/**
 * Formulare ohne JavaScript (Update 6, §1, 27.10.2026)
 *
 * Jedes Formular hat method="post" und action="/.netlify/functions/<name>". Mit JavaScript ändert sich
 * nichts: fg-design.js fängt das Absenden ab und schickt JSON wie bisher. Ohne JavaScript schickt der
 * Browser die Felder als application/x-www-form-urlencoded an dieselbe Funktion. `wrap` baut daraus
 * dieselbe Nutzlast, die das Skript bauen würde (gleiche Schlüssel, gleiche Werte), ruft die Funktion
 * damit auf und leitet danach auf eine Ergebnisseite weiter (303). Persönliche Angaben stehen so nie in
 * der Adresszeile.
 *
 * Was das Skript aus data-Attributen nimmt, steht ohne Skript in der action-Adresse (nur feste Werte,
 * keine Angaben der Besucher): concern (data-concern), form_type (data-form-type), marketing_type
 * (data-marketing-type), frage (Werte der Auswahl „concern“, die an website-question gehen, wie
 * data-endpoint="website-question"). Seite und UTM-Werte kommen aus dem Referer.
 *
 * `toPayload` nutzt auch die Testumgebung (test-env/functions/api/test/[name].js).
 */

const OK_PAGE = "/anfrage-gesendet/";
const ERROR_PAGE = "/anfrage-nicht-gesendet/";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

const trimmed = (value) => String(value === null || value === undefined ? "" : value).trim();

function refererInfo(referer) {
  try {
    const url = new URL(referer);
    return { href: url.href, params: url.searchParams };
  } catch (error) {
    return { href: "", params: new URLSearchParams() };
  }
}

function utmFrom(params) {
  const out = {};
  for (const key of UTM) out[key] = params.get(key) || "";
  return out;
}

/**
 * Baut aus den Formularfeldern die JSON-Nutzlast, die das Skript schicken würde.
 * Gibt { name, payload, honeypot } zurück; name kann sich ändern (Kontakt „Sonstiges“ → website-question).
 */
function toPayload(name, fd, query, referer) {
  const ref = refererInfo(referer);
  const get = (key) => fd.get(key);

  if (name === "propstack-lead") {
    // fg-design.js, Block [data-fgd-lead-form]
    if (get("company_website")) return { name, payload: null, honeypot: true };
    const details = {};
    const extra = [];
    for (const [key, value] of fd.entries()) {
      const match = key.match(/^property_details\[(.+)\]$/);
      if (match && trimmed(value)) details[match[1]] = trimmed(value);
      if (key.startsWith("extra:") && trimmed(value)) extra.push(`${key.slice(6)}: ${trimmed(value)}`);
    }
    if (query.get("form_type")) details.form_type = query.get("form_type");
    const message = [get("message"), ...extra].filter((v) => v && String(v).trim()).join("\n");
    const chosen = get("concern");
    const toQuestion = Boolean(chosen) && query.getAll("frage").includes(chosen);
    if (toQuestion) {
      return {
        name: "website-question",
        payload: {
          name: [get("first_name"), get("last_name")].filter(Boolean).join(" "), email: get("email"), phone: get("phone") || "",
          question: `Thema: ${trimmed(chosen)}\n${message}`, company_website: "", privacy_consent: get("privacy_consent") === "true",
          source_url: ref.href,
        },
      };
    }
    return {
      name,
      payload: {
        first_name: get("first_name"), last_name: get("last_name"), email: get("email"), phone: get("phone") || "",
        concern: get("concern") || query.get("concern") || "",
        object_type: get("object_type") || "", location: get("location") || "", budget: get("budget") || "",
        timeframe: get("timeframe") || "", contact_preference: get("contact_preference") || (get("phone") ? "Telefon" : "E-Mail"),
        message, privacy_consent: get("privacy_consent") === "true", property_details: details,
        source_url: ref.href,
        ...utmFrom(ref.params),
      },
    };
  }

  if (name === "propstack-search-profile") {
    // fg-design.js, Block [data-fgd-search-form]
    if (get("company_website")) return { name, payload: null, honeypot: true };
    const consent = get("privacy_consent") === "true";
    return {
      name,
      payload: {
        first_name: get("first_name"), last_name: get("last_name"), email: get("email"), phone: get("phone"),
        marketing_type: get("marketing_type") || query.get("marketing_type") || "BUY", property_type: get("property_type"),
        location: get("location"), budget: get("budget"), rooms: get("rooms"), living_space: get("living_space"),
        bedrooms: get("bedrooms"), bathrooms: get("bathrooms"), plot_area: get("plot_area"),
        features: fd.getAll("features"), message: get("message"),
        privacy_consent: consent, newsletter_consent: consent, source_url: ref.href,
        ...utmFrom(ref.params),
      },
    };
  }

  if (name === "website-question") {
    // fg-design.js, Block [data-faq-question-form]; den Honeypot prüft die Funktion selbst
    return {
      name,
      payload: {
        name: get("name"), email: get("email"), phone: get("phone"), question: get("question"),
        company_website: get("company_website"), privacy_consent: get("privacy_consent") === "true",
        source_url: ref.href.split("#")[0] + "#faq",
      },
    };
  }

  if (name === "propstack-inquiry") {
    // objekt-anfragen.njk: Objekt-ID und Titel setzt sonst das Skript aus ?object_id=…&object=… der Seite
    return {
      name,
      payload: {
        object_id: get("object_id") || ref.params.get("object_id") || "",
        object_title: get("object_title") || ref.params.get("object") || "Angefragtes Objekt",
        source_url: get("source_url") || ref.href,
        first_name: get("first_name"), last_name: get("last_name"), email: get("email"), phone: get("phone"),
        contact_preference: get("contact_preference"), message: get("message"), privacy: get("privacy"),
      },
    };
  }

  if (name === "bewertung-nachfrage") {
    // Update 19 §5: Nachfrage zur Bewertung; k und typ setzt sonst das Skript aus ?k=…&typ=… der Seite
    return {
      name,
      payload: {
        k: get("k") || ref.params.get("k") || "", typ: get("typ") || ref.params.get("typ") || "",
        modernisierung_jahr: get("modernisierung_jahr"), modernisierung_was: get("modernisierung_was"),
        etage: get("etage"), wohnung_aussen: fd.getAll("wohnung_aussen"), wohnung_aussen_m2: get("wohnung_aussen_m2"),
        haus_grundstueck_m2: get("haus_grundstueck_m2"), haus_aussen: fd.getAll("haus_aussen"),
        mfh_ist_miete: get("mfh_ist_miete"), mfh_soll_miete: get("mfh_soll_miete"),
        company_website: get("company_website"),
      },
    };
  }

  return { name, payload: null };
}

function header(event, key) {
  const headers = event.headers || {};
  const found = Object.keys(headers).find((k) => k.toLowerCase() === key);
  return found ? headers[found] : "";
}

function isFormPost(event) {
  return event.httpMethod === "POST" && /application\/x-www-form-urlencoded/i.test(header(event, "content-type"));
}

function redirect(location) {
  return { statusCode: 303, headers: { Location: location, "Cache-Control": "no-store" }, body: "" };
}

/** handlers: { "<name>": handler } – die Funktion selbst und, für die Weiterleitung, website-question. */
function wrap(name, handler, handlers = {}) {
  return async function (event, context) {
    if (!isFormPost(event)) return handler(event, context);
    try {
      const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
      const fd = new URLSearchParams(raw);
      const query = new URLSearchParams(event.rawQuery || new URLSearchParams(event.queryStringParameters || {}).toString());
      const built = toPayload(name, fd, query, header(event, "referer"));
      if (built.honeypot) return redirect(OK_PAGE);
      if (!built.payload) return redirect(ERROR_PAGE);
      const target = built.name === name ? handler : handlers[built.name];
      if (!target) return redirect(ERROR_PAGE);
      const result = await target(
        { ...event, body: JSON.stringify(built.payload), isBase64Encoded: false, headers: { ...(event.headers || {}), "content-type": "application/json" } },
        context
      );
      let body = {};
      try { body = JSON.parse(result.body || "{}"); } catch (error) { body = {}; }
      const ok = result.statusCode >= 200 && result.statusCode < 300 && body.success !== false;
      return redirect(ok ? OK_PAGE : ERROR_PAGE);
    } catch (error) {
      console.error("FORMPOST ERROR:", error);
      return redirect(ERROR_PAGE);
    }
  };
}

module.exports = { wrap, toPayload, isFormPost, OK_PAGE, ERROR_PAGE };
