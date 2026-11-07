/**
 * Update 44 §2.4 (07.11.2026): Sammelstelle für die Content-Security-Policy im Report-only-Modus (Header in netlify.toml).
 *
 * Browser schicken hierher, was die Richtlinie blockieren würde. Gespeichert wird je Tag nur:
 * Richtlinie, blockierte Herkunft (Schema und Host, oder „inline“, „eval“, „data“ …) und der Seitenpfad ohne Abfrage,
 * jeweils mit Anzahl. Keine IP-Adresse, kein User-Agent, keine vollständige URL.
 * Ablage: Netlify Blobs, Store „csp-berichte“, Schlüssel „JJJJ-MM-TT“. „eventual“ wie im Build-Sammler: Bei gleichzeitigen
 * Meldungen kann ein Zähler zu niedrig sein; welche Herkunft blockiert würde, geht nicht verloren, sie meldet sich wieder.
 * Auswerten nach einer Woche, dann die Richtlinie anpassen und als Content-Security-Policy einschalten.
 */
const STORE = "csp-berichte";
const MAX_BYTES = 32 * 1024;
const MAX_EINTRAEGE_JE_TAG = 500;

function herkunft(wert) {
  const s = String(wert || "").trim();
  if (!s) return "leer";
  if (/^(inline|eval|wasm-eval|trusted-types-policy|trusted-types-sink)$/i.test(s)) return s.toLowerCase();
  try {
    const u = new URL(s);
    if (u.protocol === "http:" || u.protocol === "https:" || u.protocol === "wss:" || u.protocol === "ws:") return u.protocol + "//" + u.host;
    return u.protocol.replace(":", "");
  } catch (_) {
    return s.slice(0, 40).replace(/[^a-z0-9:+.-]/gi, "");
  }
}

function pfad(wert) {
  try {
    return new URL(String(wert || "")).pathname.slice(0, 120);
  } catch (_) {
    return "unbekannt";
  }
}

function meldungen(body) {
  const daten = JSON.parse(body);
  const liste = [];
  if (Array.isArray(daten)) {
    // Reporting API (application/reports+json)
    for (const r of daten) {
      if (!r || r.type !== "csp-violation" || !r.body) continue;
      liste.push({ richtlinie: r.body.effectiveDirective || r.body.violatedDirective, blockiert: r.body.blockedURL, seite: r.body.documentURL || r.url });
    }
  } else if (daten && daten["csp-report"]) {
    // report-uri (application/csp-report)
    const r = daten["csp-report"];
    liste.push({ richtlinie: r["effective-directive"] || r["violated-directive"], blockiert: r["blocked-uri"], seite: r["document-uri"] });
  }
  return liste.map((m) => ({
    richtlinie: String(m.richtlinie || "unbekannt").split(" ")[0].slice(0, 40),
    blockiert: herkunft(m.blockiert),
    seite: pfad(m.seite)
  }));
}

function speicher(event) {
  const { connectLambda, getStore } = require("@netlify/blobs");
  if (event && event.blobs) connectLambda(event);
  return getStore({ name: STORE, consistency: "eventual" });
}

exports.handler = async function cspBericht(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: { Allow: "POST" }, body: "" };
  const body = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : String(event.body || "");
  if (!body || body.length > MAX_BYTES) return { statusCode: 413, body: "" };
  let liste;
  try {
    liste = meldungen(body);
  } catch (_) {
    return { statusCode: 400, body: "" };
  }
  if (!liste.length) return { statusCode: 204, body: "" };
  try {
    const store = speicher(event);
    const tag = new Date().toISOString().slice(0, 10);
    const stand = (await store.get(tag, { type: "json" })) || {};
    for (const m of liste) {
      const schluessel = `${m.richtlinie} | ${m.blockiert} | ${m.seite}`;
      if (!(schluessel in stand) && Object.keys(stand).length >= MAX_EINTRAEGE_JE_TAG) continue;
      stand[schluessel] = (stand[schluessel] || 0) + 1;
    }
    await store.setJSON(tag, stand);
  } catch (error) {
    console.warn("CSP-Bericht: nicht gespeichert.", error.message);
  }
  return { statusCode: 204, body: "" };
};

// Für Tests
exports._meldungen = meldungen;
exports._herkunft = herkunft;
