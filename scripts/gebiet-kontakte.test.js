// Update 48 §3: netlify/functions/_shared/gebiet-kontakte.json muss zu content/gebiete passen, und die Zeile
// „Ansprechpartner laut Gebiet“ folgt der Kontaktkarte. Aktualisieren: node scripts/gebiet-kontakte.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const { text, ziel } = require("./gebiet-kontakte.js");
const a = require("../netlify/functions/_shared/ansprechpartner.js");

test("gebiet-kontakte.json ist aktuell", () => {
  assert.strictEqual(fs.readFileSync(ziel, "utf8"), text(), "node scripts/gebiet-kontakte.js ausführen");
});

test("Ansprechpartner laut Gebiet", () => {
  const faelle = [
    [{ sourceUrl: "https://fg-realestate.de/standorte/teltow/" }, "lennart"],
    [{ sourceUrl: "https://fg-realestate.de/standorte/berlin/", orte: ["Pankow"] }, "timon"],
    [{ zip: "12163", city: "Berlin" }, "lennart"],
    [{ zip: "13187", city: "Berlin" }, "timon"],
    [{ zip: "04109", city: "Leipzig" }, "timon"],
    [{ orte: ["Berlin-Westend"] }, "lennart"],
    [{ orte: ["Bernau bei Berlin"] }, "timon"],
    [{ orte: ["Königs Wusterhausen"] }, "lennart"],
    [{ orte: ["Dresden-Striesen"] }, "timon"],
    [{ orte: ["Köpenick"] }, "timon"],
    [{ city: "Berlin" }, null],
    [{ orte: ["Hamburg"] }, null],
  ];
  for (const [eingabe, erwartet] of faelle) assert.strictEqual(a.kontaktFuer(eingabe), erwartet, JSON.stringify(eingabe));
  assert.strictEqual(a.vorNotiz("Notiz", { orte: ["Teltow"] }), "Ansprechpartner laut Gebiet: Lennart Geserich\n\nNotiz");
  assert.strictEqual(a.vorNotiz("Notiz", { orte: ["Hamburg"] }), "Notiz");
});
