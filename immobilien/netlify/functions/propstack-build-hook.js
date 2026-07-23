/*
 * Datei: netlify/functions/propstack-build-hook.js
 *
 * Zweck:
 * Propstack soll NICHT direkt den Netlify Build Hook aufrufen.
 * Stattdessen ruft Propstack diese Function auf.
 *
 * Diese Function prüft den Objektstatus.
 * Nur wenn der Status "Vermarktung" enthält, wird der echte Netlify Build Hook ausgelöst.
 *
 * WICHTIG:
 * Viele Propstack-Webhooks schicken nicht den vollständigen Objektstatus mit,
 * sondern nur eine ID oder ein reduziertes Event-Payload.
 * Deshalb versucht diese Version:
 * 1. Status direkt aus dem Webhook-Payload zu lesen
 * 2. falls kein Status vorhanden ist: Objekt per Propstack API nachzuladen
 * 3. nur bei Status "Vermarktung" den Netlify Build Hook auszulösen
 *
 * Netlify Environment Variables:
 * NETLIFY_BUILD_HOOK_URL = interner Netlify Build Hook, z.B. "Internal Website Build"
 * PROPSTACK_API_KEY = Propstack API-Key
 *
 * Optional:
 * PROPSTACK_API_BASE = https://api.propstack.de/v1
 * PROPSTACK_PUBLIC_STATUS_KEYWORDS = vermarktung
 */

const DEFAULT_PROPSTACK_BASE_URL = "https://api.propstack.de/v1";

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
  return text ? text : null;
}

function findStatus(input) {
  if (!input || typeof input !== "object") return null;

  const candidates = [
    input.status,
    input.status_name,
    input.property_status,
    input.property_status_name,
    input.marketing_status,
    input.object_status,
    input.objekt_status,

    input.custom_fields?.status,
    input.custom_fields?.objekt_status,

    input.data?.status,
    input.data?.status_name,
    input.data?.property_status,
    input.data?.property_status_name,
    input.data?.marketing_status,
    input.data?.object_status,
    input.data?.objekt_status,
    input.data?.custom_fields?.status,
    input.data?.custom_fields?.objekt_status,

    input.unit?.status,
    input.unit?.status_name,
    input.unit?.property_status,
    input.unit?.property_status_name,
    input.unit?.marketing_status,
    input.unit?.object_status,
    input.unit?.objekt_status,
    input.unit?.custom_fields?.status,
    input.unit?.custom_fields?.objekt_status,

    input.object?.status,
    input.object?.status_name,
    input.object?.property_status,
    input.object?.property_status_name,
    input.object?.marketing_status,
    input.object?.object_status,
    input.object?.objekt_status,
    input.object?.custom_fields?.status,
    input.object?.custom_fields?.objekt_status,

    input.property?.status,
    input.property?.status_name,
    input.property?.property_status,
    input.property?.property_status_name,
    input.property?.marketing_status,
    input.property?.custom_fields?.status,
    input.property?.custom_fields?.objekt_status
  ];

  for (const candidate of candidates) {
    const status = textValue(candidate);
    if (status) return status;
  }

  return null;
}

function findObjectId(input) {
  if (!input || typeof input !== "object") return null;

  const candidates = [
    input.unit_id,
    input.unitId,
    input.property_id,
    input.propertyId,
    input.object_id,
    input.objectId,
    input.real_estate_id,
    input.realEstateId,
    input.id,

    input.data?.unit_id,
    input.data?.unitId,
    input.data?.property_id,
    input.data?.propertyId,
    input.data?.object_id,
    input.data?.objectId,
    input.data?.real_estate_id,
    input.data?.realEstateId,
    input.data?.id,

    input.unit?.id,
    input.object?.id,
    input.property?.id
  ];

  for (const candidate of candidates) {
    const value = textValue(candidate);
    if (value) return value;
  }

  return null;
}

function getAllowedKeywords() {
  return String(process.env.PROPSTACK_PUBLIC_STATUS_KEYWORDS || "vermarktung")
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function statusAllowsBuild(status) {
  const normalizedStatus = normalizeText(status);
  if (!normalizedStatus) return false;

  return getAllowedKeywords().some((keyword) => normalizedStatus.includes(keyword));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

async function fetchPropstackUnit(unitId) {
  const apiKey = process.env.PROPSTACK_API_KEY;
  if (!apiKey || !unitId) return null;

  const baseUrl = (process.env.PROPSTACK_API_BASE || DEFAULT_PROPSTACK_BASE_URL).replace(/\/$/, "");

  const endpoints = [
    `${baseUrl}/units/${encodeURIComponent(unitId)}?expand=1`,
    `${baseUrl}/properties/${encodeURIComponent(unitId)}?expand=1`,
    `${baseUrl}/units?expand=1`
  ];

  for (const url of endpoints) {
    try {
      const result = await fetchJson(url, {
        headers: {
          "X-API-KEY": apiKey,
          "Accept": "application/json"
        }
      });

      if (!result.ok) {
        console.log("Propstack Nachladen fehlgeschlagen:", url, result.status);
        continue;
      }

      const data = result.data;

      if (Array.isArray(data)) {
        const found = data.find((item) => String(item?.id) === String(unitId));
        if (found) return found;
      }

      if (Array.isArray(data.data)) {
        const found = data.data.find((item) => String(item?.id) === String(unitId));
        if (found) return found;
      }

      if (Array.isArray(data.units)) {
        const found = data.units.find((item) => String(item?.id) === String(unitId));
        if (found) return found;
      }

      if (data.unit) return data.unit;
      if (data.property) return data.property;
      if (data.data && !Array.isArray(data.data)) return data.data;
      if (data.id) return data;
    } catch (error) {
      console.log("Propstack Nachladen Exception:", url, error.message);
    }
  }

  return null;
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: "Method Not Allowed"
    };
  }

  let payload = {};

  if (event.httpMethod === "POST") {
    try {
      payload = event.body ? JSON.parse(event.body) : {};
    } catch (error) {
      console.log("Invalid JSON payload:", event.body);
      return {
        statusCode: 400,
        body: "Invalid JSON payload"
      };
    }
  } else {
    payload = event.queryStringParameters || {};
  }

  const payloadStatus = findStatus(payload);
  const objectId = findObjectId(payload);

  let status = payloadStatus;
  let loadedFromApi = false;

  if (!status && objectId) {
    const unit = await fetchPropstackUnit(objectId);
    const apiStatus = findStatus(unit);

    if (apiStatus) {
      status = apiStatus;
      loadedFromApi = true;
    }

    console.log("Propstack Objekt nachgeladen:", {
      objectId,
      loadedFromApi,
      status: status || null
    });
  }

  const shouldBuild = statusAllowsBuild(status);

  if (!shouldBuild) {
    console.log("Propstack Build übersprungen:", {
      objectId: objectId || null,
      status: status || null,
      payloadStatus: payloadStatus || null,
      loadedFromApi
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        skipped: true,
        reason: "Objekt ist nicht im öffentlichen Vermarktungsstatus oder Status konnte nicht erkannt werden.",
        objectId: objectId || null,
        status: status || null,
        loadedFromApi
      })
    };
  }

  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;

  if (!buildHookUrl) {
    return {
      statusCode: 500,
      body: "NETLIFY_BUILD_HOOK_URL fehlt."
    };
  }

  const response = await fetch(buildHookUrl, {
    method: "POST"
  });

  console.log("Netlify Build Hook ausgelöst:", {
    objectId: objectId || null,
    status,
    loadedFromApi,
    netlifyStatus: response.status
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      ok: true,
      skipped: false,
      reason: "Objekt ist öffentlich vermarktbar. Build wurde ausgelöst.",
      objectId: objectId || null,
      status,
      loadedFromApi,
      netlifyStatus: response.status
    })
  };
};
