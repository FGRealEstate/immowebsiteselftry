/**
 * Update 52 §1 / Update 53 §1.1: gemeinsame Logik der Flyer-Kurzlinks /qr/flyer, /qr/flyer-a und /qr/flyer-b.
 *
 * Jeder Kurzlink leitet mit 302 auf die Bewertungsseite (UTM-Parameter, #anfrage) und zählt jeden GET-Aufruf in
 * Netlify Blobs, Store „qr-aufrufe“, ein Schlüssel je Aufruf („<name>/<ISO-Zeit>-<Zufall>“). Gespeichert wird nur
 * Datum und Uhrzeit (UTC): keine IP-Adresse, kein User-Agent, keine Personendaten. Jeder Kurzlink hat seinen eigenen
 * Präfix („flyer/“, „flyer-a/“, „flyer-b/“), so zählt jede Flyer-Version getrennt.
 * Der Store ist „eventual“; weil jeder Aufruf einen eigenen Schlüssel bekommt, überschreiben sich gleichzeitige Aufrufe
 * nicht. HEAD zählt live trotzdem mit: Netlify reicht HEAD als GET an die Funktion weiter (gemessen 09.11.2026); der
 * HEAD-Zweig unten greift nur, wo HEAD wirklich als HEAD ankommt.
 * Ein Fehler beim Zählen hält die Weiterleitung nie auf; nach 1,5 Sekunden wird ohne Zählung weitergeleitet.
 * Zählen: node ~/.claude/fg-zeiten/werkzeuge/u52/qr-zaehlen.js (liest nur), Zeile im Freitags-Update an Timon.
 *
 * noindex per X-Robots-Tag; die Adressen sind keine Seiten und stehen nicht in der Sitemap.
 * Kein Cache (no-store), damit jeder Scan hier ankommt.
 *
 * Eigene Prüfaufrufe mit ?test=1 (10.11.2026) laufen genauso, zählen aber unter „test/<name>/“, also nie in den
 * Flyer-Zahlen. Ein gedruckter Code trägt nie ?test=1. Die Zahlen liest das F&G Cockpit über qr-stand.js.
 */
const STORE = "qr-aufrufe";
const WARTEN_MS = 1500;

/** Alle Flyer-Kurzlinks. zaehlstart: Aufrufe davor waren Tests aus der Zeit vor ?test=1 (Update 52, 09.11.2026). */
const KURZLINKS = [
  { name: "flyer", titel: "Erster Druck", pfad: "/qr/flyer", zaehlstart: "2026-11-09T14:33:24.000Z" },
  { name: "flyer-a", titel: "Version A", pfad: "/qr/flyer-a", zaehlstart: null },
  { name: "flyer-b", titel: "Version B", pfad: "/qr/flyer-b", zaehlstart: null },
];

const KOPF = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function speicher(event) {
  const { connectLambda, getStore } = require("@netlify/blobs");
  if (event && event.blobs) connectLambda(event);
  return getStore({ name: STORE, consistency: "eventual" });
}

async function zaehlen(store, name, jetzt) {
  const zeit = jetzt.toISOString();
  const zufall = Math.random().toString(16).slice(2, 8).padEnd(6, "0");
  await store.set(`${name}/${zeit}-${zufall}`, zeit);
  return zeit;
}

async function qrAufruf({ name, ziel, methode, jetzt = new Date(), store, warten = WARTEN_MS, test = false }) {
  if (methode !== "GET" && methode !== "HEAD") return { statusCode: 405, headers: { ...KOPF, Allow: "GET, HEAD" }, body: "" };
  if (methode === "GET") {
    try {
      const s = typeof store === "function" ? store() : store;
      const praefix = test ? `test/${name}` : name;
      let uhr;
      await Promise.race([zaehlen(s, praefix, jetzt), new Promise((_, nein) => { uhr = setTimeout(() => nein(new Error("Zeit abgelaufen")), warten); })]).finally(() => clearTimeout(uhr));
    } catch (error) {
      console.warn(`QR-AUFRUF NICHT GEZÄHLT (${name}):`, String((error && error.message) || error).slice(0, 120));
    }
  }
  return { statusCode: 302, headers: { ...KOPF, Location: ziel }, body: "" };
}

/** Kurzlink bauen: name = Blobs-Präfix, ziel = vollständige Ziel-URL. */
function kurzlink(name, ziel) {
  const handler = async (event) => qrAufruf({
    name, ziel, methode: event.httpMethod, store: () => speicher(event),
    test: ((event && event.queryStringParameters) || {}).test === "1",
  });
  // Für Tests: wie qrAufruf, Name und Ziel schon gesetzt
  const pruefen = (opts) => qrAufruf({ ...opts, name, ziel });
  return { handler, pruefen };
}

module.exports = { kurzlink, speicher, STORE, KURZLINKS };
