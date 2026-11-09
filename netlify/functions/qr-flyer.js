/**
 * Update 52 §1 (09.11.2026): Kurzlink fg-realestate.de/qr/flyer für den QR-Code auf Seite 2 von Timons A5-Flyer.
 *
 * Weiterleitung (302) auf die Bewertungsseite mit UTM-Parametern und #anfrage: Die Seite öffnet am Formular
 * „Bewertung anfragen“, Schritt 1 (Timon: „direkt zum Bewertungsfeld“). Route in netlify.toml.
 *
 * Gezählt wird jeder GET-Aufruf, gespeichert nur Datum und Uhrzeit (UTC). Keine IP-Adresse, kein User-Agent,
 * keine Personendaten. Ablage: Netlify Blobs, Store „qr-aufrufe“, ein Schlüssel je Aufruf
 * („flyer/<ISO-Zeit>-<Zufall>“). Der Store ist „eventual“; weil jeder Aufruf einen eigenen Schlüssel bekommt,
 * überschreiben sich gleichzeitige Aufrufe nicht. HEAD (Link-Prüfer) bekommt die Weiterleitung, zählt aber nicht.
 * Ein Fehler beim Zählen hält die Weiterleitung nie auf; nach 1,5 Sekunden wird ohne Zählung weitergeleitet.
 * Zählen: node ~/.claude/fg-zeiten/werkzeuge/u52/qr-zaehlen.js (liest nur), Zeile im Freitags-Update an Timon.
 *
 * noindex per X-Robots-Tag; die Adresse ist keine Seite und steht nicht in der Sitemap.
 * Kein Cache (no-store), damit jeder Scan hier ankommt. Bleibt live, solange die Flyer im Umlauf sind.
 */
const STORE = "qr-aufrufe";
const ZIEL = "https://fg-realestate.de/immobilienbewertung/?utm_source=flyer&utm_medium=print&utm_campaign=flyer-dezember-2026#anfrage";
const WARTEN_MS = 1500;

const KOPF = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function speicher(event) {
  const { connectLambda, getStore } = require("@netlify/blobs");
  if (event && event.blobs) connectLambda(event);
  return getStore({ name: STORE, consistency: "eventual" });
}

async function zaehlen(store, jetzt) {
  const zeit = jetzt.toISOString();
  const zufall = Math.random().toString(16).slice(2, 8).padEnd(6, "0");
  await store.set(`flyer/${zeit}-${zufall}`, zeit);
  return zeit;
}

async function qrAufruf({ methode, jetzt = new Date(), store, warten = WARTEN_MS }) {
  if (methode !== "GET" && methode !== "HEAD") return { statusCode: 405, headers: { ...KOPF, Allow: "GET, HEAD" }, body: "" };
  if (methode === "GET") {
    try {
      const s = typeof store === "function" ? store() : store;
      let uhr;
      await Promise.race([zaehlen(s, jetzt), new Promise((_, nein) => { uhr = setTimeout(() => nein(new Error("Zeit abgelaufen")), warten); })]).finally(() => clearTimeout(uhr));
    } catch (error) {
      console.warn("QR-AUFRUF NICHT GEZÄHLT:", String((error && error.message) || error).slice(0, 120));
    }
  }
  return { statusCode: 302, headers: { ...KOPF, Location: ZIEL }, body: "" };
}

exports.handler = async function qrFlyer(event) {
  return qrAufruf({ methode: event.httpMethod, store: () => speicher(event) });
};

// Für Tests
exports._qrAufruf = qrAufruf;
exports.ZIEL = ZIEL;
exports.STORE = STORE;
