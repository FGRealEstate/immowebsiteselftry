/* Update 62 (17.11.2026): erster Partner Gutachten.org (Evalion GmbH, Berlin), ersetzt den Platzhalter „Grundriss und
   Wohnflächenberechnung“ aus Update 54. Grundlage: Provisionsvereinbarung mit Evalion und Evalions E-Mail an Timon.

   Regeln aus der Vereinbarung (Brief §1), an die sich jeder Text hier hält:
   - § 8 Abs. 2: nichts über Leistungen, Preise, Fristen oder Wirkungen von Gutachten.org, außer was Evalion liefert.
     Deshalb nur Produktnamen und „kostenlose Ersteinschätzung“; die Texte stehen wörtlich im Brief §2.
     Update 67 §1 (18.11.2026): Der Code für Kunden bleibt intern (F&G gibt ihn Kunden persönlich) und steht darum nicht mehr hier
     und nirgends auf der Website. Die Affiliate-Links zählen die Vermittlungen ohne Code.
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
  // Allgemeiner Affiliate-Link für den Knopf (Brief §2)
  link: "https://www.gutachten.org/r/fgr-fischer-geserich-real-estate-gmbh",
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
  // Peers Auftrag 25.11.2026 („include schmidt“): Logo links und Bild rechts wie bei den drei neuen Partnern.
  // Logo: Schriftzug von ms-immobilienservice.de (dort nur als PNG, weiß auf schwarz), mit potrace als SVG nachgezeichnet, Farbe F&G-Navy.
  logo: { src: "/images/partner/ms-immobilienservice.svg", breite: 160, hoehe: 24 },
  // Bild: Altbaufassade von der Startseite von ms-immobilienservice.de (dort nur 400 px breit)
  bild: { basis: "/images/partner/ms-immobilienservice-haus", breiten: [400], alt: "Altbaufassade in Berlin, Bild von der Website von MS-Immobilienservice Schmidt", fokus: "50% 50%" },
  link: "http://www.ms-immobilienservice.de/",
  produkt: "hausverwaltung" // Wert für `produkt` im GA4-Ereignis (Brief §2)
};

/* Peers Auftrag 25.11.2026: drei weitere Partner auf /partner/, je ein Abschnitt mit H3, einem Satz und einem Knopf
   (wie die Hausverwaltung). Texte nur aus den eigenen Seiten der Partner, nichts über Preise oder Wirkungen.
   - Peter Csaszar: Allianz-Vertretung, bis 23.11. im Team auf /ueber-uns (dort stand „Versicherung & Akquise“).
   - Immovisory GmbH, Berlin: laut immovisory.de Ankaufs- und Finanzierungsberatung für Kapitalanleger.
   - Geserich Immobilien GmbH, Berlin-Steglitz: laut geserich-immobilien.de Haus- und Grundstücksmakler seit 1988.
   Logos links wie bei Gutachten.org, Bild rechts. rel="sponsored noopener" wie bei allen Partnerlinks. */
const einfach = {
  versicherung: {
    id: "allianz-peter-csaszar", name: "Peter Csaszar (Allianz)", bereich: "Versicherung", produkt: "versicherung",
    // Allianz-Logo als SVG (Wikimedia Commons, File:Allianz.svg), links wie bei Gutachten.org
    logo: { src: "/images/partner/allianz.svg", breite: 160, hoehe: 40 },
    titel: "Unser Partner für Versicherungen",
    text: "Für die Absicherung rund um Ihre Immobilie arbeiten wir mit Peter Csaszar zusammen, Vertreter der Allianz.",
    knopf: "Zur Allianz-Vertretung",
    // Peers Auftrag 25.11.: Bild rechts im Kasten. Peters Porträt gehört F&G (bis 23.11. auf /ueber-uns).
    bild: { basis: "/images/team/peter-csaszar-frei", breiten: [480, 720], alt: "Porträt von Peter Csaszar", fokus: "50% 15%" },
    link: "https://vertretung.allianz.de/peter.csaszar/"
  },
  kapitalanlage: {
    id: "immovisory", name: "Immovisory GmbH", bereich: "Kapitalanlage", produkt: "kapitalanlage",
    // Logo als SVG von immovisory.de (wp-content/uploads/2018/04/IMV_Logo-1.svg)
    logo: { src: "/images/partner/immovisory.svg", breite: 160, hoehe: 41 },
    titel: "Unser Partner für Kapitalanleger",
    text: "Für Ankauf und Finanzierung von Kapitalanlagen arbeiten wir mit der Immovisory GmbH aus Berlin zusammen.",
    knopf: "Zu Immovisory",
    // Teamfoto von immovisory.de (wp-content/uploads/2026/10/Bild-1.jpeg), Messestand. Bildrecht bei Immovisory, Freigabe bestätigen lassen.
    bild: { basis: "/images/partner/immovisory-team", breiten: [480, 800], alt: "Das Team von Immovisory an seinem Messestand", fokus: "50% 30%" },
    link: "https://immovisory.de/"
  },
  vermittlung: {
    id: "geserich-immobilien", name: "Geserich Immobilien GmbH", bereich: "Immobilienvermittlung", produkt: "vermittlung",
    // Kein SVG auf geserich-immobilien.de, nur dieses PNG (130 × 156 px). Kommt ein SVG, hier tauschen.
    logo: { src: "/images/partner/geserich-immobilien.png", breite: 80, hoehe: 96 },
    titel: "Unser Partner für die Vermittlung",
    text: "Bei der Vermittlung von Immobilien in Berlin arbeiten wir mit der Geserich Immobilien GmbH zusammen, Haus- und Grundstücksmakler seit 1988.",
    knopf: "Zu Geserich Immobilien",
    // Hausfoto von geserich-immobilien.de (Dateiname „Schuetzenstr. 30 Aussen“). Bildrecht bei Geserich Immobilien, Freigabe bestätigen lassen.
    bild: { basis: "/images/partner/geserich-schuetzenstrasse", breiten: [480, 800], alt: "Wohnhaus in der Schützenstraße in Berlin-Steglitz, Sitz von Geserich Immobilien", fokus: "50% 40%" },
    link: "https://geserich-immobilien.de/"
  }
};

const partner = {
  aktiv: Boolean(require("./freigaben.js").partner),
  gutachten,
  hausverwaltung,
  einfach,
  // Lexikonbegriffe und Artikel mit der Partnerzeile (Brief §3): Slug → Produkt
  lexikon: { restnutzungsdauer: "restnutzungsdauer", verkehrswert: "verkehrswert" },
  artikel: { "restnutzungsdauergutachten-erklaert": "restnutzungsdauer" }
};

if (partner.aktiv && process.env.NETLIFY === "true" && process.env.CONTEXT === "production") {
  const offen = Object.entries(gutachten.produkte).filter(([, p]) => p.url.startsWith(PLATZHALTER)).map(([k]) => k);
  if (offen.length) throw new Error(`Partner Gutachten.org: Produktlink fehlt für ${offen.join(", ")}. Erst die Adressen aus Evalions E-Mail eintragen.`);
}

module.exports = partner;
