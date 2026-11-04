// Update 32 §2 (04.11.2026): Fragen für Schritt 2 der Bewertung (bewertung-nachfrage.njk).
// Einzige Quelle ist der Katalog in netlify/functions/_shared/nachfrage.js; Seite, Prüfung und Notiz lesen dieselben Fragen.
module.exports = () => require("../netlify/functions/_shared/nachfrage.js").seite();
