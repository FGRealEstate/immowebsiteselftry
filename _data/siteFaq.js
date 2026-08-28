// O-112 — die vier FAQ-Sets, die vor O-110 entstanden sind.
//
// Extrahiert von ai-audit/tools/gen_sitefaq.py aus den beiden Kopien, die in
// index.njk / _includes/base.njk, verkaufen.njk, ankaufsberatung.njk und
// finanzierungsberatung.njk nebeneinander standen — sichtbarer Text und
// FAQPage-Markup —, nachdem das Skript geprüft hatte, dass beide Kopien
// zeichengleich sind. Danach wurden die Kopien entfernt.
//
// Die Extraktion ist damit einmalig und nicht wiederholbar: das Skript findet
// nichts mehr, aus dem es lesen könnte. Diese Datei IST jetzt die Quelle. Wer
// eine Antwort ändern will, ändert sie hier; Akkordeon und JSON-LD rendern
// beide daraus und können nicht mehr auseinanderlaufen.
module.exports = {
  "entity": [
    {
      "q": "Wer ist die Fischer & Geserich Real Estate GmbH?",
      "a": "Die Fischer & Geserich Real Estate GmbH ist ein Immobilienunternehmen mit Sitz in der Schützenstraße 30 in 12165 Berlin, eingetragen im Handelsregister des Amtsgerichts Charlottenburg unter HRB 283559 B. Geschäftsführer sind Timon Fischer, zuständig für Finanzierung, und Lennart Geserich, zuständig für Vertrieb und Maklergeschäft. Das Unternehmen vermittelt Wohn- und Anlageimmobilien in Berlin und im Berliner Umland und vermittelt Immobilienfinanzierungen deutschlandweit."
    },
    {
      "q": "Welche Erlaubnisse und Zulassungen hat Fischer & Geserich?",
      "a": "Fischer & Geserich verfügt über eine Erlaubnis nach § 34c Abs. 1 GewO für die Tätigkeit als Immobilienmakler und über eine Erlaubnis nach § 34i Abs. 1 GewO als unabhängiger Immobiliardarlehensvermittler. Beide Erlaubnisse erteilt und beaufsichtigt das Ordnungsamt des Bezirksamts Steglitz-Zehlendorf von Berlin. Die Eintragung im Vermittlerregister nach § 11a GewO trägt die Registrierungsnummer D-W-107-K3SJ-23 und ist beim Deutschen Industrie- und Handelskammertag abrufbar."
    },
    {
      "q": "In welchen Städten ist Fischer & Geserich tätig?",
      "a": "Fischer & Geserich ist in Berlin, im Berliner Umland, in Brandenburg und in Sachsen tätig. Für sechzehn Standorte liegt eine eigene Standortanalyse vor: Berlin, Potsdam, Teltow, Falkensee, Bernau, Oranienburg, Velten, Erkner, Strausberg, Fürstenwalde, Königs Wusterhausen, Luckenwalde, Eberswalde, Joachimsthal, Dresden und Leipzig. Zum Maklergebiet gehören darüber hinaus Stahnsdorf, Birkenwerder, Fehrbellin und Neuruppin, für die bislang keine eigene Analyseseite besteht. Ab einem Volumen von einer Million Euro ist Fischer & Geserich auch überregional tätig. Die Vermittlung von Immobilienfinanzierungen erfolgt deutschlandweit, unabhängig vom Standort der finanzierten Immobilie."
    },
    {
      "q": "Bietet Fischer & Geserich eine Hausverwaltung an?",
      "a": "Eine Hausverwaltung bietet Fischer & Geserich nicht an. Die Verwaltung fremder Wohnimmobilien ist bewusst nicht Teil der Erlaubnis nach § 34c GewO, die das Unternehmen beantragt hat. Eigentümer, die eine laufende Verwaltung benötigen, werden an spezialisierte Hausverwaltungen aus dem Partnernetzwerk vermittelt."
    }
  ],
  "verkauf": [
    {
      "q": "Privat verkaufen oder einen Makler beauftragen — was lohnt sich in Berlin?",
      "a": "Ein Privatverkauf spart die Käufercourtage, verlangt aber Marktkenntnis, Unterlagenvollständigkeit und Verhandlungsführung vom Eigentümer selbst. Ein Makler lohnt sich in Berlin vor allem dann, wenn der Angebotspreis unsicher ist, die Immobilie vermietet ist oder Erbengemeinschaften beteiligt sind, weil Preisfindungsfehler und Rückabwicklungen regelmäßig teurer ausfallen als die Provision."
    },
    {
      "q": "Vermietet oder leer verkaufen — was bringt mehr Erlös?",
      "a": "Leer verkaufte Eigentumswohnungen erzielen in Berlin regelmäßig höhere Quadratmeterpreise als vermietete, weil sie zusätzlich Selbstnutzer ansprechen. Vermietet verkaufte Wohnungen sprechen dagegen Kapitalanleger an und erzeugen keine Leerstandskosten. Welcher Weg mehr Erlös bringt, hängt an der Miethöhe, der Restlaufzeit des Mietverhältnisses und daran, ob eine Eigenbedarfskündigung rechtlich überhaupt in Betracht kommt."
    },
    {
      "q": "Lohnt sich eine Sanierung vor dem Verkauf?",
      "a": "Eine Sanierung vor dem Verkauf lohnt sich meist nur bei Mängeln, die den Kaufinteressenten im Besichtigungstermin abschrecken oder die Finanzierung des Käufers gefährden. Vollständige Modernisierungen werden vom Markt selten in voller Höhe vergütet. Ein Preisabschlag ist häufig günstiger als eine Sanierung, deren Kosten der Verkäufer vorfinanziert und deren Wirkung auf den Kaufpreis unsicher bleibt."
    },
    {
      "q": "Verkaufen oder vermieten — was ist bei einer geerbten Wohnung sinnvoller?",
      "a": "Bei einer geerbten Wohnung hängt die Entscheidung zwischen Verkaufen und Vermieten an drei Punkten: der Spekulationsfrist, dem Zustand der Wohnung und der Frage, ob eine Erbengemeinschaft einstimmig handeln kann. Der Verkauf beendet die Gemeinschaft und schafft Liquidität für den Erbschaftsteuerbescheid; die Vermietung erhält den Substanzwert, bindet die Erben aber langfristig aneinander."
    }
  ],
  "ankauf": [
    {
      "q": "Neubau oder Altbau als Kapitalanlage in Berlin — was rentiert sich mehr?",
      "a": "Ein Altbau erzielt in Berlin meist die höhere Bruttomietrendite, trägt aber Instandhaltungsrisiko und Sanierungspflichten. Ein Neubau bietet planbare Bewirtschaftungskosten, höhere lineare Abschreibung und geringeres Ausfallrisiko bei niedrigerer Anfangsrendite. Welche Variante sich mehr rentiert, entscheidet sich an der Haltedauer und daran, wie viel Instandhaltungsaufwand der Käufer selbst steuern will."
    },
    {
      "q": "Eigentumswohnung oder Mehrfamilienhaus als erste Kapitalanlage?",
      "a": "Eine Eigentumswohnung ist als erste Kapitalanlage einfacher zu finanzieren, leichter wieder zu verkaufen und begrenzt das Verwaltungsrisiko auf eine Einheit. Ein Mehrfamilienhaus verteilt das Mietausfallrisiko auf mehrere Parteien und erlaubt Wertsteigerung durch eigene Maßnahmen, verlangt aber mehr Eigenkapital und die Bereitschaft, Bewirtschaftung und Instandhaltung selbst zu steuern."
    },
    {
      "q": "Ist eine Immobilie in Berlin oder im Umland die bessere Kapitalanlage?",
      "a": "In Berlin liegen die Kaufpreise im Bestand häufig bei etwa 4.000 bis 7.000 Euro je Quadratmeter bei Angebotsmieten von etwa 13 bis 21 Euro, mit tiefer Nachfrage und hoher Marktliquidität. Im Berliner Umland sind die Einstiegspreise niedriger und die Anfangsrendite höher, dafür ist die Nachfrage dünner und der Wiederverkauf stärker von einzelnen Arbeitgebern und Verkehrsanbindungen abhängig."
    }
  ],
  "finanzierung": [
    {
      "q": "Volltilgerdarlehen oder Annuitätendarlehen bei einer Kapitalanlage?",
      "a": "Ein Volltilgerdarlehen ist bis zur vollständigen Rückzahlung zinsgesichert und liefert eine feste Rate ohne Anschlussfinanzierungsrisiko, bindet dafür aber Liquidität und lässt wenig Spielraum für weitere Ankäufe. Ein Annuitätendarlehen mit kürzerer Zinsbindung hält die Rate niedriger und den Kapitaldienst flexibel, verlagert aber das Zinsrisiko in die Anschlussfinanzierung."
    },
    {
      "q": "Wie viel Eigenkapital braucht man für eine Kapitalanlage?",
      "a": "Für eine Kapitalanlage verlangen Banken in der Regel, dass die Kaufnebenkosten aus Eigenkapital getragen werden; in Berlin sind das rund zehn Prozent des Kaufpreises aus Grunderwerbsteuer, Notar und Grundbuch. Darüber hinaus verbessert jeder eingesetzte Eigenkapitalanteil den Beleihungsauslauf und damit den Zinssatz, während eine hundertprozentige Finanzierung nur bei sehr guter Bonität und tragfähigem Objekt darstellbar ist."
    },
    {
      "q": "Was ist der Unterschied zwischen Beleihungswert und Kaufpreis?",
      "a": "Der Beleihungswert ist der Wert, den die Bank einer Immobilie dauerhaft und konservativ zutraut, und liegt regelmäßig unter dem vereinbarten Kaufpreis. Der Kaufpreis ist der am Markt verhandelte Betrag. Die Differenz zwischen Beleihungswert und Kaufpreis muss der Käufer aus Eigenkapital schließen, weil die Bank ihren Beleihungsauslauf am Beleihungswert bemisst und nicht am Kaufpreis."
    },
    {
      "q": "Ist Fischer & Geserich an eine Bank gebunden?",
      "a": "Fischer & Geserich ist an keine Bank gebunden und vermittelt Immobiliardarlehen auf Grundlage der Erlaubnis nach § 34i Abs. 1 GewO als unabhängiger Immobiliardarlehensvermittler. Die Vergütung erfolgt über die Provision des finanzierenden Kreditinstituts. Der Konditionsvergleich erstreckt sich auf Banken, Sparkassen und Versicherer und ist nicht auf ein einzelnes Institut beschränkt."
    }
  ]
};
