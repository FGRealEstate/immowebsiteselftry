const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
  console.log("PROPSTACK NEWSLETTER START", event.httpMethod);

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    console.log("NEWSLETTER PAYLOAD:", JSON.stringify(data, null, 2));

    const firstName = clean(data.first_name || data.firstName);
    const lastName = clean(data.last_name || data.lastName);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const location = clean(data.location);
    const budget = clean(data.budget);
    const budgetNumber = numberOrNull(budget);
    const propertyType = normalizeObjectType(clean(data.property_type || data.object_type));
    const marketingType = clean(data.marketing_type || "BUY").toUpperCase() === "RENT" ? "RENT" : "BUY";
    const rooms = numberOrNull(data.rooms);
    const livingSpace = numberOrNull(data.living_space);
    const message = clean(data.message);
    const sourceUrl = clean(data.source_url);
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

    if (!email || !consent) {
      return json(400, { success: false, error: "E-Mail und Newsletter-Einwilligung sind erforderlich." });
    }

    const fullName = `${firstName} ${lastName}`.trim() || email;

    const note = [
      "Neue Newsletter-/Suchprofil-Anmeldung über die Website",
      "",
      `Name: ${fullName}`,
      `E-Mail: ${email}`,
      `Telefon: ${phone || "-"}`,
      `Suchgebiet: ${location || "-"}`,
      `Kauf/Miete: ${marketingType}`,
      `Objektart: ${propertyType || "-"}`,
      `Budget: ${budget || "-"}`,
      `Zimmer ab: ${rooms || "-"}`,
      `Fläche ab: ${livingSpace || "-"}`,
      "",
      "Nachricht:",
      message || "-",
      "",
      "Einwilligung: Newsletter und Immobilienmailing wurden aktiv bestätigt.",
      `Zeitpunkt: ${new Date().toISOString()}`,
      `Quelle: ${sourceUrl || "-"}`,
      `UTM Source: ${utmSource || "-"}`,
      `UTM Medium: ${utmMedium || "-"}`,
      `UTM Campaign: ${utmCampaign || "-"}`,
      `UTM Content: ${utmContent || "-"}`,
      `UTM Term: ${utmTerm || "-"}`
    ].join("\n");

    const contactPayload = {
      client: removeEmpty({
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email,
        phone,
        source: "Website Newsletter",
        description: note,
        note,
        buyer: true,
        newsletter: true,
        property_mailing_wanted: true,
        accept_contact: true,
        gdpr_status: 2,
        partial_custom_fields: removeEmpty({
          website_lead: true,
          anliegen: "Newsletter / Suchprofil",
          lead_typ: "Kauf",
          landingpage_typ: "Newsletter",
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
          website_rohdaten: compactJson({ marketingType, propertyType, location, budget, rooms, livingSpace, message, sourceUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }),
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
          newsletter: true,
          property_mailing_wanted: true,
          accept_contact: true,
          gdpr_status: 2,
          partial_custom_fields: contactPayload.client.partial_custom_fields
        })
      });
    }

    const noteResult = contactId ? await safeCreateNote(apiKey, contactId, note, `Newsletter/Suchprofil: ${fullName}`) : null;

    let searchProfile = null;
    if (contactId && (location || budgetNumber || propertyType || rooms || livingSpace)) {
      searchProfile = await safeCreateSearchProfile(apiKey, {
        contactId,
        marketingType,
        location,
        propertyType,
        budgetNumber,
        rooms,
        livingSpace,
        note
      });
    }

    const task = contactId ? await safeCreateTask(apiKey, contactId, note, fullName) : null;

    return json(200, {
      success: true,
      message: "Newsletter-Anmeldung wurde übermittelt.",
      contact_id: contactId,
      contact: contactResponse,
      contact_update: contactUpdate,
      note: noteResult,
      search_profile: searchProfile,
      task
    });
  } catch (error) {
    console.error("PROPSTACK NEWSLETTER ERROR:", error);
    return json(500, { success: false, error: error.message });
  }
};

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
    rs_types: input.propertyType ? [mapRsType(input.propertyType)] : undefined,
    note,
    partial_custom_fields: removeEmpty({
      suchgebiet: input.location,
      budget_zahl: input.budgetNumber,
      immobilienart: input.propertyType,
      website_lead: true,
      newsletter_gewuenscht: true,
      immobilienmailing_gewuenscht: true
    })
  });

  const attempts = [
    { endpoint: "/saved_queries", body: { saved_query: savedQuery } },
    { endpoint: "/search_profiles", body: { search_profile: savedQuery } }
  ];

  for (const attempt of attempts) {
    try {
      return await propstackPost(apiKey, attempt.endpoint, attempt.body);
    } catch (error) {
      console.warn("NEWSLETTER SEARCH PROFILE ATTEMPT FAILED:", error.message);
    }
  }

  return { ok: false, skipped: true, reason: "Suchprofil konnte per API nicht angelegt werden. Daten stehen im Kontakt." };
}

async function safeCreateNote(apiKey, contactId, body, title) {
  const attempts = [
    { note: { client_id: contactId, title, body, note_type: "note" } },
    { note: { client_id: contactId, title, text: body } }
  ];
  for (const payload of attempts) {
    try { return await propstackPost(apiKey, "/notes", payload); } catch (error) { console.warn("NEWSLETTER NOTE ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Notiz konnte nicht separat angelegt werden." };
}

async function safeCreateTask(apiKey, contactId, note, fullName) {
  const task = {
    task: removeEmpty({
      title: `Newsletter/Suchprofil prüfen: ${fullName}`,
      body: note,
      due_date: new Date().toISOString().slice(0, 10),
      client_ids: [contactId]
    })
  };
  try { return await propstackPost(apiKey, "/tasks", task); } catch (error) { return { ok: false, skipped: true, reason: error.message }; }
}

async function safePut(apiKey, endpoint, body) {
  try { return await propstackPut(apiKey, endpoint, body); } catch (error) { return { ok: false, skipped: true, reason: error.message }; }
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response, endpoint);
}

async function propstackPut(apiKey, endpoint, body) {
  console.log("PROPSTACK PUT:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response, endpoint);
}

async function parseResponse(response, endpoint) {
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  console.log("PROPSTACK RESPONSE:", endpoint, response.status, data);
  if (!response.ok) throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

function clean(value) { if (value === null || value === undefined) return ""; return String(value).trim(); }
function numberOrNull(value) { const text = clean(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""); if (!text) return null; const n = Number(text); return Number.isNaN(n) ? null : n; }
function getId(response, keys) { if (!response) return null; if (response.id) return response.id; for (const key of keys) if (response[key]?.id) return response[key].id; if (response.data?.id) return response.data.id; return null; }
function extractCity(value) { return clean(value).split(",")[0].replace(/\d{5}/g, "").trim(); }
function normalize(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss").replace(/[^a-z0-9]+/g, ""); }
function normalizeObjectType(value) { const n = normalize(value); if(!value) return ""; if(n.includes("wohnung")) return "Wohnung"; if(n.includes("mehrfamilien")) return "Mehrfamilienhaus"; if(n.includes("haus")) return "Haus"; if(n.includes("grund")) return "Grundstück"; if(n.includes("gewerbe")) return "Gewerbe"; if(n.includes("kapital") || n.includes("anlage")) return "Kapitalanlage"; return value; }
function mapRsType(value) { const text = normalize(value); if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE"; if (text.includes("haus")) return "SINGLE_FAMILY_HOUSE"; if (text.includes("grund")) return "PLOT"; if (text.includes("gewerbe")) return "COMMERCIAL_UNIT"; if (text.includes("kapital") || text.includes("anlage")) return "INVEST_FREEHOLD_FLAT"; return "APARTMENT"; }
function removeEmpty(object) { const result = {}; for (const [key, value] of Object.entries(object)) { if (value === null || value === undefined || value === "") continue; if (Array.isArray(value) && value.length === 0) continue; result[key] = value; } return result; }
function compactJson(value) { try { return JSON.stringify(value); } catch { return ""; } }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }

