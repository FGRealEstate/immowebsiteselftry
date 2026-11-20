// Update 71 §1.3: Kapitalanlage oder Eigennutz. Propstack liefert Titel, Beschreibung und „Vermietet“ als {label, value}.
const test = require("node:test");
const assert = require("node:assert");
const { getInvestmentStrategy } = require("../_data/propstack.js");

const feld = (label, value) => ({ label, value });
const leer = { investment_oder_eigennutz: { value: null, pretty_value: null } };

test("vermietete Wohnung mit Titel als {label, value} ist Kapitalanlage", () => {
  const einheit = {
    title: feld("Überschrift", "Provisionsfrei und mit Mietgarantie - Vermietete 2 Zimmer Wohnung"),
    rented: feld("Vermietet", true),
    custom_fields: leer
  };
  assert.strictEqual(getInvestmentStrategy(einheit, "Kauf", null).key, "kapitalanlage");
});

test("„Vermietet: Ja“ allein reicht für Kapitalanlage", () => {
  const einheit = { title: feld("Überschrift", "2 Zimmer mit Balkon"), rented: feld("Vermietet", true), custom_fields: leer };
  assert.strictEqual(getInvestmentStrategy(einheit, "Kauf", null).key, "kapitalanlage");
});

test("„Vermietet: Nein“ ist kein Signal, ohne Hinweis bleibt es Eigennutz", () => {
  const einheit = { title: feld("Überschrift", "Helle Wohnung mit Balkon"), rented: feld("Vermietet", false), custom_fields: leer };
  assert.strictEqual(getInvestmentStrategy(einheit, "Kauf", null).key, "eigennutz");
});

test("Beschreibung als {label, value} wird gelesen", () => {
  const einheit = { title: feld("Überschrift", "Wohnung in Reick"), description_note: feld("Beschreibung", "Kapitalanlage im Wachstumsstandort"), custom_fields: leer };
  assert.strictEqual(getInvestmentStrategy(einheit, "Kauf", null).key, "kapitalanlage");
});

test("das Propstack-Feld „Investment oder Eigennutz“ hat Vorrang", () => {
  const einheit = {
    title: feld("Überschrift", "Vermietete Wohnung"), rented: feld("Vermietet", true),
    custom_fields: { investment_oder_eigennutz: { value: "Eigennutz", pretty_value: "Eigennutz" } }
  };
  assert.strictEqual(getInvestmentStrategy(einheit, "Kauf", null).key, "eigennutz");
});
