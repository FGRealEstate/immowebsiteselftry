/*
 * Intelligenter Propstack -> Netlify Build-Webhook
 *
 * Ziele:
 * 1. Keine Builds für Einheiten, deren übergeordnetes Projekt NICHT auf
 *    "Vermarktung" steht.
 * 2. Ein Build wird ausgelöst, wenn ein veröffentlichtes Objekt/Projekt
 *    online geht, geändert wird oder den öffentlichen Status verlässt.
 * 3. Doppelte Propstack-Events werden innerhalb eines kurzen Zeitfensters
 *    zu einem einzigen Netlify-Build zusammengefasst.
 *
 * Erforderliche Environment Variables:
 * - NETLIFY_BUILD_HOOK_URL
 * - PROPSTACK_API_KEY
 *
 * Optional:
 * - PROPSTACK_API_BASE=https://api.propstack.de/v1
 * - PROPSTACK_PUBLIC_STATUS_KEYWORDS=vermarktung
 * - PROPSTACK_PUBLIC_PROJECT_STATUS_KEYWORDS=vermarktung,im angebot
 * - PROPSTACK_BUILD_DEBOUNCE_SECONDS=60
 */

const DEFAULT_PROPSTACK_BASE_URL = "https://api.propstack.de/v1";
const STORE_NAME = "propstack-build-state";

function normalizeText(input) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isPlainObject(input) {
  return Object.prototype.toString.call(input) === "[object Object]";
}

function textValue(input) {
  if (input === null || input === undefined) return null;
  if (isPlainObject(input)) {
    return (
      textValue(input.pretty_value) ||
      textValue(input.value) ||
      textValue(input.name) ||
      textValue(input.label) ||
      textValue(input.title) ||
      null
    );
  }
  const text = String(input).trim();
  return text || null;
}

function getAllowedKeywords(entityType = "unit") {
  const fallback = entityType === "project" ? "vermarktung,im angebot" : "vermarktung";
  const environmentValue = entityType === "project"
    ? process.env.PROPSTACK_PUBLIC_PROJECT_STATUS_KEYWORDS
    : process.env.PROPSTACK_PUBLIC_STATUS_KEYWORDS;

  return String(environmentValue || fallback)
    .split(",")
    .map(normalizeText)
    .filter(Boolean);
}

function isPublicStatus(status, entityType = "unit") {
  const normalized = normalizeText(status);
  return Boolean(normalized) && getAllowedKeywords(entityType).some((key) => normalized.includes(key));
}

function findStatus(input) {
  if (!input || typeof input !== "object") return null;
  const paths = [
    input.status, input.status_name, input.property_status, input.property_status_name,
    input.project_status, input.project_status_name, input.marketing_status,
    input.marketing_state, input.object_status, input.objekt_status,
    input.custom_fields?.status, input.custom_fields?.objekt_status,
    input.custom_fields?.projekt_status,
    input.data?.status, input.data?.status_name, input.data?.property_status,
    input.data?.property_status_name, input.data?.project_status,
    input.data?.project_status_name, input.data?.marketing_status,
    input.data?.object_status, input.data?.objekt_status,
    input.data?.custom_fields?.status, input.data?.custom_fields?.objekt_status,
    input.data?.custom_fields?.projekt_status,
    input.unit?.status, input.unit?.status_name, input.unit?.property_status,
    input.unit?.property_status_name, input.unit?.marketing_status,
    input.unit?.object_status, input.unit?.objekt_status,
    input.object?.status, input.object?.status_name, input.object?.property_status,
    input.object?.property_status_name, input.object?.marketing_status,
    input.property?.status, input.property?.status_name, input.property?.property_status,
    input.property?.property_status_name, input.property?.marketing_status,
    input.project?.status, input.project?.status_name, input.project?.project_status,
    input.project?.project_status_name, input.project?.marketing_status,
    input.development?.status, input.development?.status_name,
    input.development?.project_status, input.development?.marketing_status
  ];
  for (const candidate of paths) {
    const value = textValue(candidate);
    if (value) return value;
  }
  return null;
}

function findPreviousStatus(input) {
  if (!input || typeof input !== "object") return null;
  const candidates = [
    input.previous_status, input.old_status, input.status_before,
    input.previous?.status, input.previous?.status_name,
    input.before?.status, input.before?.status_name,
    input.changes?.status?.old, input.changes?.status?.from,
    input.data?.previous_status, input.data?.old_status,
    input.data?.previous?.status, input.data?.before?.status,
    input.data?.changes?.status?.old, input.data?.changes?.status?.from
  ];
  for (const candidate of candidates) {
    const value = textValue(candidate);
    if (value) return value;
  }
  return null;
}

function findEntityId(input) {
  if (!input || typeof input !== "object") return null;
  const candidates = [
    input.project_id, input.projectId, input.development_id, input.developmentId,
    input.unit_id, input.unitId, input.property_id, input.propertyId,
    input.object_id, input.objectId, input.real_estate_id, input.realEstateId,
    input.id,
    input.data?.project_id, input.data?.projectId, input.data?.development_id,
    input.data?.developmentId, input.data?.unit_id, input.data?.unitId,
    input.data?.property_id, input.data?.propertyId, input.data?.object_id,
    input.data?.objectId, input.data?.real_estate_id, input.data?.realEstateId,
    input.data?.id,
    input.project?.id, input.development?.id, input.unit?.id,
    input.object?.id, input.property?.id
  ];
  for (const candidate of candidates) {
    const value = textValue(candidate);
    if (value) return value;
  }
  return null;
}

function detectEntityHint(payload) {
  const explicit = textValue(
    payload.entity_type || payload.entityType || payload.resource_type ||
    payload.resourceType || payload.model || payload.type || payload.event ||
    payload.event_type || payload.eventType || payload.data?.type
  );
  const normalized = normalizeText(explicit);
  if (/project|development|propertyproject|projekt/.test(normalized)) return "project";
  if (/unit|property|realestate|object|objekt|wohnung/.test(normalized)) return "unit";
  if (payload.project || payload.development || payload.project_id || payload.development_id) return "project";
  if (payload.unit || payload.property || payload.object || payload.unit_id || payload.property_id) return "unit";
  return null;
}

function unwrapOne(data, keys) {
  if (!data) return null;
  for (const key of keys) {
    if (isPlainObject(data[key])) return data[key];
  }
  if (isPlainObject(data.data)) return data.data;
  if (isPlainObject(data) && data.id !== undefined) return data;
  return null;
}

async function fetchJson(url, apiKey) {
  try {
    const response = await fetch(url, {
      headers: { "X-API-KEY": apiKey, Accept: "application/json" }
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error.message };
  }
}

function baseUrl() {
  return (process.env.PROPSTACK_API_BASE || DEFAULT_PROPSTACK_BASE_URL).replace(/\/$/, "");
}

async function fetchUnit(id) {
  const apiKey = process.env.PROPSTACK_API_KEY;
  if (!apiKey || !id) return null;
  const endpoints = [
    `${baseUrl()}/units/${encodeURIComponent(id)}?expand=1`,
    `${baseUrl()}/properties/${encodeURIComponent(id)}?expand=1`
  ];
  for (const url of endpoints) {
    const result = await fetchJson(url, apiKey);
    if (!result.ok) continue;
    const item = unwrapOne(result.data, ["unit", "property", "object"]);
    if (item) return item;
  }
  return null;
}

async function fetchProject(id) {
  const apiKey = process.env.PROPSTACK_API_KEY;
  if (!apiKey || !id) return null;
  const custom = process.env.PROPSTACK_PROJECTS_API_URL;
  const endpoints = custom
    ? [`${custom.replace(/\/$/, "")}/${encodeURIComponent(id)}?expand=1`]
    : [
        `${baseUrl()}/projects/${encodeURIComponent(id)}?expand=1`,
        `${baseUrl()}/property_projects/${encodeURIComponent(id)}?expand=1`,
        `${baseUrl()}/developments/${encodeURIComponent(id)}?expand=1`
      ];
  for (const url of endpoints) {
    const result = await fetchJson(url, apiKey);
    if (!result.ok) continue;
    const item = unwrapOne(result.data, ["project", "property_project", "development"]);
    if (item) return item;
  }
  return null;
}

function getProjectRef(unit) {
  if (!unit) return null;
  const nested = [unit.project, unit.property_project, unit.development, unit.parent_project];
  for (const project of nested) {
    if (!isPlainObject(project)) continue;
    const id = textValue(project.id || project.uuid || project.project_id);
    if (id) return { id, raw: project };
  }
  const id = textValue(
    unit.project_id || unit.property_project_id || unit.development_id ||
    unit.parent_project_id || unit.custom_fields?.project_id ||
    unit.custom_fields?.projekt_id
  );
  return id ? { id, raw: null } : null;
}

async function resolveEntity(payload) {
  const id = findEntityId(payload);
  const hint = detectEntityHint(payload);
  if (!id) return { type: hint || "unknown", id: null, raw: null };

  if (hint === "project") {
    const project = await fetchProject(id);
    if (project) return { type: "project", id, raw: project };
  }
  if (hint === "unit") {
    const unit = await fetchUnit(id);
    if (unit) return { type: "unit", id, raw: unit };
  }

  // Ohne verlässlichen Typ zuerst Einheit, anschließend Projekt prüfen.
  const unit = await fetchUnit(id);
  if (unit) return { type: "unit", id, raw: unit };
  const project = await fetchProject(id);
  if (project) return { type: "project", id, raw: project };

  return { type: hint || "unknown", id, raw: null };
}

function debounceSeconds() {
  const value = Number(process.env.PROPSTACK_BUILD_DEBOUNCE_SECONDS || 60);
  return Number.isFinite(value) && value >= 0 ? value : 60;
}

async function readState(store, key) {
  try {
    return await store.get(key, { type: "json", consistency: "strong" });
  } catch (error) {
    console.warn("Build-State konnte nicht gelesen werden:", key, error.message);
    return null;
  }
}

async function writeState(store, key, value) {
  try {
    await store.setJSON(key, value);
  } catch (error) {
    console.warn("Build-State konnte nicht gespeichert werden:", key, error.message);
  }
}

async function triggerBuildOnce(store, details) {
  const now = Date.now();
  const last = await readState(store, "global/last-build");
  const minDistance = debounceSeconds() * 1000;

  if (last?.timestamp && now - Number(last.timestamp) < minDistance) {
    return {
      triggered: false,
      debounced: true,
      secondsSinceLastBuild: Math.round((now - Number(last.timestamp)) / 1000)
    };
  }

  const url = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!url) throw new Error("NETLIFY_BUILD_HOOK_URL fehlt.");

  // Vor dem Request speichern, damit nahezu gleichzeitige Events abgefangen werden.
  await writeState(store, "global/last-build", { timestamp: now, details });

  const response = await fetch(url, { method: "POST" });
  if (!response.ok) {
    // Bei Fehler Sperre entfernen, damit erneut versucht werden kann.
    try { await store.delete("global/last-build"); } catch {}
    throw new Error(`Netlify Build Hook antwortete mit Status ${response.status}.`);
  }

  return { triggered: true, debounced: false, netlifyStatus: response.status };
}

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

exports.handler = async function handler(event) {
  if (!["POST", "GET"].includes(event.httpMethod)) {
    return jsonResponse(405, { ok: false, error: "Method Not Allowed" });
  }

  let payload = {};
  try {
    payload = event.httpMethod === "POST"
      ? (event.body ? JSON.parse(event.body) : {})
      : (event.queryStringParameters || {});
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  const { connectLambda, getStore } = await import("@netlify/blobs");
  connectLambda(event);
  const store = getStore({ name: STORE_NAME, consistency: "strong" });
  const entity = await resolveEntity(payload);
  const payloadStatus = findStatus(payload);
  const previousPayloadStatus = findPreviousStatus(payload);

  if (!entity.id || !entity.raw) {
    console.log("Propstack Event übersprungen: Entität konnte nicht sicher nachgeladen werden.", {
      hint: entity.type,
      id: entity.id,
      payload
    });
    return jsonResponse(200, {
      ok: true,
      skipped: true,
      reason: "Entität konnte nicht sicher aus der Propstack API nachgeladen werden.",
      entityType: entity.type,
      entityId: entity.id
    });
  }

  let currentVisible = false;
  let projectId = null;
  let projectStatus = null;
  let ownStatus = findStatus(entity.raw) || payloadStatus;
  let reason = "";

  if (entity.type === "project") {
    currentVisible = isPublicStatus(ownStatus, "project");
    projectId = entity.id;
    projectStatus = ownStatus;
    reason = currentVisible
      ? "Projekt ist öffentlich (z. B. „Im Angebot“). Projektänderung ist website-relevant."
      : "Projekt ist nicht öffentlich.";
  } else {
    const ownPublic = isPublicStatus(ownStatus);
    const ref = getProjectRef(entity.raw);

    if (ref?.id) {
      projectId = ref.id;
      const project = ref.raw || await fetchProject(ref.id);
      projectStatus = findStatus(project);
      const projectPublic = isPublicStatus(projectStatus, "project");

      // Zentraler Schalter: Ohne öffentliches Projekt sind sämtliche Einheiten unsichtbar
      // und Änderungen an diesen Einheiten lösen keinen Build aus.
      currentVisible = projectPublic && ownPublic;
      reason = projectPublic
        ? (ownPublic
            ? "Projekt ist öffentlich und Einheit ist auf Vermarktung. Änderung ist website-relevant."
            : "Projekt ist öffentlich, Einheit jedoch nicht.")
        : "Übergeordnetes Projekt ist nicht öffentlich; Einheit wird vollständig ignoriert.";
    } else {
      // Einzelobjekt außerhalb eines Projekts.
      currentVisible = ownPublic;
      reason = ownPublic
        ? "Einzelobjekt ist auf Vermarktung. Änderung ist website-relevant."
        : "Einzelobjekt ist nicht auf Vermarktung.";
    }
  }

  const stateKey = `entity/${entity.type}/${entity.id}`;
  const previousState = await readState(store, stateKey);
  const previousVisibleFromPayload = previousPayloadStatus
    ? isPublicStatus(previousPayloadStatus, entity.type === "project" ? "project" : "unit")
    : null;
  const previousVisible = previousState?.visible ?? previousVisibleFromPayload;

  await writeState(store, stateKey, {
    visible: currentVisible,
    ownStatus: ownStatus || null,
    projectId,
    projectStatus: projectStatus || null,
    updatedAt: new Date().toISOString()
  });

  let buildRequired = false;
  let buildReason = reason;

  if (entity.type === "unit" && projectId && !isPublicStatus(projectStatus, "project")) {
    // Wichtigster Credit-Schutz: Einheiten eines nicht veröffentlichten Projekts
    // verursachen NIE einen Build, unabhängig vom Status der Einheit.
    buildRequired = false;
  } else if (currentVisible) {
    // Neu online ODER Inhalt eines bereits veröffentlichten Datensatzes geändert.
    buildRequired = true;
  } else if (previousVisible === true) {
    // War zuvor online und wurde jetzt deaktiviert -> Build zum Entfernen.
    buildRequired = true;
    buildReason = "Datensatz war zuvor öffentlich und muss von der Website entfernt werden.";
  }

  if (!buildRequired) {
    console.log("Propstack Build übersprungen:", {
      entityType: entity.type,
      entityId: entity.id,
      ownStatus,
      projectId,
      projectStatus,
      currentVisible,
      previousVisible,
      reason: buildReason
    });
    return jsonResponse(200, {
      ok: true,
      skipped: true,
      reason: buildReason,
      entityType: entity.type,
      entityId: entity.id,
      ownStatus: ownStatus || null,
      projectId,
      projectStatus: projectStatus || null,
      currentVisible,
      previousVisible
    });
  }

  try {
    const trigger = await triggerBuildOnce(store, {
      entityType: entity.type,
      entityId: entity.id,
      ownStatus,
      projectId,
      projectStatus,
      reason: buildReason
    });

    console.log("Propstack Build-Entscheidung:", { ...trigger, buildReason });

    return jsonResponse(200, {
      ok: true,
      skipped: !trigger.triggered,
      reason: trigger.debounced
        ? `Build-relevante Änderung erkannt, aber mit einem bereits laufenden/gerade ausgelösten Build zusammengefasst.`
        : buildReason,
      entityType: entity.type,
      entityId: entity.id,
      ownStatus: ownStatus || null,
      projectId,
      projectStatus: projectStatus || null,
      currentVisible,
      previousVisible,
      ...trigger
    });
  } catch (error) {
    console.error("Netlify Build Hook Fehler:", error);
    return jsonResponse(500, { ok: false, error: error.message });
  }
};
