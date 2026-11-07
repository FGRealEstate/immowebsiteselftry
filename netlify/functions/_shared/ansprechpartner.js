/*
 * Update 48 §3 (07.11.2026): „Ansprechpartner laut Gebiet: Timon Fischer“ oder „… Lennart Geserich“ als erste Zeile der Notiz
 * an Kontakt und Aufgabe (Lead- und Gesuchsformulare; Objektanfragen bleiben, wie sie sind).
 * Es wird nie ein Propstack-Benutzer gesetzt oder angelegt (Timon, 07.11.2026: kein Benutzer, für niemanden).
 *
 * Dieselbe Regel wie die Kontaktkarte der Gebietsseiten (content/gebiete/*.json „kontakt“) und der Objektseiten (_data/propstack.js):
 *   1. Formular auf einer Gebietsseite (source_url /standorte/<slug>/): deren Karte. Die Berlin-Übersicht nennt zwei Personen, zählt also nicht.
 *   2. PLZ: Berlin über die amtliche PLZ-Liste (_data/berlin-plz-bezirk.json) zum Bezirk. Haben alle Bezirke der PLZ dieselbe Person,
 *      gilt sie. Leipzig 04103–04357 und Dresden 01067–01328: Timon.
 *   3. Ortsnamen aus Ort, Standort/Objektadresse oder Suchgebiet, in der Reihenfolge, in der sie dort stehen: Berliner Ortsteil oder
 *      Bezirk, Ort mit eigener Gebietsseite, Ort eines Landkreises, Landkreis, Leipzig, Dresden und ihre Marktgebiete.
 *   4. Berliner PLZ in Bezirken beider Personen und kein Ortsname: Lennart (wie auf den Objektseiten, Update 18 Punkt 5).
 * Ohne Treffer gibt es keine Zeile. Geraten wird nicht.
 */
const GEBIETE = require("./gebiet-kontakte.json").gebiete;
const { BERLIN_ORTSTEILE, BERLIN_BEZIRKE_OHNE_SEITE } = require("./berlin-bezirke.js");
const BERLIN_PLZ = require("../../../_data/berlin-plz-bezirk.json").plz;

const NAMEN = { timon: "Timon Fischer", lennart: "Lennart Geserich" };

// wie normalizeText/placeKey in _data/propstack.js
function schluessel(text) {
  return String(text || "")
    .replace(/\s+bei\s+berlin/i, "")
    .replace(/\(.*?\)/g, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

let index = null;
function baueIndex() {
  const orte = new Map(); // Ortsname → kontakt (erster Eintrag gewinnt, wie setOnce in _data/propstack.js)
  const setze = (name, kontakt) => {
    const k = schluessel(name);
    if (k && kontakt && !orte.has(k)) orte.set(k, kontakt);
  };
  const seiten = new Map(GEBIETE.map((g) => [g.slug, g]));
  // Berliner Bezirke mit eigener Seite: alle Ortsteile
  for (const [slug, namen] of Object.entries(BERLIN_ORTSTEILE)) {
    const seite = seiten.get(slug);
    if (seite) for (const n of [seite.name, ...namen]) setze(n, seite.kontakt);
  }
  // Berliner Bezirke ohne eigene Seite
  for (const [bezirk, b] of Object.entries(BERLIN_BEZIRKE_OHNE_SEITE)) for (const n of [bezirk, ...b.ortsteile]) setze(n, b.kontakt);
  // Gebietsseiten: Name und Orte (Orte mit „/“ einzeln)
  for (const g of GEBIETE) {
    if (!g.kontakt) continue;
    for (const n of [g.name, ...g.orte.flatMap((o) => String(o).split("/"))]) setze(n, g.kontakt);
    for (const teil of String(g.name).split(/\s*&\s*/)) setze(teil, g.kontakt);
  }
  const urls = new Map(GEBIETE.map((g) => [`/standorte/${g.slug}/`, g.kontakt]));
  index = { orte, urls };
  return index;
}

function bezirkKontakt(bezirk) {
  if (BERLIN_BEZIRKE_OHNE_SEITE[bezirk]) return BERLIN_BEZIRKE_OHNE_SEITE[bezirk].kontakt;
  return (index || baueIndex()).orte.get(schluessel(bezirk)) || null;
}

function ausUrl(url) {
  let pfad = "";
  try { pfad = new URL(String(url || ""), "https://fg-realestate.de").pathname; } catch { return null; }
  const m = pfad.match(/^\/standorte\/(.+?)\/?$/);
  return m ? (index || baueIndex()).urls.get(`/standorte/${m[1]}/`) || null : null;
}

function ausPlz(texte) {
  const plz = (texte.join(" ").match(/\b\d{5}\b/g) || []);
  for (const p of plz) {
    const n = Number(p);
    if ((n >= 4103 && n <= 4357) || (n >= 1067 && n <= 1328)) return { kontakt: "timon" };
    if (BERLIN_PLZ[p]) {
      const kontakte = [...new Set(Object.keys(BERLIN_PLZ[p]).map(bezirkKontakt))];
      return kontakte.length === 1 && kontakte[0] ? { kontakt: kontakte[0] } : { berlinUnklar: true };
    }
  }
  return null;
}

// Wörter und Wortgruppen (bis drei Wörter) in Textreihenfolge; je Stelle zuerst die längste Gruppe
function ausNamen(texte) {
  const { orte } = index || baueIndex();
  for (const text of texte) {
    const woerter = String(text || "").replace(/\b\d{5}\b/g, " ").split(/[\s,;/&+()]+|\s-\s/).filter(Boolean);
    for (let i = 0; i < woerter.length; i++) {
      for (let n = Math.min(3, woerter.length - i); n >= 1; n--) {
        const gruppe = woerter.slice(i, i + n).join(" ");
        const k = schluessel(gruppe);
        if (orte.has(k)) return orte.get(k);
        // „Berlin-Steglitz“, „Leipzig-Gohlis“: Teil nach dem Stadtnamen
        const stadt = gruppe.match(/^(Berlin|Leipzig|Dresden)-(.+)$/i);
        if (stadt && orte.has(schluessel(stadt[2]))) return orte.get(schluessel(stadt[2]));
        // sonst die Stadt selbst (Leipzig und Dresden haben je eine Karte; Berlin nennt zwei Personen und zählt nicht)
        if (stadt && orte.has(schluessel(stadt[1]))) return orte.get(schluessel(stadt[1]));
      }
    }
  }
  return null;
}

/**
 * @param {{ sourceUrl?: string, zip?: string, city?: string, orte?: string[] }} eingabe
 * @returns {string|null} „timon“, „lennart“ oder null
 */
function kontaktFuer(eingabe) {
  const texte = [eingabe.zip, eingabe.city, ...(eingabe.orte || [])].map((t) => String(t || "").trim()).filter(Boolean);
  const url = ausUrl(eingabe.sourceUrl);
  if (url) return url;
  const plz = ausPlz(texte);
  if (plz && plz.kontakt) return plz.kontakt;
  const name = ausNamen(texte);
  if (name) return name;
  return plz && plz.berlinUnklar ? "lennart" : null;
}

/** Erste Zeile der Notiz, oder "" ohne Treffer. */
function zeile(eingabe) {
  const k = kontaktFuer(eingabe);
  return k && NAMEN[k] ? `Ansprechpartner laut Gebiet: ${NAMEN[k]}` : "";
}

/** Setzt die Zeile vor die Notiz (mit Leerzeile), sonst bleibt die Notiz unverändert. */
function vorNotiz(note, eingabe) {
  const z = zeile(eingabe);
  return z ? `${z}\n\n${note}` : note;
}

module.exports = { kontaktFuer, zeile, vorNotiz, NAMEN };
