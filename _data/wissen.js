// Update 44 §2.1 (07.11.2026): Block „Mehr dazu im Wissen“ auf Leistungs- und Gebietsseiten (_includes/fgs-wissen.njk).
// Zuordnung über die Kategorien der Artikel. Eine Leistungsseite zeigt die Artikel der Kategorien, deren Artikel am Ende auf
// sie verlinken (KATEGORIEN.leistungen in blogArtikel.js); so verlinkt jeder Artikel zurück auf die Leistungsseite, auf der er
// steht. Seiten, die in keiner Kategorie vorkommen, stehen unten mit Kategorie, wo eine passt. Gewerbe und Mieten: keine
// Kategorie passt, der Block entfällt. Gebietsseiten: Bewertung & Markt, Kauf & Kapitalanlage, Finanzierung.
// Die Artikel selbst kommen aus _data/blogArtikel.js (nur die, die heute erscheinen); der neueste zuerst, höchstens drei.
const { KATEGORIEN } = require("./blogArtikel.js");

const seiten = {};
for (const [kat, k] of Object.entries(KATEGORIEN)) {
  for (const href of k.leistungen) (seiten[href] = seiten[href] || []).push(kat);
}
// Seiten ohne Eintrag in KATEGORIEN.leistungen
const ZUSATZ = {
  "/mehrfamilienhaus.html": ["kauf-kapitalanlage", "finanzierung"],
  "/maklerprovision/": ["bewertung-markt"]
};
for (const [href, kats] of Object.entries(ZUSATZ)) seiten[href] = [...new Set([...(seiten[href] || []), ...kats])];

module.exports = {
  seiten,
  gebiet: ["bewertung-markt", "kauf-kapitalanlage", "finanzierung"],
  hoechstens: 3
};
