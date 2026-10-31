/* Teile, die erst nach dem Launch kommen (Update 5, Abschnitt 1, „After the launch“).
   false = Eleventy baut die Seiten nicht, sie fehlen in Sitemap, Menü und Fuß. Umschalten erst nach Freigabe.
   .eleventy.js liest diese Datei, die Vorlagen sehen sie als `freigaben`. */
module.exports = {
  // /referenzen/ und /referenzen/<objekt>/: nach dem Launch und nach Timons Antwort auf Frage 14.1
  // (Zustimmung der Verkäufer). Ohne Schalter erschiene jedes Objekt mit Propstack-Status „Verkauft“.
  referenzen: false,
  // /gewerbeimmobilien/ (Update 5, Abschnitt 4): in der Woche nach dem Launch
  gewerbe: false,
  // FG-Gap-Answers (28.10.2026): FAQ-Antworten mit Status TIMON stehen in den Seiten (Feld timon: "1.3" usw.),
  // werden aber erst gebaut, wenn ihre Nummer hier steht. Eintragen erst, wenn Jesu das OK schickt.
  // 29.10.2026 FG-Timon-Answers-Update §1: Timon hat geantwortet. 6.2 (Strukturvertrieb) ist nach FG-Update-11 §3 aus den Seiten gelöscht.
  timonFaq: ["1.3", "1.5", "3.1", "4.4", "5.2", "5.3", "5.4", "5.5", "6.1"],
  // Antworten mit Status SOURCE (selbst geschrieben aus amtlichen Quellen, Feld quelle: "3.2" usw.) gehen laut Brief §9
  // erst live, wenn Jesu sie mit ihren Quellen geprüft hat. Geprüfte Nummern hier eintragen.
  quelleFaq: []
};
