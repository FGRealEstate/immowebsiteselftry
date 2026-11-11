/**
 * 10.11.2026 (Peer: Flyer im F&G Cockpit tracken): Scan-Zahlen der Flyer-Kurzlinks für das Cockpit.
 * GET /.netlify/functions/qr-stand → JSON je Kurzlink (erster Druck, Version A, Version B): Zahl der Scans seit
 * Zählstart, letzter Scan, Scans je Tag (deutsche Zeit). Liest nur den Netlify-Blobs-Store „qr-aufrufe“
 * (siehe _shared/qr-kurzlink.js); Prüfaufrufe mit ?test=1 liegen unter „test/…“ und zählen nicht.
 *
 * Herausgegeben werden nur Zahlen und Uhrzeiten, keine Personendaten (es gibt keine). Die Antwort ist ohne Anmeldung
 * lesbar; der Browser gibt sie aber nur den Cockpit-Adressen frei (CORS). noindex, kein Cache.
 */
const { speicher, KURZLINKS } = require("./_shared/qr-kurzlink.js");

const COCKPIT = [
  /^https:\/\/fg-cockpit\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.fg-cockpit\.pages\.dev$/,
  /^https:\/\/zqe1yzqy-gpb4a-phec3p\.pages\.dev$/,
  /^https:\/\/[a-z0-9-]+\.zqe1yzqy-gpb4a-phec3p\.pages\.dev$/,
  /^http:\/\/localhost:\d+$/,
];

const tagBerlin = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Schlüssel „<name>/<ISO-Zeit>-<Zufall>“ → Zahlen je Kurzlink. */
function auswerten(schluessel, jetzt = new Date()) {
  const flyer = KURZLINKS.map((k) => {
    const praefix = `${k.name}/`;
    const zeiten = schluessel.filter((s) => s.startsWith(praefix)).map((s) => s.slice(praefix.length, praefix.length + 24))
      .filter((z) => !Number.isNaN(Date.parse(z)) && (!k.zaehlstart || z >= k.zaehlstart)).sort();
    const je_tag = {};
    for (const z of zeiten) { const t = tagBerlin(z); je_tag[t] = (je_tag[t] || 0) + 1; }
    return { name: k.name, titel: k.titel, pfad: k.pfad, zaehlstart: k.zaehlstart, gezaehlt: zeiten.length, letzter: zeiten[zeiten.length - 1] || null, je_tag };
  });
  return { stand: jetzt.toISOString(), flyer };
}

async function qrStand({ methode, herkunft, store, jetzt = new Date() }) {
  const kopf = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", Vary: "Origin" };
  if (herkunft && COCKPIT.some((r) => r.test(herkunft))) kopf["Access-Control-Allow-Origin"] = herkunft;
  if (methode === "OPTIONS") return { statusCode: 204, headers: { ...kopf, "Access-Control-Allow-Methods": "GET" }, body: "" };
  if (methode !== "GET") return { statusCode: 405, headers: { ...kopf, Allow: "GET" }, body: "" };
  try {
    const s = typeof store === "function" ? store() : store;
    const { blobs } = await s.list();
    return { statusCode: 200, headers: kopf, body: JSON.stringify(auswerten(blobs.map((b) => b.key), jetzt)) };
  } catch (error) {
    console.warn("QR-STAND NICHT LESBAR:", String((error && error.message) || error).slice(0, 120));
    return { statusCode: 503, headers: kopf, body: JSON.stringify({ fehler: "Zähler gerade nicht lesbar" }) };
  }
}

exports.handler = async function (event) {
  const h = (event && event.headers) || {};
  return qrStand({ methode: event.httpMethod, herkunft: h.origin || h.Origin, store: () => speicher(event) });
};

// Für Tests
exports._qrStand = qrStand;
exports._auswerten = auswerten;
