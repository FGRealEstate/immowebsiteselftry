const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
  console.log("PROPSTACK NEWSLETTER START", event.httpMethod);
  try {
    if (event.httpMethod !== "POST") return json(405, { success: false, error: "Method not allowed" });
    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });

    const data = JSON.parse(event.body || "{}");
    const firstName = clean(data.first_name || data.firstName);
    const lastName = clean(data.last_name || data.lastName);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const location = clean(data.location);
    const budget = clean(data.budget);
    const propertyType = clean(data.property_type || data.object_type);
    const marketingType = clean(data.marketing_type || "BUY").toUpperCase() === "RENT" ? "RENT" : "BUY";
    const rooms = numberOrNull(data.rooms);
    const livingSpace = numberOrNull(data.living_space);
    const message = clean(data.message);
    const sourceUrl = clean(data.source_url);
    const consent = data.privacy_consent === true || data.privacy_consent === "true" || data.newsletter_consent === true || data.newsletter_consent === "true";

    if (!email || !consent) return json(400, { success: false, error: "E-Mail und Newsletter-Einwilligung sind erforderlich." });

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
      `Quelle: ${sourceUrl || "-"}`
    ].join("\n");

    const contactResponse = await propstackPost(apiKey, "/contacts", {
      client: removeEmpty({
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email,
        phone,
        source: "Website Newsletter",
        note,
        buyer: true,
        newsletter: true,
        property_mailing_wanted: true,
        accept_contact: true,
        partial_custom_fields: removeEmpty({
          website_newsletter: true,
          newsletter_gewuenscht: true,
          immobilienmailing_gewuenscht: true,
          suchprofil_gewuenscht: true,
          suchgebiet: location,
          budget,
          immobilienart: propertyType,
          quelle_url: sourceUrl
        })
      })
    });

    const contactId = getId(contactResponse, ["client", "contact", "data"]);
    let searchProfile = null;
    if (contactId && (location || budget || propertyType || rooms || livingSpace)) {
      searchProfile = await safeCreateSearchProfile(apiKey, {
        contactId,
        marketingType,
        location,
        propertyType,
        budget,
        rooms,
        livingSpace,
        note
      });
    }

    return json(200, { success: true, message: "Newsletter-Anmeldung wurde übermittelt.", contact_id: contactId, contact: contactResponse, search_profile: searchProfile });
  } catch (error) {
    console.error("PROPSTACK NEWSLETTER ERROR:", error);
    return json(500, { success: false, error: error.message });
  }
};

async function safeCreateSearchProfile(apiKey, input) {
  try {
    return await propstackPost(apiKey, "/saved_queries", {
      saved_query: removeEmpty({
        client_id: input.contactId,
        active: true,
        marketing_type: input.marketingType,
        cities: input.location ? [extractCity(input.location)] : [],
        regions: input.location ? [input.location] : [],
        price_to: input.marketingType === "BUY" ? numberOrNull(input.budget) : undefined,
        base_rent_to: input.marketingType === "RENT" ? numberOrNull(input.budget) : undefined,
        living_space: input.livingSpace,
        number_of_rooms: input.rooms,
        rs_types: [mapRsType(input.propertyType)],
        note: input.note
      })
    });
  } catch (error) {
    console.warn("NEWSLETTER SEARCH PROFILE SKIPPED:", error.message);
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
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
function normalize(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, ""); }
function mapRsType(value) { const text = normalize(value); if (text.includes("haus")) return "SINGLE_FAMILY_HOUSE"; if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE"; if (text.includes("grund")) return "PLOT"; if (text.includes("gewerbe")) return "COMMERCIAL_UNIT"; return "APARTMENT"; }
function removeEmpty(object) { const result = {}; for (const [key, value] of Object.entries(object)) { if (value === null || value === undefined || value === "") continue; if (Array.isArray(value) && value.length === 0) continue; result[key] = value; } return result; }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
