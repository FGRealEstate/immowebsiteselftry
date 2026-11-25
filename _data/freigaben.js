/* Teile, die erst nach dem Launch kommen (Update 5, Abschnitt 1, „After the launch“).
   false = Eleventy baut die Seiten nicht, sie fehlen in Sitemap, Menü und Fuß. Umschalten erst nach Freigabe.
   .eleventy.js liest diese Datei, die Vorlagen sehen sie als `freigaben`. */
module.exports = {
  // Referenzen: seit Update 50 §1 (09.11.2026) ohne Schalter. Ein Objekt mit Propstack-Status „Verkauft“ oder „Vermietet“
  // wird beim Build zur Referenz unter seiner Angebotsadresse; /referenzen/ und der Menülink kommen mit der ersten.
  // /gewerbeimmobilien/ (Update 5, Abschnitt 4). Update 35 C1 (05.11.2026): erst nur Testumgebung (FG_FREIGABE_GEWERBE=1).
  // Update 44 §1.1 (07.11.2026): Jesu gibt frei, die Seite ist live.
  gewerbe: true,
  // Update 54 §1 (vorbereitet mit Update 57 §11, 15.11.2026): Partnerblock „Grundriss und Wohnflächenberechnung“ (_data/partner.js).
  // Live aus, bis Timons Angaben und Jesus Satz da sind; die Testumgebung zeigt ihn (FG_FREIGABE_PARTNER=1). Dann hier true.
  partner: process.env.FG_FREIGABE_PARTNER === "1",
  // Update 61 §2/§3 (16.11.2026): neue Gebietsseite Eberswalde (content/gebiete/eberswalde.json, Feld freigabe: "eberswalde").
  // Nur Testumgebung (FG_FREIGABE_EBERSWALDE=1), bis Jesu sie freigibt; live zeigt /standorte/eberswalde/ bis dahin die alte Seite.
  // An: die Seite, Eberswalde als 27. Gebiet in Menü, Übersicht, Sitemap, llms.txt, areaServed und „In der Nähe“,
  // und das gekürzte Eberswalde-Kapitel der Barnim-Seite. Dann hier true und `node scripts/gebiet-kontakte.js` laufen lassen
  // (Formular-Auszug mit Eberswalde; scripts/gebiet-kontakte.test.js prüft das).
  eberswalde: process.env.FG_FREIGABE_EBERSWALDE === "1",
  // Update 68 §4: Finanzierungsrechner auf den Objektseiten, bis Timons Vorgaben in _data/finanzierung.json stehen nur Testumgebung
  finanzrechner: process.env.FG_FREIGABE_FINANZRECHNER === "1",
  // Review 25.11.2026 R10 (Peer: Bewertungskarten „a bit more color … just an idea“): Farbvorschlag für /bewertungen,
  // nur Testumgebung (FG_FREIGABE_BEWERTUNGSFARBE=1), bis Peer entscheidet. Live zeigt die Karten unverändert.
  bewertungFarbe: process.env.FG_FREIGABE_BEWERTUNGSFARBE === "1",
  // FG-Gap-Answers (28.10.2026): FAQ-Antworten mit Status TIMON stehen in den Seiten (Feld timon: "1.3" usw.),
  // werden aber erst gebaut, wenn ihre Nummer hier steht. Eintragen erst, wenn Jesu das OK schickt.
  // 29.10.2026 FG-Timon-Answers-Update §1: Timon hat geantwortet. 6.2 (Strukturvertrieb) ist nach FG-Update-11 §3 aus den Seiten gelöscht.
  timonFaq: ["1.3", "1.5", "3.1", "4.4", "5.2", "5.3", "5.4", "5.5", "6.1"],
  // Antworten mit Status SOURCE (selbst geschrieben aus amtlichen Quellen, Feld quelle: "3.2" usw.) gehen laut Brief §9
  // erst live, wenn Jesu sie mit ihren Quellen geprüft hat. Geprüfte Nummern hier eintragen.
  // Update 44 §2.3 (07.11.2026, Jesu über Peer): „Every answer marked ready for Mango (Grundsteuer included) … goes live“.
  // 7.3 (Grundsteuer Berlin) ist frei; Quellen am 07.11.2026 auf berlin.de/grundsteuer/ nachgeprüft (0,31 / 0,45 Promille, Hebesatz 470 %).
  // Update 48 §9 (08.11.2026): 3.2 und 7.2 (P47, P63, P102, P103, A11) ohne Jesus Quellenprüfung an, nach den Regeln aus FG-Gap-Answers
  // (7.2 nur Zahlen von unseren Seiten mit Quelle; 3.2 Spanne nur vom Fachverband: BVS; A11 nur mit Faktor aus dem Berliner Marktbericht).
  quelleFaq: ["7.3", "3.2", "7.2-P47", "7.2-P63", "7.2-P102", "7.2-P103", "7.2-A11"]
};
