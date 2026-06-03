const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

/**
 * netlify/functions/propstack-lead.js
 * FINAL auf deine aktuellen Custom Fields angepasst.
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

    const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
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
    const noteResult = await safeCreateNote(apiKey, contactId, note, `Website Lead: ${lead.fullName}`);

    let propertyResponse = null;
    let propertyId = null;

    const shouldCreateProperty =
      (lead.concernType === "sell" || lead.concernType === "rent") &&
      lead.hasAnyObjectSignal;

    if (shouldCreateProperty) {
      propertyResponse = await safeCreateAcquisitionProperty(apiKey, {
        contactId,
        lead,
        note,
      });

      propertyId = getId(propertyResponse, ["property", "unit", "data"]);
      console.log("PROPERTY RESULT:", JSON.stringify(propertyResponse, null, 2));
      console.log("PROPERTY ID:", propertyId);
    } else {
      propertyResponse = {
        ok: true,
        skipped: true,
        reason: "Kein Akquiseobjekt nötig oder keine Objektdaten vorhanden.",
      };
    }

    const searchProfileResult = await maybeCreateSearchProfile(apiKey, contactId, lead, note);

    const stage = await findBestDealStage(apiKey, lead.concernType);
    let dealResponse = null;

    if (stage && stage.id && propertyId) {
      dealResponse = await safeCreateDeal(apiKey, {
        contactId,
        propertyId,
        stageId: stage.id,
        note,
        lead,
      });
    } else {
      dealResponse = {
        ok: true,
        skipped: true,
        reason: propertyId
          ? "Keine passende Deal-Phase gefunden."
          : "Kein Objekt vorhanden. Anfrage wurde als Kontakt, Bemerkung, Aktivität und ggf. Suchprofil gespeichert.",
      };

      console.log("DEAL SKIPPED:", dealResponse.reason);
    }

    const taskResult = await safeCreateFollowUpTask(apiKey, contactId, propertyId, lead, note);
    const documentResults = lead.documents.length
      ? await uploadDocuments(apiKey, { contactId, propertyId, documents: lead.documents })
      : [];

    return json(200, {
      success: true,
      message: "Ihre Anfrage wurde erfolgreich übermittelt.",
      contact_id: contactId,
      property_id: propertyId,
      contact: contactResponse,
      contact_update: contactUpdateResult,
      note: noteResult,
      property: propertyResponse,
      search_profile: searchProfileResult,
      deal_stage: stage,
      deal: dealResponse,
      task: taskResult,
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
  const hasAnyObjectSignal =
    hasPropertyDetails ||
    Boolean(location) ||
    Boolean(objectType) ||
    Boolean(budget);

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
  const customFields = buildContactCustomFields(lead);

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
      buyer: lead.concernType === "buy" || lead.concernType === "investment",
      owner: lead.concernType === "sell" || lead.concernType === "rent",
      newsletter: lead.concernType === "buy" || lead.concernType === "investment",
      property_mailing_wanted: lead.concernType === "buy" || lead.concernType === "investment",
      accept_contact: true,
      gdpr_status: 2,
      partial_custom_fields: customFields,
    }),
  };
}

function buildContactCustomFields(lead) {
  const details = lead.propertyDetails || {};

  return removeEmpty({
    website_lead: true,
    landingpage_typ: mapLandingpageType(lead.concernType),
    finanzierungsberatung_gewunscht:
      lead.concernType === "finance" ? "Ja" : lead.financingInterest,
    suchgebiet: lead.concernType === "buy" || lead.concernType === "investment" ? lead.location : undefined,
    objektadresse: lead.concernType === "sell" || lead.concernType === "rent" ? lead.location : undefined,
    budget: lead.budget,
    zeitrahmen: lead.timeframe,
    verwaltung_interessant:
      lead.concernType === "management" ||
      lead.concernType === "rent" ||
      Boolean(lead.managementTakeover),
    offmarket_geeignet: lead.concernType === "investment" || normalize(lead.objectType).includes("offmarket"),

    anliegen: lead.rawConcern,
    lead_typ: mapLandingpageType(lead.concernType),
    immobilienart: lead.objectType,
    objektart: lead.objectType,
    standort: lead.location,
    budget_zahl: lead.budgetNumber,
    kontaktwunsch: lead.contactPreference,
    quelle_url: lead.sourceUrl,
    nachricht: lead.message,
    datenschutz_zugestimmt: true,

    newsletter_gewuenscht: lead.concernType === "buy" || lead.concernType === "investment",
    immobilienmailing_gewuenscht: lead.concernType === "buy" || lead.concernType === "investment",

    finanzierung_interesse:
      lead.concernType === "finance" ? "Ja" : lead.financingInterest,
    finanzierung_objekt_vorhanden: boolOrText(clean(details.financing_object_available)),
    finanzierung_eigenkapital_notiz: clean(details.financing_equity_note),
    finanzierung_kaufpreis: lead.concernType === "finance" ? lead.budget : undefined,
    finanzierung_kaufpreis_zahl: lead.concernType === "finance" ? lead.budgetNumber : undefined,

    verwaltungsubernahme_gewuenscht_ab: lead.managementTakeover,
    vermietungslead: lead.concernType === "rent",
    property_details_wanted: boolOrText(lead.propertyDetailsWanted),
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

function buildObjectCustomFields(lead) {
  const details = lead.propertyDetails || {};

  return removeEmpty({
    verwaltungsubernahme_gewuenscht_ab: lead.managementTakeover,
    objektzustand: clean(details["seller-quality"]),
    wohnflache: numberOrNull(details["seller-area-value"]),
    grundstucksflache: numberOrNull(details["seller-plot-area"]),
    zimmeranzahl: numberOrNull(details["seller-rooms"]),
    baujahr: numberOrNull(details["seller-year"]),
    energieklasse: clean(details["seller-energy"]),
    balkon_terrasse: boolOrText(clean(details["seller-balcony"])),
    balkon_terrassenflache: numberOrNull(details["seller-balcony-area"]),
    letzte_modernisierung: clean(details["seller-modernization"]),
    objekt_aus_landing_page: true,
    akquiseobjekt: true,
    unterlagen_erhalten: lead.documents.length > 0,
    pdf_unterlagen_vorhanden: lead.documents.length > 0,
    offmarket_geeignet: lead.concernType === "investment" || normalize(lead.objectType).includes("offmarket"),
    website_prioritat: getWebsitePriority(lead),
    flachenart: clean(details["seller-area-type"]),
    ausstattung: clean(details["seller-quality"]),
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
      partial_custom_fields: clientPayload.partial_custom_fields,
    }),
  };

  try {
    return await propstackPut(apiKey, `/contacts/${contactId}`, updatePayload);
  } catch (error) {
    console.warn("CONTACT UPDATE SKIPPED:", error.message);
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function safeCreateNote(apiKey, contactId, body, title) {
  const payloads = [
    { note: { client_id: contactId, body, title, note_type: "note" } },
    { note: { client_id: contactId, text: body, title } },
  ];

  for (const payload of payloads) {
    try {
      return await propstackPost(apiKey, "/notes", payload);
    } catch (error) {
      console.warn("NOTE CREATE ATTEMPT FAILED:", error.message);
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: "Notiz-Endpunkt nicht akzeptiert. Bemerkung wurde aber im Kontaktfeld gespeichert.",
  };
}

async function safeCreateAcquisitionProperty(apiKey, input) {
  try {
    return await createAcquisitionProperty(apiKey, input);
  } catch (error) {
    console.warn("PROPERTY CREATE SKIPPED:", error.message);
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function createAcquisitionProperty(apiKey, { contactId, lead, note }) {
  const statusId = await findPropertyStatusId(apiKey, "Akquise");
  const details = lead.propertyDetails || {};
  const title = buildAcquisitionTitle(lead.objectType, lead.location);
  const objectCustomFields = buildObjectCustomFields(lead);

  const fullProperty = removeEmpty({
    title,
    name: title,
    address: lead.location || undefined,
    city: extractCity(lead.location) || undefined,
    marketing_type: lead.concernType === "rent" ? "RENT" : "BUY",
    object_type: "LIVING",
    rs_type: mapRsType(lead.objectType),
    living_space: numberOrNull(details["seller-area-value"]),
    property_space_value: numberOrNull(details["seller-area-value"]),
    number_of_rooms: numberOrNull(details["seller-rooms"]),
    construction_year: numberOrNull(details["seller-year"]),
    energy_efficiency_class: clean(details["seller-energy"]),
    balcony: boolFromGerman(details["seller-balcony"]),
    balcony_area: numberOrNull(details["seller-balcony-area"]),
    plot_area: numberOrNull(details["seller-plot-area"]),
    furnishing_quality: clean(details["seller-quality"]),
    last_modernization: clean(details["seller-modernization"]),
    purchase_price: lead.concernType === "sell" ? lead.budgetNumber : undefined,
    cold_rent: lead.concernType === "rent" ? lead.budgetNumber : undefined,
    note,
    internal_note: note,
    property_status_id: statusId || undefined,
    status_id: statusId || undefined,
    relationships_attributes: [
      {
        internal_name: "owner",
        related_client_id: contactId,
      },
    ],
    partial_custom_fields: objectCustomFields,
  });

  const minimalProperty = removeEmpty({
    title,
    name: title,
    address: lead.location || undefined,
    city: extractCity(lead.location) || undefined,
    marketing_type: lead.concernType === "rent" ? "RENT" : "BUY",
    object_type: "LIVING",
    rs_type: mapRsType(lead.objectType),
    note,
    internal_note: note,
    partial_custom_fields: objectCustomFields,
  });

  const attempts = [
    { endpoint: "/units", payload: { property: fullProperty } },
    { endpoint: "/units", payload: { unit: fullProperty } },
    { endpoint: "/units", payload: { property: removeKeys(fullProperty, ["relationships_attributes"]) } },
    { endpoint: "/units", payload: { property: removeKeys(fullProperty, ["status_id", "property_status_id", "relationships_attributes"]) } },
    { endpoint: "/units", payload: { property: minimalProperty } },
    { endpoint: "/units", payload: { unit: minimalProperty } },
  ];

  let lastError;

  for (const attempt of attempts) {
    try {
      const created = await propstackPost(apiKey, attempt.endpoint, attempt.payload);
      const propertyId = getId(created, ["property", "unit", "data"]);

      if (propertyId) {
        await safeCreatePropertyOwnerLink(apiKey, contactId, propertyId);
        return created;
      }

      return created;
    } catch (error) {
      lastError = error;
      console.warn("PROPERTY CREATE ATTEMPT FAILED:", error.message);
    }
  }

  throw lastError;
}

async function safeCreatePropertyOwnerLink(apiKey, contactId, propertyId) {
  const payloads = [
    {
      endpoint: "/relationships",
      payload: {
        relationship: {
          internal_name: "owner",
          related_client_id: contactId,
          property_id: propertyId,
        },
      },
    },
    {
      endpoint: "/relationships",
      payload: {
        relationship: {
          client_id: contactId,
          property_id: propertyId,
          internal_name: "owner",
        },
      },
    },
  ];

  for (const item of payloads) {
    try {
      return await propstackPost(apiKey, item.endpoint, item.payload);
    } catch (error) {
      console.warn("OWNER LINK ATTEMPT FAILED:", error.message);
    }
  }

  return { ok: false, skipped: true, reason: "Eigentümer-Verknüpfung separat nicht akzeptiert." };
}

async function maybeCreateSearchProfile(apiKey, contactId, lead, note) {
  const shouldCreate =
    lead.concernType === "buy" ||
    lead.concernType === "investment";

  if (!shouldCreate) {
    return {
      ok: true,
      skipped: true,
      reason: "Für diesen Lead-Typ kein Suchprofil erforderlich.",
    };
  }

  const savedQuery = removeEmpty({
    client_id: contactId,
    active: true,
    marketing_type: "BUY",
    cities: lead.location ? [extractCity(lead.location)] : [],
    regions: lead.location ? [lead.location] : [],
    price_to: lead.budgetNumber,
    rs_types: [mapRsType(lead.objectType)],
    note,
    partial_custom_fields: removeEmpty({
      suchgebiet: lead.location,
      budget: lead.budget,
      budget_zahl: lead.budgetNumber,
      immobilienart: lead.objectType,
      zeitrahmen: lead.timeframe,
      quelle_url: lead.sourceUrl,
      website_lead: true,
    }),
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
    reason: "Suchprofil konnte per API nicht angelegt werden. Daten stehen im Kontakt und in der Aktivität.",
    payload: savedQuery,
  };
}

async function safeCreateDeal(apiKey, input) {
  try {
    return await createDeal(apiKey, input);
  } catch (error) {
    console.warn("DEAL CREATE SKIPPED:", error.message);
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function createDeal(apiKey, input) {
  const dealPayload = {
    client_property: removeEmpty({
      client_id: input.contactId,
      property_id: input.propertyId,
      deal_stage_id: input.stageId,
      note: input.note,
      source: "Website Landingpage",
      price: input.lead?.budgetNumber || undefined,
      date: new Date().toISOString().slice(0, 10),
    }),
  };

  return await propstackPost(apiKey, "/client_properties", dealPayload);
}

async function safeCreateFollowUpTask(apiKey, contactId, propertyId, lead, note) {
  const title = getTaskTitle(lead);
  const dueAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const dueDate = dueAt.slice(0, 10);

  const task = removeEmpty({
    title,
    body: note,
    is_reminder: true,
    due_date: dueAt,
    client_ids: [contactId],
    property_ids: propertyId ? [propertyId] : undefined,
  });

  const fallbackTask = removeEmpty({
    title,
    body: note,
    is_reminder: true,
    due_date: dueDate,
    client_ids: [contactId],
    property_ids: propertyId ? [propertyId] : undefined,
  });

  const attempts = [
    { task },
    { task: fallbackTask },
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

async function findBestDealStage(apiKey, concernType) {
  const envKey = {
    sell: "PROPSTACK_DEAL_STAGE_SELL",
    rent: "PROPSTACK_DEAL_STAGE_RENT",
    buy: "PROPSTACK_DEAL_STAGE_BUY",
    investment: "PROPSTACK_DEAL_STAGE_BUY",
    finance: "PROPSTACK_DEAL_STAGE_FINANCE",
  }[concernType];

  if (envKey && process.env[envKey]) {
    return {
      id: Number(process.env[envKey]),
      name: `ENV ${envKey}`,
      source: "env",
    };
  }

  try {
    const pipelinesResponse = await propstackGet(apiKey, "/deal_pipelines");
    const pipelines = normalizeArray(pipelinesResponse);
    const allStages = [];

    for (const pipeline of pipelines) {
      const pipelineName = pipeline.name || pipeline.title || pipeline.label || "";
      const stages = pipeline.deal_stages || pipeline.stages || pipeline.client_property_stages || [];

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
        pipeline: stage.pipeline_name,
      }))
    );

    const wanted = getStageSearchTerms(concernType);

    for (const term of wanted) {
      const found = allStages.find((stage) =>
        normalize(`${stage.pipeline_name} ${stage.name}`).includes(term)
      );

      if (found) return found;
    }

    return null;
  } catch (error) {
    console.warn("DEAL STAGE LOOKUP SKIPPED:", error.message);
    return null;
  }
}

function getStageSearchTerms(concernType) {
  if (concernType === "sell") {
    return [
      "100eigentumerneuereigentumerlead",
      "100eigentuemerneuereigentuemerlead",
      "neuereigentumerlead",
      "neuereigentuemerlead",
      "akquise",
      "eigentumer",
      "eigentuemer",
    ];
  }

  if (concernType === "rent") {
    return [
      "300mieterneuermietinteressent",
      "neuermietinteressent",
      "vermietung",
      "mieter",
    ];
  }

  if (concernType === "buy" || concernType === "investment") {
    return [
      "200kauferneuerkaufinteressent",
      "200kaeuferneuerkaufinteressent",
      "neuerkaufinteressent",
      "kaufer",
      "kaeufer",
    ];
  }

  if (concernType === "finance") {
    return [
      "400finanzierungneuerfinanzierungslead",
      "neuerfinanzierungslead",
      "finanzierung",
    ];
  }

  return ["neuerlead", "neu", "lead"];
}

async function findPropertyStatusId(apiKey, wantedName) {
  if (process.env.PROPSTACK_PROPERTY_STATUS_AKQUISE) {
    return Number(process.env.PROPSTACK_PROPERTY_STATUS_AKQUISE);
  }

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
          property_id: input.propertyId || undefined,
          client_id: input.propertyId ? undefined : input.contactId,
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

function buildAcquisitionTitle(objectType, location) {
  const type = clean(objectType) || "Immobilie";
  const place = clean(location);

  return place ? `Akquise: ${type} in ${place}` : `Akquise: ${type}`;
}

function getWebsitePriority(lead) {
  if (lead.documents.length > 0) return "Hoch";
  if (lead.hasPropertyDetails) return "Hoch";
  if (lead.budgetNumber && lead.budgetNumber >= 500000) return "Mittel";
  return "Mittel";
}

function getId(response, keys) {
  if (!response) return null;
  if (response.id) return response.id;

  for (const key of keys) {
    if (response[key] && response[key].id) return response[key].id;
  }

  if (response.data && response.data.id) return response.data.id;
  if (response.ok && response.property_id) return response.property_id;

  return null;
}

function normalizeArray(response) {
  if (Array.isArray(response)) return response;

  for (const key of [
    "data",
    "deal_pipelines",
    "pipelines",
    "property_statuses",
    "statuses",
    "events",
    "tasks",
    "saved_queries",
  ]) {
    if (Array.isArray(response?.[key])) return response[key];
  }

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

function boolFromGerman(value) {
  const text = normalize(value);

  if (!text) return undefined;
  if (text === "ja" || text === "true") return true;
  if (text === "nein" || text === "false") return false;

  return undefined;
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

function removeKeys(object, keys) {
  const copy = { ...object };
  keys.forEach((key) => delete copy[key]);
  return copy;
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
