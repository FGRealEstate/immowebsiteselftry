const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
  console.log("PROPSTACK LEAD START");
  console.log("METHOD:", event.httpMethod);

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });

    const data = JSON.parse(event.body || "{}");
    console.log("PAYLOAD:", JSON.stringify(data, null, 2));

    const lead = normalizeLeadPayload(data);

    if (!lead.firstName || !lead.lastName || !lead.email || !lead.concernType || !lead.consent) {
      console.log("VALIDATION FAILED:", lead);
      return json(400, { success: false, error: "Pflichtfelder oder Datenschutz-Einwilligung fehlen." });
    }

    const note = buildNote(lead);
    const contactPayload = buildContactPayload(lead, note);
    console.log("CONTACT PAYLOAD:", JSON.stringify(contactPayload, null, 2));

    const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);
    if (!contactId) {
      return json(500, { success: false, error: "Kontakt wurde erstellt/aktualisiert, aber keine Kontakt-ID erhalten.", propstack_response: contactResponse });
    }
    console.log("CONTACT SAVED:", contactId);

    const noteResult = await safeCreateNote(apiKey, contactId, note, "Website Landingpage");

    let propertyResponse = null;
    let propertyId = null;
    const shouldCreateProperty = (lead.concernType === "sell" || lead.concernType === "rent") && lead.hasPropertyDetails;

    if (shouldCreateProperty) {
      propertyResponse = await safeCreateAcquisitionProperty(apiKey, { contactId, lead, note });
      propertyId = getId(propertyResponse, ["property", "unit", "data"]);
      console.log("PROPERTY RESULT:", propertyResponse);
    }

    const searchProfileResult = await maybeCreateSearchProfile(apiKey, contactId, lead, note);

    const stage = await findBestDealStage(apiKey, lead.concernType);
    let dealResponse = null;
    if (stage && stage.id && propertyId) {
      dealResponse = await safeCreateDeal(apiKey, { contactId, propertyId, stageId: stage.id, note });
    } else {
      dealResponse = { ok: true, skipped: true, reason: propertyId ? "Keine passende Deal-Stage gefunden." : "Kein Objekt vorhanden. Anfrage wurde als Kontakt, Notiz und ggf. Suchprofil gespeichert." };
      console.log("DEAL SKIPPED:", dealResponse.reason);
    }

    const taskResult = await safeCreateFollowUpTask(apiKey, contactId, propertyId, lead, note);
    const documentResults = lead.documents.length ? await uploadDocuments(apiKey, { contactId, propertyId, documents: lead.documents }) : [];

    return json(200, {
      success: true,
      message: "Ihre Anfrage wurde erfolgreich übermittelt.",
      contact_id: contactId,
      property_id: propertyId,
      contact: contactResponse,
      note: noteResult,
      property: propertyResponse,
      search_profile: searchProfileResult,
      deal_stage: stage,
      deal: dealResponse,
      task: taskResult,
      documents: documentResults
    });
  } catch (error) {
    console.error("PROPSTACK LEAD ERROR:", error);
    return json(500, { success: false, error: error.message, code: error.code || null, response: error.response || null });
  }
};

function normalizeLeadPayload(data) {
  const firstName = clean(data.first_name || data.firstName);
  const lastName = clean(data.last_name || data.lastName);
  const email = clean(data.email);
  const phone = clean(data.phone);
  const rawConcern = clean(data.concern || data.anliegen || data.type);
  const concernType = mapConcernType(rawConcern);
  const objectType = clean(data.object_type || data.objectType);
  const location = clean(data.location || data.address || data.ort);
  const budget = clean(data.budget);
  const budgetNumber = numberOrNull(budget);
  const timeframe = clean(data.timeframe || data.zeitrahmen);
  const contactPreference = clean(data.contact_preference || data.contactPreference) || "E-Mail";
  const message = clean(data.message || data.nachricht);
  const financingInterest = clean(data.financing_interest);
  const propertyDetailsWanted = clean(data.property_details_wanted);
  const managementTakeover = clean(data.management_takeover);
  const sourceUrl = clean(data.source_url || data.sourceUrl);
  const utmSource = clean(data.utm_source);
  const utmMedium = clean(data.utm_medium);
  const utmCampaign = clean(data.utm_campaign);
  const propertyDetails = isPlainObject(data.property_details) ? data.property_details : {};
  const documents = Array.isArray(data.documents) ? data.documents : [];
  const consent = data.privacy_consent === true || data.privacy_consent === "true" || data.privacy === "zugestimmt" || data.consent === true || data.consent === "true";
  const fullName = `${firstName} ${lastName}`.trim();
  const hasPropertyDetails = Object.values(propertyDetails).some((value) => clean(value)) || Boolean(location) || Boolean(objectType) || Boolean(budget);

  return { firstName, lastName, fullName, email, phone, rawConcern, concernType, objectType, location, budget, budgetNumber, timeframe, contactPreference, message, financingInterest, propertyDetailsWanted, managementTakeover, sourceUrl, utmSource, utmMedium, utmCampaign, propertyDetails, documents, consent, hasPropertyDetails };
}

function buildContactPayload(lead, note) {
  return {
    client: removeEmpty({
      first_name: lead.firstName,
      last_name: lead.lastName,
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone || "",
      source: "Website Landingpage",
      note,
      buyer: lead.concernType === "buy" || lead.concernType === "finance" || lead.concernType === "investment",
      owner: lead.concernType === "sell" || lead.concernType === "rent",
      newsletter: lead.concernType === "buy" || lead.concernType === "investment",
      property_mailing_wanted: lead.concernType === "buy" || lead.concernType === "investment",
      accept_contact: true,
      partial_custom_fields: removeEmpty({
        website_lead: true,
        landingpage_typ: mapLandingpageType(lead.concernType),
        anliegen: lead.rawConcern,
        immobilienart: lead.objectType,
        suchgebiet: lead.concernType === "buy" || lead.concernType === "investment" ? lead.location : undefined,
        objektadresse: lead.concernType === "sell" || lead.concernType === "rent" ? lead.location : undefined,
        budget: lead.budget,
        zeitrahmen: lead.timeframe,
        kontaktwunsch: lead.contactPreference,
        finanzierungsberatung_gewunscht: lead.concernType === "finance" ? "Ja" : lead.financingInterest,
        verwaltung_interessant: lead.concernType === "management" || Boolean(lead.managementTakeover),
        verwaltungsuebernahme_ab: lead.managementTakeover,
        property_details_wanted: lead.propertyDetailsWanted,
        offmarket_geeignet: lead.concernType === "investment",
        quelle_url: lead.sourceUrl,
        utm_source: lead.utmSource,
        utm_medium: lead.utmMedium,
        utm_campaign: lead.utmCampaign,
        newsletter_gewuenscht: lead.concernType === "buy" || lead.concernType === "investment",
        immobilienmailing_gewuenscht: lead.concernType === "buy" || lead.concernType === "investment",
        ...mapPropertyDetailsToCustomFields(lead.propertyDetails)
      })
    })
  };
}

function mapPropertyDetailsToCustomFields(details) {
  return removeEmpty({
    objektzustand: clean(details["seller-quality"]),
    wohnflache: numberOrNull(details["seller-area-value"]),
    grundstucksflache: numberOrNull(details["seller-plot-area"]),
    zimmeranzahl: numberOrNull(details["seller-rooms"]),
    baujahr: numberOrNull(details["seller-year"]),
    energieklasse: clean(details["seller-energy"]),
    balkon_oder_terrasse: clean(details["seller-balcony"]),
    balkon_terrassenflache: numberOrNull(details["seller-balcony-area"]),
    letzte_modernisierung: clean(details["seller-modernization"]),
    flaechenart: clean(details["seller-area-type"]),
    finanzierung_objekt_vorhanden: clean(details.financing_object_available),
    finanzierung_eigenkapital_notiz: clean(details.financing_equity_note),
    objekt_aus_landingpage: true,
    akquiseobjekt: true,
    unterlagen_erhalten: false
  });
}

function buildNote(lead) {
  const details = lead.propertyDetails || {};
  const detailLines = Object.entries(details).filter(([, value]) => clean(value)).map(([key, value]) => `${humanizeKey(key)}: ${clean(value)}`);
  return [
    "Neue Website-Landingpage-Anfrage",
    "",
    `Name: ${lead.fullName}`,
    `E-Mail: ${lead.email}`,
    `Telefon: ${lead.phone || "-"}`,
    `Anliegen: ${lead.rawConcern || "-"}`,
    `Lead-Typ: ${mapLandingpageType(lead.concernType)}`,
    `Immobilienart / Thema: ${lead.objectType || "-"}`,
    `Standort / Suchgebiet / Objektadresse: ${lead.location || "-"}`,
    `Budget / Preisrahmen / Preisvorstellung: ${lead.budget || "-"}`,
    `Zeitrahmen: ${lead.timeframe || "-"}`,
    `Kontaktwunsch: ${lead.contactPreference || "-"}`,
    `Interesse an Finanzierungsberatung: ${lead.financingInterest || "-"}`,
    `Weitere Objektdaten angegeben: ${lead.propertyDetailsWanted || "-"}`,
    `Verwaltungsübernahme interessant ab: ${lead.managementTakeover || "-"}`,
    `UTM Source: ${lead.utmSource || "-"}`,
    `UTM Medium: ${lead.utmMedium || "-"}`,
    `UTM Campaign: ${lead.utmCampaign || "-"}`,
    "",
    "Objektdaten / Zusatzdaten:",
    ...(detailLines.length ? detailLines : ["-"]),
    "",
    "Nachricht:",
    lead.message || "-",
    "",
    "Einwilligung:",
    "Datenschutz-Einwilligung wurde aktiv bestätigt.",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${lead.sourceUrl || "-"}`
  ].join("\n");
}

async function safeCreateNote(apiKey, contactId, body, title) {
  const payloads = [
    { note: { client_id: contactId, body, title, note_type: "note" } },
    { note: { client_id: contactId, text: body, title } }
  ];
  for (const payload of payloads) {
    try { return await propstackPost(apiKey, "/notes", payload); } catch (error) { console.warn("NOTE CREATE ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Notiz-Endpunkt nicht akzeptiert. Notiz wurde zusätzlich im Kontaktfeld gespeichert." };
}

async function safeCreateAcquisitionProperty(apiKey, input) {
  try { return await createAcquisitionProperty(apiKey, input); }
  catch (error) { console.warn("PROPERTY CREATE SKIPPED:", error.message); return { ok: false, skipped: true, reason: error.message }; }
}

async function createAcquisitionProperty(apiKey, { contactId, lead, note }) {
  const statusId = await findPropertyStatusId(apiKey, "Akquise");
  const details = lead.propertyDetails || {};
  const areaValue = numberOrNull(details["seller-area-value"]);
  const rooms = numberOrNull(details["seller-rooms"]);
  const year = numberOrNull(details["seller-year"]);
  const balconyArea = numberOrNull(details["seller-balcony-area"]);
  const plotArea = numberOrNull(details["seller-plot-area"]);
  const title = buildAcquisitionTitle(lead.objectType, lead.location);

  const property = removeEmpty({
    title,
    name: title,
    address: lead.location,
    city: extractCity(lead.location),
    marketing_type: lead.concernType === "rent" ? "RENT" : "BUY",
    object_type: "LIVING",
    rs_type: mapRsType(lead.objectType),
    living_space: areaValue,
    property_space_value: areaValue,
    number_of_rooms: rooms,
    construction_year: year,
    energy_efficiency_class: clean(details["seller-energy"]),
    balcony: boolFromGerman(details["seller-balcony"]),
    balcony_area: balconyArea,
    plot_area: plotArea,
    furnishing_quality: clean(details["seller-quality"]),
    last_modernization: clean(details["seller-modernization"]),
    note,
    internal_note: note,
    property_status_id: statusId,
    status_id: statusId,
    relationships_attributes: [{ internal_name: "owner", related_client_id: contactId }],
    partial_custom_fields: removeEmpty({ ...mapPropertyDetailsToCustomFields(details), objekt_aus_landingpage: true, akquiseobjekt: true })
  });

  const attempts = [
    { property },
    { unit: property },
    { property: removeKeys(property, ["status_id"]) },
    { property: removeKeys(property, ["property_status_id", "status_id"]) }
  ];

  let lastError;
  for (const payload of attempts) {
    try { return await propstackPost(apiKey, "/units", payload); }
    catch (error) { lastError = error; console.warn("PROPERTY CREATE ATTEMPT FAILED:", error.message); }
  }
  throw lastError;
}

async function maybeCreateSearchProfile(apiKey, contactId, lead, note) {
  const shouldCreate = lead.concernType === "buy" || lead.concernType === "investment" || lead.concernType === "finance";
  if (!shouldCreate) return { ok: true, skipped: true, reason: "Für diesen Lead-Typ kein Suchprofil erforderlich." };

  const payload = {
    saved_query: removeEmpty({
      client_id: contactId,
      active: true,
      marketing_type: "BUY",
      cities: lead.location ? [extractCity(lead.location)] : [],
      regions: lead.location ? [lead.location] : [],
      price_to: lead.budgetNumber,
      rs_types: [mapRsType(lead.objectType)],
      note
    })
  };

  try { return await propstackPost(apiKey, "/saved_queries", payload); }
  catch (error) { console.warn("SEARCH PROFILE CREATE SKIPPED:", error.message); return { ok: false, skipped: true, reason: error.message, payload }; }
}

async function safeCreateDeal(apiKey, input) {
  try { return await createDeal(apiKey, input); }
  catch (error) { console.warn("DEAL CREATE SKIPPED:", error.message); return { ok: false, skipped: true, reason: error.message }; }
}

async function createDeal(apiKey, input) {
  return await propstackPost(apiKey, "/client_properties", {
    client_property: removeEmpty({
      client_id: input.contactId,
      contact_id: input.contactId,
      property_id: input.propertyId,
      unit_id: input.propertyId,
      deal_stage_id: input.stageId,
      note: input.note,
      source: "Website Landingpage"
    })
  });
}

async function safeCreateFollowUpTask(apiKey, contactId, propertyId, lead, note) {
  const startsAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const title = `Website Lead prüfen: ${lead.fullName}`;
  const body = `${title}\n\n${note}`;
  const attempts = [
    { event: removeEmpty({ title, body, starts_at: startsAt, ends_at: startsAt, client_id: contactId, property_id: propertyId, state: "neutral" }) },
    { task: removeEmpty({ title, body, due_date: new Date().toISOString().slice(0, 10), client_id: contactId, property_id: propertyId }) }
  ];
  for (const payload of attempts) {
    try { return await propstackPost(apiKey, payload.event ? "/events" : "/tasks", payload); } catch (error) { console.warn("FOLLOWUP CREATE ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Aufgabe/Termin konnte per API nicht angelegt werden." };
}

async function findBestDealStage(apiKey, concernType) {
  try {
    const pipelinesResponse = await propstackGet(apiKey, "/deal_pipelines");
    const pipelines = normalizeArray(pipelinesResponse);
    const allStages = [];
    for (const pipeline of pipelines) {
      const pipelineName = pipeline.name || pipeline.title || pipeline.label || "";
      const stages = pipeline.deal_stages || pipeline.stages || pipeline.client_property_stages || [];
      for (const stage of stages) allStages.push({ id: stage.id, name: stage.name || stage.title || stage.label || "", pipeline_id: pipeline.id, pipeline_name: pipelineName, raw: stage });
    }
    console.log("FOUND DEAL STAGES:", allStages.map(s => ({ id: s.id, name: s.name, pipeline: s.pipeline_name })));
    const wanted = getStageSearchTerms(concernType);
    for (const term of wanted) {
      const found = allStages.find(stage => normalize(`${stage.pipeline_name} ${stage.name}`).includes(term));
      if (found) return found;
    }
    return null;
  } catch (error) { console.warn("DEAL STAGE LOOKUP SKIPPED:", error.message); return null; }
}

function getStageSearchTerms(concernType) {
  if (concernType === "sell") return ["100eigentumerneuereigentumerlead", "100eigentuemerneuereigentuemerlead", "neuereigentumerlead", "neuereigentuemerlead", "akquise"];
  if (concernType === "buy" || concernType === "investment") return ["200kauferneuerkaufinteressent", "200kaeuferneuerkaufinteressent", "neuerkaufinteressent", "kaufer", "kaeufer"];
  if (concernType === "rent") return ["300mieterneuermietinteressent", "neuermietinteressent", "vermietung"];
  if (concernType === "finance") return ["400finanzierungneuerfinanzierungslead", "neuerfinanzierungslead", "finanzierung"];
  return ["neuerlead", "neu", "lead"];
}

async function findPropertyStatusId(apiKey, wantedName) {
  try {
    const response = await propstackGet(apiKey, "/property_statuses");
    const statuses = normalizeArray(response);
    const wanted = normalize(wantedName);
    const found = statuses.find(status => normalize(status.name || status.title || status.label).includes(wanted));
    return found ? found.id : null;
  } catch (error) { console.warn("Property status konnte nicht gelesen werden:", error.message); return null; }
}

async function uploadDocuments(apiKey, input) {
  const results = [];
  const safeDocuments = input.documents.filter(file => file && file.base64 && String(file.name || "").toLowerCase().endsWith(".pdf")).slice(0, 3);
  for (const file of safeDocuments) {
    try {
      const result = await propstackPost(apiKey, "/documents", { document: removeEmpty({ title: file.name || "Website-Unterlage.pdf", doc: file.base64, is_private: true, tags: ["Website Anfrage"], property_id: input.propertyId || undefined, client_id: input.propertyId ? undefined : input.contactId }) });
      results.push({ ok: true, name: file.name, result });
    } catch (error) { console.warn("Dokument konnte nicht hochgeladen werden:", error.message); results.push({ ok: false, name: file.name, error: error.message }); }
  }
  return results;
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  return parsePropstackResponse(response, endpoint);
}

async function propstackGet(apiKey, endpoint) {
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, { method: "GET", headers: { "X-API-KEY": apiKey, Accept: "application/json" } });
  return parsePropstackResponse(response, endpoint);
}

async function parsePropstackResponse(response, endpoint) {
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  console.log("PROPSTACK RESPONSE:", endpoint, response.status, data);
  if (!response.ok) throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

function mapConcernType(value) { const text = normalize(value); if (text.includes("kaufen") || text.includes("kauf")) return "buy"; if (text.includes("verkaufen") || text.includes("verkauf")) return "sell"; if (text.includes("vermieten") || text.includes("vermietung")) return "rent"; if (text.includes("finanzierung") || text.includes("finanz")) return "finance"; if (text.includes("verwaltung")) return "management"; if (text.includes("kapitalanlage") || text.includes("anlage")) return "investment"; return ""; }
function mapLandingpageType(type) { return { buy: "Kauf", sell: "Verkauf", rent: "Vermietung", finance: "Finanzierung", management: "Verwaltung", investment: "Kapitalanlage" }[type] || "Website Lead"; }
function mapRsType(value) { const text = normalize(value); if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE"; if (text.includes("haus")) return "SINGLE_FAMILY_HOUSE"; if (text.includes("grund")) return "PLOT"; if (text.includes("gewerbe")) return "COMMERCIAL_UNIT"; if (text.includes("kapital") || text.includes("anlage")) return "INVEST_FREEHOLD_FLAT"; return "APARTMENT"; }
function buildAcquisitionTitle(objectType, location) { const type = clean(objectType) || "Immobilie"; const place = clean(location); return place ? `Akquise: ${type} in ${place}` : `Akquise: ${type}`; }
function getId(response, keys) { if (!response) return null; if (response.id) return response.id; for (const key of keys) if (response[key] && response[key].id) return response[key].id; if (response.data && response.data.id) return response.data.id; return null; }
function normalizeArray(response) { if (Array.isArray(response)) return response; for (const key of ["data", "deal_pipelines", "pipelines", "property_statuses", "statuses", "events"]) if (Array.isArray(response?.[key])) return response[key]; return []; }
function clean(value) { if (value === null || value === undefined) return ""; return String(value).trim(); }
function isPlainObject(value) { return Object.prototype.toString.call(value) === "[object Object]"; }
function normalize(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, ""); }
function numberOrNull(value) { const text = clean(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""); if (!text) return null; const number = Number(text); return Number.isNaN(number) ? null : number; }
function boolFromGerman(value) { const text = normalize(value); if (!text) return undefined; if (text === "ja" || text === "true") return true; if (text === "nein" || text === "false") return false; return undefined; }
function extractCity(value) { const text = clean(value); if (!text) return ""; return text.split(",")[0].replace(/\d{5}/g, "").trim(); }
function removeKeys(object, keys) { const copy = { ...object }; keys.forEach(key => delete copy[key]); return copy; }
function removeEmpty(object) { const result = {}; for (const [key, value] of Object.entries(object)) { if (value === null || value === undefined || value === "") continue; if (Array.isArray(value) && value.length === 0) continue; if (isPlainObject(value) && Object.keys(value).length === 0) continue; result[key] = value; } return result; }
function humanizeKey(key) { return { "seller-area-type": "Flächenart", "seller-area-value": "Fläche in m²", "seller-rooms": "Zimmeranzahl", "seller-year": "Baujahr", "seller-energy": "Energielabel", "seller-balcony": "Balkon/Terrasse", "seller-balcony-area": "Balkon-/Terrassenfläche", "seller-plot-area": "Grundstücksgröße", "seller-quality": "Ausstattung", "seller-modernization": "Letzte Modernisierung", financing_object_available: "Konkretes Objekt vorhanden", financing_equity_note: "Eigenkapital / Finanzierungsbemerkung" }[key] || key; }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
