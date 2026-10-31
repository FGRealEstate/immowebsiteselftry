// Hauptmenü, Mobilmenü und Footer lesen aus dieser Datei (Brief Redesign §4.1).
// Einträge mit `fallback` zeigen auf Seiten, die noch gebaut werden; bis dahin
// wird der Fallback verlinkt, damit lokal und live kein Link ins Leere geht.
// Sobald die Seite existiert: `fallback` löschen.

// Gewerbeimmobilien (Update 5, Abschnitt 4): unter „Verkaufen“ und im Fuß, nicht auf der Startseite.
// Erst mit freigaben.gewerbe, sonst fehlen beide Einträge.
const freigaben = require("./freigaben.js");
const gewerbe = freigaben.gewerbe;

const phone = { display: "+49 1520 3083048", href: "tel:+4915203083048" };
const email = "info@fg-realestate.de";

const valuation = {
  label: "Kostenlose Bewertung",
  short: "Bewertung",
  href: "/immobilienbewertung/"
};

const menu = [
  {
    label: "Verkaufen",
    href: "/verkaufen.html",
    items: [
      { label: "Immobilie verkaufen", note: "Bewertung, Vermarktung, Abschluss", href: "/verkaufen.html" },
      { label: "Kostenlose Bewertung", note: "Meist noch am selben Tag", href: valuation.href },
      { label: "Mehrfamilienhaus", note: "Verkauf und Ankauf", href: "/mehrfamilienhaus.html" },
      ...(gewerbe ? [{ label: "Gewerbeimmobilien", note: "Hallen, Logistik, Gewerbeflächen", href: "/gewerbeimmobilien/" }] : []),
      { label: "Vermieten", note: "Mietpreis und Auswahl", href: "/vermieten.html" },
      { label: "Maklerprovision", note: "Alle Fälle erklärt", href: "/maklerprovision/" }
    ]
  },
  {
    label: "Kaufen & Investieren",
    href: "/kaufen.html",
    items: [
      { label: "Aktuelle Angebote", note: "Immobilien über F&G", href: "/angebote.html" },
      { label: "Immobilie kaufen", note: "Der passende Einstieg", href: "/kaufen.html" },
      { label: "Ankaufsberatung", note: "Objekt und Strategie prüfen", href: "/ankaufsberatung.html" },
      { label: "Kapitalanlage", note: "Vorher rechnen", href: "/kapitalanlage.html" },
      { label: "Betreuung nach dem Kauf", note: "Nach dem Notartermin", href: "/betreuung-nach-dem-kauf/" },
      { label: "Mieten", note: "Mietgesuch anlegen", href: "/mieten.html" },
      { label: "Suchprofil anlegen", note: "Passende Objekte zuerst", href: "/gesuch-anlegen/" }
    ]
  },
  {
    label: "Finanzierung",
    href: "/finanzierungsberatung.html",
    items: [
      { label: "Finanzierungsberatung", note: "Unabhängig, Banken vergleichen", href: "/finanzierungsberatung.html" },
      { label: "Investment Lab", note: "Rechner und Werkzeuge", href: "/investment-lab.html" },
      { label: "Investitionsrechner", note: "Rendite und Cashflow", href: "/investitionsrechner.html" }
    ]
  },
  {
    label: "Gebiete",
    href: "/standorte/",
    // Brief Gebietsseiten §7: jede Gebietsseite im Menü. Mit `areas` baut base.njk das Menü aus
    // _data/serviceArea.js (Bezirke, Landkreise, Städte, Marktgebiete); `items` sind die Köpfe der Spalten.
    areas: true,
    items: [
      { key: "berlin", label: "Berlin", note: "Stadt und Bezirke", href: "/standorte/berlin/" },
      { key: "brandenburg", label: "Brandenburg", note: "Berliner Umland", href: "/standorte/#region-brandenburg" },
      { key: "leipzig", label: "Leipzig", note: "Sachsen", href: "/standorte/leipzig/" },
      { key: "dresden", label: "Dresden", note: "Sachsen", href: "/standorte/dresden/" }
    ]
  },
  {
    label: "Wissen",
    href: "/blog/",
    items: [
      { label: "Blog", note: "Artikel mit Rechnung", href: "/blog/" },
      { label: "Lexikon", note: "Begriffe erklärt", href: "/lexikon/" },
      { label: "Investment Lab", note: "Rechner und Analysen", href: "/investment-lab.html" }
    ]
  },
  {
    label: "Über uns",
    href: "/ueber-uns.html",
    items: [
      { label: "Über uns", note: "Wer wir sind", href: "/ueber-uns.html" },
      { label: "Timon Fischer", note: "Finanzierung & Prozesse", href: "/team/timon-fischer/" },
      { label: "Lennart Geserich", note: "Sales & Vermietung", href: "/team/lennart-geserich/" },
      { label: "Bewertungen", note: "Was Kunden sagen", href: "/bewertungen/" },
      { label: "Kontakt", note: "Telefon, E-Mail, Termin", href: "/kontakt.html" }
    ]
  }
];

const services = [
  { label: "Immobilie verkaufen", href: "/verkaufen.html" },
  { label: "Kostenlose Bewertung", href: valuation.href },
  { label: "Immobilie kaufen", href: "/kaufen.html" },
  { label: "Ankaufsberatung", href: "/ankaufsberatung.html" },
  { label: "Kapitalanlage", href: "/kapitalanlage.html" },
  { label: "Mehrfamilienhaus", href: "/mehrfamilienhaus.html" },
  ...(gewerbe ? [{ label: "Gewerbeimmobilien", href: "/gewerbeimmobilien/" }] : []),
  { label: "Finanzierung", href: "/finanzierungsberatung.html" },
  { label: "Vermieten", href: "/vermieten.html" },
  { label: "Mieten", href: "/mieten.html" },
  { label: "Betreuung nach dem Kauf", href: "/betreuung-nach-dem-kauf/" },
  { label: "Maklerprovision", href: "/maklerprovision/" }
];

module.exports = { phone, email, valuation, menu, services };
