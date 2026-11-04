/**
 * Bewertung: Nachfrage per E-Mail (Update 19 §5, 30.10.2026; neu gebaut in Update 32 §2, 04.11.2026)
 *
 * Ablauf: Nach einer Bewertungsanfrage (propstack-lead, Anliegen mit „Bewertung“, Schritt 1) bekommt der Absender eine
 * Bestätigungsmail mit einem Link auf /immobilienbewertung/nachfrage/ (Schritt 2). Dort stehen nur die Fragen zur
 * Objektart aus Schritt 1. Die Antworten schickt das Formular an bewertung-nachfrage; die Funktion legt eine Notiz an
 * Kontakt und Objekt aus Schritt 1 und schreibt die Felder, die Propstack mit gültigen Werten kennt (propstackFelder).
 *
 * Update 32 §2: Fragen und Optionen sind die von Sprengnetter, in Sprengnetters Reihenfolge (Timons Bildschirmfotos,
 * Brief §2.4/§2.5); die Notiz ordnet die Antworten unter Sprengnetters Abschnitten, damit Timon Zeile für Zeile
 * übertragen kann. Der KATALOG unten ist die einzige Quelle: Seite (_data/nachfrage.js → bewertung-nachfrage.njk),
 * Prüfung, Notiz und Propstack-Felder lesen alle daraus.
 *
 * Link (v2): k = <Kontakt-ID>.<Objekt-ID>.<Signatur>, typ = efh|dhh|rh|zfh|etw|mfh|gewerbe|grundstueck, dazu die
 * Angaben aus Schritt 1, die Schritt 2 nicht noch einmal fragt und für die berechneten Zeilen braucht:
 * wf (Wohnfläche m²), gf (Grundstück m²), bj (Baujahr), mi (Nettokaltmiete im Monat €), fl (Gewerbe-/Nutzfläche m²),
 * n (Nutzung, Kürzel siehe NUTZUNG). Die Signatur (HMAC mit NACHFRAGE_SECRET) deckt Kontakt, Objekt, Typ und diese
 * Angaben; a=1 (Anruf gewählt) steuert nur den Hinweistext und ist nicht signiert. Keine Namen, keine E-Mail-Adresse.
 * Alte Links aus Update 19 (k = <Kontakt-ID>.<Signatur>, typ = wohnung|haus|mfh|grundstueck|gewerbe, gf=1) gelten weiter;
 * sie haben kein Objekt, die Notiz geht dann nur an den Kontakt.
 *
 * Fehlt NACHFRAGE_SECRET, dient der Propstack-Schlüssel mit eigenem Präfix als Geheimnis (geheimnis()).
 * Web Crypto statt node:crypto, damit die Testumgebung (Cloudflare, test-env/functions/api/test) dasselbe Modul nutzt.
 */

const PFAD = "/immobilienbewertung/nachfrage/";

// Objektart aus dem Bewertungsformular (Schritt 1) → Typ im Link
const TYPEN = {
  Einfamilienhaus: "efh",
  "Doppelhaushälfte": "dhh",
  Reihenhaus: "rh",
  Zweifamilienhaus: "zfh",
  Eigentumswohnung: "etw",
  Mehrfamilienhaus: "mfh",
  Gewerbe: "gewerbe",
  "Grundstück": "grundstueck",
};
const TYP_NAME = Object.fromEntries(Object.entries(TYPEN).map(([name, typ]) => [typ, name]));
// Links aus Update 19
const ALTE_TYPEN = { wohnung: "etw", haus: "efh", mfh: "mfh", grundstueck: "grundstueck", gewerbe: "gewerbe" };

const HAUS = ["efh", "dhh", "rh", "zfh"];
const OHNE_GRUNDSTUECK = [...HAUS, "etw", "mfh", "gewerbe"];
const ALLE = [...OHNE_GRUNDSTUECK, "grundstueck"];

// Nutzung aus Schritt 1 (Brief §2.2): Kürzel im Link → Wortlaut
const NUTZUNG = {
  s: "Selbst genutzt",
  v: "Vermietet",
  vv: "Vollständig vermietet",
  tv: "Teilweise vermietet",
  l: "Leer stehend",
};
const NUTZUNG_KUERZEL = Object.fromEntries(Object.entries(NUTZUNG).map(([k, v]) => [v, k]));

// Gruppen für den Besucher (Brief §2.4) und Abschnitte der Notiz (Sprengnetter, Brief §2.6.3)
const BEREICHE = [
  ["gebaeude", "Das Gebäude"],
  ["energie", "Energie"],
  ["ausstattung", "Ausstattung"],
  ["modernisierung", "Modernisierungen"],
  ["preis", "Preis und Hinweise"],
];
const ABSCHNITTE = [
  ["grundstueck", "Grundstücksangaben"],
  ["gebaeude", "Gebäude- und Wohnungsdaten"],
  ["energie", "Energieeffizienz"],
  ["standard", "Gebäudestandard"],
  ["modernisierung", "relevante Modernisierungen"],
  ["preis", "Preis und Hinweise"],
];

const JA_NEIN = ["ja", "nein"];
const JA_NEIN_WEISS = ["ja", "nein", "weiß ich nicht"];
const MIETE_HILFE = "Die Miete ohne Nebenkosten, als Gesamtbetrag pro Monat. Sie müssen nichts pro Quadratmeter umrechnen.";
const GESCHOSSLAGE = ["Souterrain", "Erdgeschoss", ...Array.from({ length: 10 }, (_, i) => `${i + 1}. Obergeschoss`), "Dachgeschoss"];
const DACHEINDECKUNG = ["Dachpappe", "Dachpfannen bzw. -ziegel", "Kunstschiefer", "Naturschiefer oder Metall", "sonstige", "weiß ich nicht"];
const MOD_UMFANG = ["keine", "teilweise", "komplett", "weiß ich nicht"];
const MOD_WANN = ["in den letzten 5 Jahren", "vor 5 bis 15 Jahren", "vor mehr als 15 Jahren"];
const MODERNISIERUNG = [
  ["boden", "Bodenbeläge, Wandverkleidungen und Treppenhaus"],
  ["baeder", "Bäder und WCs (Fliesen und Sanitärobjekte)"],
  ["heizung", "Heizung (Brenner ggf. Kessel)"],
  ["leitungen", "Strom, (Ab)Wasser, Heizungsleitungen und Heizkörper"],
  ["fenster", "Fenster (Rahmen und Isolierverglasung)"],
  ["daemmung", "Wärmedämmung"],
  ["dach", "Dach (Eindeckung und Wärmedämmung)"],
  ["grundriss", "Raumaufteilung (Grundriss, Zimmergrößen)"],
];

/**
 * Fragen. art: wahl (Optionsfelder), auswahl (Liste), haken (ein Kästchen), zahl (ganze Zahl), flaeche (m²), geld (€),
 * jahr (vierstellig), text (Freitext). typen: für welche Objektarten. bereich: Gruppe für den Besucher. abschnitt: Abschnitt
 * der Notiz. ohne: nicht fragen, wenn Schritt 1 diese Angabe schon hat. wenn: nur zeigen, wenn ein anderes Feld einen der
 * Werte hat. gruppe: Überschrift über zusammengehörenden Feldern. Optionen mit typen erscheinen nur bei diesen Objektarten.
 */
const KATALOG = [
  // ---- Das Gebäude ----
  { key: "gebaeudeart", frage: "Gebäudeart", art: "wahl", typen: ["efh", "rh", "zfh"], bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: [{ wert: "freistehend", typen: ["efh", "zfh"] }, { wert: "Doppelhaushälfte", typen: ["efh", "zfh"] }, "Reihenendhaus", "Reihenmittelhaus"] },
  { key: "bauweise", frage: "Bauweise", art: "wahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: ["massiv", "Fertighaus (massiv)", "Fertighaus (Holz)"] },
  { key: "geschosslage", frage: "In welchem Geschoss liegt die Wohnung?", label: "Geschosslage der Wohnung", art: "auswahl", typen: ["etw"], bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: GESCHOSSLAGE },
  { key: "wohnungen_im_haus", frage: "Wie viele Wohnungen hat das Haus?", label: "Anzahl der Wohnungen im Haus", art: "zahl", typen: ["etw"], bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "geschosse", frage: "Anzahl Geschosse ohne Dach- und Kellergeschoss", art: "wahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: ["1", "2", "3", "mehr als 3"] },
  { key: "geschosse_zahl", frage: "Anzahl Geschosse ohne Dach- und Kellergeschoss", art: "zahl", typen: ["mfh"], bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "dach", frage: "Dach", art: "wahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: ["voll ausgebaut", "teilweise ausgebaut", "nicht ausgebaut", "Flachdach bzw. flach geneigtes Dach"] },
  { key: "keller", frage: "Keller", art: "wahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: ["voll unterkellert", "teilweise unterkellert", "nicht unterkellert"] },
  { key: "kellerausbau", frage: "Ist der Keller zum Wohnen ausgebaut?", label: "Kellerausbau für Wohnnutzung", art: "wahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude",
    optionen: ["voll", "teilweise", "nicht ausgebaut"], wenn: { feld: "keller", werte: ["voll unterkellert", "teilweise unterkellert"] } },
  { key: "wohnflaeche", frage: "Wohnfläche", einheit: "m²", art: "flaeche", typen: HAUS, ohne: "wf", bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "baujahr", frage: "Baujahr", hilfe: "Ungefähr reicht.", art: "jahr", typen: [...HAUS, "etw", "gewerbe"], ohne: "bj", bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "einheiten", frage: "Anzahl Einheiten", art: "zahl", typen: ["gewerbe"], bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "miete_gesamt", frage: "Monatliche Nettokaltmiete gesamt", einheit: "€", hilfe: MIETE_HILFE, art: "geld", typen: ["gewerbe"], ohne: "mi", bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "aufzug", frage: "Aufzug", art: "wahl", typen: ["etw", "mfh"], bereich: "gebaeude", abschnitt: "gebaeude", optionen: JA_NEIN },
  // MFH: Wohnungen und Gewerbe
  { key: "we_anzahl", gruppe: "Wohnungen", frage: "Anzahl Wohneinheiten", art: "zahl", typen: ["mfh"], bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "wohnflaeche_gesamt", gruppe: "Wohnungen", frage: "Wohnfläche gesamt", einheit: "m²", art: "flaeche", typen: ["mfh"], ohne: "wf", bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "miete_wohnen", gruppe: "Wohnungen", frage: "Monatliche Nettokaltmiete Wohnen gesamt", einheit: "€", hilfe: MIETE_HILFE, art: "geld", typen: ["mfh"], ohne: "mi", bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "gewerbe_ja", frage: "Gibt es im Haus auch Gewerbeflächen (z. B. Laden, Büro, Praxis)?", label: "Gewerbeflächen im Haus", art: "wahl", typen: ["mfh"], bereich: "gebaeude", abschnitt: "gebaeude", optionen: JA_NEIN },
  { key: "ge_anzahl", gruppe: "Gewerbe", frage: "Anzahl Gewerbeeinheiten", art: "zahl", typen: ["mfh"], wenn: { feld: "gewerbe_ja", werte: ["ja"] }, bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "ge_flaeche", gruppe: "Gewerbe", frage: "Gewerbefläche gesamt", einheit: "m²", art: "flaeche", typen: ["mfh"], wenn: { feld: "gewerbe_ja", werte: ["ja"] }, bereich: "gebaeude", abschnitt: "gebaeude" },
  { key: "miete_gewerbe", gruppe: "Gewerbe", frage: "Monatliche Nettokaltmiete Gewerbe gesamt", einheit: "€", hilfe: MIETE_HILFE, art: "geld", typen: ["mfh"], wenn: { feld: "gewerbe_ja", werte: ["ja"] }, bereich: "gebaeude", abschnitt: "gebaeude" },
  // Stellplätze
  { key: "stp_tiefgarage", gruppe: "Stellplätze (Anzahl)", frage: "Tiefgarage", art: "zahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude", label: "Stellplätze Tiefgarage" },
  { key: "stp_garage", gruppe: "Stellplätze (Anzahl)", frage: "Garage", art: "zahl", typen: [...HAUS, "mfh"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Stellplätze Garage", frageMfh: "Garagenstellplätze" },
  { key: "stp_carport", gruppe: "Stellplätze (Anzahl)", frage: "Carport", art: "zahl", typen: HAUS, bereich: "gebaeude", abschnitt: "gebaeude", label: "Stellplätze Carport" },
  { key: "stp_aussen", gruppe: "Stellplätze (Anzahl)", frage: "Außenstellplatz", art: "zahl", typen: [...HAUS, "mfh"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Außenstellplätze", frageMfh: "Außenstellplätze" },
  { key: "miete_garage", gruppe: "Stellplätze (Anzahl)", frage: "Monatliche Miete je Garage", einheit: "€", art: "geld", typen: ["mfh"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Monatliche Miete je Garage" },
  { key: "miete_stellplatz", gruppe: "Stellplätze (Anzahl)", frage: "Monatliche Miete je Außenstellplatz", einheit: "€", art: "geld", typen: ["mfh"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Monatliche Miete je Außenstellplatz" },
  { key: "stp_anzahl", frage: "Stellplätze (Anzahl)", art: "zahl", typen: ["gewerbe"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Stellplätze" },
  // ETW: fest zur Wohnung gehörend
  { key: "se_garage", gruppe: "Fest zur Wohnung gehörend (Sondereigentum oder Sondernutzungsrecht)", frage: "Garagenstellplätze (Anzahl)", art: "zahl", typen: ["etw"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Zur Wohnung gehörend: Garagenstellplätze" },
  { key: "se_aussen", gruppe: "Fest zur Wohnung gehörend (Sondereigentum oder Sondernutzungsrecht)", frage: "Außenstellplätze (Anzahl)", art: "zahl", typen: ["etw"], bereich: "gebaeude", abschnitt: "gebaeude", label: "Zur Wohnung gehörend: Außenstellplätze" },
  { key: "se_garten", gruppe: "Fest zur Wohnung gehörend (Sondereigentum oder Sondernutzungsrecht)", frage: "Gartennutzung", art: "wahl", typen: ["etw"], optionen: JA_NEIN, bereich: "gebaeude", abschnitt: "gebaeude", label: "Zur Wohnung gehörend: Gartennutzung" },
  { key: "erbbaurecht", frage: "Erbbaurecht", art: "wahl", typen: OHNE_GRUNDSTUECK, optionen: JA_NEIN_WEISS, bereich: "gebaeude", abschnitt: "grundstueck" },
  { key: "denkmal", frage: "Denkmalschutz", art: "wahl", typen: OHNE_GRUNDSTUECK, optionen: JA_NEIN_WEISS, bereich: "gebaeude", abschnitt: "grundstueck" },

  // ---- Energie ----
  { key: "energieausweis", frage: "Energieausweis", art: "wahl", typen: OHNE_GRUNDSTUECK, bereich: "energie", abschnitt: "energie",
    optionen: ["Ja, Verbrauchsausweis", "Ja, Bedarfsausweis", "Kein Energieausweis vorhanden", "Weiß ich nicht"] },
  { key: "effizienzklasse", frage: "Energieeffizienzklasse", art: "wahl", typen: OHNE_GRUNDSTUECK, bereich: "energie", abschnitt: "energie",
    optionen: ["A+", "A", "B", "C", "D", "E", "F", "G", "H", "Weiß ich nicht"], wenn: { feld: "energieausweis", werte: ["Ja, Verbrauchsausweis", "Ja, Bedarfsausweis"] } },
  { key: "heizung", frage: "Heizung", art: "wahl", typen: OHNE_GRUNDSTUECK, bereich: "energie", abschnitt: "standard",
    optionen: ["Einzelöfen (keine Nachtspeicherheizung)", "Flächenheizung (Wand- oder Fußbodenheizung)", "Zentralheizung für Gebäude oder Wohnung", "Sonstige (z. B. Nachtspeicherheizung)", "Weiß ich nicht"] },
  { key: "heizung_wp", frage: "mit Wärmepumpe oder Blockheizkraftwerk", label: "Heizung mit Wärmepumpe oder Blockheizkraftwerk", art: "haken", typen: OHNE_GRUNDSTUECK, bereich: "energie", abschnitt: "standard" },
  { key: "fenster", frage: "Fenster", art: "wahl", typen: OHNE_GRUNDSTUECK, bereich: "energie", abschnitt: "standard",
    optionen: ["einfach verglast", "zweifach verglast", "dreifach verglast", "Kastenfenster", "große feststehende Fensterflächen", "Spezialverglasung", "sonstige", "Weiß ich nicht"] },
  { key: "aussenwaende", frage: "Außenwände überwiegend gedämmt", art: "wahl", typen: OHNE_GRUNDSTUECK, optionen: JA_NEIN_WEISS, bereich: "energie", abschnitt: "standard" },
  { key: "pv", frage: "Photovoltaikanlage", art: "wahl", typen: HAUS, optionen: JA_NEIN, bereich: "energie", abschnitt: "energie" },
  { key: "pv_baujahr", frage: "Baujahr der Photovoltaikanlage", art: "jahr", typen: HAUS, wenn: { feld: "pv", werte: ["ja"] }, bereich: "energie", abschnitt: "energie" },
  { key: "pv_ertrag", frage: "Jährlicher Stromertrag", einheit: "kWh", art: "zahl", typen: HAUS, wenn: { feld: "pv", werte: ["ja"] }, bereich: "energie", abschnitt: "energie", label: "Photovoltaik: jährlicher Stromertrag" },

  // ---- Ausstattung ----
  { key: "gaeste_wc", frage: "Separates Gäste-WC", art: "wahl", typen: OHNE_GRUNDSTUECK, optionen: JA_NEIN, bereich: "ausstattung", abschnitt: "standard" },
  { key: "mehr_bad", frage: "Mehr als ein Bad", art: "wahl", typen: HAUS, optionen: JA_NEIN, bereich: "ausstattung", abschnitt: "standard" },
  { key: "bad", frage: "Bad", art: "wahl", typen: ["etw"], optionen: ["innenliegend", "mit Fenster", "mehr als ein Bad"], bereich: "ausstattung", abschnitt: "standard" },
  { key: "wellness", frage: "Wellnesselemente (z. B. Sauna, Whirlpool)", art: "wahl", typen: HAUS, optionen: JA_NEIN, bereich: "ausstattung", abschnitt: "standard" },
  { key: "leitungen_putz", frage: "Leitungen überwiegend auf Putz", art: "wahl", typen: HAUS, optionen: JA_NEIN_WEISS, bereich: "ausstattung", abschnitt: "standard" },
  { key: "kamin_solar", frage: "Aufwendige Kaminanlage oder Solarthermie", art: "wahl", typen: HAUS, optionen: JA_NEIN, bereich: "ausstattung", abschnitt: "standard" },
  { key: "dacheindeckung", frage: "Dacheindeckung", art: "wahl", typen: [...HAUS, "mfh"], optionen: DACHEINDECKUNG, bereich: "ausstattung", abschnitt: "standard" },
  { key: "aussenbereich", frage: "Außenwohnbereiche", art: "wahl", typen: ["etw", "mfh"], bereich: "ausstattung", abschnitt: "gebaeude",
    optionen: ["kein nutzbarer Balkon oder Loggia", "Balkon, Loggia oder Terrasse unter 10 m²", "Balkon, Loggia oder Terrasse ab 10 m²", { wert: "Wintergarten", typen: ["etw"] }] },
  { key: "fussboden", frage: "Fußboden im Wohnzimmer", art: "wahl", typen: ["etw"], optionen: ["Kunststoff/PVC", "Fliesen", "Parkett oder Naturstein", "Teppich oder Laminat", "sonstiges"], bereich: "ausstattung", abschnitt: "standard" },
  { key: "abstellraum_etw", frage: "Abstellraum oder Keller", art: "wahl", typen: ["etw"], optionen: ["keiner", "in der Wohnung", "außerhalb der Wohnung (z. B. Kellerabteil)", "beides"], bereich: "ausstattung", abschnitt: "gebaeude" },
  { key: "abstellraum", frage: "Abstellraum", art: "wahl", typen: ["mfh"], optionen: JA_NEIN, bereich: "ausstattung", abschnitt: "gebaeude" },

  // ---- Modernisierungen (Brief §2.5): je Zeile Umfang, bei teilweise/komplett auch wann ----
  ...MODERNISIERUNG.flatMap(([k, titel]) => [
    { key: `mod_${k}`, karte: titel, frage: "Umfang", label: titel, art: "wahl", typen: OHNE_GRUNDSTUECK, optionen: MOD_UMFANG, bereich: "modernisierung", abschnitt: "modernisierung" },
    { key: `mod_${k}_wann`, karte: titel, frage: "Wann", label: `${titel}, wann`, art: "wahl", typen: OHNE_GRUNDSTUECK, optionen: MOD_WANN, bereich: "modernisierung", abschnitt: "modernisierung",
      wenn: { feld: `mod_${k}`, werte: ["teilweise", "komplett"] } },
  ]),
  { key: "mod_gesamt", frage: "Wie würden Sie den Modernisierungsstand insgesamt einschätzen?", label: "Modernisierungsstand insgesamt", art: "wahl", typen: OHNE_GRUNDSTUECK,
    optionen: ["unerheblich", "gering", "mittel", "überwiegend", "umfassend (Kernsanierung)"], bereich: "modernisierung", abschnitt: "modernisierung" },

  // ---- Preis und Hinweise ----
  { key: "kaufpreis", frage: "Kaufpreisvorstellung", einheit: "€", hilfe: "Ihre Preisvorstellung, falls Sie schon eine haben.", art: "geld", typen: ALLE, bereich: "preis", abschnitt: "preis" },
  { key: "hinweise", frage: "Was sollten wir sonst noch wissen?", label: "Hinweise des Eigentümers", art: "text", typen: ALLE, bereich: "preis", abschnitt: "preis" },
];
const FRAGE = Object.fromEntries(KATALOG.map((f) => [f.key, f]));

const clean = (value) => (value === null || value === undefined ? "" : String(value).trim());
const wert = (o) => (typeof o === "string" ? o : o.wert);
const optionFuer = (o, typ) => typeof o === "string" || !o.typen || o.typen.includes(typ);
const gross = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Zahl aus einer Eingabe wie „1.200“, „1.200,50“, „72,5“, „72.5“, „900 €“; NaN, wenn es keine ist. */
function zahl(value) {
  const t = clean(value).replace(/\s|€|m²|qm|kwh/gi, "");
  if (!t) return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d+(,\d+)?$/.test(t)) return Number(t.replace(",", "."));
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return NaN;
}
const deZahl = (n, stellen = 0) => n.toLocaleString("de-DE", { minimumFractionDigits: stellen, maximumFractionDigits: stellen });
const deGeld = (n) => `${deZahl(n, Number.isInteger(n) ? 0 : 2)} €`;
const deFlaeche = (n) => `${deZahl(n, Number.isInteger(n) ? 0 : 1)} m²`;

function typFuer(objectType) {
  return TYPEN[clean(objectType)] || "";
}

/** Typ aus dem Link: neue Kürzel direkt, alte (Update 19) übersetzt, sonst "". */
function typAusLink(typ) {
  const t = clean(typ);
  if (TYP_NAME[t]) return t;
  return ALTE_TYPEN[t] || "";
}

/** Seit Update 32 bekommt jede Objektart Fragen (Grundstück: Preisvorstellung und Hinweise). */
function ohneFragen() {
  return false;
}

/** Ist die Frage für diesen Typ und diese Angaben aus Schritt 1 sichtbar? (ohne die wenn-Bedingung) */
function gefragt(frage, typ, s1 = {}) {
  if (typ && !frage.typen.includes(typ)) return false;
  if (frage.ohne && clean(s1[frage.ohne])) return false;
  if (frage.key === "gebaeudeart" && typ === "dhh") return false;
  return true;
}

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret, text) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(text)));
  return base64url(mac.slice(0, 16));
}

// Update 19: Signatur nur über die Kontakt-ID
function signatur(secret, contactId) {
  return hmac(secret, `nachfrage-v1:${contactId}`);
}

const S1_SCHLUESSEL = ["wf", "gf", "bj", "mi", "fl", "n"];
function s1Text(s1) {
  return S1_SCHLUESSEL.filter((k) => clean(s1 && s1[k])).map((k) => `${k}=${clean(s1[k])}`).join("&");
}
function signaturV2(secret, { contactId, propertyId, typ, s1 }) {
  return hmac(secret, `nachfrage-v2|${contactId}|${propertyId || ""}|${typ}|${s1Text(s1)}`);
}

/** Geheimnis für die Signatur: NACHFRAGE_SECRET, sonst der Propstack-Schlüssel (eigener Präfix); "" ohne beides. */
function geheimnis(env) {
  const eigenes = clean(env && env.NACHFRAGE_SECRET);
  if (eigenes) return eigenes;
  const propstack = clean(env && env.PROPSTACK_API_KEY);
  return propstack ? `fg-nachfrage-v1|${propstack}` : "";
}

/**
 * Angaben aus Schritt 1 für den Link (property_details des Bewertungsformulars). Nur Zahlen und das Nutzungs-Kürzel,
 * normalisiert, damit die Signatur stabil ist.
 */
function schritt1Angaben(details) {
  const d = details || {};
  const nr = (key, ganz) => {
    const n = zahl(d[key]);
    if (!Number.isFinite(n) || n <= 0) return "";
    return String(ganz ? Math.round(n) : Math.round(n * 100) / 100);
  };
  const bj = clean(d["seller-year"]);
  return {
    wf: nr("seller-area-value"),
    gf: nr("seller-plot-area"),
    bj: /^\d{4}$/.test(bj) ? bj : "",
    mi: nr("seller-rent-monthly"),
    fl: nr("seller-commercial-area"),
    n: NUTZUNG_KUERZEL[clean(d["seller-usage"])] || "",
  };
}

/** Link für die Bestätigungsmail; "" ohne Geheimnis oder Kontakt-ID. */
async function link({ secret, base, contactId, propertyId, objectType, schritt1, anruf }) {
  const id = clean(contactId);
  const objekt = clean(propertyId);
  const typ = typFuer(objectType);
  if (!clean(secret) || !/^[\w-]{1,64}$/.test(id) || (objekt && !/^[\w-]{1,64}$/.test(objekt))) return "";
  const s1 = {};
  for (const k of S1_SCHLUESSEL) if (clean(schritt1 && schritt1[k])) s1[k] = clean(schritt1[k]);
  const sig = await signaturV2(secret, { contactId: id, propertyId: objekt, typ, s1 });
  const params = new URLSearchParams({ k: `${id}.${objekt}.${sig}` });
  if (typ) params.set("typ", typ);
  for (const [k, v] of Object.entries(s1)) params.set(k, v);
  if (anruf) params.set("a", "1");
  return `${clean(base).replace(/\/+$/, "")}${PFAD}?${params.toString()}`;
}

function gleich(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Prüft den Link (Felder k, typ und die Angaben aus Schritt 1, wie die Seite sie mitschickt).
 * Gibt { contactId, propertyId, typ, s1, version } zurück oder null.
 */
async function pruefen(secret, d) {
  const daten = typeof d === "string" ? { k: d } : d || {};
  const teile = clean(daten.k).split(".");
  if (!clean(secret)) return null;
  if (teile.length === 2) {
    const [id, sig] = teile;
    if (!/^[\w-]{1,64}$/.test(id) || !gleich(await signatur(secret, id), sig)) return null;
    return { contactId: id, propertyId: "", typ: typAusLink(daten.typ), s1: clean(daten.gf) === "1" ? { gf: "ja" } : {}, version: 1 };
  }
  if (teile.length !== 3) return null;
  const [id, objekt, sig] = teile;
  if (!/^[\w-]{1,64}$/.test(id) || (objekt && !/^[\w-]{1,64}$/.test(objekt))) return null;
  const typ = TYP_NAME[clean(daten.typ)] ? clean(daten.typ) : "";
  const s1 = {};
  for (const k of S1_SCHLUESSEL) if (clean(daten[k])) s1[k] = clean(daten[k]);
  if (!gleich(await signaturV2(secret, { contactId: id, propertyId: objekt, typ, s1 }), sig)) return null;
  return { contactId: id, propertyId: objekt, typ, s1, version: 2 };
}

function istBewertung(rawConcern) {
  return /bewertung/i.test(clean(rawConcern));
}

const SIGNATUR = [
  "Fischer & Geserich Real Estate GmbH",
  "Schützenstraße 30, 12165 Berlin",
  "Telefon +49 1520 3083048 · info@fg-realestate.de",
  "Geschäftsführer: Timon Fischer, Lennart Geserich",
  "Amtsgericht Charlottenburg, HRB 283559 B",
];

const esc = (value) =>
  clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Adresse für die Bestätigungsmail: „Straße Hausnummer, PLZ Ort“ aus den Formularfeldern (oder location), sonst "". */
function adresseText(d) {
  const x = d || {};
  const strasse = [clean(x.street || x.strasse), clean(x.house_number || x.houseNumber || x.hausnummer)].filter(Boolean).join(" ");
  const ort = [clean(x.zip_code || x.zipCode || x.plz), clean(x.city || x.ort)].filter(Boolean).join(" ");
  return [strasse, ort].filter(Boolean).join(", ") || clean(x.location);
}

/** true, wenn „Mit einem Anruf“ gewählt ist (contact_preference = „Telefon“, wie das Propstack-Feld Kontaktwunsch). */
function perAnruf(contactPreference) {
  const v = clean(contactPreference).toLowerCase();
  return v === "telefon" || v.includes("anruf");
}

/** Bestätigungsmail an den Absender der Bewertungsanfrage, Update 28 §3.2 (Text von Timon über Jesu, wörtlich):
 *  Version A „Per E-Mail“, Version B „Mit einem Anruf“ (anruf = true).
 *  Ohne Link fehlt in A der Absatz zu den Fragen, in B nur der letzte Satz mit dem Link.
 *  Update 32 §2.4 F: Grundstück hat jetzt eine kurze Nachfrage (Preisvorstellung, Hinweise). In Version A fällt dort nur
 *  der Einschub „, zum Beispiel zu Modernisierungen, zur Etage und zu Balkon oder Terrasse“ weg (nichts Neues dazu).
 *  Ohne Adresse heißt es „zu Ihrer Immobilie.“ statt „zu Ihrer Immobilie in …“. */
function bestaetigung({ firstName, lastName, link: url, adresse, anruf, objectType }) {
  const name = [clean(firstName), clean(lastName)].filter(Boolean).join(" ");
  const wo = clean(adresse) ? ` in ${clean(adresse)}` : "";
  const einstieg = anruf
    ? `vielen Dank für Ihre Anfrage zu Ihrer Immobilie${wo}. Innerhalb weniger Stunden haben wir einen indikativen Marktwert für Sie und rufen Sie dazu an.`
    : `vielen Dank für Ihre Anfrage zu Ihrer Immobilie${wo}. Innerhalb weniger Stunden schicken wir Ihnen einen indikativen Marktwert per E-Mail.`;
  // Absatz zu den Folgefragen: [Text vor dem Link, mit Link?]
  let fragen = null;
  if (anruf) {
    const basis = "Für einen festen Angebotspreis brauchen wir noch einige Angaben zu Ihrer Immobilie. Die können wir am Telefon, persönlich bei einem Termin oder per E-Mail klären, ganz wie es Ihnen lieber ist.";
    fragen = url ? `${basis} Wenn Sie möchten, beantworten Sie die Fragen schon vorab hier: ` : basis;
  } else if (url) {
    fragen = typFuer(objectType) === "grundstueck"
      ? "Für einen festen Angebotspreis brauchen wir noch einige Angaben zu Ihrer Immobilie. Die Fragen beantworten Sie in wenigen Minuten hier: "
      : "Für einen festen Angebotspreis brauchen wir noch einige Angaben zu Ihrer Immobilie, zum Beispiel zu Modernisierungen, zur Etage und zu Balkon oder Terrasse. Die Fragen beantworten Sie in wenigen Minuten hier: ";
  }
  const gruss = ["Mit freundlichen Grüßen", "Timon Fischer und Lennart Geserich", "Fischer & Geserich Real Estate GmbH"];
  const anrede = name ? `Guten Tag ${name},` : "Guten Tag,";
  const text = [anrede, einstieg, ...(fragen ? [url ? `${fragen}${url}` : fragen] : []), gruss.join("\n"), `--\n${SIGNATUR.join("\n")}`].join("\n\n");
  const p = 'style="margin:0 0 16px"';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#08082F">
<p ${p}>${esc(anrede)}</p>
<p ${p}>${esc(einstieg)}</p>${fragen ? `
<p ${p}>${esc(fragen)}${url ? `<a href="${esc(url)}">${esc(url)}</a>` : ""}</p>` : ""}
<p ${p}>${gruss.map(esc).join("<br>")}</p>
<p style="margin:24px 0 0;font-size:13px;color:#555">${SIGNATUR.map(esc).join("<br>")}</p>
</div>`;
  return { subject: "Ihre Wertermittlung bei Fischer & Geserich", text, html };
}

/** Antworten prüfen; gibt eine Fehlermeldung zurück oder "". Alles ist freiwillig, ein leeres Formular ist gültig. */
function pruefeAntworten(d) {
  for (const frage of KATALOG) {
    const v = clean(d[frage.key]);
    if (!v) continue;
    const name = frage.frage;
    if (frage.art === "wahl" || frage.art === "auswahl") {
      if (!frage.optionen.map(wert).includes(v)) return `Unbekannte Angabe bei „${name}“.`;
    } else if (frage.art === "haken") {
      if (v !== "ja") return `Unbekannte Angabe bei „${name}“.`;
    } else if (frage.art === "jahr") {
      if (!/^\d{4}$/.test(v)) return `Bitte geben Sie bei „${name}“ das Jahr vierstellig an.`;
    } else if (frage.art === "text") {
      if (v.length > 3000) return "Der Hinweis ist zu lang.";
    } else {
      const n = zahl(v);
      if (v.length > 20 || !Number.isFinite(n) || n < 0) return `Bitte geben Sie bei „${name}“ eine Zahl ein.`;
      if (frage.art === "zahl" && !Number.isInteger(n)) return `Bitte geben Sie bei „${name}“ eine ganze Zahl ein.`;
    }
  }
  return "";
}

/** Text einer Antwort für die Notiz (Zahlen mit Einheit). */
function antwortText(frage, v) {
  if (frage.art === "haken") return "ja";
  if (frage.art === "geld") return deGeld(zahl(v));
  if (frage.art === "flaeche") return deFlaeche(zahl(v));
  if (frage.art === "zahl" && frage.einheit) return `${deZahl(zahl(v))} ${frage.einheit}`;
  if (frage.art === "zahl") return deZahl(zahl(v));
  return v;
}

/**
 * Mieten und berechnete Werte (Brief §2.3). Monatliche Nettokaltmiete gesamt: aus Schritt 1 (mi) oder aus Schritt 2
 * (Gewerbe: miete_gesamt; MFH: Wohnen + Gewerbe). Gibt auch zurück, ob der Wert aus Schritt 2 stammt (dann schreibt
 * bewertung-nachfrage ihn nach Propstack; den aus Schritt 1 hat propstack-lead schon geschrieben).
 */
function mieten(d, typ, s1) {
  const mi = zahl(s1.mi);
  const n = (key) => (clean(d[key]) ? zahl(d[key]) : NaN);
  const wohnen = n("miete_wohnen");
  const gewerbe = clean(d.gewerbe_ja) === "ja" ? n("miete_gewerbe") : NaN;
  let gesamt = NaN;
  let ausSchritt2 = false;
  let wohnenBerechnet = NaN;
  if (Number.isFinite(mi)) {
    gesamt = mi;
    if (typ === "mfh" && Number.isFinite(gewerbe) && gewerbe <= mi) wohnenBerechnet = mi - gewerbe;
  } else if (typ === "gewerbe" && Number.isFinite(n("miete_gesamt"))) {
    gesamt = n("miete_gesamt");
    ausSchritt2 = true;
  } else if (typ === "mfh" && (Number.isFinite(wohnen) || Number.isFinite(gewerbe))) {
    gesamt = (Number.isFinite(wohnen) ? wohnen : 0) + (Number.isFinite(gewerbe) ? gewerbe : 0);
    ausSchritt2 = true;
  }
  const kaufpreis = n("kaufpreis");
  const rendite = Number.isFinite(gesamt) && Number.isFinite(kaufpreis) && kaufpreis > 0 ? Math.round(((gesamt * 12) / kaufpreis) * 10000) / 100 : NaN;
  return { gesamt, ausSchritt2, wohnen, gewerbe, wohnenBerechnet, kaufpreis, rendite };
}

function zeitText(datum) {
  const d = datum || new Date();
  const teile = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d);
  const t = Object.fromEntries(teile.map((p) => [p.type, p.value]));
  return `${t.day}.${t.month}.${t.year}, ${t.hour}:${t.minute} Uhr`;
}

/**
 * Notiz für Propstack und die Mail an das Postfach (Brief §2.6.3). Gibt { text, html, zeilen } zurück.
 * Erste Zeile „Angaben des Eigentümers aus dem Bewertungs-Formular, nicht geprüft“; bei einem Mehrfamilienhaus mit
 * Gewerbe steht davor „Wohn- und Geschäftshaus (mit Gewerbeanteil bewerten)“ (Brief §2.4 D). Je Antwort eine Zeile
 * „Label: Wert“ unter Sprengnetters Abschnitten; unbeantwortete Fragen fehlen, „weiß ich nicht“ bleibt stehen.
 * Angaben aus Schritt 1 (aus dem signierten Link) stehen mit „(aus der Anfrage)“, berechnete mit „(berechnet)“.
 */
function notiz({ antworten, typ, s1 = {}, contactId, propertyId, zeit }) {
  const d = antworten || {};
  const wgh = typ === "mfh" && clean(d.gewerbe_ja) === "ja";
  const kopf = [
    ...(wgh ? ["Wohn- und Geschäftshaus (mit Gewerbeanteil bewerten)"] : []),
    "Angaben des Eigentümers aus dem Bewertungs-Formular, nicht geprüft",
    `Eingang: ${zeitText(zeit)}`,
    `Objektart laut Anfrage: ${TYP_NAME[typ] || "nicht angegeben"}`,
    `Propstack: Kontakt ${contactId}${propertyId ? `, Objekt ${propertyId}` : ""}`,
  ];
  const abschnitte = Object.fromEntries(ABSCHNITTE.map(([k]) => [k, []]));
  const aus1 = (k) => clean(s1[k]) && clean(s1[k]) !== "ja";
  // Schritt 1
  if (aus1("gf")) abschnitte.grundstueck.push(`Grundstücksfläche (aus der Anfrage): ${deFlaeche(zahl(s1.gf))}`);
  else if (clean(s1.gf) === "ja") abschnitte.grundstueck.push("Grundstücksfläche: in der Anfrage angegeben");
  if (typ === "zfh") abschnitte.gebaeude.push("2 Wohneinheiten");
  if (aus1("wf")) abschnitte.gebaeude.push(`${typ === "mfh" ? "Wohnfläche gesamt" : "Wohnfläche"} (aus der Anfrage): ${deFlaeche(zahl(s1.wf))}`);
  if (aus1("fl")) abschnitte.gebaeude.push(`Gewerbe- bzw. Nutzfläche (aus der Anfrage): ${deFlaeche(zahl(s1.fl))}`);
  if (aus1("bj")) abschnitte.gebaeude.push(`Baujahr (aus der Anfrage): ${s1.bj}`);
  if (clean(s1.n) && NUTZUNG[s1.n]) abschnitte.gebaeude.push(`Nutzung (aus der Anfrage): ${NUTZUNG[s1.n]}`);

  // Schritt 2, in Katalog-Reihenfolge; Modernisierung je Zeile zusammengefasst
  for (const frage of KATALOG) {
    const v = clean(d[frage.key]);
    if (!v || frage.key.endsWith("_wann")) continue;
    if (frage.wenn && !frage.wenn.werte.includes(clean(d[frage.wenn.feld]))) continue;
    let text = antwortText(frage, v);
    if (frage.bereich === "modernisierung" && frage.key !== "mod_gesamt") {
      const wann = clean(d[`${frage.key}_wann`]);
      if (wann && ["teilweise", "komplett"].includes(v)) text = `${text}, ${wann}`;
    }
    abschnitte[frage.abschnitt].push(`${frage.label || frage.frage}: ${text}`);
  }

  // Mieten (Brief §2.3)
  const m = mieten(d, typ, s1);
  const g = abschnitte.gebaeude;
  if (Number.isFinite(zahl(s1.mi))) {
    g.push(`Monatliche Nettokaltmiete gesamt (aus der Anfrage${typ === "zfh" ? ", beide Wohneinheiten" : ""}): ${deGeld(zahl(s1.mi))}`);
  }
  if (Number.isFinite(m.wohnenBerechnet)) g.push(`Monatliche Nettokaltmiete Wohnen (berechnet, gesamt minus Gewerbe): ${deGeld(m.wohnenBerechnet)}`);
  if (Number.isFinite(m.gesamt)) {
    if (typ === "mfh" && m.ausSchritt2 && Number.isFinite(m.wohnen) && Number.isFinite(m.gewerbe)) {
      g.push(`Monatliche Nettokaltmiete gesamt (berechnet, Wohnen plus Gewerbe): ${deGeld(m.gesamt)}`);
    }
    g.push(`Jahresnettokaltmiete (berechnet): ${deGeld(Math.round(m.gesamt * 12 * 100) / 100)}`);
  }
  const proQm = (miete, flaeche, label) => {
    if (Number.isFinite(miete) && Number.isFinite(flaeche) && flaeche > 0) g.push(`${label} (berechnet): ${deZahl(Math.round((miete / flaeche) * 100) / 100, 2)} €/m²`);
  };
  const wf = Number.isFinite(zahl(s1.wf)) ? zahl(s1.wf) : clean(d.wohnflaeche) ? zahl(d.wohnflaeche) : clean(d.wohnflaeche_gesamt) ? zahl(d.wohnflaeche_gesamt) : NaN;
  if (typ === "mfh") {
    const wohnenMiete = Number.isFinite(m.wohnen) ? m.wohnen : Number.isFinite(m.wohnenBerechnet) ? m.wohnenBerechnet : clean(d.gewerbe_ja) !== "ja" ? m.gesamt : NaN;
    proQm(wohnenMiete, wf, "Nettokaltmiete Wohnen je m² Wohnfläche");
    if (clean(d.gewerbe_ja) === "ja") proQm(m.gewerbe, clean(d.ge_flaeche) ? zahl(d.ge_flaeche) : NaN, "Nettokaltmiete Gewerbe je m² Gewerbefläche");
  } else if (typ === "gewerbe") {
    proQm(m.gesamt, zahl(s1.fl), "Nettokaltmiete je m² Gewerbe- bzw. Nutzfläche");
  } else {
    proQm(m.gesamt, wf, "Nettokaltmiete je m² Wohnfläche");
  }
  if (Number.isFinite(m.rendite)) abschnitte.preis.push(`Bruttorendite (berechnet, Jahresnettokaltmiete ÷ Kaufpreisvorstellung): ${deZahl(m.rendite, 2)} %`);

  const zeilen = [...kopf];
  for (const [k, titel] of ABSCHNITTE) {
    if (!abschnitte[k].length) continue;
    zeilen.push("", titel, ...abschnitte[k]);
  }
  if (!KATALOG.some((f) => clean(d[f.key]))) zeilen.push("", "Im Formular wurden keine weiteren Angaben gemacht.");
  const text = zeilen.join("\n");
  const titel = new Set(ABSCHNITTE.map(([, t]) => t));
  const html = zeilen
    .map((z) => (titel.has(z) ? `<strong>${esc(z)}</strong>` : esc(z)))
    .join("<br>")
    .replace(/(<br>){2,}/g, "<br><br>");
  return { text, html, zeilen };
}

// Propstack-Werte (Codes aus der API-Spezifikation v2, Stand 04.11.2026): nur eindeutige Zuordnungen, sonst nur Notiz
const HEIZUNG_CODE = {
  "Einzelöfen (keine Nachtspeicherheizung)": "STOVE_HEATING",
  "Flächenheizung (Wand- oder Fußbodenheizung)": "FLOOR_HEATING",
  "Zentralheizung für Gebäude oder Wohnung": "CENTRAL_HEATING",
};
const KLASSE_CODE = { "A+": "A_PLUS", A: "A", B: "B", C: "C", D: "D", E: "E", F: "F", G: "G", H: "H" };
const jaNein = (v) => (v === "ja" ? true : v === "nein" ? false : undefined);

/**
 * Felder für PUT /units/:id aus den Antworten (Brief §2.6, Zuordnungstabelle im PLAN.md, Abschnitt „Update 32“).
 * Nur nicht leere Werte; was Propstack nicht eindeutig kennt, steht nur in der Notiz. Gibt { property, custom } zurück.
 */
const HAUSART_CODE = { freistehend: "SINGLE_FAMILY_HOUSE", "Doppelhaushälfte": "SEMIDETACHED_HOUSE", Reihenendhaus: "TERRACE_END_HOUSE", Reihenmittelhaus: "MID_TERRACE_HOUSE" };

function propstackFelder({ antworten, typ, s1 = {} }) {
  const d = antworten || {};
  const v = (key) => {
    const frage = FRAGE[key];
    if (!frage || !gefragt(frage, typ, s1)) return "";
    if (frage.wenn && !frage.wenn.werte.includes(clean(d[frage.wenn.feld]))) return "";
    return clean(d[key]);
  };
  const n = (key) => (v(key) ? zahl(v(key)) : NaN);
  const p = {};
  const c = {};
  const setze = (ziel, key, wert) => { if (wert !== undefined && wert !== "" && !(typeof wert === "number" && !Number.isFinite(wert))) ziel[key] = wert; };

  // Objektart: Mehrfamilienhaus mit Gewerbe = Wohn-/Geschäftshaus (Propstack-Objektart INVEST_LIVING_BUSINESS_HOUSE)
  if (typ === "mfh" && v("gewerbe_ja") === "ja") Object.assign(p, { object_type: "INVESTMENT", rs_type: "INVESTMENT", rs_category: "INVEST_LIVING_BUSINESS_HOUSE" });

  // Gebäudeart als Propstack-Hausart (gültige rs_category-Werte laut API); beim Zweifamilienhaus bleibt TWO_FAMILY_HOUSE
  const hausart = HAUSART_CODE[v("gebaeudeart")];
  if (["efh", "rh"].includes(typ) && hausart) p.rs_category = hausart;

  // Energie
  if (["Ja, Verbrauchsausweis", "Ja, Bedarfsausweis"].includes(v("energieausweis"))) {
    setze(p, "energy_efficiency_class", KLASSE_CODE[v("effizienzklasse")]);
    if (KLASSE_CODE[v("effizienzklasse")]) c.energieklasse = v("effizienzklasse");
  }
  setze(p, "heating_type", HEIZUNG_CODE[v("heizung")]);

  // Gebäude
  setze(p, "guest_toilet", jaNein(v("gaeste_wc")));
  setze(p, "monument", jaNein(v("denkmal")));
  setze(p, "lift", jaNein(v("aufzug")));
  setze(p, "wellness_area", jaNein(v("wellness")));
  if (/^[123]$/.test(v("geschosse"))) p.number_of_floors = Number(v("geschosse"));
  if (Number.isInteger(n("geschosse_zahl"))) p.number_of_floors = n("geschosse_zahl");
  if (v("keller")) p.cellar = v("keller") !== "nicht unterkellert";
  const abst = v("abstellraum_etw");
  if (abst === "keiner") Object.assign(p, { cellar: false, storeroom: false });
  if (abst === "in der Wohnung") p.storeroom = true;
  if (abst === "außerhalb der Wohnung (z. B. Kellerabteil)") p.cellar = true;
  if (abst === "beides") Object.assign(p, { cellar: true, storeroom: true });
  setze(p, "storeroom", jaNein(v("abstellraum")));
  setze(p, "garden", jaNein(v("se_garten")));
  const aussen = v("aussenbereich");
  if (aussen === "kein nutzbarer Balkon oder Loggia") { p.balcony = false; c.balkon_terasse = false; }
  if (aussen.startsWith("Balkon, Loggia oder Terrasse")) { p.balcony = true; c.balkon_terasse = true; }
  if (aussen === "Wintergarten") p.winter_garden = true;
  const lage = v("geschosslage");
  if (lage === "Erdgeschoss") p.floor = 0;
  const og = lage.match(/^(\d+)\. Obergeschoss$/);
  if (og) p.floor = Number(og[1]);

  // Flächen, Einheiten, Baujahr
  setze(p, "living_space", n("wohnflaeche"));
  setze(p, "living_space", n("wohnflaeche_gesamt"));
  if (Number.isFinite(n("wohnflaeche"))) c.wohnflache = n("wohnflaeche");
  if (Number.isFinite(n("wohnflaeche_gesamt"))) c.wohnflache = n("wohnflaeche_gesamt");
  if (typ === "zfh") p.number_of_apartments = 2;
  setze(p, "number_of_apartments", n("we_anzahl"));
  setze(p, "number_of_commercials", n("ge_anzahl"));
  setze(p, "industrial_area", n("ge_flaeche"));
  setze(p, "number_of_commercials", n("einheiten"));
  if (v("baujahr")) { p.construction_year = Number(v("baujahr")); c.baujahr = Number(v("baujahr")); }
  const stellplaetze = ["stp_tiefgarage", "stp_garage", "stp_carport", "stp_aussen", "se_garage", "se_aussen", "stp_anzahl"]
    .map(n).filter(Number.isFinite);
  if (stellplaetze.length) p.number_of_parking_spaces = stellplaetze.reduce((a, b) => a + b, 0);

  // Mieten und Rendite (Brief §2.3); Miete aus Schritt 1 hat propstack-lead schon geschrieben
  const m = mieten(d, typ, s1);
  if (m.ausSchritt2 && Number.isFinite(m.gesamt)) {
    p.base_rent = m.gesamt;
    p.rental_income_actual = Math.round(m.gesamt * 12 * 100) / 100;
  }
  setze(p, "yield_actual", m.rendite);

  // Modernisierung: Custom Field „letzte_modernisierung“ (Text) als Kurzfassung; Jahr (last_refurbishment) lässt sich
  // aus den Zeiträumen nicht ableiten
  const mods = MODERNISIERUNG.map(([k, titel]) => {
    const umfang = v(`mod_${k}`);
    if (!umfang || umfang === "keine" || umfang === "weiß ich nicht") return "";
    const wann = v(`mod_${k}_wann`);
    return `${titel}: ${umfang}${wann ? `, ${wann}` : ""}`;
  }).filter(Boolean);
  if (v("mod_gesamt")) mods.push(`insgesamt: ${v("mod_gesamt")}`);
  if (mods.length) c.letzte_modernisierung = mods.join("; ").slice(0, 250);

  return { property: p, custom: c };
}

/**
 * Daten für die Seite (_data/bewertungFragen.js → bewertung-nachfrage.njk): Bereiche mit Blöcken. Ein Block ist eine
 * einzelne Frage, eine Gruppe mit Überschrift (gruppe) oder eine Modernisierungs-Karte (karte). spalten: Breite des
 * Auswahlrasters (2 bei langen Optionen oder zwei Optionen, 3 bei drei, sonst 4).
 */
function seite() {
  const typenAttr = (typen) => (typen.length === ALLE.length ? "" : typen.join(" "));
  const fuerSeite = (f) => {
    const optionen = (f.optionen || []).map((o) => ({
      wert: wert(o),
      anzeige: gross(wert(o)),
      typenAttr: typeof o === "string" || !o.typen ? "" : o.typen.join(" "),
    }));
    const lang = optionen.some((o) => o.anzeige.length > 26);
    const n = optionen.length;
    return {
      ...f,
      optionen,
      spalten: lang || n === 2 ? 2 : n === 3 ? 3 : 4,
      typenAttr: typenAttr(f.typen),
      wennAttr: f.wenn ? `${f.wenn.feld}=${f.wenn.werte.join("|")}` : "",
    };
  };
  return {
    typen: TYP_NAME,
    hilfeMiete: MIETE_HILFE,
    bereiche: BEREICHE.map(([key, titel]) => {
      const bloecke = [];
      for (const f of KATALOG.filter((x) => x.bereich === key)) {
        const titelBlock = f.karte || f.gruppe || "";
        const letzter = bloecke[bloecke.length - 1];
        if (titelBlock && letzter && letzter.titel === titelBlock) letzter.fragen.push(fuerSeite(f));
        else bloecke.push({ titel: titelBlock, karte: Boolean(f.karte), id: `nf-b-${f.key}`, fragen: [fuerSeite(f)] });
      }
      const karten = bloecke.filter((b) => b.karte);
      return { key, titel, bloecke: bloecke.filter((b) => !b.karte), karten, rest: [] };
    }),
  };
}

module.exports = {
  PFAD, TYPEN, TYP_NAME, NUTZUNG, KATALOG, BEREICHE, ABSCHNITTE, MIETE_HILFE,
  typFuer, typAusLink, gefragt, ohneFragen, geheimnis, link, pruefen, schritt1Angaben, istBewertung, adresseText, perAnruf,
  bestaetigung, pruefeAntworten, notiz, propstackFelder, mieten, zahl, zeitText, seite, optionFuer,
};
