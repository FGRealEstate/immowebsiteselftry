const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

/**
 * netlify/functions/propstack-lead.js
 * Stabiler Lead-Prozess für Landingpage:
 *
 * Ziel:
 * - Kontakt zuverlässig anlegen/aktualisieren
 * - alle Formular-/Objektdaten verlustfrei im CRM speichern
 * - Käufer/Kapitalanlage: Suchprofil anlegen, wenn möglich
 * - Verkäufer/Vermieter/Finanzierung: als Kontakt + Bemerkung + Aufgabe speichern
 * - KEINE automatische Objektanlage per /units, damit Propstack keine fehlerhaften Objekte blockiert
 *
 * Objektanlage wird später separat richtig gebaut:
 * Kontakt -> Property/Objekt -> Eigentümerverknüpfung -> Deal
 */

exports.handler = async function (event) {
  console.log("PROPSTACK LEAD START");
  console.log("METHOD:", event.httpMethod);

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    console.log("PAYLOAD:", JSON.stringify(redactLargePayload(data), null, 2));

    const lead = normalizeLeadPayload(data);

    if (!lead.firstName || !lead.lastName || !lead.email || !lead.concernType || !lead.consent) {
      console.log("VALIDATION FAILED:", {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        rawConcern: lead.rawConcern,
        concernType: lead.concernType,
        consent: lead.consent,
      });

      return json(400, {
        success: false,
        error: "Pflichtfelder oder Datenschutz-Einwilligung fehlen.",
      });
    }

    const note = buildNote(lead);
    const contactPayload = buildContactPayload(lead, note);

    console.log("CONTACT PAYLOAD:", JSON.stringify(contactPayload, null, 2));

    const contactResponse = await createContactWithFallback(apiKey, contactPayload, lead, note);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);

    if (!contactId) {
      return json(500, {
        success: false,
        error: "Kontakt wurde erstellt/aktualisiert, aber keine Kontakt-ID erhalten.",
        propstack_response: contactResponse,
      });
    }

    console.log("CONTACT SAVED:", contactId);

    const contactUpdateResult = await safeUpdateContact(apiKey, contactId, contactPayload.client);
    const searchProfileResult = await maybeCreateSearchProfile(apiKey, contactId, lead, note);
    const taskResult = await safeCreateFollowUpTask(apiKey, contactId, lead, note);
    const documentResults = lead.documents.length
      ? await uploadDocuments(apiKey, { contactId, documents: lead.documents })
      : [];

    /**
     * Bewusst deaktiviert:
     * - keine automatische /units Objektanlage
     * - keine /client_properties Deals ohne echtes Propstack-Objekt
     *
     * Grund:
     * Propstack erwartet für Objekte eine saubere Property-/Unit-Struktur.
     * Falsche /units Requests blockieren Verkauf/Vermietung aktuell.
     */
    const propertyResult = {
      ok: true,
      skipped: true,
      reason:
        lead.concernType === "sell" || lead.concernType === "rent"
          ? "Objektdaten wurden im Kontakt und in der Aufgabe gespeichert. Automatische Objektanlage ist bewusst deaktiviert, bis die Propstack-Property-Struktur final gemappt ist."
          : "Für diesen Lead-Typ keine Objektanlage erforderlich.",
    };

    const dealResult = {
      ok: true,
      skipped: true,
      reason: "Deal wird erst erstellt, wenn ein echtes Propstack-Objekt vorhanden ist. Lead ist als Kontakt + Aktivität sauber gespeichert.",
    };

    return json(200, {
      success: true,
      message: "Ihre Anfrage wurde erfolgreich übermittelt.",
      contact_id: contactId,
      contact: contactResponse,
      contact_update: contactUpdateResult,
      search_profile: searchProfileResult,
      task: taskResult,
      property: propertyResult,
      deal: dealResult,
      documents: documentResults,
    });
  } catch (error) {
    console.error("PROPSTACK LEAD ERROR:", error);

    return json(500, {
      success: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
};

function normalizeLeadPayload(data) {
  const firstName = clean(data.first_name || data.firstName);
  const lastName = clean(data.last_name || data.lastName);
  const email = clean(data.email);
  const phone = clean(data.phone);

  const rawConcern = clean(data.concern || data.anliegen || data.type);
  const concernType = mapConcernType(rawConcern);

  const objectType = normalizeObjectType(clean(data.object_type || data.objectType));
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
  const utmContent = clean(data.utm_content);
  const utmTerm = clean(data.utm_term);

  const propertyDetails = isPlainObject(data.property_details) ? data.property_details : {};
  const documents = Array.isArray(data.documents) ? data.documents : [];

  const consent =
    data.privacy_consent === true ||
    data.privacy_consent === "true" ||
    data.privacy === "zugestimmt" ||
    data.consent === true ||
    data.consent === "true";

  const fullName = `${firstName} ${lastName}`.trim();
  const hasPropertyDetails = Object.values(propertyDetails).some((value) => clean(value));
  const hasAnyObjectSignal = hasPropertyDetails || Boolean(location) || Boolean(objectType) || Boolean(budget);

  return {
    firstName,
    lastName,
    fullName,
    email,
    phone,
    rawConcern,
    concernType,
    objectType,
    location,
    budget,
    budgetNumber,
    timeframe,
    contactPreference,
    message,
    financingInterest,
    propertyDetailsWanted,
    managementTakeover,
    sourceUrl,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    propertyDetails,
    documents,
    consent,
    hasPropertyDetails,
    hasAnyObjectSignal,
  };
}

function buildContactPayload(lead, note) {
  const isBuyerLike = lead.concernType === "buy" || lead.concernType === "investment";
  const isOwnerLike = lead.concernType === "sell" || lead.concernType === "rent";

  return {
    client: removeEmpty({
      first_name: lead.firstName,
      last_name: lead.lastName,
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone || "",
      home_cell: lead.phone || undefined,
      source: "Website Landingpage",
      description: note,
      note,
      warning_notice: "Website Lead prüfen",

      buyer: isBuyerLike,
      owner: isOwnerLike,

      newsletter: isBuyerLike,
      property_mailing_wanted: isBuyerLike,
      accept_contact: true,
      gdpr_status: 2,

      partial_custom_fields: buildContactCustomFields(lead),
    }),
  };
}

function buildContactPayloadWithoutCustomFields(lead, note) {
  const isBuyerLike = lead.concernType === "buy" || lead.concernType === "investment";
  const isOwnerLike = lead.concernType === "sell" || lead.concernType === "rent";

  return {
    client: removeEmpty({
      first_name: lead.firstName,
      last_name: lead.lastName,
      name: lead.fullName,
      email: lead.email,
      phone: lead.phone || "",
      home_cell: lead.phone || undefined,
      source: "Website Landingpage",
      description: note,
      note,
      warning_notice: "Website Lead prüfen",
      buyer: isBuyerLike,
      owner: isOwnerLike,
      newsletter: isBuyerLike,
      property_mailing_wanted: isBuyerLike,
      accept_contact: true,
      gdpr_status: 2,
    }),
  };
}

function buildContactCustomFields(lead) {
  const details = lead.propertyDetails || {};

  return removeEmpty({
    website_lead: true,
    landingpage_typ: mapLandingpageType(lead.concernType),
    anliegen: lead.rawConcern,
    lead_typ: mapLandingpageType(lead.concernType),

    immobilienart: lead.objectType,
    objektart: lead.objectType,
    standort: lead.location,
    suchgebiet: lead.concernType === "buy" || lead.concernType === "investment" ? lead.location : undefined,
    objektadresse: lead.concernType === "sell" || lead.concernType === "rent" ? lead.location : undefined,

    budget: lead.budget,
    budget_zahl: lead.budgetNumber,
    zeitrahmen: lead.timeframe,
    kontaktwunsch: lead.contactPreference,
    quelle_url: lead.sourceUrl,
    nachricht: lead.message,
    datenschutz_zugestimmt: true,

    newsletter_gewuenscht: lead.concernType === "buy" || lead.concernType === "investment",
    immobilienmailing_gewuenscht: lead.concernType === "buy" || lead.concernType === "investment",

    finanzierungsberatung_gewunscht:
      lead.concernType === "finance" ? "Ja" : lead.financingInterest,
    finanzierung_interesse:
      lead.concernType === "finance" ? "Ja" : lead.financingInterest,
    finanzierung_objekt_vorhanden: boolOrText(clean(details.financing_object_available || details["visible-financing-object"])),
    finanzierung_eigenkapital_notiz: clean(details.financing_equity_note || details["visible-financing-equity"]),
    finanzierung_kaufpreis: lead.concernType === "finance" ? lead.budget : undefined,
    finanzierung_kaufpreis_zahl: lead.concernType === "finance" ? lead.budgetNumber : undefined,

    verwaltung_interessant:
      lead.concernType === "management" ||
      lead.concernType === "rent" ||
      Boolean(lead.managementTakeover),
    verwaltungsubernahme_gewuenscht_ab: lead.managementTakeover,
    vermietungslead: lead.concernType === "rent",
    property_details_wanted: boolOrText(lead.propertyDetailsWanted),

    offmarket_geeignet: lead.concernType === "investment" || normalize(lead.objectType).includes("offmarket"),
    bonitatsgepruft: false,

    website_rohdaten: compactJson({
      concern: lead.rawConcern,
      concernType: lead.concernType,
      objectType: lead.objectType,
      location: lead.location,
      budget: lead.budget,
      timeframe: lead.timeframe,
      contactPreference: lead.contactPreference,
      financingInterest: lead.financingInterest,
      propertyDetailsWanted: lead.propertyDetailsWanted,
      managementTakeover: lead.managementTakeover,
      propertyDetails: lead.propertyDetails,
      sourceUrl: lead.sourceUrl,
      utmSource: lead.utmSource,
      utmMedium: lead.utmMedium,
      utmCampaign: lead.utmCampaign,
      utmContent: lead.utmContent,
      utmTerm: lead.utmTerm,
    }),

    utm_source: lead.utmSource,
    utm_medium: lead.utmMedium,
    utm_campaign: lead.utmCampaign,
    utm_content: lead.utmContent,
    utm_term: lead.utmTerm,
  });
}

function buildNote(lead) {
  const detailLines = Object.entries(lead.propertyDetails || {})
    .filter(([, value]) => clean(value))
    .map(([key, value]) => `${humanizeKey(key)}: ${clean(value)}`);

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
    `Interesse an Finanzierungsberatung: ${
      lead.concernType === "finance" ? "Ja" : lead.financingInterest || "-"
    }`,
    `Weitere Objektdaten angegeben: ${lead.propertyDetailsWanted || "-"}`,
    `Verwaltungsübernahme interessant ab: ${lead.managementTakeover || "-"}`,
    "",
    "Objektdaten / Zusatzdaten:",
    ...(detailLines.length ? detailLines : ["-"]),
    "",
    "Nachricht:",
    lead.message || "-",
    "",
    "Marketing-Quelle:",
    `UTM Source: ${lead.utmSource || "-"}`,
    `UTM Medium: ${lead.utmMedium || "-"}`,
    `UTM Campaign: ${lead.utmCampaign || "-"}`,
    `UTM Content: ${lead.utmContent || "-"}`,
    `UTM Term: ${lead.utmTerm || "-"}`,
    "",
    "Einwilligung:",
    "Datenschutz-Einwilligung wurde aktiv bestätigt.",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${lead.sourceUrl || "-"}`,
  ].join("\n");
}

async function createContactWithFallback(apiKey, contactPayload, lead, note) {
  try {
    return await propstackPost(apiKey, "/contacts", contactPayload);
  } catch (error) {
    console.warn("CONTACT CREATE WITH CUSTOM FIELDS FAILED:", error.message);
    console.warn("TRY CONTACT CREATE WITHOUT CUSTOM FIELDS");
    return await propstackPost(apiKey, "/contacts", buildContactPayloadWithoutCustomFields(lead, note));
  }
}

async function safeUpdateContact(apiKey, contactId, clientPayload) {
  const updatePayload = {
    client: removeEmpty({
      description: clientPayload.description,
      note: clientPayload.note,
      warning_notice: clientPayload.warning_notice,
      newsletter: clientPayload.newsletter,
      property_mailing_wanted: clientPayload.property_mailing_wanted,
      accept_contact: clientPayload.accept_contact,
      gdpr_status: clientPayload.gdpr_status,
      buyer: clientPayload.buyer,
      owner: clientPayload.owner,
      partial_custom_fields: clientPayload.partial_custom_fields,
    }),
  };

  try {
    return await propstackPut(apiKey, `/contacts/${contactId}`, updatePayload);
  } catch (error) {
    console.warn("CONTACT UPDATE WITH CUSTOM FIELDS SKIPPED:", error.message);

    try {
      const fallback = {
        client: removeEmpty({
          description: clientPayload.description,
          note: clientPayload.note,
          warning_notice: clientPayload.warning_notice,
          newsletter: clientPayload.newsletter,
          property_mailing_wanted: clientPayload.property_mailing_wanted,
          accept_contact: clientPayload.accept_contact,
          gdpr_status: clientPayload.gdpr_status,
          buyer: clientPayload.buyer,
          owner: clientPayload.owner,
        }),
      };

      return await propstackPut(apiKey, `/contacts/${contactId}`, fallback);
    } catch (fallbackError) {
      console.warn("CONTACT UPDATE FALLBACK SKIPPED:", fallbackError.message);
      return { ok: false, skipped: true, reason: fallbackError.message };
    }
  }
}

async function maybeCreateSearchProfile(apiKey, contactId, lead, note) {
  const shouldCreate = lead.concernType === "buy" || lead.concernType === "investment";

  if (!shouldCreate) {
    return {
      ok: true,
      skipped: true,
      reason: "Für diesen Lead-Typ kein Suchprofil erforderlich.",
    };
  }

  const city = extractCity(lead.location);

  const savedQuery = removeEmpty({
    client_id: contactId,
    active: true,
    marketing_type: "BUY",
    cities: city ? [city] : undefined,
    regions: lead.location ? [lead.location] : undefined,
    price_to: lead.budgetNumber,
    rs_types: lead.objectType ? [mapRsType(lead.objectType)] : undefined,
    note,
    internal_note: note,
  });

  const attempts = [
    { endpoint: "/saved_queries", payload: { saved_query: savedQuery } },
    { endpoint: "/search_profiles", payload: { search_profile: savedQuery } },
  ];

  for (const attempt of attempts) {
    try {
      return await propstackPost(apiKey, attempt.endpoint, attempt.payload);
    } catch (error) {
      console.warn("SEARCH PROFILE CREATE ATTEMPT FAILED:", error.message);
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: "Suchprofil konnte per API nicht angelegt werden. Daten stehen im Kontakt und in der Aufgabe.",
    payload: savedQuery,
  };
}

async function safeCreateFollowUpTask(apiKey, contactId, lead, note) {
  const title = getTaskTitle(lead);
  const dueAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const dueDate = dueAt.slice(0, 10);

  const attempts = [
    {
      task: removeEmpty({
        title,
        body: note,
        is_reminder: true,
        due_date: dueAt,
        client_ids: [contactId],
      }),
    },
    {
      task: removeEmpty({
        title,
        body: note,
        is_reminder: true,
        due_date: dueDate,
        client_ids: [contactId],
      }),
    },
  ];

  for (const payload of attempts) {
    try {
      return await propstackPost(apiKey, "/tasks", payload);
    } catch (error) {
      console.warn("FOLLOWUP TASK ATTEMPT FAILED:", error.message);
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: "Aufgabe konnte per API nicht angelegt werden. Daten stehen im Kontakt/Bemerkung.",
  };
}

function getTaskTitle(lead) {
  const type = mapLandingpageType(lead.concernType);
  return `Website Lead prüfen: ${type} – ${lead.fullName}`;
}

async function uploadDocuments(apiKey, input) {
  const results = [];
  const safeDocuments = input.documents
    .filter((file) => file && file.base64 && String(file.name || "").toLowerCase().endsWith(".pdf"))
    .slice(0, 3);

  for (const file of safeDocuments) {
    try {
      const result = await propstackPost(apiKey, "/documents", {
        document: removeEmpty({
          title: file.name || "Website-Unterlage.pdf",
          doc: file.base64,
          is_private: true,
          tags: ["Website Anfrage"],
          client_id: input.contactId,
        }),
      });

      results.push({ ok: true, name: file.name, result });
    } catch (error) {
      console.warn("Dokument konnte nicht hochgeladen werden:", error.message);
      results.push({ ok: false, name: file.name, error: error.message });
    }
  }

  return results;
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return parsePropstackResponse(response, endpoint);
}

async function propstackPut(apiKey, endpoint, body) {
  console.log("PROPSTACK PUT:", endpoint, JSON.stringify(body, null, 2));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return parsePropstackResponse(response, endpoint);
}

async function parsePropstackResponse(response, endpoint) {
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  console.log("PROPSTACK RESPONSE:", endpoint, response.status, data);

  if (!response.ok) {
    throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
  }

  return data;
}

function mapConcernType(value) {
  const text = normalize(value);

  if (text.includes("verkaufen") || text.includes("verkauf")) return "sell";
  if (text.includes("vermieten") || text.includes("vermietung")) return "rent";
  if (text.includes("finanzierung") || text.includes("finanz")) return "finance";
  if (text.includes("verwaltung")) return "management";
  if (text.includes("kapitalanlage") || text.includes("anlage")) return "investment";
  if (text.includes("kaufen") || text.includes("kauf")) return "buy";

  return "";
}

function normalizeObjectType(value) {
  const text = clean(value);
  const n = normalize(text);

  if (!text) return "";
  if (n.includes("eigentumswohnung") || n.includes("wohnung")) return "Wohnung";
  if (n.includes("mehrfamilien")) return "Mehrfamilienhaus";
  if (n.includes("einfamilien") || n.includes("haus")) return "Haus";
  if (n.includes("grund")) return "Grundstück";
  if (n.includes("gewerbe")) return "Gewerbe";
  if (n.includes("kapital") || n.includes("anlage")) return "Kapitalanlage";
  if (n.includes("offmarket")) return "Sonstiges";

  return text;
}

function mapLandingpageType(type) {
  return {
    buy: "Kauf",
    sell: "Verkauf",
    rent: "Vermietung",
    finance: "Finanzierung",
    management: "Verwaltung",
    investment: "Kapitalanlage",
  }[type] || "Website Lead";
}

function mapRsType(value) {
  const text = normalize(value);

  if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE";
  if (text.includes("haus")) return "SINGLE_FAMILY_HOUSE";
  if (text.includes("grund")) return "PLOT";
  if (text.includes("gewerbe")) return "COMMERCIAL_UNIT";
  if (text.includes("kapital") || text.includes("anlage")) return "INVEST_FREEHOLD_FLAT";

  return "APARTMENT";
}

function getId(response, keys) {
  if (!response) return null;
  if (response.id) return response.id;

  for (const key of keys) {
    if (response[key] && response[key].id) return response[key].id;
  }

  if (response.data && response.data.id) return response.data.id;
  return null;
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

function numberOrNull(value) {
  const text = clean(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!text) return null;

  const number = Number(text);
  return Number.isNaN(number) ? null : number;
}

function boolOrText(value) {
  const text = normalize(value);

  if (text === "ja" || text === "true") return true;
  if (text === "nein" || text === "false") return false;
  if (!text) return undefined;

  return value;
}

function extractCity(value) {
  const text = clean(value);
  if (!text) return "";

  return text
    .split(",")[0]
    .replace(/\d{5}/g, "")
    .trim();
}

function removeEmpty(object) {
  const result = {};

  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isPlainObject(value) && Object.keys(value).length === 0) continue;

    result[key] = value;
  }

  return result;
}

function compactJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function humanizeKey(key) {
  return {
    "seller-area-type": "Flächenart",
    "seller-area-value": "Fläche in m²",
    "seller-rooms": "Zimmeranzahl",
    "seller-year": "Baujahr",
    "seller-energy": "Energielabel",
    "seller-balcony": "Balkon/Terrasse",
    "seller-balcony-area": "Balkon-/Terrassenfläche",
    "seller-plot-area": "Grundstücksgröße",
    "seller-quality": "Ausstattung / Objektzustand",
    "seller-modernization": "Letzte Modernisierung",
    financing_object_available: "Konkretes Objekt vorhanden",
    financing_equity_note: "Eigenkapital / Finanzierungsbemerkung",
    "visible-financing-object": "Konkretes Objekt vorhanden",
    "visible-financing-equity": "Eigenkapital / Finanzierungsbemerkung",
  }[key] || key;
}

function redactLargePayload(data) {
  const clone = { ...data };

  if (Array.isArray(clone.documents)) {
    clone.documents = clone.documents.map((doc) => ({
      name: doc.name,
      type: doc.type,
      base64: doc.base64 ? "[base64 gekürzt]" : undefined,
    }));
  }

  return clone;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

