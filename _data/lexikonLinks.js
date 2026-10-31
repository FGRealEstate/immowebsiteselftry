// Lexikon (Brief Design-Pass §4.7): verwandte Begriffe und passende Leistung je Eintrag.
// Die Einträge selbst (content/lexikon/*.json) haben kein Feld „related“; die Verweise entstehen hier nach festen Regeln,
// damit sie bei neuen oder geänderten Texten mitwandern:
//  1. Begriffe, die im Text des Eintrags vorkommen (Definition, Einordnung, Beispiel, Formel), zählen 2 Punkte;
//  2. Begriffe, deren Text diesen Eintrag nennt, 1 Punkt; gleiche Kategorie 0,5 Punkte dazu;
//  3. reichen 1 und 2 nicht für drei Verweise, füllen Einträge derselben Kategorie mit den meisten gemeinsamen Wörtern auf.
// Höchstens vier Verweise. Die Leistung kommt aus der Kategorie, einzelne Begriffe haben eine eigene Zuordnung (LEISTUNG_JE_BEGRIFF).
const lab = require("./labContent.js");
const nav = require("./nav.js");

const menuItems = nav.menu.flatMap((g) => g.items);
const leistung = (href) => {
  if (href === "/immobilienbewertung/") return { href, label: "Kostenlose Immobilienbewertung", note: "Marktwert meist am selben Tag" };
  const item = menuItems.find((i) => i.href === href);
  if (!item) throw new Error(`lexikonLinks: Leistung ${href} nicht im Menü`);
  return { href, label: item.label, note: item.note };
};

const LEISTUNG_JE_KATEGORIE = {
  Immobilienkauf: "/ankaufsberatung.html",
  Finanzierung: "/finanzierungsberatung.html",
  Kapitalanlage: "/kapitalanlage.html",
  Steuern: "/kapitalanlage.html",
  Vermietung: "/vermieten.html"
};
const LEISTUNG_JE_BEGRIFF = {
  // Wertermittlung
  bodenrichtwert: "/immobilienbewertung/", bodenwert: "/immobilienbewertung/", ertragswert: "/immobilienbewertung/",
  sachwert: "/immobilienbewertung/", verkehrswert: "/immobilienbewertung/", vervielfaltiger: "/immobilienbewertung/",
  restnutzungsdauer: "/immobilienbewertung/", liegenschaftszins: "/immobilienbewertung/", kapitalisierungszins: "/immobilienbewertung/",
  // Provision
  courtage: "/maklerprovision/", maklerprovision: "/maklerprovision/",
  // Kauf und Verkauf
  kaufnebenkosten: "/kaufen.html", grunderwerbsteuer: "/kaufen.html", zwangsversteigerung: "/kaufen.html",
  spekulationsfrist: "/verkaufen.html",
  teilungserklarung: "/mehrfamilienhaus.html", abgeschlossenheitsbescheinigung: "/mehrfamilienhaus.html", umwandlung: "/mehrfamilienhaus.html",
  // Finanzierung
  eigenkapital: "/finanzierungsberatung.html", restschuld: "/finanzierungsberatung.html", kreditwurdigkeitsprufung: "/finanzierungsberatung.html",
  "stress-test": "/finanzierungsberatung.html", vorfalligkeitsentschadigung: "/finanzierungsberatung.html", "debt-service": "/finanzierungsberatung.html",
  // Vermietung
  mietspiegel: "/vermieten.html", mietpreisbremse: "/vermieten.html", kappungsgrenze: "/vermieten.html",
  nebenkostenabrechnung: "/vermieten.html", zweckentfremdung: "/vermieten.html", mietbindung: "/vermieten.html",
  // Verwaltung nach dem Kauf
  hausgeld: "/betreuung-nach-dem-kauf/", weg: "/betreuung-nach-dem-kauf/", wirtschaftsplan: "/betreuung-nach-dem-kauf/",
  sonderumlage: "/betreuung-nach-dem-kauf/", erhaltungsrucklage: "/betreuung-nach-dem-kauf/", rucklage: "/betreuung-nach-dem-kauf/",
  verwaltungskosten: "/betreuung-nach-dem-kauf/"
};

// Ansprechpartner im Abschlussblock (Brief §4.0): Timon für Finanzierung (und Steuern wie im Blog), sonst Lennart
const KONTAKT_JE_KATEGORIE = { Finanzierung: "timon", Steuern: "timon" };

const ENDUNG = "(?:e|en|n|s|es|er|em)?";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function muster(term) {
  // Abkürzungen (zwei oder mehr Großbuchstaben, z. B. WEG, LTV, AfA) nur in genauer Schreibweise
  const abk = (term.match(/[A-ZÄÖÜ]/g) || []).length >= 2;
  const teile = term.split(/[\s-]+/).map((w) => esc(w) + (abk ? "" : ENDUNG));
  return new RegExp(`(?<![\\p{L}\\d])${teile.join("[\\s-]+")}(?![\\p{L}\\d])`, abk ? "u" : "iu");
}
const text = (e) => [e.definition, e.explanation, e.practiceExample, e.formula].filter(Boolean).join(" ");
const woerter = (e) => new Set(text(e).toLowerCase().match(/\p{L}{5,}/gu) || []);

module.exports = () => {
  const L = lab().lexicon;
  const re = Object.fromEntries(L.map((e) => [e.slug, muster(e.term)]));
  const w = Object.fromEntries(L.map((e) => [e.slug, woerter(e)]));
  const out = {};
  for (const e of L) {
    const t = text(e);
    const punkte = [];
    for (const f of L) {
      if (f.slug === e.slug) continue;
      let p = 0;
      if (re[f.slug].test(t)) p += 2;
      if (re[e.slug].test(text(f))) p += 1;
      if (p && f.category === e.category) p += 0.5;
      if (p) punkte.push({ f, p });
    }
    punkte.sort((a, b) => b.p - a.p || a.f.term.localeCompare(b.f.term, "de"));
    let rel = punkte.slice(0, 4).map((x) => x.f);
    if (rel.length < 3) {
      const gemeinsam = (f) => [...w[f.slug]].filter((x) => w[e.slug].has(x)).length;
      const fuell = L.filter((f) => f.slug !== e.slug && f.category === e.category && !rel.includes(f))
        .map((f) => ({ f, g: gemeinsam(f) }))
        .sort((a, b) => b.g - a.g || a.f.term.localeCompare(b.f.term, "de"));
      rel = rel.concat(fuell.slice(0, 3 - rel.length).map((x) => x.f));
    }
    const href = LEISTUNG_JE_BEGRIFF[e.slug] || LEISTUNG_JE_KATEGORIE[e.category];
    if (!href) throw new Error(`lexikonLinks: keine Leistung für ${e.slug} (${e.category})`);
    out[e.slug] = {
      related: rel.map((f) => ({ slug: f.slug, term: f.term, definition: f.definition })),
      leistung: leistung(href),
      kontakt: KONTAKT_JE_KATEGORIE[e.category] || "lennart"
    };
  }
  for (const slug of Object.keys(LEISTUNG_JE_BEGRIFF)) if (!out[slug]) throw new Error(`lexikonLinks: ${slug} gibt es im Lexikon nicht`);
  return out;
};
