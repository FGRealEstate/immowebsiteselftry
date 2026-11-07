/*
 * Update 48 §3 (07.11.2026): kompakter Auszug der Gebietsseiten für die Formular-Funktionen.
 * netlify/functions/_shared/ansprechpartner.js schreibt damit „Ansprechpartner laut Gebiet: …“ als erste Zeile der Notiz.
 * Je Seite nur slug, name, typ, orte, kreis und kontakt (wie die Kontaktkarte; die Berlin-Übersicht nennt zwei Personen
 * und gibt deshalb keinen). Läuft in „npm run build“ vor Eleventy; die Datei liegt zusätzlich im Repository, damit die
 * Funktionen auch ohne diesen Schritt (Testumgebung) gebündelt werden. scripts/gebiet-kontakte.test.js prüft, dass sie aktuell ist.
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "content", "gebiete");
const ziel = path.join(__dirname, "..", "netlify", "functions", "_shared", "gebiet-kontakte.json");

function auszug() {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    return {
      slug: d.slug,
      name: d.name,
      typ: d.typ || "ort",
      orte: d.orte || [],
      kreis: (d.kreis && d.kreis.name) || null,
      kontakt: d.kontakte ? null : d.kontakt || null,
    };
  });
}

function text() {
  return JSON.stringify({ quelle: "content/gebiete/*.json, erzeugt von scripts/gebiet-kontakte.js (Update 48 §3)", gebiete: auszug() }, null, 1) + "\n";
}

if (require.main === module) {
  fs.writeFileSync(ziel + ".tmp", text());
  fs.renameSync(ziel + ".tmp", ziel);
  console.log("gebiet-kontakte.json:", auszug().length, "Gebietsseiten");
}

module.exports = { text, ziel };
