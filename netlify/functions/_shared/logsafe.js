/**
 * Update 31 §3: Logs ohne Personendaten.
 * In die Netlify-Logs kommen nur Formulartyp, fehlende Pflichtfelder, Anfrage-ID, Endpunkt, HTTP-Status und Fehlerart.
 * Keine Namen, E-Mail-Adressen, Telefonnummern, Adressen und keine Nutzlasten. Die Datenschutzerklärung deckt Personendaten in Logs nicht ab.
 */
// Ohne require("crypto"): globalThis.crypto gibt es in Node 18+ und in Cloudflare (Testumgebung bindet formpost.js ein).

// Anfrage-ID: Netlify-Request-ID, sonst eine zufällige. Verbindet die Logzeilen einer Anfrage, ohne die Person zu nennen.
function requestId(event) {
  const headers = (event && event.headers) || {};
  const id = headers["x-nf-request-id"] || headers["X-Nf-Request-Id"];
  return String(id || (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))).slice(0, 40);
}

// Endpunkt ohne IDs und ohne Query: /contacts/123?x=1 → /contacts/<id>
function endpoint(value) {
  return String(value || "").split("?")[0].replace(/\/\d+(?=\/|$)/g, "/<id>");
}

// Falls doch Freitext geloggt wird: E-Mail-Adressen und längere Ziffernfolgen (Telefon, Hausnummer mit PLZ) unkenntlich machen.
function mask(text) {
  return String(text === null || text === undefined ? "" : text)
    .replace(/[^\s@"'<>,;:()[\]{}]+@[^\s@"'<>,;:()[\]{}]+/g, "<E-Mail>")
    .replace(/\+?\d[\d\s/().-]{5,}\d/g, "<Ziffern>");
}

// Fehler für das Log: Art, Code, Status und eine kurze Meldung ohne Inhalte.
// Propstack-Fehler tragen safeMessage (Status + Endpunkt + Feldnamen), siehe propstackError().
function error(err) {
  if (!err) return {};
  const out = {
    name: err.name,
    code: err.code,
    status: err.status || err.statusCode,
    responseCode: err.responseCode,
    // Update 51 §7: 500 statt 200 Zeichen, damit Propstacks Fehlermeldung (siehe fehlerText) ganz im Log steht
    message: mask(err.safeMessage || err.message).slice(0, 500),
  };
  Object.keys(out).forEach((key) => out[key] === undefined && delete out[key]);
  return out;
}

// Kurzform für console.warn(…, logsafe.msg(error))
function msg(err) {
  return error(err).message || "";
}

// Fehler aus einer Propstack-Antwort. message bleibt wie bisher (geht an den Browser zurück), safeMessage ist für das Log.
function propstackError(status, path, data) {
  const err = new Error(`Propstack Fehler ${status} bei ${path}: ${JSON.stringify(data)}`);
  err.status = status;
  err.safeMessage = `Propstack Fehler ${status} bei ${endpoint(path)}${fieldNames(data)}${fehlerText(data)}`;
  return err;
}

// Update 51 §7: Propstacks Fehlermeldung für das Log, damit man sieht, welches Feld oder welchen Wert Propstack ablehnt
// (Befund 8: „Propstack Fehler 400 bei /units“ ohne Grund). Nur Feldnamen und Propstacks Meldungstext, keine Nutzlast;
// mask() macht E-Mail-Adressen und Ziffernfolgen unkenntlich. Je Meldung höchstens 120 Zeichen, zusammen höchstens 400.
function fehlerText(data) {
  if (!data || typeof data !== "object") return "";
  if (data.raw !== undefined) return ` (Antwort ohne JSON, ${String(data.raw).length} Zeichen)`;
  const teile = [];
  const text = (v) => (v && typeof v === "object" ? JSON.stringify(v) : String(v));
  const add = (feld, meldung) => teile.push(`${feld ? feld + ": " : ""}${mask(meldung).slice(0, 120)}`);
  const e = data.errors !== undefined ? data.errors : data.error;
  if (Array.isArray(e)) e.slice(0, 10).forEach((v) => add("", text(v)));
  else if (e && typeof e === "object") Object.entries(e).slice(0, 10).forEach(([k, v]) => add(k, Array.isArray(v) ? v.map(text).join("; ") : text(v)));
  else if (e !== undefined && e !== null && e !== "") add("", text(e));
  if (data.message) add("message", text(data.message));
  return teile.length ? ` (Propstack: ${teile.join(" | ")})`.slice(0, 420) : "";
}

// Nur die Namen der beanstandeten Felder, nie die Werte.
function fieldNames(data) {
  const errors = data && (data.errors || data.error);
  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    const keys = Object.keys(errors).slice(0, 10);
    return keys.length ? ` (Felder: ${keys.join(", ")})` : "";
  }
  return "";
}

// Welche der Felder fehlen? Gibt nur Feldnamen zurück.
function missing(values, fields) {
  return fields.filter((field) => {
    const value = values ? values[field] : undefined;
    return value === undefined || value === null || value === "" || value === false;
  });
}

module.exports = { requestId, endpoint, mask, error, msg, propstackError, missing };
