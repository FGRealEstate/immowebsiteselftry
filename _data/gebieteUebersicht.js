// Gebiete-Übersicht /standorte/ (Brief Gebietsseiten §2, Brief Design-Pass 4.9: je Region ein großes Foto
// im Stil der Omniyat-Seite „Destinations“, darunter echter Text). Text, Zahlen und Quellen stehen in
// content/uebersicht/standorte.json; die Links kommen aus den gebauten Gebietsseiten (_data/gebiete.js).
// regionen[].uebersicht und gruppen[].seiten nennen Slugs aus content/gebiete/; ein unbekannter Slug bricht
// den Build ab, damit die Übersicht nie auf eine fehlende Seite zeigt.
// regionen[].foto nennt die Gebietsseite, deren Kopffoto die Region zeigt (zweite Verwendung, kein eigener
// Download); solange die Bilddatei fehlt, zeigt die Vorlage eine navy Fläche mit dem Regionsnamen.
const fs = require("fs");
const path = require("path");
const loadGebiete = require("./gebiete.js");

const file = path.join(__dirname, "..", "content", "uebersicht", "standorte.json");

module.exports = () => {
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const bySlug = new Map(loadGebiete().map((page) => [page.slug, page]));
  const find = (slug) => {
    const page = bySlug.get(slug);
    if (!page) throw new Error(`[gebieteUebersicht] Gebietsseite "${slug}" gibt es nicht (content/gebiete/)`);
    return page;
  };
  // name = voller Name (ItemList), kurz = Name in der Liste unter „Landkreise“ (ohne das Wort Landkreis).
  // Für die Kacheln (Design-Sprint-Brief 5.3, CP3): foto = Kopffoto der Gebietsseite, zeile = die ersten drei Orte
  // der Seite (Landkreis, Bezirk, Marktgebiet) oder der Landkreis einer Stadt. Beides steht schon auf der Gebietsseite.
  const zeile = (page) => ["landkreis", "bezirk", "marktgebiet"].includes(page.typ)
    ? (page.orte || []).slice(0, 3).join(", ")
    : (page.kreis ? page.kreis.name : "");
  const link = (page) => ({ name: page.typ === "landkreis" ? page.nameLang : page.name, kurz: page.name, url: page.url, typ: page.typ || "stadt", foto: page.heroPhoto || null, zeile: zeile(page) });

  const max = (data.quellen || []).length;
  for (const match of JSON.stringify([data.kurzantwort, data.kurzantwortMehr, data.regionen, data.faq]).matchAll(/\[\[([\d,\s]+)\]\]/g)) {
    for (const n of match[1].split(",").map((v) => Number(v.trim()))) {
      if (!(n >= 1 && n <= max)) throw new Error(`[gebieteUebersicht] Fußnote [[${match[1]}]] zeigt auf keine Quelle (1–${max})`);
    }
  }

  const regionen = data.regionen.map((region) => {
    const fotoPage = region.foto ? find(region.foto) : null;
    // gruppe.zeilen: eigene Zeile unter dem Namen, wenn die Seite keinen Landkreis hat (Final Copy Pass §13: „Potsdam / Landeshauptstadt“).
    const gruppen = region.gruppen.map((gruppe) => ({ ...gruppe, seiten: gruppe.seiten.map((slug) => {
      const l = link(find(slug));
      return (gruppe.zeilen || {})[slug] ? { ...l, zeile: gruppe.zeilen[slug] } : l;
    }) }));
    return {
      ...region,
      uebersicht: region.uebersicht ? link(find(region.uebersicht)) : null,
      foto: fotoPage && fotoPage.heroPhoto ? { ...fotoPage.heroPhoto, caption: region.fotoCaption } : null,
      gruppen,
      anzahl: gruppen.reduce((sum, gruppe) => sum + gruppe.seiten.length, 0)
    };
  });

  // Für das ItemList-Markup: jede verlinkte Seite einmal, in der Reihenfolge der Übersicht.
  const alle = regionen.flatMap((region) => [region.uebersicht, ...region.gruppen.flatMap((gruppe) => gruppe.seiten)]).filter(Boolean);
  return { ...data, regionen, alle };
};
