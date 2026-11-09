/**
 * Update 51 §7 (09.11.2026): Rückfall-Versuche bei Propstack sichtbar machen.
 *
 * Lehnt Propstack den ersten Versuch ab und klappt erst ein Rückfall-Versuch mit weniger Feldern (Befund 8), dann
 *   1. steht im Log eine Zeile „PROPSTACK RÜCKFALL BENUTZT: …“ mit Formular, Endpunkt, Versuch und Propstacks Meldung;
 *   2. zählt die Funktion das je Tag in Netlify Blobs, Store „propstack-rueckfall“, Schlüssel „JJJJ-MM-TT“:
 *      { "<Formular> | <Endpunkt> | <Versuch>": { anzahl, fehler, zuletzt } }.
 * Keine Personendaten: nur Formular, Endpunkt, Name des Versuchs und die Fehlermeldung aus logsafe (ohne Werte).
 * Die wöchentliche Prüfung liest den Store und listet jeden Eintrag. „eventual“ wie im CSP-Bericht: Bei gleichzeitigen
 * Anfragen kann ein Zähler zu niedrig sein; dass ein Rückfall vorkam, geht nicht verloren.
 * Ein Fehler beim Zählen bricht nie die Anfrage ab.
 */
const logsafe = require("./logsafe");

const STORE = "propstack-rueckfall";
const MAX_EINTRAEGE_JE_TAG = 200;

function speicher(event) {
  const { connectLambda, getStore } = require("@netlify/blobs");
  if (event && event.blobs) connectLambda(event);
  return getStore({ name: STORE, consistency: "eventual" });
}

/**
 * ergebnis: Rückgabe eines Anlege-Versuchs mit { ok, attempt, versuch, fehlversuche } (siehe propstack-lead.js).
 * Meldet nur, wenn es geklappt hat und nicht der erste Versuch war.
 */
async function melden(event, { formular, endpoint, ergebnis }) {
  if (!ergebnis || !ergebnis.ok || !(ergebnis.versuch > 1)) return false;
  const fehler = (ergebnis.fehlversuche || [])[0] || "";
  console.warn("PROPSTACK RÜCKFALL BENUTZT:", {
    formular,
    endpoint: logsafe.endpoint(endpoint),
    versuch: ergebnis.attempt,
    fehlversuche: (ergebnis.fehlversuche || []).length,
    ersterFehler: fehler,
  });
  try {
    const store = speicher(event);
    const tag = new Date().toISOString().slice(0, 10);
    const stand = (await store.get(tag, { type: "json" })) || {};
    const schluessel = `${formular} | ${logsafe.endpoint(endpoint)} | ${ergebnis.attempt}`;
    if (!(schluessel in stand) && Object.keys(stand).length >= MAX_EINTRAEGE_JE_TAG) return true;
    const alt = stand[schluessel] || { anzahl: 0 };
    stand[schluessel] = { anzahl: alt.anzahl + 1, fehler: String(fehler).slice(0, 500), zuletzt: new Date().toISOString() };
    await store.setJSON(tag, stand);
  } catch (error) {
    console.warn("PROPSTACK RÜCKFALL NICHT GEZÄHLT:", logsafe.msg(error));
  }
  return true;
}

module.exports = { melden, STORE };
