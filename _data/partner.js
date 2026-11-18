/* Update 62 (17.11.2026): erster Partner Gutachten.org (Evalion GmbH, Berlin), ersetzt den Platzhalter „Grundriss und
   Wohnflächenberechnung“ aus Update 54. Grundlage: Provisionsvereinbarung mit Evalion und Evalions E-Mail an Timon.

   Regeln aus der Vereinbarung (Brief §1), an die sich jeder Text hier hält:
   - § 8 Abs. 2: nichts über Leistungen, Preise, Fristen oder Wirkungen von Gutachten.org, außer was Evalion liefert.
     Deshalb nur Produktnamen, „kostenlose Ersteinschätzung“ und der Code FG10; die Texte stehen wörtlich im Brief §2.
   - § 8 Abs. 3: Evalion als Partner nennen ist erlaubt, das Logo hat Evalion per E-Mail freigegeben.
   - § 8 Abs. 5: Update 62 setzte darum unter jeden Block den Hinweis auf die Provision. Update 65 §3 (18.11.2026) nimmt alle
     sichtbaren Hinweise heraus; rel="sponsored noopener" bleibt an jedem Partnerlink.
   Kein Schema für den Partner, kein sameAs (Brief §4).

   Update 65 (18.11.2026): zweiter Partner MS-Immobilienservice Schmidt e.K. (Hausverwaltung), siehe `hausverwaltung` unten.

   Wo der Partner erscheint (Brief §3): _includes/fgs-partner.njk (Block), _includes/fgs-partner-zeile.njk (eine Zeile im
   Lexikon und im Artikel Nr. 14), partner.njk (/partner/). Alles nur mit dem Schalter `partner` in _data/freigaben.js;
   live aus bis Jesus OK, die Testumgebung zeigt es (deploy-test.sh setzt FG_FREIGABE_PARTNER=1).

   Klicks: fg-design.js schickt partner_click mit partner (data-partner) und produkt (data-produkt) an den dataLayer.

   Sicherung: Steht im Netlify-Produktionsbuild noch ein Platzhalter in einer Adresse, bricht der Build ab. */
const PLATZHALTER = "#platzhalter";

const gutachten = {
  id: "gutachten.org", // Wert für `partner` im GA4-Ereignis
  name: "Gutachten.org",
  bereich: "Gutachten", // Abschnitt auf /partner/
  // Evalions Logo, PNG mit transparentem Hintergrund aus Korbinians E-Mail vom 16.11.2026 (1322 × 144 px, fürs Web auf 480 px verkleinert).
  // Ohne Logo (logo: null) stünde der Name in Schrift.
  logo: { src: "/images/partner/gutachten-org.png", breite: 480, hoehe: 52 },
  // Allgemeiner Affiliate-Link für den Knopf (Brief §2), daneben der Code
  link: "https://www.gutachten.org/r/fgr-fischer-geserich-real-estate-gmbh",
  code: "FG10",
  // Produktlinks genau wie in Evalions E-Mail vom 16.11.2026, mit attr- und UTM-Parametern (aus den Link-Zielen der E-Mail, nicht
  // aus dem umbrochenen Text). Der Restnutzungsdauer-Link trägt laut E-Mail attr=visitenkarte… und utm_content=visitenkarte.
  produkte: {
    restnutzungsdauer: { text: "Restnutzungsdauer\u00ADgutachten: kostenlose Ersteinschätzung", // \u00AD: unsichtbare Trennstelle, am Handy „Restnutzungsdauer-“ / „gutachten“ (U63 §2)
      url: "https://www.gutachten.org/restnutzungsdauergutachten-ersteinschaetzung/?attr=visitenkarte--pfgr6qc142959&utm_source=fg-real-estate&utm_medium=referral&utm_campaign=partner-fg-real-estate&utm_content=visitenkarte" },
    kaufpreisaufteilung: { text: "Kaufpreisaufteilung: kostenlose Ersteinschätzung", url: "https://www.gutachten.org/anfrage/kaufpreisaufteilung/?attr=fg-real-estate--pfgr2xs04e440&utm_source=fg-real-estate&utm_medium=referral&utm_campaign=partner-fg-real-estate&utm_content=fg-real-estate" },
    verkehrswert: { text: "Verkehrswertgutachten", url: "https://www.gutachten.org/anfrage/verkehrswertgutachten/?attr=fg-real-estate--pfgrj822643da&utm_source=fg-real-estate&utm_medium=referral&utm_campaign=partner-fg-real-estate&utm_content=fg-real-estate" }
  },
  reihenfolge: ["restnutzungsdauer", "kaufpreisaufteilung", "verkehrswert"]
};

/* Update 65 (18.11.2026): Hausverwaltung für Mietshäuser und Eigentümergemeinschaften in Berlin und Brandenburg.
   Block nach Brief §2 in _includes/fgs-partner.njk (partnerArt = "hausverwaltung"): H3, ein Satz, ein Knopf, kein Code.
   Logo: Timons Datei trägt das Wasserzeichen „AILogoMaker“ und wird nicht verwendet (Brief §1). Kommt eine saubere Datei
   (PNG mit transparentem Hintergrund oder SVG), hier wie bei Gutachten.org eintragen: { src, breite, hoehe }.
   Link: Timons E-Mail lag beim Bau nicht vor. Die Adresse stammt aus der Websuche und ist die eigene Seite der Firma
   (Titel „MS-Immobilienservice - Schmidt e.K.“, Bötzowstr. 26, 10407 Berlin). Nur http: Das Zertifikat unter https gilt
   nicht für die Domain (*.kasserver.com). Gegen Timons E-Mail prüfen, sobald sie da ist. */
const hausverwaltung = {
  id: "ms-immobilienservice-schmidt", // Wert für `partner` im GA4-Ereignis (Brief §2)
  name: "MS-Immobilienservice Schmidt e.K.",
  bereich: "Hausverwaltung", // Abschnitt auf /partner/
  logo: null,
  link: "http://www.ms-immobilienservice.de/",
  produkt: "hausverwaltung" // Wert für `produkt` im GA4-Ereignis (Brief §2)
};

const partner = {
  aktiv: Boolean(require("./freigaben.js").partner),
  gutachten,
  hausverwaltung,
  // Lexikonbegriffe und Artikel mit der Partnerzeile (Brief §3): Slug → Produkt
  lexikon: { restnutzungsdauer: "restnutzungsdauer", verkehrswert: "verkehrswert" },
  artikel: { "restnutzungsdauergutachten-erklaert": "restnutzungsdauer" }
};

if (partner.aktiv && process.env.NETLIFY === "true" && process.env.CONTEXT === "production") {
  const offen = Object.entries(gutachten.produkte).filter(([, p]) => p.url.startsWith(PLATZHALTER)).map(([k]) => k);
  if (offen.length) throw new Error(`Partner Gutachten.org: Produktlink fehlt für ${offen.join(", ")}. Erst die Adressen aus Evalions E-Mail eintragen.`);
}

module.exports = partner;
