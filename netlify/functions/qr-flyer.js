/**
 * Update 52 §1 (09.11.2026): Kurzlink fg-realestate.de/qr/flyer für den QR-Code auf Seite 2 von Timons A5-Flyer
 * (erster Druck). Bleibt live, solange diese Flyer im Umlauf sind, und zählt getrennt von Version A und B (Update 53).
 *
 * Weiterleitung (302) auf die Bewertungsseite mit UTM-Parametern und #anfrage: Die Seite öffnet am Formular
 * „Bewertung anfragen“, Schritt 1 (Timon: „direkt zum Bewertungsfeld“). Route in netlify.toml.
 * Zählung und Datenschutz: netlify/functions/_shared/qr-kurzlink.js (Präfix „flyer/“).
 */
const { kurzlink, STORE } = require("./_shared/qr-kurzlink.js");

const ZIEL = "https://fg-realestate.de/immobilienbewertung/?utm_source=flyer&utm_medium=print&utm_campaign=flyer-dezember-2026#anfrage";
const { handler, pruefen } = kurzlink("flyer", ZIEL);

exports.handler = handler;

// Für Tests
exports._qrAufruf = pruefen;
exports.ZIEL = ZIEL;
exports.STORE = STORE;
