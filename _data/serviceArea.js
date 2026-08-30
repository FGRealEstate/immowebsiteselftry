// O-112 — one service area, one source.
//
// Before this file the site stated three different answers to "where does
// Fischer & Geserich work": the C6 answer in the delivered copy (Berlin plus
// nine Speckgürtel towns, Dresden and Leipzig above one million euro), the
// sixteen Standorte pages, and `areaServed` in the homepage graph, which
// mirrored the sixteen. An assistant asked "does F&G work in Neuruppin" could
// not resolve which record was authoritative.
//
// The resolution is a union, not a choice: a place F&G works in does not stop
// being served because it has no analysis page, and a place with an analysis
// page is served whether or not it was named on a call. `hasPage` records the
// difference between the two, so that the Standorte page can say which of the
// two it is rather than leaving the reader to notice a gap.
//
// The four `hasPage: false` entries are named in the delivered copy and carry
// no market data here, because none was delivered for them. They are not
// given a fabricated price range in order to look like the other sixteen.
//
// Every consumer — `areaServed` in _includes/base.njk, the /standorte/ page,
// the entity FAQ answer — reads this file. Adding a location happens once.

const analysed = [
  { name: "Berlin",              slug: "berlin",              region: "Metropole" },
  { name: "Potsdam",             slug: "potsdam",             region: "Speckgürtel" },
  { name: "Teltow",              slug: "teltow",              region: "Berliner Speckgürtel · Südwest" },
  { name: "Falkensee",           slug: "falkensee",           region: "Berliner Speckgürtel · West" },
  { name: "Bernau",              slug: "bernau",              region: "Berliner Speckgürtel · Nordost" },
  { name: "Oranienburg",         slug: "oranienburg",         region: "Berliner Speckgürtel · Nord" },
  { name: "Velten",              slug: "velten",              region: "Berliner Speckgürtel · Nordwest" },
  { name: "Erkner",              slug: "erkner",              region: "Berliner Speckgürtel · Ost" },
  { name: "Strausberg",          slug: "strausberg",          region: "Berliner Speckgürtel · Ost" },
  { name: "Fürstenwalde",        slug: "furstenwalde",        region: "Berliner Speckgürtel · Ost" },
  { name: "Königs Wusterhausen", slug: "konigs-wusterhausen", region: "Berliner Speckgürtel · Südost" },
  { name: "Luckenwalde",         slug: "luckenwalde",         region: "Berliner Speckgürtel · Südwest" },
  { name: "Eberswalde",          slug: "eberswalde",          region: "Berliner Speckgürtel · Nordost" },
  { name: "Joachimsthal",        slug: "joachimsthal",        region: "Berliner Speckgürtel · Nordost" },
  { name: "Dresden",             slug: "dresden",             region: "Sachsen" },
  { name: "Leipzig",             slug: "leipzig",             region: "Sachsen" },
].map((p) => ({ ...p, hasPage: true }));

// Named in the delivered copy (Antwort C6, /verkaufen.html) as part of the
// Maklergebiet, without a Standortanalyse of their own.
const additional = [
  { name: "Stahnsdorf",  region: "Brandenburg" },
  { name: "Birkenwerder", region: "Brandenburg" },
  { name: "Fehrbellin",  region: "Brandenburg" },
  { name: "Neuruppin",   region: "Brandenburg" },
].map((p) => ({ ...p, slug: null, hasPage: false }));

module.exports = {
  analysed,
  additional,
  all: [...analysed, ...additional],
  // Finanzierungsvermittlung ist nicht an das Maklergebiet gebunden.
  financingArea: "Deutschland",
  note:
    "Sechzehn dieser Standorte sind mit einer eigenen Standortanalyse hinterlegt. " +
    "Stahnsdorf, Birkenwerder, Fehrbellin und Neuruppin gehören zum Maklergebiet, " +
    "haben aber keine eigene Analyseseite. Ab einem Volumen von einer Million Euro " +
    "ist Fischer & Geserich auch überregional tätig; Immobilienfinanzierungen " +
    "werden unabhängig vom Standort der Immobilie deutschlandweit vermittelt.",
};
