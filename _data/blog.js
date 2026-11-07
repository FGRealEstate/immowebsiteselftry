// Update 42 §2 (07.11.2026): die Blogartikel, die an diesem Tag erscheinen, nach Datum. Ersetzt _data/blog.json.
// Plan: _data/blogplan.json (Datum je Artikel, Zeitpunkt „bereit“). Karten (Kategorie, Titel, Kurztext):
// _data/blogquelle.json aus live.py. Regeln und Testzeit FG_JETZT: scripts/blogplan.js.
// Benutzt von .eleventy.js (Sitemap, Weiterleitungen, Bilder), blogArtikel.js, bildnachweise.js, llms.txt.njk
// und den Leistungsseiten (related.blog).
const path = require("path");
const blogplan = require("../scripts/blogplan");

const { plan, quelle, vorhanden } = blogplan.ladePlan(path.join(__dirname, ".."));
module.exports = blogplan.veroeffentlicht(plan, quelle, { jetzt: blogplan.jetztAusUmgebung(), vorhanden });
