/**
 * Update 53 §1.1 (10.11.2026): Kurzlink fg-realestate.de/qr/flyer-a für den QR-Code auf Flyer-Version A.
 * Gleiches Ziel wie /qr/flyer, dazu utm_content=a; zählt getrennt (Präfix „flyer-a/“).
 * Zählung und Datenschutz: netlify/functions/_shared/qr-kurzlink.js. Route in netlify.toml.
 * Bleibt live, solange Flyer der Version A im Umlauf sind.
 */
const { kurzlink, STORE } = require("./_shared/qr-kurzlink.js");

const ZIEL = "https://fg-realestate.de/immobilienbewertung/?utm_source=flyer&utm_medium=print&utm_campaign=flyer-dezember-2026&utm_content=a#anfrage";
const { handler, pruefen } = kurzlink("flyer-a", ZIEL);

exports.handler = handler;

// Für Tests
exports._qrAufruf = pruefen;
exports.ZIEL = ZIEL;
exports.STORE = STORE;
