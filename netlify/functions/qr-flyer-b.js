/**
 * Update 53 §1.1 (10.11.2026): Kurzlink fg-realestate.de/qr/flyer-b für die QR-Codes auf Flyer-Version B.
 * Gleiches Ziel wie /qr/flyer, dazu utm_content=b; zählt getrennt (Präfix „flyer-b/“).
 * Zählung und Datenschutz: netlify/functions/_shared/qr-kurzlink.js. Route in netlify.toml.
 * Bleibt live, solange Flyer der Version B im Umlauf sind.
 */
const { kurzlink, STORE } = require("./_shared/qr-kurzlink.js");

const ZIEL = "https://fg-realestate.de/immobilienbewertung/?utm_source=flyer&utm_medium=print&utm_campaign=flyer-dezember-2026&utm_content=b#anfrage";
const { handler, pruefen } = kurzlink("flyer-b", ZIEL);

exports.handler = handler;

// Für Tests
exports._qrAufruf = pruefen;
exports.ZIEL = ZIEL;
exports.STORE = STORE;
