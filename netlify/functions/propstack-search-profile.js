const { sendInternalNotification } = require("./_shared/mailer");
const logsafe = require("./_shared/logsafe");
const zustellung = require("./_shared/zustellung");
const PROPSTACK_BASE_URL = require("./_shared/propstack-basis").basis();

exports.handler = async function (event) {
  // Update 31 §3: keine Personendaten ins Log
  const requestId = logsafe.requestId(event);
  console.log("PROPSTACK SEARCH PROFILE START", { requestId, method: event.httpMethod });

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    console.log("SEARCH PROFILE EINGANG:", { requestId, form: "suchprofil", marketing: data.marketing_type || data.marketingType || "-", felder: Object.keys(data).length });

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
    // Mehrfamilienhaus und Kapitalanlage (31.10.2026): Einheiten ab und Bruttorendite ab in Prozent
    const units = numberOrNull(data.units);
    const grossYield = decimalOrNull(data.gross_yield || data.grossYield);
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
      units,
      grossYield,
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
        warning_notice: "Gesuch prüfen",
        buyer: true,
        // Update 32 §7.6: Die Suchformulare haben kein Newsletter-Kästchen, also nie newsletter setzen. Die Einwilligung
        // („über passende Immobilienangebote informiert werden“) deckt das Immobilienmailing.
        property_mailing_wanted: true,
        accept_contact: true,
        gdpr_status: 2,
        partial_custom_fields: removeEmpty({
          website_lead: true,
          landingpage_typ: "Gesuch",
          anliegen: "Gesuch",
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
          immobilienmailing_gewuenscht: true,
          website_rohdaten: compactJson({ marketingType, propertyType, location, budget, rooms, livingSpace, bedrooms, bathrooms, plotArea, units, grossYield, features, message, sourceUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }),
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm
        })
      })
    };

    // Update 32 §1: Rücklesen nach jedem Schreiben, Rückfall-Mail wenn etwas fehlt (_shared/zustellung.js)
    const api = zustellung.propstack(apiKey, PROPSTACK_BASE_URL);
    const formular = `propstack-search-profile (${marketingType === "RENT" ? "Mietgesuch" : "Kaufgesuch"})`;
    const prot = zustellung.protokoll(api, formular, requestId);

    let contactId = null;
    try {
      const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
      contactId = await prot.pruefen("Kontakt", getId(contactResponse, ["client", "contact", "data"]), { endpoint: "/contacts" });
    } catch (error) {
      prot.fehlgeschlagen("Kontakt", "/contacts", error);
    }

    if (contactId) {
      await safePut(apiKey, `/contacts/${contactId}`, {
        client: removeEmpty({
          description: note,
          note,
          warning_notice: "Gesuch prüfen",
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

    if (searchProfile) {
      if (searchProfile.ok === false) prot.fehlgeschlagen("Suchprofil", "/saved_queries", searchProfile.error);
      else await prot.pruefen("Suchprofil", zustellung.idAus(searchProfile), { kontaktId: contactId, endpoint: "/saved_queries" });
    }

    const task = contactId ? await safeCreateTask(apiKey, contactId, note, fullName, marketingType) : null;
    if (task) {
      if (task.ok === false) prot.fehlgeschlagen("Aufgabe", "/tasks", task.error);
      else await prot.pruefen("Aufgabe", zustellung.idAus(task), { endpoint: "/tasks" });
    }

    // Update 32 §1.2: alles angekommen → gewohnte Mail „Neues Kaufgesuch/Mietgesuch: …“; sonst die Rückfall-Mail
    const internalNotification = prot.fehlend().length
      ? await zustellung.rueckfallMail({ formular, requestId, text: note, replyTo: email, protokoll: prot })
      : await sendInternalNotification({
          subject: `Neues ${marketingType === "RENT" ? "Mietgesuch" : "Kaufgesuch"}: ${fullName}`,
          replyTo: email,
          text: note,
        });

    if (!contactId && !internalNotification.sent) {
      return zustellung.oeffentlich(502, { success: false, error: "Das Gesuch konnte gerade nicht gesendet werden." });
    }

    // Antwort an den Browser: nur success und message
    return zustellung.oeffentlich(200, { success: true, message: "Gesuch wurde übermittelt." });
  } catch (error) {
    console.error("PROPSTACK SEARCH PROFILE ERROR:", { requestId, ...logsafe.error(error) });
    return zustellung.oeffentlich(500, { success: false, error: "Das Gesuch konnte gerade nicht gesendet werden." });
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
    `${input.propertyType === "Gewerbe" ? "Fläche ab" : "Wohnfläche ab"}: ${input.livingSpace || "-"}`,
    `Schlafzimmer ab: ${input.bedrooms || "-"}`,
    `Badezimmer ab: ${input.bathrooms || "-"}`,
    `Grundstück ab: ${input.plotArea || "-"}`,
    `Einheiten ab: ${input.units || "-"}`,
    `Bruttorendite ab: ${input.grossYield ? `${String(input.grossYield).replace(".", ",")} %` : "-"}`,
    `Wünsche / Ausstattung: ${input.features && input.features.length ? input.features.join(", ") : "-"}`,
    "",
    "Nachricht:",
    input.message || "-",
    "",
    "Einwilligung:",
    "Kontaktaufnahme zum Suchprofil und Information über passende Immobilienangebote wurden aktiv bestätigt (kein Newsletter).",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${input.sourceUrl || "-"}`,
    `UTM Source: ${input.utmSource || "-"}`,
    `UTM Medium: ${input.utmMedium || "-"}`,
    `UTM Campaign: ${input.utmCampaign || "-"}`,
    `UTM Content: ${input.utmContent || "-"}`,
    `UTM Term: ${input.utmTerm || "-"}`
  ].join("\n");
}

// Suchkriterien (Update 7, §1, 28.10.2026, Timon: „Suchkriterien mit übernehmen.“): Jedes Kriterium des Formulars geht
// in das passende Feld des Propstack-Suchprofils (POST /saved_queries, Felder laut docs.propstack.de/reference/suchprofile,
// gelesen am 28.10.2026). Was Propstack nicht als Feld kennt (Badezimmer, Stellplatz, Barrierefrei, Off-Market, Nachricht),
// steht weiter in der Notiz des Suchprofils und im Kontakt. Vorher gingen die Objektarten mit Werten an Propstack, die es
// dort nicht gibt (z. B. SINGLE_FAMILY_HOUSE als rs_types), und bei einem Fehler legten die Ausweichversuche das Profil
// ohne die Hülle „saved_query“ an, also ohne Kriterien. Jetzt gibt es nur noch den dokumentierten Aufruf.
// Einheiten ab und Bruttorendite ab (31.10.2026) haben in der Doku kein Feld (yield_actual steht nur im GET-Beispiel,
// ohne Beschreibung); sie stehen deshalb in der Notiz des Suchprofils und im Kontakt.
async function safeCreateSearchProfile(apiKey, input) {
  const savedQuery = buildSavedQuery(input);
  try {
    return await propstackPost(apiKey, "/saved_queries", { saved_query: savedQuery });
  } catch (error) {
    console.warn("SEARCH PROFILE CREATE FAILED:", logsafe.msg(error));
    return { ok: false, skipped: true, error };
  }
}

function buildSavedQuery(input) {
  const buy = input.marketingType !== "RENT";
  const types = mapRsTypes(input.propertyType);
  const features = (input.features || []).map(normalize);
  const has = (key) => (features.some((f) => f.includes(key)) ? "true" : undefined);
  const location = splitLocation(input.location);
  return removeEmpty({
    client_id: input.contactId,
    active: true,
    marketing_type: input.marketingType,
    cities: location.cities,
    regions: location.regions,
    rs_types: types.rsTypes,
    rs_categories: types.rsCategories,
    price_to: buy ? input.budgetNumber : undefined,
    base_rent_to: buy ? undefined : input.budgetNumber,
    number_of_rooms: input.rooms,
    living_space: input.livingSpace,
    number_of_bedrooms: input.bedrooms,
    plot_area: input.plotArea,
    balcony: has("balkon"),
    garden: has("garten"),
    lift: has("aufzug"),
    cellar: has("keller"),
    built_in_kitchen: has("einbaukuche"),
    note: input.note
  });
}

// Objektart des Formulars → rs_types (und rs_categories) laut Propstack-Doku „Objekte“.
// Kapitalanlagen stehen bei F&G in Propstack als Wohnung mit Zusatzfeld, deshalb Wohnung und Anlageobjekt.
function mapRsTypes(value) {
  const text = normalize(value);
  if (!text) return {};
  if (text.includes("mehrfamilien")) return { rsTypes: ["HOUSE"], rsCategories: ["MULTI_FAMILY_HOUSE"] };
  if (text.includes("grund")) return { rsTypes: ["TRADE_SITE"] };
  if (text.includes("gewerbe")) return { rsTypes: ["OFFICE", "STORE", "GASTRONOMY", "INDUSTRY"] };
  if (text.includes("kapital") || text.includes("anlage")) return { rsTypes: ["APARTMENT", "INVESTMENT"] };
  if (text.includes("haus")) return { rsTypes: ["HOUSE"] };
  if (text.includes("wohnung")) return { rsTypes: ["APARTMENT"] };
  return {};
}

// Suchgebiet als Freitext („Berlin-Steglitz“, „Potsdam, Teltow“) → cities als einfache Ortsnamen wie in der Doku
// („Berlin oder München“). Ein Bezirk mit Bindestrich bringt seine Stadt mit („Berlin-Steglitz“ → auch „Berlin“);
// Ortsnamen mit Bindestrich oder Schrägstrich wie „Blankenfelde-Mahlow“ oder „Petershagen/Eggersdorf“ bleiben ganz.
// regions nimmt nur Bundesländer.
function splitLocation(value) {
  const parts = clean(value)
    .split(/\s*(?:,|;|\bund\b|\boder\b)\s*/i)
    .map((part) => part.replace(/\b\d{5}\b/g, "").trim())
    .filter(Boolean);
  const states = ["Berlin", "Brandenburg", "Sachsen", "Sachsen-Anhalt", "Mecklenburg-Vorpommern", "Thüringen"];
  const bigCities = ["Berlin", "Leipzig", "Dresden", "Potsdam"];
  const cities = [];
  const regions = [];
  for (const part of parts) {
    const state = states.find((name) => name.toLowerCase() === part.toLowerCase());
    if (state && state !== "Berlin") {
      regions.push(state);
      continue;
    }
    cities.push(part);
    const base = bigCities.find((name) => part.toLowerCase().startsWith(`${name.toLowerCase()}-`) || part.toLowerCase().startsWith(`${name.toLowerCase()} `));
    if (base) cities.push(base);
  }
  return { cities: [...new Set(cities)], regions: [...new Set(regions)] };
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
    return { ok: false, skipped: true, error };
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
  console.log("PROPSTACK POST:", logsafe.endpoint(endpoint));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    // Dringend-Fix 02.11.: Schreibanfragen folgen keiner Umleitung (sonst wird aus POST ein GET)
    redirect: "manual",
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
  console.log("PROPSTACK PUT:", logsafe.endpoint(endpoint));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    // Dringend-Fix 02.11.: Schreibanfragen folgen keiner Umleitung (sonst wird aus POST ein GET)
    redirect: "manual",
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

  console.log("PROPSTACK RESPONSE:", logsafe.endpoint(endpoint), response.status);

  if (!response.ok) {
    throw logsafe.propstackError(response.status, endpoint, data);
  }

  return data;
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

// Prozentwerte wie „4,5“ oder „4.5“: Punkt und Komma sind hier Dezimalzeichen, nicht Tausenderpunkt.
function decimalOrNull(value) {
  const text = clean(value).replace(",", ".").replace(/[^\d.]/g, "");
  if (!text) return null;
  const n = Number(text);
  return Number.isNaN(n) ? null : n;
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

function getId(response, keys) {
  if (!response) return null;
  if (response.id) return response.id;
  for (const key of keys) {
    if (response[key] && response[key].id) return response[key].id;
  }
  if (response.data && response.data.id) return response.data.id;
  return null;
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

// Formulare ohne JavaScript (Update 6, §1): POST als Formular → gleiche Nutzlast, dann Weiterleitung. Siehe _shared/formpost.js.
exports.handler = require("./_shared/formpost").wrap("propstack-search-profile", exports.handler);
