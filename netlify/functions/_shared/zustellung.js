/**
 * Zustellung nach Propstack prüfen (Update 32 §1, 04.11.2026)
 *
 * Hintergrund: Vom 19.09. bis zum Fix am 02.11. kam keine Website-Anfrage in Propstack an. Die alte Adresse
 * crm.propstack.de/api/v1 antwortete mit einer Umleitung, und dabei wurde aus dem POST ein GET. Eine Antwort ohne
 * Fehler zählt deshalb nicht mehr als „angekommen“.
 *
 * 1. Rücklesen: Nach jedem Schreiben (Kontakt, Objekt, Suchprofil, Notiz oder Aufgabe, Deal) liest die Funktion den
 *    Datensatz über die zurückgegebene ID wieder (GET). Nur wenn das Rücklesen ihn findet, gilt er als angekommen.
 * 2. Rückfall-Mail: Fehlt ein Teil, geht die ganze Anfrage an das F&G-Postfach, Betreff
 *    „Website-Anfrage NICHT in Propstack angekommen“, mit einer kurzen Fehlerzeile je Teil (Endpunkt, Status, Fehlerart).
 *    Ins Log kommen nur Formular, Endpunkt (ohne IDs), Status und Fehlerart, keine Personendaten.
 * 3. An den Browser gehen nur success und message (oder error).
 *
 * Lesende Endpunkte laut docs.propstack.de (gelesen 04.11.2026) und am 04.11. lesend gegen Propstack geprüft:
 * GET /contacts/:id, GET /units/:id, GET /tasks/:id, GET /client_properties/:id (antwortet, steht nicht in der Doku),
 * GET /saved_queries?client=<Kontakt-ID>. Unbekannte IDs geben 404.
 */

const logsafe = require("./logsafe");
const { sendInternalNotification } = require("./mailer");

const BETREFF = "Website-Anfrage NICHT in Propstack angekommen";

/** Propstack-Zugriff mit redirect: "manual" für alle Methoden (eine Umleitung ist immer ein Fehler). */
function propstack(apiKey, base) {
  async function call(method, endpoint, body) {
    console.log(`PROPSTACK ${method}:`, logsafe.endpoint(endpoint));
    const response = await fetch(`${base}${endpoint}`, {
      method,
      redirect: "manual",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    console.log("PROPSTACK RESPONSE:", logsafe.endpoint(endpoint), response.status);
    if (!response.ok) throw logsafe.propstackError(response.status, endpoint, data);
    return data;
  }
  return {
    get: (endpoint) => call("GET", endpoint),
    post: (endpoint, body) => call("POST", endpoint, body),
    put: (endpoint, body) => call("PUT", endpoint, body),
  };
}

/** ID aus einer Propstack-Antwort ({id}, {data:{id}}, {client:{id}} …). */
function idAus(response, keys = ["client", "contact", "property", "unit", "saved_query", "task", "client_property", "data"]) {
  if (!response || typeof response !== "object") return null;
  if (response.id) return response.id;
  for (const key of keys) if (response[key] && response[key].id) return response[key].id;
  return null;
}

/** Fehlerart in Worten, ohne Inhalte. */
function fehlerart(error) {
  if (!error) return "";
  const status = error.status || error.statusCode;
  if (status >= 300 && status < 400) return `Umleitung (HTTP ${status})`;
  if (status) return `HTTP ${status}`;
  if (error.name === "AbortError" || /timeout/i.test(String(error.message))) return "Zeitüberschreitung";
  if (error.name === "TypeError") return "Netzwerkfehler";
  return error.name || "Fehler";
}

const LESEN = {
  Kontakt: (id) => `/contacts/${id}`,
  Objekt: (id) => `/units/${id}`,
  Notiz: (id) => `/tasks/${id}`,
  Aufgabe: (id) => `/tasks/${id}`,
  Deal: (id) => `/client_properties/${id}`,
};

/**
 * Liest einen geschriebenen Datensatz zurück. art: Kontakt, Objekt, Notiz, Aufgabe, Deal, Suchprofil.
 * Gibt { ok, endpoint, status, fehlerart } zurück; ok nur, wenn der Datensatz mit derselben ID gefunden wird.
 */
async function zuruecklesen(api, art, id, { kontaktId } = {}) {
  if (!id) return { ok: false, endpoint: "", status: "", fehlerart: "keine ID in der Antwort" };
  const endpoint = art === "Suchprofil" ? `/saved_queries?client=${kontaktId}&per=100` : LESEN[art](id);
  try {
    const data = await api.get(endpoint);
    const liste = Array.isArray(data) ? data : Array.isArray(data && data.data) ? data.data : null;
    const gefunden = liste ? liste.some((x) => x && String(x.id) === String(id)) : String(idAus(data)) === String(id);
    return gefunden
      ? { ok: true, endpoint: logsafe.endpoint(endpoint), status: 200, fehlerart: "" }
      : { ok: false, endpoint: logsafe.endpoint(endpoint), status: 200, fehlerart: "Rücklesen: Datensatz nicht gefunden" };
  } catch (error) {
    return { ok: false, endpoint: logsafe.endpoint(endpoint), status: error.status || "", fehlerart: `Rücklesen: ${fehlerart(error)}` };
  }
}

/**
 * Protokoll einer Anfrage: jeder Teil, der nach Propstack geschrieben werden sollte, mit Ergebnis.
 * schreiben(teil, endpoint, fn) führt fn aus (gibt die Propstack-Antwort zurück), liest zurück und trägt das Ergebnis ein.
 * Gibt die ID zurück, wenn der Teil angekommen ist, sonst null.
 */
function protokoll(api, formular, requestId) {
  const teile = [];

  function eintragen(teil, eintrag) {
    teile.push({ teil, ...eintrag });
    if (!eintrag.ok) console.warn("PROPSTACK TEIL FEHLT:", { requestId, formular, teil, endpoint: eintrag.endpoint, status: eintrag.status, fehlerart: eintrag.fehlerart });
  }

  async function pruefen(teil, id, { kontaktId, endpoint } = {}) {
    const r = await zuruecklesen(api, teil, id, { kontaktId });
    eintragen(teil, r.ok ? { ok: true, id, endpoint: r.endpoint, status: r.status } : { ok: false, id, ...r, endpoint: r.endpoint || logsafe.endpoint(endpoint || "") });
    return r.ok ? id : null;
  }

  return {
    teile,
    /** Schreiben ist fehlgeschlagen (alle Versuche): Teil als fehlend eintragen. */
    fehlgeschlagen(teil, endpoint, error) {
      eintragen(teil, { ok: false, endpoint: logsafe.endpoint(endpoint), status: (error && (error.status || error.statusCode)) || "", fehlerart: fehlerart(error) || "Schreiben fehlgeschlagen" });
      return null;
    },
    /** Schreiben war ohne Fehler: zurücklesen. */
    pruefen,
    fehlend() {
      return teile.filter((t) => !t.ok);
    },
    angekommen() {
      return teile.filter((t) => t.ok);
    },
  };
}

/** Eine Fehlerzeile je fehlendem Teil: „Kontakt: /contacts, Status 301, Umleitung (HTTP 301)“ */
function fehlerzeilen(fehlend) {
  return fehlend.map((t) => `${t.teil}: ${t.endpoint || "-"}, Status ${t.status || "-"}, ${t.fehlerart || "unbekannt"}`);
}

/**
 * Rückfall-Mail an das F&G-Postfach. text = die vollständige Anfrage (Notiz). Gibt das Ergebnis des Mailers zurück.
 * Log: nur Formular, Endpunkte, Status, Fehlerart und ob die Mail ging.
 */
async function rueckfallMail({ formular, requestId, text, replyTo, protokoll: p, hinweis }) {
  const fehlend = p.fehlend();
  const angekommen = p.angekommen();
  const kopf = [
    "Diese Website-Anfrage ist NICHT vollständig in Propstack angekommen. Bitte die fehlenden Teile von Hand anlegen.",
    "",
    `Formular: ${formular}`,
    `Zeitpunkt: ${new Date().toISOString()}`,
    "",
    "Fehler:",
    ...fehlerzeilen(fehlend).map((z) => `- ${z}`),
    "",
    `In Propstack angekommen: ${angekommen.length ? angekommen.map((t) => `${t.teil} (ID ${t.id})`).join(", ") : "nichts"}`,
    ...(hinweis ? ["", hinweis] : []),
    "",
    "Vollständige Anfrage:",
    "",
  ].join("\n");
  const mail = await sendInternalNotification({ subject: BETREFF, replyTo, text: `${kopf}${text}` });
  console.error("PROPSTACK NICHT ANGEKOMMEN:", {
    requestId,
    formular,
    fehler: fehlend.map((t) => ({ teil: t.teil, endpoint: t.endpoint, status: t.status, fehlerart: t.fehlerart })),
    mail: mail.sent ? "gesendet" : mail.skipped ? "übersprungen" : "fehlgeschlagen",
  });
  return mail;
}

/** Antwort an den Browser: nur success und message bzw. error. */
function oeffentlich(statusCode, { success, message, error }) {
  const body = success ? { success: true, message } : { success: false, error };
  return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

module.exports = { BETREFF, propstack, idAus, fehlerart, zuruecklesen, protokoll, fehlerzeilen, rueckfallMail, oeffentlich };
