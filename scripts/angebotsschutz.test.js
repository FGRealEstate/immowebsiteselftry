// Update 36 §2.1: Test für den Angebotsschutz. Aufruf: npm test (node --test scripts/*.test.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { sperrgrund, ueberspringen } = require("./angebotsschutz.js");

const berlin = { id: 1, title: "Vermietete 2-Zimmer-Wohnung in Schöneberg", city: "Berlin", region: "Berlin", zip_code: "10827" };

test("echtes Objekt in Berlin, Dresden, Leipzig und Brandenburg bleibt", () => {
    assert.equal(sperrgrund(berlin), null);
    assert.equal(sperrgrund({ id: 2, title: "Altbau mit Balkon", city: "Dresden", region: "Sachsen", zip_code: "01309" }), null);
    assert.equal(sperrgrund({ id: 3, title: "Altbau in Plagwitz", city: "Leipzig", zip_code: "04229" }), null);
    assert.equal(sperrgrund({ id: 4, title: "Einfamilienhaus", city: "Oranienburg", region: "Brandenburg", zip_code: "16515" }), null);
    assert.equal(sperrgrund({ id: 5, title: "Haus am See", city: "Erkner", zip_code: "15537" }), null);
    assert.equal(sperrgrund({ id: 6, title: "Stadthaus", city: "Cottbus", zip_code: "03046" }), null);
});

test("Fall 6350704: TEST im Titel, Krefeld", () => {
    const objekt = { id: 6350704, title: "TEST Vermietete 3,5-Zimmer-Wohnung mit Balkon", city: "Krefeld", region: "", zip_code: "47798" };
    assert.equal(sperrgrund(objekt), "testwort");
    assert.equal(sperrgrund({ ...objekt, title: "Vermietete 3,5-Zimmer-Wohnung mit Balkon" }), "ausserhalb");
});

test("Testwörter in Titel, Beschreibung und Tags", () => {
    assert.equal(sperrgrund({ ...berlin, title: "Test-Objekt Schöneberg" }), "testwort");
    assert.equal(sperrgrund({ ...berlin, description_note: "Alle Angaben sind erfunden." }), "testwort");
    assert.equal(sperrgrund({ ...berlin, location_note: { label: "Lage", value: "Musterhausen, ERFUNDEN" } }), "testwort");
    assert.equal(sperrgrund({ ...berlin, tags: ["TEST"] }), "testwort");
    assert.equal(sperrgrund({ ...berlin, tags: [{ name: "Test-Daten" }] }), "testwort");
    assert.equal(sperrgrund({ ...berlin, title: "TEST: Wohnung" }), "testwort");
});

test("normale Wörter mit „test“ bleiben", () => {
    assert.equal(sperrgrund({ ...berlin, description_note: "Energieausweis liegt vor, Attest des Schornsteinfegers, Testament-Vollstreckung abgeschlossen." }), null);
    assert.equal(sperrgrund({ ...berlin, description_note: "Der Testsieger unter den Grundrissen; getestet und bestätigt." }), null);
    assert.equal(sperrgrund({ ...berlin, title: "Wohnung am TESTA-Platz" }), null);
});

test("Orte außerhalb der F&G-Gebiete fallen weg", () => {
    assert.equal(sperrgrund({ id: 7, title: "Wohnung", city: "München", region: "Bayern", zip_code: "80331" }), "ausserhalb");
    assert.equal(sperrgrund({ id: 8, title: "Wohnung", city: "Hamburg", zip_code: "20095" }), "ausserhalb");
    assert.equal(sperrgrund({ id: 9, title: "Wohnung", city: "Radebeul", region: "Sachsen", zip_code: "01445" }), "ausserhalb");
    assert.equal(sperrgrund({ id: 10, title: "Wohnung", city: "Musterhausen" }), "ausserhalb");
});

test("Ort fehlt ganz: nur der Testwort-Filter entscheidet", () => {
    assert.equal(sperrgrund({ id: 11, title: "Wohnung" }), null);
    assert.equal(sperrgrund({ id: 12, title: "TEST Wohnung" }), "testwort");
});

test("Protokoll nennt nur die ID, keine Objektdaten", () => {
    const zeilen = [];
    const original = console.warn;
    console.warn = (...teile) => zeilen.push(teile.join(" "));
    try {
        assert.equal(ueberspringen({ id: 6350704, title: "TEST Vermietete Wohnung", city: "Krefeld", street: "Musterstraße 1" }, "Einheit"), true);
        assert.equal(ueberspringen(berlin, "Einheit"), false);
    } finally {
        console.warn = original;
    }
    assert.equal(zeilen.length, 1);
    assert.match(zeilen[0], /6350704/);
    assert.doesNotMatch(zeilen[0], /Krefeld|Musterstra|Vermietete/);
});
