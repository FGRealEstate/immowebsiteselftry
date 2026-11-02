const { sendInternalNotification } = require("./_shared/mailer");
const nachfrage = require("./_shared/nachfrage");
const logsafe = require("./_shared/logsafe");
const PROPSTACK_BASE_URL = require("./_shared/propstack-basis").basis();

/**
 * netlify/functions/propstack-lead.js
 * Stabiler Lead-Prozess für Landingpage:
 *
 * Ziel:
 * - Kontakt zuverlässig anlegen/aktualisieren
 * - alle Formular-/Objektdaten verlustfrei im CRM speichern
 * - Käufer/Kapitalanlage: Suchprofil mit erweiterten Suchkriterien anlegen, wenn möglich
 * - Verkäufer/Vermieter: Kontakt wird als Eigentümer markiert + Bemerkung + Aufgabe
 * - Finanzierung: wird deutlich am Kontakt/Custom Field/Warnhinweis markiert
 * - Objektanlage V2: keine invaliden Felder property_space_value/internal_note/name mehr
 * - KEINE automatische Objektanlage per /units, damit Propstack keine fehlerhaften Objekte blockiert
 *
 * Objektanlage wird später separat richtig gebaut:
 * Kontakt -> Property/Objekt -> Eigentümerverknüpfung -> Deal
 */

exports.handler = async function (event) {
  // Update 31 §3: nur Anfrage-ID, Formulartyp, fehlende Felder, Endpunkte und Status ins Log, keine Personendaten
  const requestId = logsafe.requestId(event);
  console.log("PROPSTACK LEAD START", { requestId, method: event.httpMethod });

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    const lead = normalizeLeadPayload(data);
    console.log("LEAD EINGANG:", { requestId, form: lead.concernType || "unbekannt", felder: Object.keys(data).length, dokumente: lead.documents.length });

    if (!lead.firstName || !lead.lastName || !lead.email || !lead.concernType || !lead.consent) {
      console.log("VALIDATION FAILED:", {
        requestId,
        form: lead.concernType || "unbekannt",
        missing: logsafe.missing(lead, ["firstName", "lastName", "email", "concernType", "consent"]),
      });

      return json(400, {
        success: false,
        error: "Pflichtfelder oder Datenschutz-Einwilligung fehlen.",
      });
    }

    // Update 28 §3.1: Wer „Mit einem Anruf“ wählt, muss eine Telefonnummer angeben (im Browser prüft fg-design.js das schon).
    if (normalize(lead.contactPreference) === "telefon" && !lead.phone) {
      console.log("VALIDATION FAILED:", { requestId, form: lead.concernType, missing: ["phone"] });
      return json(400, {
        success: false,
        error: "Bitte geben Sie Ihre Telefonnummer an, damit wir Sie anrufen können.",
      });
    }

    const note = buildNote(lead);
    const contactPayload = buildContactPayload(lead, note);

    const contactResponse = await createContactWithFallback(apiKey, contactPayload, lead, note);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);

    if (!contactId) {
      return json(500, {
        success: false,
        error: "Kontakt wurde erstellt/aktualisiert, aber keine Kontakt-ID erhalten.",
        // Dringend-Fix 02.11.: keine Propstack-Rohdaten an den Browser (die Umleitung lieferte hier eure Kontaktliste)
      });
    }

    console.log("CONTACT SAVED:", { requestId, contactId });

    const contactUpdateResult = await safeUpdateContact(apiKey, contactId, contactPayload.client);
    const searchProfileResult = await maybeCreateSearchProfile(apiKey, contactId, lead, note);

    // Verkauf/Vermietung: wenn der Eigentümer Objektdaten angibt, legen wir ein echtes Propstack-Objekt an
    // und verknüpfen den Kontakt direkt über relationships_attributes als owner.
    const propertyResult = await maybeCreateOwnerProperty(apiKey, contactId, lead, note);
    const propertyId = getId(propertyResult && propertyResult.result, ["property", "unit", "data"]);

    const dealResult = await maybeCreateDealForOwnerObject(apiKey, contactId, propertyId, lead, note);
    const taskResult = await safeCreateFollowUpTask(apiKey, contactId, lead, note);
    const documentResults = lead.documents.length
      ? await uploadDocuments(apiKey, { contactId, propertyId, documents: lead.documents })
      : [];

    // Interne Benachrichtigung zusätzlich zum Propstack-Kontakt / der Aufgabe.
    // Ein Mailfehler blockiert die CRM-Übermittlung nicht.
    const internalNotification = await sendInternalNotification({
      subject: `Neue Website-Anfrage: ${mapLandingpageType(lead.concernType)} – ${lead.fullName}`,
      replyTo: lead.email,
      text: note,
    });

    // Update 19 §5: Bewertungsanfrage → Bestätigungsmail an den Absender mit Link auf die Nachfrage
    const confirmation = nachfrage.istBewertung(lead.rawConcern)
      ? await sendValuationConfirmation(lead, contactId, data)
      : { sent: false, skipped: true, reason: "keine Bewertungsanfrage" };

    return json(200, {
      success: true,
      message: "Ihre Anfrage wurde erfolgreich übermittelt.",
      contact_id: contactId,
      // Dringend-Fix 02.11.: keine Propstack-Rohdaten an den Browser
      contact_update: contactUpdateResult,
      search_profile: searchProfileResult,
      task: taskResult,
      property_id: propertyId,
      property: propertyResult,
      deal: dealResult,
      documents: documentResults,
      internal_notification: internalNotification,
      confirmation,
    });
  } catch (error) {
    console.error("PROPSTACK LEAD ERROR:", { requestId, ...logsafe.error(error) });

    return json(500, {
      success: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
};

// Update 19 §5: Link mit Kontakt-ID und Signatur (_shared/nachfrage.js); ohne Geheimnis keine Mail
// (NACHFRAGE_SECRET oder ersatzweise der Propstack-Schlüssel, siehe nachfrage.geheimnis).
// Ein Mailfehler blockiert die Anfrage nicht.
async function sendValuationConfirmation(lead, contactId, data) {
  try {
    const secret = nachfrage.geheimnis(process.env);
    if (!secret) return { sent: false, skipped: true, reason: "kein Geheimnis für den Nachfrage-Link" };
    const objectType = data.object_type || data.objectType;
    // Design-Pass 3 §0.4: Grundstück → Bestätigungsmail ohne Link auf die Fragen
    const url = await nachfrage.link({
      secret,
      base: process.env.URL || "https://fg-realestate.de",
      contactId,
      objectType,
      plotGiven: Boolean(clean((lead.propertyDetails || {})["seller-plot-area"])),
    });
    if (!url && !nachfrage.ohneFragen(objectType)) return { sent: false, skipped: true, reason: "kein Nachfrage-Link" };
    // Update 28 §3.2: Version A (E-Mail) oder B (Anruf) je nach Kontaktwunsch, mit Adresse der Immobilie
    const mail = nachfrage.bestaetigung({ firstName: lead.firstName, lastName: lead.lastName, link: url, adresse: nachfrage.adresseText(data), anruf: nachfrage.perAnruf(lead.contactPreference) });
    const result = await sendInternalNotification({
      to: lead.email,
      replyTo: process.env.WEBSITE_LEAD_EMAIL || "info@fg-realestate.de",
      ...mail,
    });
    return { sent: Boolean(result.sent), skipped: Boolean(result.skipped), reason: result.reason || result.error || "" };
  } catch (error) {
    console.error("BEWERTUNG BESTAETIGUNG ERROR:", logsafe.error(error));
    return { sent: false, skipped: false, reason: error.message };
  }
}

function normalizeLeadPayload(data) {
  const firstName = clean(data.first_name || data.firstName);
  const lastName = clean(data.last_name || data.lastName);
  const email = clean(data.email);
  const phone = clean(data.phone);

  const rawConcern = clean(data.concern || data.anliegen || data.type);
  const concernType = mapConcernType(rawConcern);

  const objectType = normalizeObjectType(clean(data.object_type || data.objectType));
  // Update 23 B3: Die Bewertung fragt Straße, Hausnummer, PLZ und Ort einzeln ab; ohne Skript kommt kein „location“ mit.
  const street = clean(data.street);
  const houseNumber = clean(data.house_number);
  const zipCode = clean(data.zip_code);
  const city = clean(data.city);
  const addressParts = [[street, houseNumber].filter(Boolean).join(" "), [zipCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const location = clean(data.location || data.address || data.ort) || addressParts;
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

  const newsletterConsent =
    data.newsletter_consent === true ||
    data.newsletter_consent === "true" ||
    data.newsletter === true ||
    data.newsletter === "true";

  const hasFinancingInterest =
    concernType === "finance" ||
    isAffirmative(financingInterest) ||
    isAffirmative(data.financing_interest) ||
    isAffirmative(data.financingInterest);

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
    street,
    houseNumber,
    zipCode,
    city,
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
    newsletterConsent,
    hasFinancingInterest,
    hasPropertyDetails,
    hasAnyObjectSignal,
  };
}

function getWarningNotice(lead) {
  if (lead.concernType === "sell") return "Eigentümer-Lead prüfen";
  if (lead.concernType === "rent") return "Vermietungs-/Eigentümer-Lead prüfen";
  if (lead.hasFinancingInterest) return "Website Lead prüfen – Finanzierung gewünscht";
  return "Website Lead prüfen";
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
      warning_notice: getWarningNotice(lead),

      buyer: isBuyerLike,
      owner: isOwnerLike,

      newsletter: lead.newsletterConsent,
      property_mailing_wanted: lead.newsletterConsent,
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
      warning_notice: getWarningNotice(lead),
      buyer: isBuyerLike,
      owner: isOwnerLike,
      newsletter: lead.newsletterConsent,
      property_mailing_wanted: lead.newsletterConsent,
      accept_contact: true,
      gdpr_status: 2,
    }),
  };
}

function buildContactCustomFields(lead) {
  const details = lead.propertyDetails || {};
  const buyer = getBuyerSearchDetails(details);

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

    // Käufer-/Suchprofil-Daten aus der erweiterten Landingpage
    zimmeranzahl: buyer.roomsFrom,
    wohnflache: buyer.livingSpaceFrom,
    grundstucksflache: buyer.plotAreaFrom,
    balkon_terrasse: buyer.balcony,
    // Update 31 §2: kein Zustand mehr in objektzustand/ausstattung. Beide Felder gibt es in Propstack nur für Objekte,
    // und „Ausstattung“ ist kein Zustand. Der gewünschte Zustand steht weiter in Notiz und Suchprofil.

    // Falls diese Custom Fields in Propstack existieren, werden sie sauber befüllt.
    // Falls nicht, greift der Fallback und alle Werte bleiben trotzdem in Beschreibung/Aufgabe/Suchprofil erhalten.
    etage: buyer.floor,
    aufzug: buyer.elevator,
    stellplatz: buyer.parking,
    keller: buyer.basement,
    garten: buyer.garden,
    einbaukuche: buyer.kitchen,
    barrierefrei: buyer.barrierFree,
    badezimmer: buyer.bathroomsFrom,
    schlafzimmer: buyer.bedroomsFrom,

    quelle_url: lead.sourceUrl,
    nachricht: lead.message,
    datenschutz_zugestimmt: true,

    newsletter_gewuenscht: lead.newsletterConsent,
    immobilienmailing_gewuenscht: lead.newsletterConsent,

    finanzierungsberatung_gewunscht: lead.hasFinancingInterest ? "Ja" : "Nein",
    finanzierung_interesse: lead.hasFinancingInterest ? "Ja" : "Nein",
    finanzierung_interessiert: lead.hasFinancingInterest,
    finanzierung_lead: lead.concernType === "finance",
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
      budgetNumber: lead.budgetNumber,
      timeframe: lead.timeframe,
      contactPreference: lead.contactPreference,
      newsletterConsent: lead.newsletterConsent,
      financingInterest: lead.financingInterest,
      hasFinancingInterest: lead.hasFinancingInterest,
      propertyDetailsWanted: lead.propertyDetailsWanted,
      managementTakeover: lead.managementTakeover,
      buyerSearchDetails: buyer,
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

function getBuyerSearchDetails(details) {
  return {
    roomsFrom: numberOrNull(firstValue(details, [
      "buyer-rooms-from", "buyer_rooms_from", "rooms_from", "zimmer_ab", "rooms"
    ])),
    livingSpaceFrom: numberOrNull(firstValue(details, [
      "buyer-living-space-from", "buyer_living_space_from", "living_space_from", "wohnflaeche_ab", "wohnflache_ab", "area_from"
    ])),
    plotAreaFrom: numberOrNull(firstValue(details, [
      "buyer-plot-area-from", "buyer_plot_area_from", "plot_area_from", "grundstueck_ab", "grundstuck_ab"
    ])),
    bedroomsFrom: numberOrNull(firstValue(details, [
      "buyer-bedrooms-from", "buyer_bedrooms_from", "bedrooms_from", "schlafzimmer_ab"
    ])),
    bathroomsFrom: numberOrNull(firstValue(details, [
      "buyer-bathrooms-from", "buyer_bathrooms_from", "bathrooms_from", "badezimmer_ab"
    ])),
    floor: clean(firstValue(details, [
      "buyer-floor", "buyer_floor", "floor", "etage"
    ])),
    balcony: boolOrText(firstValue(details, [
      "buyer-balcony", "buyer_balcony", "balcony", "balkon_terrasse"
    ])),
    elevator: boolOrText(firstValue(details, [
      "buyer-elevator", "buyer_elevator", "elevator", "aufzug"
    ])),
    parking: boolOrText(firstValue(details, [
      "buyer-parking", "buyer_parking", "parking", "stellplatz"
    ])),
    basement: boolOrText(firstValue(details, [
      "buyer-basement", "buyer_basement", "basement", "keller"
    ])),
    garden: boolOrText(firstValue(details, [
      "buyer-garden", "buyer_garden", "garden", "garten"
    ])),
    kitchen: boolOrText(firstValue(details, [
      "buyer-kitchen", "buyer_kitchen", "kitchen", "einbaukueche", "einbaukuche"
    ])),
    barrierFree: boolOrText(firstValue(details, [
      "buyer-barrier-free", "buyer_barrier_free", "barrier_free", "barrierefrei"
    ])),
    condition: clean(firstValue(details, [
      "buyer-condition", "buyer_condition", "condition", "objektzustand"
    ])),
  };
}

function firstValue(object, keys) {
  for (const key of keys) {
    if (object && object[key] !== undefined && object[key] !== null && clean(object[key]) !== "") {
      return object[key];
    }
  }
  return "";
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
    `Newsletter / Immobilienmailing: ${lead.newsletterConsent ? "Ja" : "Nein"}`,
    `Interesse an Finanzierungsberatung: ${lead.hasFinancingInterest ? "Ja" : "Nein"}`,
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
    console.warn("CONTACT CREATE WITH CUSTOM FIELDS FAILED:", logsafe.msg(error));
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
    console.warn("CONTACT UPDATE WITH CUSTOM FIELDS SKIPPED:", logsafe.msg(error));

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
      console.warn("CONTACT UPDATE FALLBACK SKIPPED:", logsafe.msg(fallbackError));
      return { ok: false, skipped: true, reason: fallbackError.message };
    }
  }
}


async function maybeCreateOwnerProperty(apiKey, contactId, lead, note) {
  const shouldCreate = lead.concernType === "sell" || lead.concernType === "rent";

  if (!shouldCreate) {
    return { ok: true, skipped: true, reason: "Für diesen Lead-Typ keine Objektanlage erforderlich." };
  }

  if (!lead.hasAnyObjectSignal) {
    return {
      ok: true,
      skipped: true,
      reason: "Keine ausreichenden Objektdaten angegeben. Kontakt/Aufgabe wurden gespeichert.",
    };
  }

  const property = await buildOwnerPropertyPayload(apiKey, contactId, lead, note);

  // Propstack V1 erwartet laut Doku bei POST /units einen Wrapper { property: {...} }.
  // Manche Accounts reagieren auf einzelne Attribute empfindlich. Deshalb robuste Fallbacks:
  // 1. Vollständiger sauberer Payload
  // 2. ohne Status
  // 3. ohne Custom Fields
  // 4. Minimalobjekt mit Eigentümer-Verknüpfung
  // Update 31 §2: lehnt Propstack den Zustandscode ab, folgt derselbe Payload mit Propstacks deutscher Bezeichnung, dann ohne Zustand.
  const conditionLabel = conditionOf(lead.propertyDetails || {}).label;
  const attempts = [
    { label: "full property", payload: { property } },
    ...(property.condition && conditionLabel ? [{ label: "condition as label", payload: { property: { ...property, condition: conditionLabel } } }] : []),
    { label: "without status", payload: { property: omitKeys(property, ["status_id", "property_status_id"]) } },
    ...(property.condition ? [{ label: "without status and condition", payload: { property: omitKeys(property, ["status_id", "property_status_id", "condition"]) } }] : []),
    { label: "without optional standard fields", payload: { property: omitKeys(property, ["status_id", "property_status_id", "base_rent", "net_cold_rent", "rent", "target_cold_rent", "service_charge", "annual_net_rent", "target_annual_net_rent", "balcony_area", "interior_quality", "condition", "last_modernization", "rs_category", "country"]) } },
    { label: "without custom fields", payload: { property: omitKeys(property, ["partial_custom_fields", "interior_quality", "condition", "status_id", "property_status_id", "base_rent", "net_cold_rent", "rent", "target_cold_rent", "service_charge", "annual_net_rent", "target_annual_net_rent", "rs_category", "country"]) } },
    { label: "without category", payload: { property: omitKeys(property, ["partial_custom_fields", "status_id", "property_status_id", "rs_category", "country"]) } },
    {
      label: "minimal owner property",
      payload: {
        property: removeEmpty({
          title: property.title,
          unit_id: property.unit_id,
          marketing_type: property.marketing_type,
          object_type: property.object_type,
          rs_type: property.rs_type,
          city: property.city,
          address: property.address,
          note,
          relationships_attributes: property.relationships_attributes,
        }),
      },
    },
    {
      label: "ultra minimal owner property",
      payload: {
        property: removeEmpty({
          title: property.title,
          marketing_type: property.marketing_type,
          object_type: property.object_type,
          rs_type: property.rs_type,
          city: property.city,
          address: property.address,
          relationships_attributes: property.relationships_attributes,
        }),
      },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      console.log("PROPERTY CREATE ATTEMPT:", attempt.label);
      const result = await propstackPost(apiKey, "/units", attempt.payload);
      return { ok: true, attempt: attempt.label, result, used_payload: attempt.payload };
    } catch (error) {
      lastError = error;
      console.warn("PROPERTY CREATE ATTEMPT FAILED:", attempt.label, logsafe.msg(error));
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastError ? lastError.message : "Objektanlage fehlgeschlagen.",
    attempted_property: property,
  };
}

async function buildOwnerPropertyPayload(apiKey, contactId, lead, note) {
  const details = lead.propertyDetails || {};
  const statusId = await findPropertyStatusId(apiKey, "Akquise");
  const objectMapping = mapOwnerObjectMapping(lead.objectType, details);
  const title = buildOwnerPropertyTitle(lead);
  const address = lead.location || undefined;
  const city = lead.city || extractCity(lead.location) || undefined;
  const priceNumber = lead.concernType === "sell" ? lead.budgetNumber : undefined;
  const coldRent = numberOrNull(firstValue(details, ["seller-cold-rent", "seller_cold_rent", "cold_rent", "net_cold_rent"])) || (lead.concernType === "rent" ? lead.budgetNumber : undefined);
  const coldRentTarget = numberOrNull(firstValue(details, ["seller-cold-rent-target", "seller_cold_rent_target", "target_cold_rent"]));
  const netRentCurrent = numberOrNull(firstValue(details, ["seller-net-rent-current", "seller_net_rent_current", "net_rent_current"]));
  const netRentTarget = numberOrNull(firstValue(details, ["seller-net-rent-target", "seller_net_rent_target", "net_rent_target"]));
  const serviceCharge = numberOrNull(firstValue(details, ["seller-service-charge", "seller_service_charge", "service_charge"]));

  const property = removeEmpty({
    title,
    unit_id: buildUnitId(lead),
    marketing_type: lead.concernType === "rent" ? "RENT" : "BUY",
    object_type: objectMapping.object_type,
    rs_type: objectMapping.rs_type,
    rs_category: objectMapping.rs_category,

    address,
    street: lead.street || undefined,
    house_number: lead.houseNumber || undefined,
    zip_code: lead.zipCode || undefined,
    city,
    country: "DEU",

    price: priceNumber,
    cold_rent: coldRent,
    base_rent: coldRent,
    net_cold_rent: coldRent,
    rent: coldRent,
    target_cold_rent: coldRentTarget,
    service_charge: serviceCharge,
    annual_net_rent: netRentCurrent,
    target_annual_net_rent: netRentTarget,
    living_space: numberOrNull(firstValue(details, ["seller-area-value", "seller_area_value", "living_space", "wohnflaeche"])),
    plot_area: numberOrNull(firstValue(details, ["seller-plot-area", "seller_plot_area", "plot_area", "grundstuecksflaeche"])),
    number_of_rooms: shouldUseRoomsForObject(lead.objectType) ? numberOrNull(firstValue(details, ["seller-rooms", "seller_rooms", "rooms", "zimmer"] )) : undefined,
    construction_year: numberOrNull(firstValue(details, ["seller-year", "seller_year", "construction_year", "baujahr"])),
    energy_efficiency_class: clean(firstValue(details, ["seller-energy", "seller_energy", "energy", "energieklasse"])),
    // Update 28 §2: Ausstattung ins Propstack-Standardfeld „Qualität der Ausstattung“ (interior_quality), das Sprengnetter liest.
    // Der Zustand (seller-quality) geht hier nicht mehr hinein; nur Ausstattungswerte werden übersetzt.
    interior_quality: interiorQuality(details).api,
    // Update 31 §2: Zustand ins Propstack-Standardfeld condition, das Sprengnetter liest (Zuordnung siehe CONDITION unten)
    condition: conditionOf(details).code,
    last_modernization: clean(firstValue(details, ["seller-modernization", "seller_modernization", "modernization", "letzte_modernisierung"])),
    balcony: isAffirmative(firstValue(details, ["seller-balcony", "seller_balcony", "balcony", "balkon"])),
    balcony_area: numberOrNull(firstValue(details, ["seller-balcony-area", "seller_balcony_area", "balcony_area"])),

    note,
    status_id: statusId || undefined,
    property_status_id: statusId || undefined,

    relationships_attributes: [
      {
        internal_name: "owner",
        related_client_id: contactId,
      },
    ],

    partial_custom_fields: buildOwnerPropertyCustomFields(lead),
  });

  return property;
}

function buildOwnerPropertyCustomFields(lead) {
  const details = lead.propertyDetails || {};
  const objectMapping = mapOwnerObjectMapping(lead.objectType, details);

  return removeEmpty({
    objekt_aus_landing_page: true,
    objekt_aus_landingpage: true,
    akquiseobjekt: true,
    website_prioritat: "Hoch",
    offmarket_geeignet: normalize(lead.objectType).includes("offmarket"),
    unterlagen_erhalten: lead.documents.length > 0,
    pdf_unterlagen_vorhanden: lead.documents.length > 0,

    objektart: lead.objectType,
    immobilienart: objectMapping.pretty,
    flachenart: clean(firstValue(details, ["seller-area-type", "seller_area_type"])),
    hausart: clean(firstValue(details, ["seller-house-subtype", "seller_house_subtype"])),
    wohnungsart: clean(firstValue(details, ["seller-apartment-subtype", "seller_apartment_subtype"])),
    etage: clean(firstValue(details, ["seller-floor", "seller_floor"])),
    // Update 31 §2: Custom Field „Objektzustand“ (Einfach, Gehoben, Luxus, Sanierungsbedürftig, Standard) nur mit genau passender Option
    objektzustand: conditionOf(details).objektzustand,
    ausstattung: interiorQuality(details).option,
    wohnflache: numberOrNull(firstValue(details, ["seller-area-value", "seller_area_value"])),
    grundstucksflache: numberOrNull(firstValue(details, ["seller-plot-area", "seller_plot_area"])),
    zimmeranzahl: shouldUseRoomsForObject(lead.objectType) ? numberOrNull(firstValue(details, ["seller-rooms", "seller_rooms"] )) : undefined,
    schlafzimmer: numberOrNull(firstValue(details, ["seller-bedrooms", "seller_bedrooms"])),
    badezimmer: numberOrNull(firstValue(details, ["seller-bathrooms", "seller_bathrooms"])),
    wohneinheiten: numberOrNull(firstValue(details, ["seller-units", "seller_units"])),
    gewerbeeinheiten: numberOrNull(firstValue(details, ["seller-commercial-units", "seller_commercial_units"])),
    nettokaltmiete_ist: numberOrNull(firstValue(details, ["seller-cold-rent", "seller_cold_rent", "seller-net-rent-current", "seller_net_rent_current"])),
    nettokaltmiete_soll: numberOrNull(firstValue(details, ["seller-cold-rent-target", "seller_cold_rent_target", "seller-net-rent-target", "seller_net_rent_target"])),
    hausgeld_nebenkosten: numberOrNull(firstValue(details, ["seller-service-charge", "seller_service_charge"])),
    leerstand_notiz: clean(firstValue(details, ["seller-vacancy-note", "seller_vacancy_note"])),
    grundstuecksart: clean(firstValue(details, ["seller-plot-type", "seller_plot_type"])),
    erschliessung: clean(firstValue(details, ["seller-development-status", "seller_development_status"])),
    baujahr: numberOrNull(firstValue(details, ["seller-year", "seller_year"])),
    energieklasse: clean(firstValue(details, ["seller-energy", "seller_energy"])),
    balkon_terrasse: boolOrText(firstValue(details, ["seller-balcony", "seller_balcony"])),
    balkon_terrassenflache: numberOrNull(firstValue(details, ["seller-balcony-area", "seller_balcony_area"])),
    garten: boolOrText(firstValue(details, ["seller-garden", "seller_garden"])),
    aufzug: boolOrText(firstValue(details, ["seller-elevator", "seller_elevator"])),
    einbaukuche: boolOrText(firstValue(details, ["seller-kitchen", "seller_kitchen"])),
    keller: boolOrText(firstValue(details, ["seller-basement", "seller_basement"])),
    letzte_modernisierung: clean(firstValue(details, ["seller-modernization", "seller_modernization"])),
    verwaltungsubernahme_gewuenscht_ab: lead.managementTakeover,
    website_rohdaten: compactJson({ concern: lead.rawConcern, objectType: lead.objectType, propertyDetails: lead.propertyDetails }),
  });
}

async function findPropertyStatusId(apiKey, wantedName) {
  try {
    const response = await propstackGet(apiKey, "/property_statuses");
    const statuses = normalizeArray(response);
    const wanted = normalize(wantedName);
    const found = statuses.find((status) => normalize(status.name || status.title || status.label).includes(wanted));
    return found ? found.id : null;
  } catch (error) {
    console.warn("PROPERTY STATUS READ SKIPPED:", logsafe.msg(error));
    return null;
  }
}

async function maybeCreateDealForOwnerObject(apiKey, contactId, propertyId, lead, note) {
  if (!(lead.concernType === "sell" || lead.concernType === "rent")) {
    return { ok: true, skipped: true, reason: "Für diesen Lead-Typ kein Eigentümer-Deal erforderlich." };
  }

  if (!propertyId) {
    return { ok: true, skipped: true, reason: "Kein Objekt angelegt, daher kein Objekt-Deal erstellt. Aufgabe/Kontakt sind vorhanden." };
  }

  const stage = await findBestDealStage(apiKey, lead.concernType);
  if (!stage || !stage.id) {
    return { ok: true, skipped: true, reason: "Keine passende Deal-Phase gefunden.", stage };
  }

  const attempts = [
    {
      client_property: removeEmpty({
        client_id: contactId,
        contact_id: contactId,
        property_id: propertyId,
        unit_id: propertyId,
        deal_stage_id: stage.id,
        note,
        source: "Website Landingpage",
      }),
    },
    {
      client_property: removeEmpty({
        client_id: contactId,
        property_id: propertyId,
        deal_stage_id: stage.id,
        note,
      }),
    },
  ];

  for (const payload of attempts) {
    try {
      const result = await propstackPost(apiKey, "/client_properties", payload);
      return { ok: true, stage, result };
    } catch (error) {
      console.warn("OWNER DEAL CREATE ATTEMPT FAILED:", logsafe.msg(error));
    }
  }

  return { ok: false, skipped: true, reason: "Deal konnte nicht erstellt werden.", stage };
}

async function findBestDealStage(apiKey, concernType) {
  try {
    const pipelinesResponse = await propstackGet(apiKey, "/deal_pipelines");
    const pipelines = normalizeArray(pipelinesResponse);
    const allStages = [];

    for (const pipeline of pipelines) {
      const pipelineName = pipeline.name || pipeline.title || pipeline.label || "";
      const stages = pipeline.deal_stages || pipeline.stages || pipeline.client_property_stages || [];
      for (const stage of stages) {
        allStages.push({ id: stage.id, name: stage.name || stage.title || stage.label || "", pipeline: pipelineName });
      }
    }

    const wanted = concernType === "rent"
      ? ["neuermietinteressent", "mieter", "vermietung"]
      : ["neuereigentumerlead", "neuereigentuemerlead", "eigentumer", "eigentuemer"];

    for (const term of wanted) {
      const found = allStages.find((stage) => normalize(`${stage.pipeline} ${stage.name}`).includes(term));
      if (found) return found;
    }

    return allStages[0] || null;
  } catch (error) {
    console.warn("DEAL STAGES READ SKIPPED:", logsafe.msg(error));
    return null;
  }
}

function buildOwnerPropertyTitle(lead) {
  const type = lead.objectType || "Immobilie";
  const place = lead.location ? ` in ${lead.location}` : "";
  return `Akquise: ${type}${place}`;
}

function buildUnitId(lead) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const type = normalize(lead.objectType).slice(0, 6).toUpperCase() || "OBJ";
  return `WEB-${type}-${stamp}`;
}

function mapOwnerObjectMapping(objectType, details) {
  const text = normalize(objectType);
  const sub = normalize(firstValue(details || {}, ["seller-house-subtype", "seller_house_subtype", "seller-subtype", "seller_subtype"]));

  if (text.includes("grund")) return { object_type: "LIVING", rs_type: "PLOT", rs_category: "OTHER", pretty: "Grundstück" };
  if (text.includes("gewerbe")) return { object_type: "COMMERCIAL", rs_type: "COMMERCIAL_UNIT", rs_category: "COMMERCIAL_UNIT", pretty: "Gewerbe" };
  if (text.includes("mehrfamilien")) return { object_type: "INVESTMENT", rs_type: "INVESTMENT", rs_category: "INVEST_HOUSING_ESTATE", pretty: "Mehrfamilienhaus" };
  if (text.includes("doppel") || sub.includes("doppel")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "SEMIDETACHED_HOUSE", pretty: "Doppelhaushälfte" };
  if (text.includes("zweifamilien") || sub.includes("zweifamilien") || sub.includes("zfh")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "TWO_FAMILY_HOUSE", pretty: "Zweifamilienhaus" };
  if (text.includes("reihenend") || sub.includes("reihenend")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "TERRACE_END_HOUSE", pretty: "Reihenendhaus" };
  if (text.includes("reihenmittel") || sub.includes("reihenmittel")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "MID_TERRACE_HOUSE", pretty: "Reihenmittelhaus" };
  if (text.includes("reihen") || sub.includes("reihen")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "TERRACE_HOUSE", pretty: "Reihenhaus" };
  if (text.includes("villa") || sub.includes("villa")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "VILLA", pretty: "Villa" };
  if (text.includes("bungalow") || sub.includes("bungalow")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "BUNGALOW", pretty: "Bungalow" };
  if (text.includes("haus") || text.includes("einfamilien") || sub.includes("einfamilien") || sub.includes("efh")) return { object_type: "LIVING", rs_type: "HOUSE", rs_category: "SINGLE_FAMILY_HOUSE", pretty: "Einfamilienhaus" };
  if (text.includes("dachgeschoss")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "ROOF_STOREY", pretty: "Dachgeschosswohnung" };
  if (text.includes("loft")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "LOFT", pretty: "Loft" };
  if (text.includes("maisonette")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "MAISONETTE", pretty: "Maisonette" };
  if (text.includes("penthouse")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "PENTHOUSE", pretty: "Penthouse" };
  if (text.includes("terrassen")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "TERRACED_FLAT", pretty: "Terrassenwohnung" };
  if (text.includes("etagen")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "APARTMENT", pretty: "Etagenwohnung" };
  if (text.includes("erdgeschoss")) return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "GROUND_FLOOR", pretty: "Erdgeschosswohnung" };

  return { object_type: "LIVING", rs_type: "APARTMENT", rs_category: "APARTMENT", pretty: "Wohnung" };
}

function shouldUseRoomsForObject(objectType) {
  const text = normalize(objectType);
  return !(text.includes("grund") || text.includes("mehrfamilien") || text.includes("gewerbe"));
}

function omitKeys(object, keys) {
  const clone = { ...object };
  keys.forEach((key) => delete clone[key]);
  return clone;
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
  const buyer = getBuyerSearchDetails(lead.propertyDetails || {});
  const rsType = mapRsType(lead.objectType);
  const objectTypes = mapObjectTypeList(lead.objectType);

  // Wichtig: Propstack akzeptiert je nach Account/Version nicht jedes Suchprofil-Feld.
  // Deshalb versucht der Code zuerst eine reichere Variante und fällt danach automatisch
  // auf schlankere Varianten zurück. So bricht der Lead nicht ab.
  const richSavedQuery = removeEmpty({
    client_id: contactId,
    active: true,
    marketing_type: "BUY",
    cities: city ? [city] : undefined,
    regions: lead.location ? [lead.location] : undefined,
    price_to: lead.budgetNumber,
    rs_types: rsType ? [rsType] : undefined,
    object_types: objectTypes.length ? objectTypes : undefined,

    rooms_from: buyer.roomsFrom,
    number_of_rooms_from: buyer.roomsFrom,
    living_space_from: buyer.livingSpaceFrom,
    property_space_from: buyer.plotAreaFrom,
    plot_area_from: buyer.plotAreaFrom,
    bedrooms_from: buyer.bedroomsFrom,
    bathrooms_from: buyer.bathroomsFrom,

    balcony: buyer.balcony,
    terrace: buyer.balcony,
    elevator: buyer.elevator,
    lift: buyer.elevator,
    parking: buyer.parking,
    basement: buyer.basement,
    cellar: buyer.basement,
    garden: buyer.garden,
    fitted_kitchen: buyer.kitchen,
    barrier_free: buyer.barrierFree,
    condition: buyer.condition,
    property_condition: buyer.condition,

    note,
    internal_note: note,
  });

  const mediumSavedQuery = removeEmpty({
    client_id: contactId,
    active: true,
    marketing_type: "BUY",
    cities: city ? [city] : undefined,
    regions: lead.location ? [lead.location] : undefined,
    price_to: lead.budgetNumber,
    rs_types: rsType ? [rsType] : undefined,
    rooms_from: buyer.roomsFrom,
    living_space_from: buyer.livingSpaceFrom,
    note,
    internal_note: note,
  });

  const basicSavedQuery = removeEmpty({
    client_id: contactId,
    active: true,
    marketing_type: "BUY",
    cities: city ? [city] : undefined,
    regions: lead.location ? [lead.location] : undefined,
    price_to: lead.budgetNumber,
    rs_types: rsType ? [rsType] : undefined,
    note,
    internal_note: note,
  });

  const attempts = [
    { endpoint: "/saved_queries", payload: { saved_query: richSavedQuery }, label: "rich saved_query" },
    { endpoint: "/saved_queries", payload: { saved_query: mediumSavedQuery }, label: "medium saved_query" },
    { endpoint: "/saved_queries", payload: { saved_query: basicSavedQuery }, label: "basic saved_query" },
    { endpoint: "/search_profiles", payload: { search_profile: mediumSavedQuery }, label: "medium search_profile" },
    { endpoint: "/search_profiles", payload: { search_profile: basicSavedQuery }, label: "basic search_profile" },
  ];

  for (const attempt of attempts) {
    try {
      console.log("SEARCH PROFILE ATTEMPT:", attempt.label);
      const result = await propstackPost(apiKey, attempt.endpoint, attempt.payload);
      return {
        ok: true,
        attempt: attempt.label,
        result,
        used_payload: attempt.payload,
      };
    } catch (error) {
      console.warn("SEARCH PROFILE CREATE ATTEMPT FAILED:", attempt.label, logsafe.msg(error));
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: "Suchprofil konnte per API nicht angelegt werden. Daten stehen im Kontakt und in der Aufgabe.",
    payload: richSavedQuery,
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
      console.warn("FOLLOWUP TASK ATTEMPT FAILED:", logsafe.msg(error));
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
  if (lead.concernType === "sell") return `Eigentümer-Lead prüfen: Verkauf – ${lead.fullName}`;
  if (lead.concernType === "rent") return `Eigentümer-Lead prüfen: Vermietung – ${lead.fullName}`;
  if (lead.hasFinancingInterest) return `Finanzierung prüfen: ${type} – ${lead.fullName}`;
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
          property_id: input.propertyId || undefined,
          client_id: input.propertyId ? undefined : input.contactId,
        }),
      });

      results.push({ ok: true, name: file.name, result });
    } catch (error) {
      console.warn("Dokument konnte nicht hochgeladen werden:", logsafe.msg(error));
      results.push({ ok: false, name: file.name, error: error.message });
    }
  }

  return results;
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

  return parsePropstackResponse(response, endpoint);
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

  console.log("PROPSTACK RESPONSE:", logsafe.endpoint(endpoint), response.status);

  if (!response.ok) {
    throw logsafe.propstackError(response.status, endpoint, data);
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
  if (text.includes("suchen") || text.includes("mieten") || text.includes("miete")) return "buy";
  if (text.includes("kaufen") || text.includes("kauf")) return "buy";

  return "";
}

function normalizeObjectType(value) {
  const text = clean(value);
  const n = normalize(text);

  if (!text) return "";
  if (n.includes("dachgeschoss")) return "Dachgeschosswohnung";
  if (n.includes("loft")) return "Loft";
  if (n.includes("maisonette")) return "Maisonette";
  if (n.includes("penthouse")) return "Penthouse";
  if (n.includes("terrassenwohnung")) return "Terrassenwohnung";
  if (n.includes("eigentumswohnung") || n.includes("wohnung")) return "Wohnung";
  if (n.includes("mehrfamilien")) return "Mehrfamilienhaus";
  if (n.includes("zweifamilien") || n.includes("zfh")) return "Zweifamilienhaus";
  if (n.includes("doppel")) return "Doppelhaushälfte";
  if (n.includes("reihenend")) return "Reihenendhaus";
  if (n.includes("reihenmittel")) return "Reihenmittelhaus";
  if (n.includes("reihen")) return "Reihenhaus";
  if (n.includes("villa")) return "Villa";
  if (n.includes("bungalow")) return "Bungalow";
  if (n.includes("einfamilien") || n.includes("efh") || n.includes("haus")) return "Haus";
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

  if (text.includes("dachgeschoss")) return "ROOF_STOREY";
  if (text.includes("loft")) return "LOFT";
  if (text.includes("maisonette")) return "MAISONETTE";
  if (text.includes("penthouse")) return "PENTHOUSE";
  if (text.includes("terrassenwohnung")) return "TERRACE_FLAT";
  if (text.includes("erdgeschoss")) return "GROUND_FLOOR";
  if (text.includes("mehrfamilien")) return "MULTI_FAMILY_HOUSE";
  if (text.includes("einfamilien") || text === "haus" || text.includes("haus")) return "SINGLE_FAMILY_HOUSE";
  if (text.includes("grund")) return "PLOT";
  if (text.includes("gewerbe")) return "COMMERCIAL_UNIT";
  if (text.includes("kapital") || text.includes("anlage")) return "INVEST_FREEHOLD_FLAT";
  if (text.includes("wohnung")) return "APARTMENT";

  return "APARTMENT";
}

function mapObjectTypeList(value) {
  const text = normalize(value);

  if (text.includes("dachgeschoss")) return ["ROOF_STOREY"];
  if (text.includes("loft")) return ["LOFT"];
  if (text.includes("maisonette")) return ["MAISONETTE"];
  if (text.includes("penthouse")) return ["PENTHOUSE"];
  if (text.includes("terrassenwohnung")) return ["TERRACE_FLAT"];
  if (text.includes("erdgeschoss")) return ["GROUND_FLOOR"];
  if (text.includes("mehrfamilien")) return ["MULTI_FAMILY_HOUSE"];
  if (text.includes("einfamilien") || text === "haus" || text.includes("haus")) return ["SINGLE_FAMILY_HOUSE"];
  if (text.includes("grund")) return ["PLOT"];
  if (text.includes("gewerbe")) return ["COMMERCIAL_UNIT"];
  if (text.includes("kapital") || text.includes("anlage")) return ["INVEST_FREEHOLD_FLAT"];
  if (text.includes("wohnung")) return ["APARTMENT"];

  return [];
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
  if (response && Array.isArray(response.data)) return response.data;
  if (response && Array.isArray(response.deal_pipelines)) return response.deal_pipelines;
  if (response && Array.isArray(response.pipelines)) return response.pipelines;
  if (response && Array.isArray(response.property_statuses)) return response.property_statuses;
  if (response && Array.isArray(response.statuses)) return response.statuses;
  return [];
}

// Update 28 §2: Werte der Ausstattung genau wie in Propstack („Qualität der Ausstattung“: einfach, normal, gehoben, luxuriös).
// api = Wert für das Standardfeld interior_quality, option = Auswahl im Custom Field „Ausstattung“ dieses Kontos.
// Nimmt das neue Feld seller-interior-quality; aus seller-quality (ältere Landingpage) nur echte Ausstattungswerte, nie einen Zustand.
const INTERIOR_QUALITY = {
  luxurios: { api: "LUXURY", option: "luxus" },
  luxus: { api: "LUXURY", option: "luxus" },
  gehoben: { api: "SOPHISTICATED", option: "gehoben" },
  normal: { api: "NORMAL", option: "normal" },
  einfach: { api: "SIMPLE", option: "Einfach" },
};

// Update 31 §2: Zustand der Bewertungsanfrage → Propstack-Standardfeld condition (liest die Sprengnetter-Bewertung).
// Propstack speichert den Zustand als Code: die Doku zeigt im Rohdatenexport „condition": "DERELICT" und
// „interior_quality": "SIMPLE" (docs.propstack.de, Objekte, GET /v1/datadump/properties). GET /units liefert dieselben
// Werte übersetzt (saniert, gepflegt, renovierungsbedürftig …). Die API-Spezifikation v2 nennt für condition keine Liste.
// Versuch 1: code. Lehnt Propstack ihn ab, Versuch 2: label (Propstacks deutsche Bezeichnung), danach ohne Zustand.
// „Sanierungsbedürftig“ gibt es in Propstack als eigenen Wert, sein Code ist nicht dokumentiert: nächster dokumentierter
// Code NEED_OF_RENOVATION, dazu die genau passende Option im Custom Field „Objektzustand“.
const CONDITION = {
  neuwertigodersaniert: { code: "REFURBISHED", label: "saniert" },
  gepflegt: { code: "WELL_KEPT", label: "gepflegt" },
  renovierungsbedurftig: { code: "NEED_OF_RENOVATION", label: "renovierungsbedürftig" },
  sanierungsbedurftig: { code: "NEED_OF_RENOVATION", label: "sanierungsbedürftig" },
};

// Optionen des Custom Fields „Objektzustand“ (nur für Objekte, Stand 02.11.2026). Nur ein genau passender Wert wird gesetzt.
// Die alte Landingpage schickt Luxus, Gehoben, Einfach im selben Feld; sie passen genau und bleiben erhalten.
const OBJEKTZUSTAND_OPTIONS = ["Einfach", "Gehoben", "Luxus", "Sanierungsbedürftig", "Standard"];

function conditionOf(details) {
  const raw = firstValue(details || {}, ["seller-quality", "seller_quality", "quality", "condition"]);
  const value = normalize(raw);
  const entry = CONDITION[value] || {};
  const option = OBJEKTZUSTAND_OPTIONS.find((name) => normalize(name) === value);
  return { code: entry.code, label: entry.label, objektzustand: option };
}

function interiorQuality(details) {
  const neu = normalize(firstValue(details || {}, ["seller-interior-quality", "seller_interior_quality", "interior_quality"]));
  const alt = normalize(firstValue(details || {}, ["seller-quality", "seller_quality"]));
  return INTERIOR_QUALITY[neu] || INTERIOR_QUALITY[alt] || { api: undefined, option: undefined };
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

function isAffirmative(value) {
  const text = normalize(value);
  return text === "ja" || text === "true" || text === "1" || text === "yes" || text.includes("finanzierung") || text.includes("gewunscht") || text.includes("interessiert");
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
    "seller-quality": "Objektzustand",
    "seller-interior-quality": "Ausstattung",
    "buyer-rooms-from": "Zimmer ab",
    "buyer-living-space-from": "Wohnfläche ab m²",
    "buyer-plot-area-from": "Grundstück ab m²",
    "buyer-balcony": "Balkon/Terrasse gewünscht",
    "buyer-elevator": "Aufzug gewünscht",
    "buyer-condition": "Objektzustand gewünscht",
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

// Formulare ohne JavaScript (Update 6, §1): POST als Formular → gleiche Nutzlast, dann Weiterleitung. Siehe _shared/formpost.js.
exports.handler = require("./_shared/formpost").wrap("propstack-lead", exports.handler, { "website-question": require("./website-question").handler });
