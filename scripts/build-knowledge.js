#!/usr/bin/env node
/*
 * Erzeugt fg-knowledge.js (Wissen für den F&G Assistenten) aus dem aktuellen Inhalt:
 *   - content/lexikon/*.json   → Einträge mit Link auf /lexikon/<slug>/
 *   - content/wissen/*.json    → Antworten der alten Wissensartikel. /wissen/ ist seit 22.10.2026
 *                                 offline, darum zeigt jeder Eintrag auf eine Seite, die live ist:
 *                                 den Blogartikel (laut _redirects), den passenden Lexikonbegriff
 *                                 oder die Leistungsseite zum Thema.
 *   - _data/blog.json           → die Blogartikel, die live sind.
 * Aufruf: node scripts/build-knowledge.js   (prüft jeden Link gegen die Quelldateien und bricht sonst ab)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const list = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".json")).sort();

// Schlagwörter der bisherigen Datei weiterverwenden, damit der Assistent gleich gut trifft.
const previous = {};
const previousAnswer = {};
try {
  global.window = {};
  require(path.join(ROOT, "fg-knowledge.js"));
  for (const e of window.FG_SHARED_KNOWLEDGE || []) {
    previous[`${e.kind}:${e.id}`] = e.keywords;
    previousAnswer[`${e.kind}:${e.id}`] = e.answer;
  }
} catch (e) { /* erste Erzeugung */ }

function keywordsFor(kind, id, ...texts) {
  if (previous[`${kind}:${id}`]) return previous[`${kind}:${id}`];
  const words = texts.join(" ").toLowerCase().match(/[a-zäöüß0-9][a-zäöüß0-9%.\-/]{2,}/g) || [];
  return [...new Set(words)];
}

// Weiterleitungen /wissen/<slug> → Blogartikel
const redirects = {};
for (const line of fs.readFileSync(path.join(ROOT, "_redirects"), "utf8").split("\n")) {
  const m = line.match(/^\/wissen\/([a-z0-9-]+)\s+(\/blog\/[a-z0-9-]+\/)\s+301/);
  if (m) redirects[m[1]] = m[2];
}

// Alter Artikel → Lexikonbegriff, Blogartikel oder Seite, wenn es eine klar passende gibt.
const TARGET = {
  "5-afa-wann-ist-sie-moglich": "/lexikon/afa/",
  "afa-richtig-berechnen": "/lexikon/afa/",
  "annuitatendarlehen-erklart": "/lexikon/annuitat/",
  "anschlussfinanzierung-planen": "/lexikon/anschlussfinanzierung/",
  "bereitstellungszinsen": "/lexikon/bereitstellungszins/",
  "bodenrichtwert-richtig-lesen": "/lexikon/bodenrichtwert/",
  "brutto-vs-nettomietrendite": "/lexikon/nettomietrendite/",
  "bruttogeschossflache-vs-wohnflache": "/lexikon/wohnflache/",
  "capex-statt-schonrechnung": "/lexikon/capex/",
  "cashflow-verstehen": "/lexikon/cashflow/",
  "deal-screening-in-funf-minuten": "/investitionsrechner.html",
  "dscr-verstehen": "/lexikon/dscr/",
  "due-diligence-fur-einsteiger": "/lexikon/due-diligence/",
  "eigenkapital-optimal-einsetzen": "/lexikon/eigenkapital/",
  "ertragswertverfahren-kompakt": "/lexikon/ertragswert/",
  "exit-kosten-berucksichtigen": "/lexikon/exit/",
  "finanzierungsreserve-planen": "/lexikon/liquiditatsreserve/",
  "gebaudeanteil-berechnen": "/lexikon/gebaudeanteil/",
  "immobilie-ohne-eigenkapital": "/lexikon/vollfinanzierung/",
  "indexmiete-kalkulieren": "/lexikon/indexmiete/",
  "instandhaltungsrucklage-pro-quadratmeter": "/lexikon/erhaltungsrucklage/",
  "irr-bei-immobilien": "/lexikon/irr/",
  "kapitalwert-verstehen": "/lexikon/kapitalwert/",
  "kaufnebenkosten-vollstandig-erfassen": "/lexikon/kaufnebenkosten/",
  "kaufpreisfaktor-richtig-einordnen": "/lexikon/kaufpreisfaktor/",
  "leerstand-richtig-bewerten": "/lexikon/leerstand/",
  "ltv-verstehen": "/lexikon/ltv/",
  "mietausfall-kalkulieren": "/lexikon/mietausfall/",
  "mietmultiplikator-und-faktor": "/lexikon/kaufpreisfaktor/",
  "mietspiegel-richtig-nutzen": "/lexikon/mietspiegel/",
  "modernisierungsumlage": "/lexikon/modernisierung/",
  "nicht-umlagefahiges-hausgeld": "/lexikon/hausgeld/",
  "portfolio-risiko-messen": "/lexikon/portfolio/",
  "restnutzungsgutachten-erklart": "/lexikon/restnutzungsdauer/",
  "sachwertverfahren-kompakt": "/lexikon/sachwert/",
  "sensitivitatsanalyse-nutzen": "/lexikon/stress-test/",
  "sonderumlage-als-risiko": "/lexikon/sonderumlage/",
  "spekulationsfrist-im-uberblick": "/lexikon/spekulationsfrist/",
  "staffelmiete-kalkulieren": "/lexikon/staffelmiete/",
  "steuerlicher-gewinn-und-echter-cashflow": "/lexikon/steuerlicher-uberschuss/",
  "tilgung-oder-sondertilgung": "/lexikon/sondertilgung/",
  "umlagefahige-betriebskosten": "/lexikon/umlagefahige-kosten/",
  "vergleichswertverfahren-kompakt": "/lexikon/verkehrswert/",
  "wann-lohnt-sich-ein-mehrfamilienhaus": "/mehrfamilienhaus.html",
  "weg-rucklage-verstehen": "/lexikon/erhaltungsrucklage/",
  "wertsteigerung-als-szenario": "/lexikon/wertsteigerung/",
  "wie-berechnet-man-die-eigenkapitalrendite": "/lexikon/eigenkapitalrendite/",
  "wohnflachenberechnung-prufen": "/lexikon/wohnflache/",
  "woran-orientiert-sich-der-bauzins": "/blog/zinsbindung-strategisch-waehlen/",
  "zinsanderungsstress-testen": "/lexikon/stress-test/",
};
// Sonst die Leistungsseite zum Thema.
const BY_CATEGORY = {
  Finanzierung: "/finanzierungsberatung.html",
  Immobilienkauf: "/ankaufsberatung.html",
  Kapitalanlage: "/kapitalanlage.html",
  Marktanalysen: "/standorte/",
  Steuern: "/kapitalanlage.html",
  Vermietung: "/vermieten.html",
};

const lexSlugs = new Set(list("content/lexikon").map((f) => f.replace(/\.json$/, "")));
const blog = read("_data/blog.json");
const blogUrls = new Set(blog.map((p) => p.url));
const PAGES = new Set(["/finanzierungsberatung.html", "/ankaufsberatung.html", "/kapitalanlage.html", "/standorte/",
  "/vermieten.html", "/mehrfamilienhaus.html", "/investitionsrechner.html"]);
function assertLive(url, from) {
  const lex = url.match(/^\/lexikon\/([a-z0-9-]+)\/$/);
  const ok = lex ? lexSlugs.has(lex[1]) : url.startsWith("/blog/") ? blogUrls.has(url) : PAGES.has(url);
  if (!ok) throw new Error(`${from}: Ziel ${url} ist keine Live-Seite`);
  return url;
}

const out = [];
for (const f of list("content/wissen")) {
  const a = read(`content/wissen/${f}`);
  const url = redirects[a.slug] || TARGET[a.slug] || BY_CATEGORY[a.category];
  if (!url) throw new Error(`${a.slug}: kein Ziel (Kategorie ${a.category})`);
  out.push({
    kind: "article", id: a.slug, title: a.title, category: a.category, summary: a.summary,
    // Ohne assistantAnswer (drei Artikel) bleibt die bisherige, längere Antwort stehen.
    answer: a.assistantAnswer
      ? [a.assistantAnswer, a.decisionUse && `Entscheidungsrelevant: ${a.decisionUse}`].filter(Boolean).join(" ")
      : previousAnswer[`article:${a.slug}`] || a.summary,
    url: assertLive(url, a.slug),
    keywords: keywordsFor("article", a.slug, a.title, a.summary, a.body || ""),
  });
}
for (const f of list("content/lexikon")) {
  const l = read(`content/lexikon/${f}`);
  out.push({
    kind: "lexicon", id: l.slug, title: l.term, category: l.category, summary: l.definition,
    answer: l.assistantAnswer || [l.definition, l.explanation].filter(Boolean).join(" "),
    url: assertLive(`/lexikon/${l.slug}/`, l.slug),
    keywords: keywordsFor("lexicon", l.slug, l.term, l.definition, l.explanation || "", ...(l.keywords || [])),
  });
}
for (const p of blog) {
  out.push({
    kind: "blog", id: p.slug, title: p.titel, category: p.kategorie, summary: p.kurz, answer: p.kurz,
    url: assertLive(p.url, p.slug), keywords: keywordsFor("blog", p.slug, p.titel, p.kurz),
  });
}

const stale = out.filter((e) => e.url.startsWith("/wissen/"));
if (stale.length) throw new Error(`noch /wissen/-Links: ${stale.map((e) => e.id).join(", ")}`);
fs.writeFileSync(path.join(ROOT, "fg-knowledge.js"),
  "/* Automatisch erzeugt mit scripts/build-knowledge.js aus content/lexikon, content/wissen und _data/blog.json. Nicht von Hand ändern. */\n" +
  `window.FG_SHARED_KNOWLEDGE=${JSON.stringify(out)};\n`);
const count = out.reduce((c, e) => ((c[e.kind] = (c[e.kind] || 0) + 1), c), {});
console.log("fg-knowledge.js:", out.length, "Einträge", count);
