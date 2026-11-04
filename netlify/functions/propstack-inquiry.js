const nodemailer = require("nodemailer");
const logsafe = require("./_shared/logsafe");
const zustellung = require("./_shared/zustellung");

const PROPSTACK_BASE_URL = require("./_shared/propstack-basis").basis();

exports.handler = async function (event) {
  // Update 31 §3: keine Personendaten ins Log
  const requestId = logsafe.requestId(event);
  try {
    console.log("PROPSTACK INQUIRY START", { requestId, method: event.httpMethod });

    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;

    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    console.log("INQUIRY EINGANG:", { requestId, form: "objektanfrage", felder: Object.keys(data).length });

    const firstName = clean(data.first_name || data.firstName);
    const lastName = clean(data.last_name || data.lastName);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const message = clean(data.message);
    const contactPreference = clean(
      data.contact_preference || data.contactPreference
    );
    const objectId = clean(data.object_id || data.propertyId);
    const objectTitle = clean(data.object_title || data.propertyTitle);
    const sourceUrl = clean(data.source_url || data.url);

    const privacyConsent =
      data.privacy_consent === true ||
      data.privacy_consent === "true" ||
      data.datenschutz === true ||
      data.datenschutz === "true" ||
      data.consent === true ||
      data.consent === "true" ||
      data.privacy === "zugestimmt";

    // Update 32 §7.2: Einwilligung auch auf dem Server prüfen, nicht nur im Browser
    if (!firstName || !lastName || !email || !objectId || !privacyConsent) {
      console.log("VALIDATION FAILED:", { requestId, form: "objektanfrage", missing: logsafe.missing({ firstName, lastName, email, objectId, privacyConsent }, ["firstName", "lastName", "email", "objectId", "privacyConsent"]) });
      return zustellung.oeffentlich(400, { success: false, error: "Pflichtfelder oder Datenschutz-Einwilligung fehlen." });
    }

    const fullName = `${firstName} ${lastName}`.trim();

    const note = buildNote({
      firstName,
      lastName,
      fullName,
      email,
      phone,
      message,
      contactPreference,
      objectId,
      objectTitle,
      sourceUrl,
      privacyConsent,
    });

    console.log("Neue Objektanfrage:", { requestId, objectId });

    // 1) Mail senden. Update 32 §7.2: Ein Mailfehler hält den Kontakt in Propstack nicht mehr auf.
    let portalMailResult;
    try {
      portalMailResult = await sendPropstackPortalInquiryMail({
        firstName,
        lastName,
        fullName,
        email,
        phone,
        message,
        contactPreference,
        objectId,
        objectTitle,
        sourceUrl,
        privacyConsent,
      });
    } catch (error) {
      console.error("PORTAL MAIL ERROR:", { requestId, ...logsafe.error(error) });
      portalMailResult = { sent: false };
    }
    console.log("Portal-Mail Ergebnis:", { requestId, sent: Boolean(portalMailResult && portalMailResult.sent) });

    // Update 32 §1: Rücklesen nach jedem Schreiben, Rückfall-Mail wenn etwas fehlt (_shared/zustellung.js)
    const api = zustellung.propstack(apiKey, PROPSTACK_BASE_URL);
    const formular = "propstack-inquiry (Objektanfrage)";
    const prot = zustellung.protokoll(api, formular, requestId);

    // 2) Kontakt in Propstack
    let contactId = null;
    try {
      const contactResponse = await createContact(apiKey, { firstName, lastName, fullName, email, phone, note, contactPreference });
      contactId = await prot.pruefen("Kontakt", extractId(contactResponse), { endpoint: "/contacts" });
    } catch (error) {
      prot.fehlgeschlagen("Kontakt", "/contacts", error);
    }

    if (contactId) {
      console.log("Kontakt erstellt:", { requestId, contactId });

      // 3) Objekt lesen: Kauf oder Miete, Ansprechpartner. Update 32 §7.2: Mietobjekte in die Pipeline „300 Mieter“,
      //    nicht mehr in „200 Käufer“.
      let unit = null;
      try {
        unit = await propstackGet(apiKey, `/units/${encodeURIComponent(objectId)}`);
      } catch (error) {
        console.warn("OBJEKT LESEN FEHLGESCHLAGEN:", { requestId, ...logsafe.error(error) });
      }
      const isRent = String((unit && unit.marketing_type) || "").toUpperCase() === "RENT";
      const brokerId = unit && unit.broker_id ? unit.broker_id : undefined;

      // 4) Deal
      try {
        const stage = isRent ? await findStage(apiKey, "mieter", ["neuer mietinteressent", "mietinteressent"]) : await findBestBuyerDealStage(apiKey);
        if (!stage || !stage.id) throw new Error("Keine Deal-Phase gefunden");
        console.log("Deal-Stage gefunden:", { requestId, id: stage.id, pipeline: stage.pipeline_name });
        const dealResponse = await createDeal(apiKey, { contactId, objectId, stageId: stage.id, note });
        await prot.pruefen("Deal", zustellung.idAus(dealResponse), { endpoint: "/client_properties" });
      } catch (error) {
        prot.fehlgeschlagen("Deal", "/client_properties", error);
      }

      // 5) Update 32 §7.2: Aufgabe für den Ansprechpartner des Objekts (broker_id des Objekts, sonst ohne Zuweisung)
      try {
        const taskResponse = await propstackPost(apiKey, "/tasks", {
          task: removeEmpty({
            title: `Objektanfrage prüfen: ${objectTitle || objectId} – ${fullName}`,
            body: note,
            is_reminder: true,
            due_date: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            client_ids: [contactId],
            property_ids: /^\d+$/.test(objectId) ? [Number(objectId)] : undefined,
            broker_id: brokerId,
          }),
        });
        await prot.pruefen("Aufgabe", zustellung.idAus(taskResponse), { endpoint: "/tasks" });
      } catch (error) {
        prot.fehlgeschlagen("Aufgabe", "/tasks", error);
      }
    }

    // Update 32 §1.2: Fehlt ein Teil, geht die ganze Anfrage zusätzlich als Rückfall-Mail an das Postfach.
    let fallback = { sent: false, skipped: true };
    if (prot.fehlend().length) {
      fallback = await zustellung.rueckfallMail({ formular, requestId, text: note, replyTo: email, protokoll: prot });
    }

    if (!contactId && !portalMailResult.sent && !fallback.sent) {
      return zustellung.oeffentlich(502, { success: false, error: "Die Anfrage konnte gerade nicht gesendet werden." });
    }

    // Antwort an den Browser: nur success und message
    return zustellung.oeffentlich(200, { success: true, message: "Objektanfrage erfolgreich übermittelt." });
  } catch (error) {
    console.error("PROPSTACK INQUIRY ERROR:", { requestId, ...logsafe.error(error) });
    return zustellung.oeffentlich(500, { success: false, error: "Die Anfrage konnte gerade nicht gesendet werden." });
  }
};

async function sendPropstackPortalInquiryMail(payload) {
  const smtpHost = clean(process.env.SMTP_HOST || "smtp.office365.com");
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = clean(process.env.SMTP_USER);
  const smtpPass = process.env.SMTP_PASS;
  const from = clean(process.env.MAIL_FROM || smtpUser);
  const to = clean(
    process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL || "info@fg-realestate.de"
  );

  if (!smtpUser || !smtpPass) {
    return {
      sent: false,
      skipped: true,
      reason: "SMTP_USER oder SMTP_PASS fehlt",
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    requireTLS: true,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      ciphers: "TLSv1.2",
    },
  });

  console.log("SMTP TRANSPORT READY");

  const subject = `Neue Objektanfrage: ${payload.objectTitle || payload.objectId}`;
  const html = buildPropstackInquiryHtml(payload);
  const text = buildPlainTextInquiry(payload);

  const mailResult = await transporter.sendMail({
    from,
    to,
    replyTo: payload.email || undefined,
    subject,
    html,
    text,
  });

  console.log("MAIL SENT:", mailResult.messageId);

  return {
    sent: true,
    to,
    from,
    subject,
    messageId: mailResult.messageId,
  };
}

function buildNote(payload) {
  return [
    "Neue Objektanfrage über die Website",
    "",
    `Objekt: ${payload.objectTitle || "-"}`,
    `Objekt-ID / Unit-ID: ${payload.objectId}`,
    `Name: ${payload.fullName}`,
    `E-Mail: ${payload.email}`,
    `Telefon: ${payload.phone || "-"}`,
    `Kontaktwunsch: ${payload.contactPreference || "-"}`,
    "",
    "Nachricht:",
    payload.message || "-",
    "",
    "Einwilligung:",
    payload.privacyConsent
      ? "Datenschutz-Einwilligung wurde aktiv bestätigt."
      : "Keine gesonderte Datenschutz-Info im Payload erkannt.",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${payload.sourceUrl || "-"}`,
  ].join("\n");
}

function buildPlainTextInquiry(payload) {
  return `
Neue Objektanfrage über die Website

Objekt: ${payload.objectTitle || "-"}
Objekt-ID / Unit-ID: ${payload.objectId}

Name: ${payload.fullName}
E-Mail: ${payload.email}
Telefon: ${payload.phone || "-"}
Kontaktwunsch: ${payload.contactPreference || "-"}

Nachricht:
${payload.message || "-"}

Einwilligung:
${
  payload.privacyConsent
    ? "Datenschutz-Einwilligung wurde aktiv bestätigt."
    : "Keine gesonderte Datenschutz-Info im Payload erkannt."
}

Quelle:
${payload.sourceUrl || "-"}

Zeitpunkt:
${new Date().toISOString()}
`;
}

function buildPropstackInquiryHtml(payload) {
  const safeMessage = escapeHtml(payload.message || "-");
  const safeObjectTitle = escapeHtml(payload.objectTitle || "-");
  const safeSourceUrl = escapeHtml(payload.sourceUrl || "-");

  return `
<div id="ps-kontaktanfrage">
    <p><strong>Neue Objektanfrage über die Website</strong></p>

    <p>
        <strong>Objekt:</strong> ${safeObjectTitle}<br>
        <strong>Objekt-ID:</strong> ${escapeHtml(payload.objectId)}<br>
        <strong>Name:</strong> ${escapeHtml(payload.fullName)}<br>
        <strong>E-Mail:</strong> ${escapeHtml(payload.email)}<br>
        <strong>Telefon:</strong> ${escapeHtml(payload.phone || "-")}<br>
        <strong>Kontaktwunsch:</strong> ${escapeHtml(payload.contactPreference || "-")}
    </p>

    <p>
        <strong>Nachricht:</strong><br>
        ${safeMessage.replace(/\n/g, "<br>")}
    </p>

    <p>
        <strong>Einwilligung:</strong><br>
        ${
          payload.privacyConsent
            ? "Datenschutz-Einwilligung wurde aktiv bestätigt."
            : "Keine gesonderte Datenschutz-Info im Payload erkannt."
        }
    </p>

    <p>
        <strong>Quelle:</strong><br>
        ${safeSourceUrl}
    </p>

    <span id="client_first_name">${escapeHtml(payload.firstName)}</span>
    <span id="client_last_name">${escapeHtml(payload.lastName)}</span>
    <span id="client_name">${escapeHtml(payload.fullName)}</span>
    <span id="client_email">${escapeHtml(payload.email)}</span>
    <span id="client_phone">${escapeHtml(payload.phone || "")}</span>
    <span id="property_id">${escapeHtml(payload.objectId)}</span>
    <span id="unit_id">${escapeHtml(payload.objectId)}</span>
    <span id="body">${safeMessage}</span>
    <span id="message">${safeMessage}</span>
    <span id="source">Website Objektanfrage</span>
</div>
`;
}

async function createContact(apiKey, payload) {
  return await propstackPost(apiKey, "/contacts", {
    client: removeEmpty({
      first_name: payload.firstName,
      last_name: payload.lastName,
      name: payload.fullName,
      email: payload.email,
      phone: payload.phone || "",
      note: payload.note,
      source: "Website Objektanfrage",
      buyer: true,
      partial_custom_fields: removeEmpty({
        website_lead: true,
        landingpage_typ: "Kauf",
        finanzierungsberatung_gewunscht: "",
        suchgebiet: "",
        objektadresse: "",
        budget: "",
        zeitrahmen: "",
        offmarket_geeignet: false,
      }),
    }),
  });
}

async function createDeal(apiKey, payload) {
  return await propstackPost(apiKey, "/client_properties", {
    client_property: removeEmpty({
      client_id: payload.contactId,
      contact_id: payload.contactId,
      property_id: payload.objectId,
      unit_id: payload.objectId,
      deal_stage_id: payload.stageId,
      note: payload.note,
      source: "Website Objektanfrage",
    }),
  });
}

// Update 32 §7.2: Phase in einer Pipeline, deren Name den Begriff enthält (z. B. „mieter“ → „300 Mieter“)
async function findStage(apiKey, pipelineTerm, stageNames) {
  const pipelines = normalizeArray(await propstackGet(apiKey, "/deal_pipelines"));
  const pipeline = pipelines.find((p) => normalizeText(p.name || p.title || "").includes(pipelineTerm));
  if (!pipeline) return null;
  const stages = (pipeline.deal_stages || pipeline.stages || []).map((stage) => ({ id: stage.id, name: stage.name || "", pipeline_id: pipeline.id, pipeline_name: pipeline.name || "" }));
  for (const name of stageNames) {
    const found = stages.find((stage) => normalizeText(stage.name) === name);
    if (found) return found;
  }
  return stages[0] || null;
}

async function findBestBuyerDealStage(apiKey) {
  const pipelinesResponse = await propstackGet(apiKey, "/deal_pipelines");
  const pipelines = normalizeArray(pipelinesResponse);

  const allStages = [];

  for (const pipeline of pipelines) {
    const pipelineName = pipeline.name || pipeline.title || pipeline.label || "";

    const stages =
      pipeline.deal_stages ||
      pipeline.stages ||
      pipeline.client_property_stages ||
      [];

    for (const stage of stages) {
      allStages.push({
        id: stage.id,
        name: stage.name || stage.title || stage.label || "",
        pipeline_id: pipeline.id,
        pipeline_name: pipelineName,
        raw: stage,
      });
    }
  }

  console.log(
    "Gefundene Deal-Stages:",
    allStages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      pipeline_id: stage.pipeline_id,
      pipeline_name: stage.pipeline_name,
    }))
  );

  const buyerStages = allStages.filter((stage) => {
    const combined = normalizeText(`${stage.pipeline_name} ${stage.name}`);

    const isBuyerPipeline =
      combined.includes("200 kaufer") ||
      combined.includes("200 kaeufer") ||
      combined.includes("kaeufer") ||
      combined.includes("kaufer") ||
      combined.includes("kaufinteressent") ||
      combined.includes("buyer");

    const isWrongPipeline =
      combined.includes("100 eigentumer") ||
      combined.includes("100 eigentuemer") ||
      combined.includes("eigentumer") ||
      combined.includes("eigentuemer") ||
      combined.includes("verkaufer") ||
      combined.includes("verkaeufer") ||
      combined.includes("300 mieter") ||
      combined.includes("400 finanzierung");

    return isBuyerPipeline && !isWrongPipeline;
  });

  const preferredNames = [
    "neuer kaufer lead",
    "neuer kaeufer lead",
    "neuer kaufinteressent",
    "kaufinteressent",
    "unqualifiziert",
    "qualifiziert",
  ];

  for (const preferredName of preferredNames) {
    const exact = buyerStages.find(
      (stage) => normalizeText(stage.name) === preferredName
    );
    if (exact) return exact;
  }

  for (const preferredName of preferredNames) {
    const partial = buyerStages.find((stage) =>
      normalizeText(`${stage.pipeline_name} ${stage.name}`).includes(
        preferredName
      )
    );
    if (partial) return partial;
  }

  if (buyerStages.length) return buyerStages[0];

  throw new Error(
    "Keine Käufer-Stage gefunden. Bitte Pipeline 200 Käufer prüfen oder API-Rechte für Deal-Pipelines aktivieren."
  );
}

async function propstackGet(apiKey, endpoint) {
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "GET",
    redirect: "manual",
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
    },
  });

  return await parsePropstackResponse(response, endpoint);
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", logsafe.endpoint(endpoint));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    // Dringend-Fix 02.11.: Schreibanfragen folgen keiner Umleitung (sonst wird aus POST ein GET)
    redirect: "manual",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return await parsePropstackResponse(response, endpoint);
}

async function parsePropstackResponse(response, endpoint) {
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  console.log("PROPSTACK RESPONSE:", logsafe.endpoint(endpoint), response.status);

  if (!response.ok) {
    throw logsafe.propstackError(response.status, endpoint, data);
  }

  return data;
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.deal_pipelines)) return value.deal_pipelines;
  if (Array.isArray(value?.pipelines)) return value.pipelines;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
}

function extractId(response) {
  return (
    response?.client?.id ||
    response?.contact?.id ||
    response?.id ||
    response?.data?.id ||
    null
  );
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeText(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeEmpty(object) {
  const result = {};

  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (
      Object.prototype.toString.call(value) === "[object Object]" &&
      Object.keys(value).length === 0
    ) {
      continue;
    }

    result[key] = value;
  }

  return result;
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

// Formulare ohne JavaScript (Update 6, §1): POST als Formular → gleiche Nutzlast, dann Weiterleitung. Siehe _shared/formpost.js.
exports.handler = require("./_shared/formpost").wrap("propstack-inquiry", exports.handler);
