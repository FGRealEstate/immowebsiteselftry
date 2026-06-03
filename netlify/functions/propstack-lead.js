const PROPSTACK_BASE_URL =
  process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

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
    console.log("PAYLOAD:", JSON.stringify(data, null, 2));

    const firstName = clean(data.first_name || data.firstName);
    const lastName = clean(data.last_name || data.lastName);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const rawConcern = clean(data.concern || data.anliegen || data.type);
    const concernType = mapConcernType(rawConcern);
    const objectType = clean(data.object_type || data.objectType);
    const location = clean(data.location || data.address || data.ort);
    const budget = clean(data.budget);
    const timeframe = clean(data.timeframe || data.zeitrahmen);
    const contactPreference =
      clean(data.contact_preference || data.contactPreference) || "E-Mail";
    const message = clean(data.message || data.nachricht);
    const financingInterest = clean(data.financing_interest);
    const propertyDetailsWanted = clean(data.property_details_wanted);
    const managementTakeover = clean(data.management_takeover);
    const sourceUrl = clean(data.source_url || data.sourceUrl);
    const propertyDetails = isPlainObject(data.property_details)
      ? data.property_details
      : {};
    const documents = Array.isArray(data.documents) ? data.documents : [];

    const consent =
      data.privacy_consent === true ||
      data.privacy_consent === "true" ||
      data.privacy === "zugestimmt" ||
      data.consent === true ||
      data.consent === "true";

    if (!firstName || !lastName || !email || !concernType || !consent) {
      console.log("VALIDATION FAILED:", {
        firstName,
        lastName,
        email,
        rawConcern,
        concernType,
        consent,
      });

      return json(400, {
        success: false,
        error: "Pflichtfelder oder Datenschutz-Einwilligung fehlen.",
      });
    }

    const fullName = `${firstName} ${lastName}`.trim();

    const note = buildNote({
      fullName,
      email,
      phone,
      rawConcern,
      concernType,
      objectType,
      location,
      budget,
      timeframe,
      contactPreference,
      financingInterest,
      propertyDetailsWanted,
      managementTakeover,
      propertyDetails,
      message,
      sourceUrl,
    });

    const contactPayload = {
      client: removeEmpty({
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email,
        phone: phone || "",
        source: "Website Landingpage",
        note,
        buyer: concernType === "buy" || concernType === "finance",
        owner: concernType === "sell" || concernType === "rent",
        partial_custom_fields: removeEmpty({
          landingpage_typ: mapLandingpageType(concernType),
          finanzierungsberatung_gewunscht:
            concernType === "finance" ? "Ja" : financingInterest || undefined,
          suchgebiet: concernType === "buy" ? location : undefined,
          objektadresse:
            concernType === "sell" || concernType === "rent"
              ? location
              : undefined,
          budget: budget || undefined,
          zeitrahmen: timeframe || undefined,
          verwaltung_interessant: concernType === "management",
          website_lead: true,
          offmarket_geeignet: concernType === "investment",
        }),
      }),
    };

    console.log("CONTACT PAYLOAD:", JSON.stringify(contactPayload, null, 2));

    const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);

    if (!contactId) {
      return json(500, {
        success: false,
        error: "Kontakt wurde erstellt/aktualisiert, aber keine Kontakt-ID erhalten.",
        propstack_response: contactResponse,
      });
    }

    console.log("CONTACT CREATED:", contactId);

    let propertyResponse = null;
    let propertyId = null;
    let documentResults = [];

    if (concernType === "sell" && propertyDetailsWanted === "Ja") {
      propertyResponse = await createAcquisitionProperty(apiKey, {
        contactId,
        objectType,
        location,
        budget,
        timeframe,
        propertyDetails,
        note,
      });

      propertyId = getId(propertyResponse, ["property", "unit", "data"]);
      console.log("PROPERTY CREATED:", propertyId);
    }

    const stage = await findBestDealStage(apiKey, concernType);
    console.log("DEAL STAGE:", stage);

  let dealResponse = null;

const canCreateDealWithProperty = Boolean(propertyId);

if (stage && stage.id && canCreateDealWithProperty) {
  try {
    dealResponse = await createDeal(apiKey, {
      contactId,
      propertyId,
      stageId: stage.id,
      note,
      concernType,
    });

    console.log("DEAL CREATED:", JSON.stringify(dealResponse, null, 2));
  } catch (dealError) {
    console.warn("DEAL CREATE SKIPPED:", dealError.message);

    dealResponse = {
      ok: false,
      skipped: true,
      reason: dealError.message,
    };
  }
} else {
  dealResponse = {
    ok: true,
    skipped: true,
    reason: "Kein Objekt vorhanden. Landingpage-Lead wurde nur als Kontakt mit Notiz gespeichert.",
  };

  console.log("DEAL SKIPPED:", dealResponse.reason);
}

    if (documents.length) {
      documentResults = await uploadDocuments(apiKey, {
        contactId,
        propertyId,
        documents,
      });
    }

    return json(200, {
      success: true,
      message: "Ihre Anfrage wurde erfolgreich übermittelt.",
      contact_id: contactId,
      property_id: propertyId,
      deal_stage: stage,
      contact: contactResponse,
      property: propertyResponse,
      deal: dealResponse,
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

function buildNote(input) {
  const details = input.propertyDetails || {};

  const detailLines = Object.entries(details)
    .filter(([, value]) => clean(value))
    .map(([key, value]) => `${humanizeKey(key)}: ${clean(value)}`);

  return [
    "Neue Website-Landingpage-Anfrage",
    "",
    `Name: ${input.fullName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone || "-"}`,
    `Anliegen: ${input.rawConcern || "-"}`,
    `Lead-Typ: ${mapLandingpageType(input.concernType)}`,
    `Immobilienart / Thema: ${input.objectType || "-"}`,
    `Standort / Suchgebiet / Objektadresse: ${input.location || "-"}`,
    `Budget / Preisrahmen / Preisvorstellung: ${input.budget || "-"}`,
    `Zeitrahmen: ${input.timeframe || "-"}`,
    `Kontaktwunsch: ${input.contactPreference || "-"}`,
    `Interesse an Finanzierungsberatung: ${input.financingInterest || "-"}`,
    `Weitere Objektdaten angegeben: ${input.propertyDetailsWanted || "-"}`,
    `Verwaltungsübernahme interessant ab: ${input.managementTakeover || "-"}`,
    "",
    "Objektdaten / Zusatzdaten:",
    ...(detailLines.length ? detailLines : ["-"]),
    "",
    "Nachricht:",
    input.message || "-",
    "",
    "Einwilligung:",
    "Datenschutz-Einwilligung wurde aktiv bestätigt.",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${input.sourceUrl || "-"}`,
  ].join("\n");
}

async function createDeal(apiKey, input) {
  const payload = {
    client_property: removeEmpty({
      client_id: input.contactId,
      contact_id: input.contactId,
      property_id: input.propertyId || undefined,
      unit_id: input.propertyId || undefined,
      deal_stage_id: input.stageId,
      note: input.note,
      source: "Website Landingpage",
    }),
  };

  return await propstackPost(apiKey, "/client_properties", payload);
}

async function findBestDealStage(apiKey, concernType) {
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
    "FOUND DEAL STAGES:",
    allStages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      pipeline_id: stage.pipeline_id,
      pipeline_name: stage.pipeline_name,
    }))
  );

  const wanted = getStageSearchTerms(concernType);

  for (const term of wanted) {
    const exact = allStages.find((stage) =>
      normalize(`${stage.pipeline_name} ${stage.name}`).includes(term)
    );
    if (exact) return exact;
  }

  return null;
}

function getStageSearchTerms(concernType) {
  if (concernType === "sell") {
    return [
      "100eigentumerneuereigentumerlead",
      "100eigentuemerneuereigentuemerlead",
      "neuereigentumerlead",
      "neuereigentuemerlead",
    ];
  }

  if (concernType === "buy") {
    return [
      "200kauferneuerkaufinteressent",
      "200kaeuferneuerkaufinteressent",
      "neuerkaufinteressent",
    ];
  }

  if (concernType === "rent") {
    return [
      "300mieterneuermietinteressent",
      "neuermietinteressent",
    ];
  }

  if (concernType === "finance") {
    return [
      "400finanzierungneuerfinanzierungslead",
      "neuerfinanzierungslead",
    ];
  }

  return ["neuerlead", "neu", "lead"];
}

async function createAcquisitionProperty(apiKey, input) {
  const statusId = await findPropertyStatusId(apiKey, "Akquise");
  const rsType = mapRsType(input.objectType);
  const areaValue = numberOrNull(input.propertyDetails["seller-area-value"]);
  const rooms = numberOrNull(input.propertyDetails["seller-rooms"]);
  const year = numberOrNull(input.propertyDetails["seller-year"]);
  const balconyArea = numberOrNull(input.propertyDetails["seller-balcony-area"]);
  const plotArea = numberOrNull(input.propertyDetails["seller-plot-area"]);

  const property = removeEmpty({
    title: buildAcquisitionTitle(input.objectType, input.location),
    name: buildAcquisitionTitle(input.objectType, input.location),
    address: input.location || undefined,
    city: input.location || undefined,
    marketing_type: "BUY",
    object_type: "LIVING",
    rs_type: rsType,
    living_space: areaValue,
    property_space_value: areaValue,
    number_of_rooms: rooms,
    construction_year: year,
    energy_efficiency_class: clean(input.propertyDetails["seller-energy"]),
    balcony: clean(input.propertyDetails["seller-balcony"]) === "Ja",
    balcony_area: balconyArea,
    plot_area: plotArea,
    furnishing_quality: clean(input.propertyDetails["seller-quality"]),
    last_modernization: clean(input.propertyDetails["seller-modernization"]),
    note: input.note,
    internal_note: input.note,
    property_status_id: statusId,
    status_id: statusId,
    relationships_attributes: [
      {
        internal_name: "owner",
        related_client_id: input.contactId,
      },
    ],
    partial_custom_fields: removeEmpty({
      objektzustand: clean(input.propertyDetails["seller-quality"]),
      wohnflache: areaValue,
      grundstucksflache: plotArea,
      zimmeranzahl: rooms,
      baujahr: year,
      energieklasse: clean(input.propertyDetails["seller-energy"]),
      balkon_oder_terrasse:
        clean(input.propertyDetails["seller-balcony"]) === "Ja",
      balkon_terrassenflache: balconyArea,
      letzte_modernisierung: clean(input.propertyDetails["seller-modernization"]),
      objekt_aus_landingpage: true,
      akquiseobjekt: true,
      unterlagen_erhalten: false,
    }),
  });

  const attempts = [
    property,
    (() => {
      const clone = { ...property };
      delete clone.status_id;
      return clone;
    })(),
    (() => {
      const clone = { ...property };
      delete clone.property_status_id;
      delete clone.status_id;
      return clone;
    })(),
  ];

  let lastError;

  for (const attempt of attempts) {
    try {
      return await propstackPost(apiKey, "/units", { property: attempt });
    } catch (error) {
      lastError = error;
      console.warn("PROPERTY CREATE ATTEMPT FAILED:", error.message);
    }
  }

  throw lastError;
}

async function findPropertyStatusId(apiKey, wantedName) {
  try {
    const response = await propstackGet(apiKey, "/property_statuses");
    const statuses = normalizeArray(response);
    const wanted = normalize(wantedName);
    const found = statuses.find((status) =>
      normalize(status.name || status.title || status.label).includes(wanted)
    );
    return found ? found.id : null;
  } catch (error) {
    console.warn("Property status konnte nicht gelesen werden:", error.message);
    return null;
  }
}

async function uploadDocuments(apiKey, input) {
  const results = [];
  const safeDocuments = input.documents
    .filter(
      (file) =>
        file &&
        file.base64 &&
        String(file.name || "").toLowerCase().endsWith(".pdf")
    )
    .slice(0, 3);

  for (const file of safeDocuments) {
    try {
      const documentPayload = {
        document: removeEmpty({
          title: file.name || "Website-Unterlage.pdf",
          doc: file.base64,
          is_private: true,
          tags: ["Website Anfrage"],
          property_id: input.propertyId || undefined,
          client_id: input.propertyId ? undefined : input.contactId,
        }),
      };

      const result = await propstackPost(apiKey, "/documents", documentPayload);
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

async function propstackGet(apiKey, endpoint) {
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
    },
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
    throw new Error(
      `Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`
    );
  }

  return data;
}

function mapConcernType(value) {
  const text = normalize(value);

  if (text.includes("kaufen") || text.includes("kauf")) return "buy";
  if (text.includes("verkaufen") || text.includes("verkauf")) return "sell";
  if (text.includes("vermieten") || text.includes("vermietung")) return "rent";
  if (text.includes("finanzierung") || text.includes("finanz")) return "finance";
  if (text.includes("verwaltung")) return "management";
  if (text.includes("kapitalanlage") || text.includes("anlage")) return "investment";

  return "";
}

function mapLandingpageType(type) {
  const map = {
    buy: "Kauf",
    sell: "Verkauf",
    rent: "Vermietung",
    finance: "Finanzierung",
    management: "Verwaltung",
    investment: "Kapitalanlage",
  };

  return map[type] || "Website Lead";
}

function mapRsType(value) {
  const text = normalize(value);
  if (text.includes("haus")) return "SINGLE_FAMILY_HOUSE";
  if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE";
  if (text.includes("grund")) return "PLOT";
  if (text.includes("gewerbe")) return "COMMERCIAL_UNIT";
  return "APARTMENT";
}

function buildAcquisitionTitle(objectType, location) {
  const type = clean(objectType) || "Immobilie";
  const place = clean(location);
  return place ? `Akquise: ${type} in ${place}` : `Akquise: ${type}`;
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

function normalizeArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.deal_pipelines)) return response.deal_pipelines;
  if (Array.isArray(response.pipelines)) return response.pipelines;
  if (Array.isArray(response.property_statuses)) return response.property_statuses;
  if (Array.isArray(response.statuses)) return response.statuses;
  return [];
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

function humanizeKey(key) {
  const map = {
    "seller-area-type": "Flächenart",
    "seller-area-value": "Fläche in m²",
    "seller-rooms": "Zimmeranzahl",
    "seller-year": "Baujahr",
    "seller-energy": "Energielabel",
    "seller-balcony": "Balkon/Terrasse",
    "seller-balcony-area": "Balkon-/Terrassenfläche",
    "seller-plot-area": "Grundstücksgröße",
    "seller-quality": "Ausstattung",
    "seller-modernization": "Letzte Modernisierung",
    financing_object_available: "Konkretes Objekt vorhanden",
    financing_equity_note: "Eigenkapital / Finanzierungsbemerkung",
  };

  return map[key] || key;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
