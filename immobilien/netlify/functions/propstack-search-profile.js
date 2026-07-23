const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
  console.log("PROPSTACK SEARCH PROFILE START", event.httpMethod);

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    console.log("SEARCH PROFILE PAYLOAD:", JSON.stringify(data, null, 2));

    const firstName = clean(data.first_name || data.firstName);
    const lastName = clean(data.last_name || data.lastName);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const marketingType = normalizeMarketingType(data.marketing_type || data.marketingType);
    const propertyType = normalizeObjectType(data.property_type || data.object_type || data.objectType);
    const location = clean(data.location || data.city || data.suchgebiet);
    const budget = clean(data.budget || data.price_to || data.price);
    const budgetNumber = numberOrNull(budget);
    const rooms = numberOrNull(data.rooms);
    const livingSpace = numberOrNull(data.living_space || data.livingSpace);
    const bedrooms = numberOrNull(data.bedrooms);
    const bathrooms = numberOrNull(data.bathrooms);
    const plotArea = numberOrNull(data.plot_area || data.plotArea);
    const features = Array.isArray(data.features) ? data.features.map(clean).filter(Boolean) : [];
    const message = clean(data.message || data.nachricht);
    const sourceUrl = clean(data.source_url || data.sourceUrl);
    const utmSource = clean(data.utm_source);
    const utmMedium = clean(data.utm_medium);
    const utmCampaign = clean(data.utm_campaign);
    const utmContent = clean(data.utm_content);
    const utmTerm = clean(data.utm_term);

    const consent =
      data.privacy_consent === true ||
      data.privacy_consent === "true" ||
      data.newsletter_consent === true ||
      data.newsletter_consent === "true";

    if (!email || !location || !consent) {
      return json(400, {
        success: false,
        error: "E-Mail, Suchgebiet und Einwilligung sind erforderlich."
      });
    }

    const fullName = `${firstName} ${lastName}`.trim() || email;
    const note = buildNote({
      fullName,
      email,
      phone,
      marketingType,
      propertyType,
      location,
      budget,
      budgetNumber,
      rooms,
      livingSpace,
      bedrooms,
      bathrooms,
      plotArea,
      features,
      message,
      sourceUrl,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm
    });

    const contactPayload = {
      client: removeEmpty({
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email,
        phone,
        source: "Website Gesuch",
        description: note,
        note,
        warning_notice: "Newsletter / Gesuch prüfen",
        buyer: true,
        newsletter: true,
        property_mailing_wanted: true,
        accept_contact: true,
        gdpr_status: 2,
        partial_custom_fields: removeEmpty({
          website_lead: true,
          landingpage_typ: "Gesuch",
          anliegen: "Gesuch / Newsletter",
          lead_typ: marketingType === "RENT" ? "Miete" : "Kauf",
          immobilienart: propertyType,
          objektart: propertyType,
          suchgebiet: location,
          standort: location,
          budget,
          budget_zahl: budgetNumber,
          nachricht: message,
          quelle_url: sourceUrl,
          datenschutz_zugestimmt: true,
          newsletter_gewuenscht: true,
          immobilienmailing_gewuenscht: true,
          website_rohdaten: compactJson({ marketingType, propertyType, location, budget, rooms, livingSpace, bedrooms, bathrooms, plotArea, features, message, sourceUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }),
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm
        })
      })
    };

    const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);

    let contactUpdate = null;
    if (contactId) {
      contactUpdate = await safePut(apiKey, `/contacts/${contactId}`, {
        client: removeEmpty({
          description: note,
          note,
          warning_notice: "Newsletter / Gesuch prüfen",
          newsletter: true,
          property_mailing_wanted: true,
          accept_contact: true,
          gdpr_status: 2,
          partial_custom_fields: contactPayload.client.partial_custom_fields
        })
      });
    }

    const searchProfile = contactId
      ? await safeCreateSearchProfile(apiKey, {
          contactId,
          marketingType,
          location,
          propertyType,
          budgetNumber,
          rooms,
          livingSpace,
          bedrooms,
          bathrooms,
          plotArea,
          features,
          note
        })
      : null;

    const task = contactId ? await safeCreateTask(apiKey, contactId, note, fullName, marketingType) : null;

    return json(200, {
      success: true,
      message: "Gesuch wurde übermittelt.",
      contact_id: contactId,
      contact: contactResponse,
      contact_update: contactUpdate,
      search_profile: searchProfile,
      task
    });
  } catch (error) {
    console.error("PROPSTACK SEARCH PROFILE ERROR:", error);
    return json(500, {
      success: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null
    });
  }
};

function buildNote(input) {
  return [
    "Neue Gesuch-/Newsletter-Anmeldung über die Website",
    "",
    `Name: ${input.fullName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone || "-"}`,
    `Kauf/Miete: ${input.marketingType === "RENT" ? "Miete" : "Kauf"}`,
    `Objektart: ${input.propertyType || "-"}`,
    `Suchgebiet: ${input.location || "-"}`,
    `Budget / Preis bis: ${input.budget || "-"}`,
    `Zimmer ab: ${input.rooms || "-"}`,
    `Wohnfläche ab: ${input.livingSpace || "-"}`,
    `Schlafzimmer ab: ${input.bedrooms || "-"}`,
    `Badezimmer ab: ${input.bathrooms || "-"}`,
    `Grundstück ab: ${input.plotArea || "-"}`,
    `Wünsche / Ausstattung: ${input.features && input.features.length ? input.features.join(", ") : "-"}`,
    "",
    "Nachricht:",
    input.message || "-",
    "",
    "Einwilligung:",
    "Newsletter, Immobilienmailing und Kontaktaufnahme wurden aktiv bestätigt.",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${input.sourceUrl || "-"}`,
    `UTM Source: ${input.utmSource || "-"}`,
    `UTM Medium: ${input.utmMedium || "-"}`,
    `UTM Campaign: ${input.utmCampaign || "-"}`,
    `UTM Content: ${input.utmContent || "-"}`,
    `UTM Term: ${input.utmTerm || "-"}`
  ].join("\n");
}

async function safeCreateSearchProfile(apiKey, input) {
  const savedQuery = removeEmpty({
    client_id: input.contactId,
    active: true,
    marketing_type: input.marketingType,
    cities: input.location ? [extractCity(input.location)] : [],
    regions: input.location ? [input.location] : [],
    price_to: input.marketingType === "BUY" ? input.budgetNumber : undefined,
    base_rent_to: input.marketingType === "RENT" ? input.budgetNumber : undefined,
    living_space: input.livingSpace,
    number_of_rooms: input.rooms,
    number_of_bedrooms: input.bedrooms,
    number_of_bathrooms: input.bathrooms,
    plot_area: input.plotArea,
    rs_types: input.propertyType ? [mapRsType(input.propertyType)] : undefined,
    note: input.note,
    internal_note: input.note,
    partial_custom_fields: removeEmpty({
      website_lead: true,
      newsletter_gewuenscht: true,
      immobilienmailing_gewuenscht: true,
      suchgebiet: input.location,
      budget_zahl: input.budgetNumber,
      immobilienart: input.propertyType,
      objektart: input.propertyType,
      ausstattung: input.features && input.features.length ? input.features.join(", ") : undefined
    })
  });

  const attempts = [
    { endpoint: "/saved_queries", body: { saved_query: savedQuery } },
    { endpoint: "/saved_queries", body: savedQuery },
    { endpoint: "/search_profiles", body: { search_profile: savedQuery } }
  ];

  let lastError = null;
  for (const attempt of attempts) {
    try {
      return await propstackPost(apiKey, attempt.endpoint, attempt.body);
    } catch (error) {
      lastError = error;
      console.warn("SEARCH PROFILE CREATE ATTEMPT FAILED:", error.message);
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastError ? lastError.message : "Suchprofil konnte per API nicht angelegt werden. Daten stehen im Kontakt."
  };
}

async function safeCreateTask(apiKey, contactId, note, fullName, marketingType) {
  const task = {
    task: removeEmpty({
      title: `Gesuch prüfen: ${marketingType === "RENT" ? "Miete" : "Kauf"} – ${fullName}`,
      body: note,
      is_reminder: true,
      due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      client_ids: [contactId]
    })
  };

  try {
    return await propstackPost(apiKey, "/tasks", task);
  } catch (error) {
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function safePut(apiKey, endpoint, body) {
  try {
    return await propstackPut(apiKey, endpoint, body);
  } catch (error) {
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  return parseResponse(response, endpoint);
}

async function propstackPut(apiKey, endpoint, body) {
  console.log("PROPSTACK PUT:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  return parseResponse(response, endpoint);
}

async function parseResponse(response, endpoint) {
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

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberOrNull(value) {
  const text = clean(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isNaN(n) ? null : n;
}

function normalizeMarketingType(value) {
  const text = normalize(value);
  if (text.includes("miet") || text === "rent") return "RENT";
  return "BUY";
}

function normalizeObjectType(value) {
  const raw = clean(value);
  const text = normalize(raw);
  if (!raw) return "";
  if (text.includes("mehrfamilien")) return "Mehrfamilienhaus";
  if (text.includes("grund")) return "Grundstück";
  if (text.includes("gewerbe") || text.includes("buro") || text.includes("praxis")) return "Gewerbe";
  if (text.includes("kapital") || text.includes("anlage")) return "Kapitalanlage";
  if (text.includes("haus")) return "Haus";
  if (text.includes("wohnung") || text.includes("penthouse") || text.includes("loft")) return "Wohnung";
  return raw;
}

function mapRsType(value) {
  const text = normalize(value);
  if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE";
  if (text.includes("grund")) return "PLOT";
  if (text.includes("gewerbe")) return "COMMERCIAL_UNIT";
  if (text.includes("kapital") || text.includes("anlage")) return "INVEST_FREEHOLD_FLAT";
  if (text.includes("haus")) return "SINGLE_FAMILY_HOUSE";
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

function extractCity(value) {
  return clean(value).split(",")[0].replace(/\d{5}/g, "").trim();
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

function removeEmpty(object) {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
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

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}
