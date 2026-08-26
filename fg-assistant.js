(() => {
  'use strict';

  const ROOT = document.querySelector('[data-fg-ai-assistant]');
  if (!ROOT) return;

  const $ = (sel, root = ROOT) => root.querySelector(sel);
  const $$ = (sel, root = ROOT) => Array.from(root.querySelectorAll(sel));
  const panel = $('[data-fg-ai-panel]');
  const launcher = $('[data-fg-ai-launcher]');
  const closeBtn = $('[data-fg-ai-close]');
  const resetBtn = $('[data-fg-ai-reset]');
  const messages = $('[data-fg-ai-messages]');
  const form = $('[data-fg-ai-form]');
  const input = $('[data-fg-ai-input]');
  const nav = $('[data-fg-ai-nav]');

  const VERSION = '26.08.2026';
  const SESSION_KEY = 'fg_ai_assistant_session_v1';

  const grESt = {
    'Baden-Württemberg': 5.0,
    'Bayern': 3.5,
    'Berlin': 6.0,
    'Brandenburg': 6.5,
    'Bremen': 5.0,
    'Hamburg': 5.5,
    'Hessen': 6.0,
    'Mecklenburg-Vorpommern': 6.0,
    'Niedersachsen': 5.0,
    'Nordrhein-Westfalen': 6.5,
    'Rheinland-Pfalz': 5.0,
    'Saarland': 6.5,
    'Sachsen': 5.5,
    'Sachsen-Anhalt': 5.0,
    'Schleswig-Holstein': 6.5,
    'Thüringen': 5.0
  };

  const PAGE_ACTIONS = {
    kaufen: { label: 'Kaufgesuch anlegen', href: '/kaufen.html#kaufgesuch', icon: 'fa-key' },
    mieten: { label: 'Mietgesuch anlegen', href: '/mieten.html#mietgesuch', icon: 'fa-door-open' },
    verkaufen: { label: 'Verkauf anfragen', href: '/verkaufen.html#kontakt-verkauf', icon: 'fa-house-circle-check' },
    vermieten: { label: 'Vermietung anfragen', href: '/vermieten.html#kontakt-vermietung', icon: 'fa-building' },
    finanzierung: { label: 'Finanzierung prüfen', href: '/finanzierungsberatung.html#kontakt-finanzierung', icon: 'fa-building-columns' },
    ankauf: { label: 'Ankaufsberatung', href: '/ankaufsberatung.html', icon: 'fa-handshake-angle' },
    angebote: { label: 'Aktuelle Angebote', href: '/angebote.html', icon: 'fa-magnifying-glass' },
    lab: { label: 'Investment Lab', href: '/investment-lab.html', icon: 'fa-chart-line' },
    kontakt: { label: 'Kontakt', href: '/kontakt.html', icon: 'fa-phone' }
  };

  const CAT_META = {
    kaufen: ['fa-key', 'Kaufen', 'Kaufablauf, Notar, Prüfung'],
    verkaufen: ['fa-house-circle-check', 'Verkaufen', 'Bewertung, Vermarktung, Abschluss'],
    finanzierung: ['fa-building-columns', 'Finanzierung', 'Eigenkapital, Rate, Banken'],
    investment: ['fa-chart-line', 'Investment', 'Rendite, Cashflow, Prüfung'],
    miete: ['fa-door-open', 'Mieten & Vermieten', 'Gesuch, Kaution, Vermietung'],
    kosten: ['fa-coins', 'Kosten & Makler', 'Provision, Steuer, Nebenkosten'],
    unterlagen: ['fa-folder-open', 'Unterlagen', 'Kauf, Verkauf, Finanzierung'],
    wissen: ['fa-book-open', 'Immobilienwissen', 'Grundbuch, WEG, Energie'],
    fg: ['fa-location-dot', 'F&G & Standorte', 'Leistungen, Märkte, Kontakt']
  };

  const KB = [
    {
      id:'makler-verguetung-kauf',cat:'kosten',q:'Wie wird ein Makler beim Immobilienkauf vergütet?',
      keys:['makler vergütung','makler provision','courtage','wer zahlt makler','maklerkosten','3,57','provision kauf','makler bezahlt'],
      answer:`Die Maklervergütung wird grundsätzlich <strong>vertraglich vereinbart</strong> und entsteht typischerweise bei erfolgreichem Abschluss des vermittelten Kaufvertrags. Bei Wohnungen und Einfamilienhäusern, die ein Verbraucher kauft, gelten besondere Regeln: Ist der Makler für beide Kaufvertragsparteien tätig und vereinbart mit beiden eine Provision, müssen sich beide in gleicher Höhe verpflichten. Hat nur eine Seite den Makler beauftragt und soll die andere Seite an den Kosten beteiligt werden, darf diese grundsätzlich nicht stärker belastet werden als der ursprüngliche Auftraggeber. Die konkrete Provision steht im Maklervertrag, Exposé oder Provisionshinweis. Bei Mehrfamilienhäusern, Gewerbe- oder sonstigen Investmenttransaktionen können andere Provisionsmodelle vereinbart werden.`,
      note:'Rechtsgrundlagen bei Verbraucher-Käufen von Wohnung/EFH: §§ 656a–656d BGB. Keine Rechtsberatung.',
      actions:['verkaufen','ankauf']
    },
    {
      id:'makler-faelligkeit',cat:'kosten',q:'Wann wird die Maklerprovision fällig?',
      keys:['provision fällig','courtage fällig','maklerrechnung wann','makler bezahlt wann'],
      answer:`Die Provision wird in der Regel fällig, wenn der Hauptvertrag – meist der notarielle Kaufvertrag – wirksam zustande gekommen ist und die vertraglichen Voraussetzungen des Maklervertrags erfüllt sind. Bei bestimmten Verbraucherfällen nach § 656d BGB gelten zusätzliche Voraussetzungen für die Weitergabe eines Provisionsanteils. Maßgeblich ist immer die konkrete Provisionsvereinbarung.`
    },
    {
      id:'makler-miete',cat:'kosten',q:'Wer zahlt den Makler bei einer Mietwohnung?',
      keys:['makler miete','provision mieter','bestellerprinzip','mietwohnung maklerkosten','vermietung provision'],
      answer:`Bei der Vermittlung von Wohnraum gilt grundsätzlich das <strong>Bestellerprinzip</strong>. Ein Wohnungssuchender darf nur unter engen Voraussetzungen mit einem Vermittlungsentgelt belastet werden, insbesondere wenn der Makler ausschließlich aufgrund des Suchauftrags des Wohnungssuchenden den Vermieterauftrag für genau diese Wohnung einholt. Wenn der Wohnungssuchende rechtmäßig provisionspflichtig ist, ist das Entgelt gesetzlich begrenzt. In der Praxis beauftragt und vergütet bei klassischer Wohnraumvermietung häufig der Vermieter den Makler.`,
      note:'Grundlage: Wohnungsvermittlungsgesetz. Bei Gewerbevermietung gelten andere Regeln.',actions:['mieten','vermieten']
    },
    {
      id:'kaufnebenkosten',cat:'kosten',q:'Welche Kaufnebenkosten fallen beim Immobilienkauf an?',
      keys:['kaufnebenkosten','nebenkosten kauf','grunderwerbsteuer notar grundbuch makler','was kommt zum kaufpreis dazu'],
      answer:`Zusätzlich zum Kaufpreis sollten Sie typischerweise mit <strong>Grunderwerbsteuer</strong>, <strong>Notar- und Grundbuchkosten</strong> sowie – falls provisionspflichtig – <strong>Maklerkosten</strong> rechnen. Die Grunderwerbsteuer hängt vom Bundesland ab. Notar und Grundbuch liegen in vielen Standardfällen grob in einer Größenordnung um 1,5–2,0 % des Kaufpreises, können aber je nach Vertrag und Finanzierung abweichen. Für eine Finanzierungsplanung sollten die Nebenkosten separat und nicht nur pauschal betrachtet werden.`,
      tool:'purchaseCosts'
    },
    {
      id:'grunderwerbsteuer',cat:'kosten',q:'Wie hoch ist die Grunderwerbsteuer?',
      keys:['grunderwerbsteuer','grunderwerbssteuer','gre st','steuer berlin brandenburg sachsen','kaufsteuer immobilie'],
      answer:`Die Grunderwerbsteuer ist vom Bundesland abhängig. In unseren Kernmärkten liegt sie derzeit bei <strong>6,0 % in Berlin</strong>, <strong>6,5 % in Brandenburg</strong> und <strong>5,5 % in Sachsen</strong>. Grundlage ist regelmäßig die steuerliche Gegenleistung, häufig also der Kaufpreis. Mit dem Nebenkostenrechner können Sie das Bundesland auswählen.`,
      tool:'purchaseCosts',note:`Steuersätze Stand ${VERSION}; Änderungen sind möglich.`
    },
    {
      id:'notar-kosten',cat:'kosten',q:'Wie hoch sind Notar- und Grundbuchkosten?',
      keys:['notarkosten','grundbuchkosten','notar gebühr','grundbuch gebühr'],
      answer:`Für eine erste Kalkulation wird häufig mit ungefähr <strong>1,5 bis 2,0 %</strong> des Kaufpreises für Notar und Grundbuch gerechnet. Das ist nur ein Planungswert: Die tatsächlichen Gebühren hängen unter anderem vom Geschäftswert, den beurkundeten Erklärungen, Grundschulden und weiteren Eintragungen ab.`
    },
    {
      id:'reservierung',cat:'kaufen',q:'Was bedeutet eine Reservierung bei einer Immobilie?',
      keys:['reservierung immobilie','reservierungsvereinbarung','wohnung reservieren'],
      answer:`Eine Reservierung soll ein Objekt für einen begrenzten Zeitraum aus der aktiven Vermarktung nehmen. Sie ersetzt <strong>keinen notariellen Kaufvertrag</strong> und verschafft allein noch kein Eigentum. Inhalt, Bindungswirkung und mögliche Reservierungsentgelte sollten im Einzelfall geprüft werden.`
    },
    {
      id:'kaufablauf',cat:'kaufen',q:'Wie läuft ein Immobilienkauf typischerweise ab?',
      keys:['kaufablauf','immobilie kaufen ablauf','kaufprozess','wie kaufe ich wohnung','notar ablauf'],
      answer:`Ein typischer Ablauf ist: <strong>1.</strong> Suchprofil und Budget festlegen, <strong>2.</strong> Objekt und Unterlagen prüfen, <strong>3.</strong> Finanzierung strukturieren, <strong>4.</strong> Kaufpreis und Bedingungen verhandeln, <strong>5.</strong> Kaufvertragsentwurf prüfen, <strong>6.</strong> notariell beurkunden, <strong>7.</strong> Fälligkeitsvoraussetzungen und Kaufpreiszahlung, <strong>8.</strong> Übergabe sowie später Eigentumsumschreibung. Bei Kapitalanlagen sollte die wirtschaftliche Prüfung bereits vor der Beurkundung parallel laufen.`,
      actions:['kaufen','ankauf','finanzierung']
    },
    {
      id:'notar-rolle',cat:'kaufen',q:'Welche Rolle hat der Notar beim Immobilienkauf?',
      keys:['notar rolle','was macht notar','notar immobilienkauf','beurkundung'],
      answer:`Der Notar beurkundet den Grundstückskaufvertrag, belehrt über die rechtliche Tragweite, veranlasst die notwendigen Vollzugsschritte und überwacht typischerweise die Fälligkeitsvoraussetzungen. Der Notar ist neutral und vertritt nicht die wirtschaftlichen Interessen einer einzelnen Partei. Wirtschaftliche Objektprüfung, Finanzierungsberatung und Preisstrategie sind deshalb getrennte Themen.`
    },
    {
      id:'auflassungsvormerkung',cat:'wissen',q:'Was ist eine Auflassungsvormerkung?',
      keys:['auflassungsvormerkung','vormerkung grundbuch','eigentumsvormerkung'],
      answer:`Die Auflassungsvormerkung sichert im Grundbuch den Anspruch des Käufers auf Eigentumsübertragung. Sie schützt den Erwerber während der Zeit zwischen Kaufvertragsabschluss und endgültiger Eigentumsumschreibung vor bestimmten späteren Verfügungen über das Grundstück.`
    },
    {
      id:'grundschuld',cat:'wissen',q:'Was ist eine Grundschuld?',
      keys:['grundschuld','grundpfandrecht','bank grundbuch','grundschuld finanzierung'],
      answer:`Eine Grundschuld ist ein Grundpfandrecht und dient Banken regelmäßig als Sicherheit für ein Immobiliendarlehen. Sie wird im Grundbuch eingetragen. Die Höhe der Grundschuld ist nicht automatisch identisch mit der aktuell offenen Darlehensschuld. Bei einer Finanzierung stimmt der Notar die Bestellung typischerweise mit Käufer und Bank ab.`
    },
    {
      id:'kaufpreisfaelligkeit',cat:'kaufen',q:'Wann muss der Kaufpreis gezahlt werden?',
      keys:['kaufpreis fällig','wann kaufpreis zahlen','fälligkeitsmitteilung','kaufpreiszahlung notar'],
      answer:`Der Kaufpreis wird normalerweise nicht unmittelbar beim Notartermin gezahlt. Der Notar prüft zunächst die im Vertrag vorgesehenen Fälligkeitsvoraussetzungen und versendet anschließend eine Fälligkeitsmitteilung. Erst dann wird entsprechend der vertraglichen Frist gezahlt. Bei einer Finanzierung müssen Eigenmittel und Bankauszahlung zeitlich abgestimmt werden.`
    },
    {
      id:'uebergabe',cat:'kaufen',q:'Wann findet die Übergabe statt?',
      keys:['übergabe immobilie','schlüsselübergabe','nutzen lasten','besitzübergang'],
      answer:`Der Zeitpunkt für Besitz, Nutzen und Lasten wird im Kaufvertrag geregelt. Häufig erfolgt die Übergabe nach vollständiger Kaufpreiszahlung, kann aber vertraglich anders ausgestaltet sein. Bei der Übergabe sollten Zählerstände, Schlüssel, Zustand und übergebene Unterlagen dokumentiert werden.`
    },
    {
      id:'objektpruefung',cat:'kaufen',q:'Welche Unterlagen sollte ich vor dem Kauf prüfen?',
      keys:['unterlagen kauf prüfen','due diligence wohnung','wohnung unterlagen','kaufprüfung'],
      answer:`Je nach Objektart gehören unter anderem dazu: Grundbuchauszug, Flurkarte, Teilungserklärung und Aufteilungsplan bei Wohnungseigentum, Protokolle der Eigentümerversammlungen, Wirtschaftsplan, Jahresabrechnungen, Instandhaltungsrücklage, Energieausweis, Mietvertrag bei vermieteten Objekten, Baubeschreibung bzw. Genehmigungen, Wohnflächenunterlagen und bekannte Modernisierungen. Bei Anlageobjekten kommen Mieterliste, Kostenstruktur und Ertragssituation hinzu.`,
      actions:['ankauf']
    },
    {
      id:'weg-protokolle',cat:'wissen',q:'Warum sind WEG-Protokolle wichtig?',
      keys:['weg protokolle','eigentümerversammlung','protokolle eigentumswohnung','sonderumlage'],
      answer:`Protokolle der Wohnungseigentümergemeinschaft zeigen, welche Themen im Gebäude diskutiert und beschlossen wurden – etwa Sanierungen, Streitigkeiten, Sonderumlagen oder größere Investitionen. Zusammen mit Wirtschaftsplan, Abrechnung und Rücklagenstand helfen sie, mögliche zukünftige Belastungen einzuschätzen.`
    },
    {
      id:'teilungserklaerung',cat:'wissen',q:'Was steht in der Teilungserklärung?',
      keys:['teilungserklärung','gemeinschaftsordnung','sondereigentum','wohnungseigentum'],
      answer:`Die Teilungserklärung und Gemeinschaftsordnung regeln, wie ein Gebäude rechtlich in Sonder- und Gemeinschaftseigentum aufgeteilt ist und welche Rechte bzw. Pflichten die Eigentümer haben. Relevant sind zum Beispiel Sondernutzungsrechte, Kostenverteilung, Nutzungsvorgaben und Zuordnung von Räumen oder Stellplätzen.`
    },
    {
      id:'energieausweis',cat:'wissen',q:'Wann brauche ich einen Energieausweis?',
      keys:['energieausweis','energieausweis verkauf','energieausweis vermietung','verbrauchsausweis bedarfsausweis'],
      answer:`Bei Verkauf oder Vermietung von Gebäuden bzw. Wohnungen bestehen regelmäßig Pflichten rund um den Energieausweis und bestimmte Energieangaben in Immobilienanzeigen. Ob ein Verbrauchs- oder Bedarfsausweis erforderlich ist und welche Ausnahmen gelten, hängt vom Gebäude ab. Für die Vermarktung sollte der passende Ausweis frühzeitig vorliegen.`
    },
    {
      id:'eigennutzung-oder-investment',cat:'kaufen',q:'Eigennutzung oder Kapitalanlage – was ist bei der Prüfung anders?',
      keys:['eigennutzung kapitalanlage','selbst nutzen oder vermieten','eigennutzer investor unterschied'],
      answer:`Bei Eigennutzung stehen Wohnqualität, Lage im Alltag, langfristige Tragbarkeit der Rate und persönliche Planung stärker im Vordergrund. Bei einer Kapitalanlage kommen zusätzlich Miete, nicht umlagefähige Kosten, Instandhaltung, Leerstandsrisiko, Finanzierung, steuerliche Effekte und Wiederverkaufsperspektive hinzu. Ein gutes Objekt kann für einen Eigennutzer hervorragend und als Investment trotzdem ungeeignet sein – oder umgekehrt.`,
      actions:['ankauf','lab']
    },
    {
      id:'ankaufsberatung',cat:'kaufen',q:'Was umfasst eine Ankaufsberatung?',
      keys:['ankaufsberatung','kaufberatung','objektprüfung durch makler','ankauf begleiten'],
      answer:`Unsere Ankaufsberatung verbindet Suchstrategie, Einordnung des Objekts, wirtschaftliche Prüfung, Verhandlung und – soweit gewünscht – Finanzierung. Ziel ist nicht, möglichst schnell irgendein Objekt zu kaufen, sondern die Entscheidungsgrundlage zu verbessern und Risiken vor dem Notartermin sichtbar zu machen.`,
      actions:['ankauf']
    },
    {
      id:'finanzierung-ablauf',cat:'finanzierung',q:'Wie läuft eine Immobilienfinanzierung ab?',
      keys:['finanzierung ablauf','baufinanzierung ablauf','immobiliendarlehen prozess','bank finanzierung'],
      answer:`Typischerweise klären wir zunächst Kaufpreis, Eigenkapital, Einkommen, bestehende Verpflichtungen, Objektart und gewünschte Monatsrate. Danach wird eine Finanzierungsstruktur entwickelt und mit passenden Banken geprüft. Nach positiver Kreditentscheidung folgen Darlehensvertrag, Grundschuldbestellung und – sobald die Auszahlungsvoraussetzungen erfüllt sind – die Auszahlung an den Verkäufer.`,
      actions:['finanzierung']
    },
    {
      id:'finanzierungsunterlagen',cat:'unterlagen',q:'Welche Unterlagen brauche ich für eine Finanzierung?',
      keys:['unterlagen finanzierung','bank unterlagen','gehaltsnachweise selbstauskunft','finanzierung dokumente'],
      answer:`Üblich sind eine ausgefüllte Selbstauskunft, Identitätsunterlagen, Einkommensnachweise, Konto- bzw. Vermögensnachweise und Informationen zu bestehenden Darlehen oder Verpflichtungen. Bei Angestellten werden regelmäßig aktuelle Gehaltsabrechnungen und je nach Fall Arbeitsvertrag bzw. Arbeitgeberinformationen benötigt. Selbstständige benötigen typischerweise umfangreichere betriebswirtschaftliche und steuerliche Unterlagen. Zusätzlich braucht die Bank vollständige Objektunterlagen.`,
      actions:['finanzierung']
    },
    {
      id:'eigenkapital',cat:'finanzierung',q:'Wie viel Eigenkapital sollte ich einbringen?',
      keys:['eigenkapital','wie viel eigenkapital','finanzierung ohne eigenkapital','100 prozent finanzierung','110 prozent'],
      answer:`Das lässt sich nicht pauschal beantworten. Mehr Eigenkapital kann Finanzierungskosten und Beleihung reduzieren; zugleich kann bei Kapitalanlegern eine bewusste Fremdkapitalquote Teil der Strategie sein. Banken unterscheiden zwischen einer Finanzierung, bei der zumindest die Kaufnebenkosten aus Eigenmitteln kommen, und sehr hohen Beleihungen bis hin zu Vollfinanzierungen. Entscheidend sind Bonität, Objekt, Einkommen, Reserven und Gesamtstrategie.`,
      actions:['finanzierung']
    },
    {
      id:'monatsrate',cat:'finanzierung',q:'Wie berechnet sich die anfängliche Monatsrate?',
      keys:['monatsrate','rate berechnen','annuität','zins tilgung rate','darlehensrate'],
      answer:`Bei einem klassischen Annuitätendarlehen lässt sich die anfängliche Jahresrate grob aus <strong>Darlehen × (Sollzins + anfängliche Tilgung)</strong> ableiten. Geteilt durch zwölf ergibt sich die anfängliche Monatsrate. Sondertilgungen, Tilgungswechsel, bereitstellungsfreie Zeiten und spätere Zinsänderungen sind darin noch nicht enthalten.`,
      tool:'loanRate'
    },
    {
      id:'zinsbindung',cat:'finanzierung',q:'Welche Zinsbindung ist sinnvoll?',
      keys:['zinsbindung','10 jahre 15 jahre zins','sollzinsbindung','zins festschreiben'],
      answer:`Eine längere Sollzinsbindung erhöht Planungssicherheit, kann aber andere Konditionen haben als eine kürzere Bindung. Relevant sind Zinsniveau, Tilgung, gewünschte Flexibilität, mögliche Sondertilgung und die erwartete Restschuld am Ende der Bindung. Die Entscheidung sollte nicht nur nach dem niedrigsten Startzins getroffen werden.`
    },
    {
      id:'tilgung',cat:'finanzierung',q:'Welche anfängliche Tilgung ist sinnvoll?',
      keys:['tilgung','anfängliche tilgung','2 prozent tilgung','3 prozent tilgung'],
      answer:`Eine höhere Tilgung senkt die Restschuld schneller, erhöht aber die laufende Monatsrate. Sinnvoll ist eine Tilgung, die zur Haushaltsrechnung und zum gewünschten Entschuldungstempo passt. Für Kapitalanlagen sollte zusätzlich geprüft werden, wie die Tilgung den laufenden Cashflow beeinflusst.`
    },
    {
      id:'sondertilgung',cat:'finanzierung',q:'Was ist eine Sondertilgung?',
      keys:['sondertilgung','extra tilgen','darlehen schneller zurückzahlen'],
      answer:`Eine Sondertilgung ist eine zusätzliche Rückzahlung außerhalb der regulären Rate. Viele Darlehensverträge sehen ein jährliches Sondertilgungsrecht vor. Höhe, Frist und Kosten hängen vom konkreten Vertrag ab. Flexibilität kann wertvoll sein, sollte aber gegen den jeweiligen Konditionsaufschlag abgewogen werden.`
    },
    {
      id:'befristeter-arbeitsvertrag',cat:'finanzierung',q:'Kann ich mit einem befristeten Arbeitsvertrag finanzieren?',
      keys:['befristeter arbeitsvertrag','befristet finanzierung','probezeit bank','arbeitsvertrag befristet'],
      answer:`Ein befristeter Arbeitsvertrag schließt eine Immobilienfinanzierung nicht automatisch aus. Banken bewerten unter anderem Branche, Restlaufzeit, bisherige Beschäftigungsdauer, Anschlusswahrscheinlichkeit, Einkommen, Eigenkapital und Haushaltsüberschuss. In Branchen mit strukturell häufigen Befristungen kann die Einordnung anders ausfallen als bei einem atypischen kurzen Vertrag.`,
      actions:['finanzierung']
    },
    {
      id:'aufenthaltstitel',cat:'finanzierung',q:'Spielt der Aufenthaltstitel bei der Finanzierung eine Rolle?',
      keys:['aufenthaltstitel','visum finanzierung','nicht eu finanzierung','residence permit mortgage'],
      answer:`Ja. Banken unterscheiden je nach Staatsangehörigkeit und Art bzw. Dauer des Aufenthaltstitels. Ein unbefristetes Aufenthaltsrecht wird häufig anders bewertet als ein zeitlich begrenzter Titel. Entscheidend sind Bankrichtlinie, Restlaufzeit, Einkommen, Objekt und weitere Bonitätsmerkmale. Deshalb fragen wir den konkreten Aufenthaltstitel früh im Prozess ab.`
    },
    {
      id:'selbststaendig',cat:'finanzierung',q:'Wie finanziert die Bank bei Selbstständigen?',
      keys:['selbstständig finanzierung','freiberufler finanzierung','unternehmer baufinanzierung','bwa steuerbescheid'],
      answer:`Bei Selbstständigen und Freiberuflern prüft die Bank die nachhaltige Ertragskraft über mehrere Perioden. Häufig verlangt werden Steuerbescheide bzw. Steuererklärungen, BWA, Jahresabschlüsse oder EÜR und gegebenenfalls Summen- und Saldenlisten. Neugründungen sind anspruchsvoller, aber nicht in jedem Fall ausgeschlossen – dann gewinnen Eigenkapital, Berufsbild, Auftragslage und Gesamtkonzept an Bedeutung.`
    },
    {
      id:'schufa',cat:'finanzierung',q:'Welche Rolle spielt die SCHUFA?',
      keys:['schufa','bonität','schufa score immobilienfinanzierung','kreditwürdigkeit'],
      answer:`Die SCHUFA ist ein Bestandteil der Bonitätsprüfung, aber nicht die einzige Entscheidungsgrundlage. Banken betrachten zusätzlich Einkommen, Beschäftigung, Eigenkapital, bestehende Verbindlichkeiten, Haushaltsrechnung und Objekt. Negative Merkmale können eine Finanzierung deutlich erschweren; ein einzelner Score ersetzt aber nicht die Gesamtprüfung.`
    },
    {
      id:'kfw',cat:'finanzierung',q:'Kann ich KfW-Förderung nutzen?',
      keys:['kfw','förderung immobilie','förderdarlehen','kfw wohneigentum'],
      answer:`Je nach Vorhaben können KfW- oder andere Förderprogramme relevant sein, beispielsweise für bestimmte Neubau-, Effizienz- oder Eigentumsvorhaben. Programme, Förderbedingungen und Zinssätze ändern sich. Deshalb sollte die Förderfähigkeit immer am konkreten Objekt und zum aktuellen Antragszeitpunkt geprüft werden – idealerweise vor Abschluss bindender Verträge, wenn das jeweilige Programm dies verlangt.`,
      actions:['finanzierung']
    },
    {
      id:'finanzierungsbestaetigung',cat:'finanzierung',q:'Was ist eine Finanzierungsbestätigung?',
      keys:['finanzierungsbestätigung','bankbestätigung','finanzierungszusage','kaufpreis finanzierung bestätigt'],
      answer:`Eine Finanzierungsbestätigung signalisiert dem Verkäufer bzw. Makler, dass die Finanzierung grundsätzlich geprüft wurde. Die Aussagekraft hängt stark davon ab, ob es nur eine unverbindliche Vorprüfung oder bereits eine objektbezogene Kreditentscheidung ist. Vor dem Notartermin sollte klar sein, welche Bedingungen die Bank noch stellt.`
    },
    {
      id:'restschuld',cat:'finanzierung',q:'Warum ist die Restschuld nach der Zinsbindung wichtig?',
      keys:['restschuld','anschlussfinanzierung','zinsbindung ende','darlehen restschuld'],
      answer:`Die Restschuld bestimmt, welcher Betrag nach Ablauf der Sollzinsbindung weiterfinanziert werden muss. Je höher die Restschuld, desto stärker wirkt sich ein später verändertes Zinsniveau auf die neue Rate aus. Deshalb sollte man Finanzierungsvorschläge nicht nur anhand der heutigen Monatsrate, sondern auch anhand der Restschuld vergleichen.`,
      tool:'loanRate'
    },
    {
      id:'bruttorendite',cat:'investment',q:'Was ist die Bruttomietrendite?',
      keys:['bruttorendite','mietrendite','brutto mietrendite','rendite berechnen'],
      answer:`Die Bruttomietrendite setzt die jährliche Nettokaltmiete ins Verhältnis zum Kaufpreis: <strong>Jahresnettokaltmiete ÷ Kaufpreis × 100</strong>. Sie eignet sich als schneller erster Vergleich, berücksichtigt aber weder Kaufnebenkosten noch nicht umlagefähige Kosten, Instandhaltung, Finanzierung, Leerstand oder Steuern.`,
      tool:'yield'
    },
    {
      id:'kaufpreisfaktor',cat:'investment',q:'Was ist der Kaufpreisfaktor?',
      keys:['kaufpreisfaktor','mietfaktor','vervielfältiger','jahresmiete faktor'],
      answer:`Der Kaufpreisfaktor ist grob der Kehrwert der Bruttomietrendite und wird meist als <strong>Kaufpreis ÷ Jahresnettokaltmiete</strong> berechnet. Ein Faktor 25 bedeutet vereinfacht, dass der Kaufpreis dem 25-Fachen der Jahresnettokaltmiete entspricht. Niedriger ist nicht automatisch besser: Lage, Zustand, Mietpotenzial und Risiko müssen mitbewertet werden.`
    },
    {
      id:'cashflow',cat:'investment',q:'Was bedeutet Cashflow bei einer Kapitalanlage?',
      keys:['cashflow','cash flow immobilie','monatlicher überschuss','miete rate kosten'],
      answer:`Der laufende Cashflow ist vereinfacht der Betrag, der nach Mieteinnahmen, nicht umlagefähigen Kosten und Finanzierung übrig bleibt. Für eine belastbare Betrachtung sollten zusätzlich Instandhaltung, Leerstand, Verwaltung, mögliche Sonderumlagen und Steuern berücksichtigt werden. Ein negativer Cashflow ist nicht automatisch schlecht – er muss zur Gesamtstrategie und erwarteten Entwicklung passen.`,
      tool:'yield'
    },
    {
      id:'eigenkapitalrendite',cat:'investment',q:'Was ist die Eigenkapitalrendite?',
      keys:['eigenkapitalrendite','ek rendite','return on equity immobilie'],
      answer:`Die Eigenkapitalrendite setzt den Ertrag ins Verhältnis zum tatsächlich eingesetzten Eigenkapital. Je nach Berechnung kann nur der laufende Cashflow oder zusätzlich die Tilgungsleistung einbezogen werden. Deshalb sollten zwei Angebote nur verglichen werden, wenn die Berechnungsmethodik identisch ist.`,
      tool:'yield'
    },
    {
      id:'nicht-umlagefaehig',cat:'investment',q:'Welche Kosten sind für Vermieter nicht umlagefähig?',
      keys:['nicht umlagefähig','nichtumlagefähige kosten','hausgeld vermieter','hausgeld kapitalanlage'],
      answer:`Bei einer Eigentumswohnung ist das gesamte Hausgeld nicht automatisch auf den Mieter umlegbar. Typischerweise verbleiben unter anderem Verwaltungsanteile und Zuführungen zur Instandhaltungsrücklage beim Eigentümer; auch nicht alle sonstigen Positionen sind Betriebskosten. Für die Investmentrechnung sollte daher nicht mit „Miete minus gesamtem Hausgeld“ oder „Miete minus null Kosten“ gerechnet werden, sondern die Abrechnung sauber aufgeteilt werden.`
    },
    {
      id:'ruecklage',cat:'investment',q:'Warum ist die Instandhaltungsrücklage wichtig?',
      keys:['instandhaltungsrücklage','rücklage weg','rücklagen wohnung','erhaltungsrücklage'],
      answer:`Die Erhaltungs- bzw. Instandhaltungsrücklage dient der Gemeinschaft zur Finanzierung künftiger Maßnahmen am Gemeinschaftseigentum. Ein niedriger Rücklagenstand ist nicht automatisch problematisch, sollte aber zusammen mit Gebäudealter, Sanierungsbedarf und geplanten Maßnahmen betrachtet werden. Bei großen Maßnahmen kann trotz Rücklage eine Sonderumlage nötig werden.`
    },
    {
      id:'sonderumlage',cat:'investment',q:'Was ist eine Sonderumlage?',
      keys:['sonderumlage','weg sonderumlage','sanierung sonderumlage'],
      answer:`Reichen laufende Mittel und Rücklagen für eine größere Maßnahme nicht aus, kann die Wohnungseigentümergemeinschaft eine Sonderumlage beschließen. Für Käufer ist deshalb wichtig, aktuelle Beschlüsse, geplante Sanierungen, Protokolle und Rücklagenstand vor dem Kauf zu prüfen.`
    },
    {
      id:'afa',cat:'investment',q:'Was bedeutet AfA bei Immobilien?',
      keys:['afa','abschreibung immobilie','gebäude abschreiben','steuer abschreibung'],
      answer:`AfA steht für Absetzung für Abnutzung. Bei vermieteten Immobilien kann der abschreibungsfähige Gebäudeanteil grundsätzlich über die steuerlich maßgebliche Nutzungsdauer verteilt werden. Welche AfA-Methode und welcher Satz im konkreten Fall gelten, hängt unter anderem von Baujahr, Objektart, Anschaffungszeitpunkt und gesetzlichen Sonderregelungen ab. Grundstücksanteile sind nicht abschreibbar.`,
      note:'Steuerliche Einzelfälle bitte mit Steuerberatung klären; Regeln können sich ändern.'
    },
    {
      id:'steuern-kapitalanlage',cat:'investment',q:'Welche Steuern muss ich bei einer Kapitalanlage beachten?',
      keys:['steuern kapitalanlage','miete versteuern','vermietung steuer','immobilie steuer'],
      answer:`Bei einer vermieteten Immobilie sind insbesondere Einkünfte aus Vermietung und Verpachtung, abzugsfähige Werbungskosten, Finanzierungskosten, AfA sowie mögliche steuerliche Folgen bei einem späteren Verkauf relevant. Die konkrete Steuerwirkung hängt stark von persönlichem Steuersatz, Haltedauer, Nutzung und Objektstruktur ab und sollte individuell steuerlich geprüft werden.`
    },
    {
      id:'investment-pruefung',cat:'investment',q:'Wie prüfe ich eine Kapitalanlage sinnvoll?',
      keys:['kapitalanlage prüfen','investment prüfen','gute kapitalanlage','wohnung investment check'],
      answer:`Wir würden mindestens fünf Ebenen trennen: <strong>1. Lage und Nachfrage</strong>, <strong>2. Objekt und technische Risiken</strong>, <strong>3. Miet- und Kostenstruktur</strong>, <strong>4. Finanzierung und Cashflow</strong>, <strong>5. Exit- und Entwicklungsperspektive</strong>. Eine einzelne Bruttorendite reicht nicht. Im F&G Investment Lab können Sie Kennzahlen vorprüfen; in der Ankaufsberatung wird das konkrete Objekt eingeordnet.`,
      actions:['lab','ankauf'],tool:'yield'
    },
    {
      id:'leerstand',cat:'investment',q:'Wie berücksichtige ich Leerstand?',
      keys:['leerstand','mietausfall','leerstandsrisiko','kapitalanlage mietausfall'],
      answer:`Bei einer Investmentrechnung sollte nicht selbstverständlich mit zwölf vollständig bezahlten Monatsmieten für alle Zukunft gerechnet werden. Je nach Lage und Objekt kann eine Reserve für Neuvermietungszeiten, Mietausfall, Renovierung zwischen Mietverhältnissen und Vermarktung sinnvoll sein. Bei dauerhaft sehr gefragten Lagen kann das Risiko kleiner, aber nie völlig null sein.`
    },
    {
      id:'mietsteigerung',cat:'investment',q:'Kann ich die Miete nach dem Kauf einfach erhöhen?',
      keys:['miete erhöhen','mieterhöhung nach kauf','mietsteigerung kapitalanlage','miete anpassen'],
      answer:`Nein. Eine Mieterhöhung ist an mietrechtliche Voraussetzungen, Fristen und Grenzen gebunden. Ob und in welchem Umfang eine Anpassung möglich ist, hängt unter anderem von Mietvertrag, bisheriger Miethöhe, örtlichem Mietniveau, Modernisierung und gesetzlichen Beschränkungen ab. In einer Investmentrechnung sollte deshalb nur mit rechtlich plausiblen Mietannahmen gearbeitet werden.`,
      note:'Mietrecht ist einzelfallabhängig; keine Rechtsberatung.'
    },
    {
      id:'verkaufsablauf',cat:'verkaufen',q:'Wie läuft ein professioneller Immobilienverkauf ab?',
      keys:['verkaufsablauf','immobilie verkaufen ablauf','verkaufsprozess','haus verkaufen schritte'],
      answer:`Ein strukturierter Verkauf umfasst typischerweise: <strong>1.</strong> Objektaufnahme und Unterlagen, <strong>2.</strong> Markt- und Preispositionierung, <strong>3.</strong> Vermarktungsstrategie, <strong>4.</strong> Exposé und Interessentenansprache, <strong>5.</strong> Qualifizierung und Besichtigungen, <strong>6.</strong> Verhandlung und Bonitäts-/Finanzierungsprüfung, <strong>7.</strong> Kaufvertragsvorbereitung und Notar, <strong>8.</strong> Übergabe und Nachbereitung.`,
      actions:['verkaufen']
    },
    {
      id:'immobilienbewertung',cat:'verkaufen',q:'Wie wird ein realistischer Verkaufspreis ermittelt?',
      keys:['immobilienbewertung','verkaufspreis ermitteln','was ist meine immobilie wert','marktwert','verkehrswert'],
      answer:`Ein realistischer Angebotspreis sollte aus Lage, Mikrostandort, Objektart, Größe, Zustand, Ausstattung, rechtlichen Besonderheiten, Ertragssituation und tatsächlich beobachtbarer Marktnachfrage abgeleitet werden. Vergleichsangebote allein reichen häufig nicht, weil Angebotspreis und real erzielter Kaufpreis auseinanderliegen können. Bei vermieteten Investmentobjekten spielt zusätzlich der Ertrag eine wesentliche Rolle.`,
      actions:['verkaufen']
    },
    {
      id:'lockpreis',cat:'verkaufen',q:'Warum ist ein zu hoher Angebotspreis problematisch?',
      keys:['zu hoher angebotspreis','lockpreis','preis reduzieren','immobilie zu teuer anbieten'],
      answer:`Ein deutlich überhöhter Startpreis kann die relevante Käufergruppe bereits in den ersten Wochen verlieren. Bleibt das Objekt lange online und wird später mehrfach reduziert, kann dies die Verhandlungsposition schwächen. Ziel sollte deshalb nicht der höchste versprochene Startpreis, sondern eine belastbare Positionierung mit realistischem Abschlussziel sein.`
    },
    {
      id:'verkaufsdauer',cat:'verkaufen',q:'Wie lange dauert ein Immobilienverkauf?',
      keys:['wie lange immobilienverkauf','verkaufsdauer','haus verkaufen dauer','wohnung verkaufen dauer'],
      answer:`Die Dauer hängt stark von Lage, Preis, Objektart, Unterlagenlage und Käuferfinanzierung ab. Zwischen Vermarktungsstart und Notartermin können bei gut positionierten Standardobjekten wenige Wochen liegen; komplexe oder hochpreisige Objekte benötigen häufig deutlich länger. Zusätzlich vergeht nach dem Notartermin Zeit bis zur Kaufpreisfälligkeit und Eigentumsumschreibung.`
    },
    {
      id:'verkaufsunterlagen',cat:'unterlagen',q:'Welche Unterlagen brauche ich als Verkäufer?',
      keys:['unterlagen verkauf','verkäufer dokumente','haus verkaufen unterlagen','wohnung verkaufen unterlagen'],
      answer:`Je nach Objekt werden typischerweise Grundbuchunterlagen, Flurkarte/Lageplan, Wohn- und Flächenunterlagen, Grundrisse, Energieausweis, Bauunterlagen, Nachweise zu Modernisierungen und Belastungen benötigt. Bei Eigentumswohnungen zusätzlich Teilungserklärung, Aufteilungsplan, WEG-Protokolle, Wirtschaftsplan, Abrechnungen und Rücklageninformationen. Bei Vermietung kommen Mietvertrag und Mietdaten hinzu.`
    },
    {
      id:'vermietet-verkaufen',cat:'verkaufen',q:'Kann ich eine vermietete Wohnung verkaufen?',
      keys:['vermietete wohnung verkaufen','wohnung mit mieter verkaufen','mieter bei verkauf'],
      answer:`Ja. Ein bestehendes Mietverhältnis endet durch den Verkauf grundsätzlich nicht automatisch. Für die Vermarktung verändert sich allerdings die Zielgruppe: Eine vermietete Wohnung richtet sich häufig stärker an Kapitalanleger. Mietvertrag, Miethöhe, Laufzeit, Ertrag und rechtliche Situation sollten deshalb transparent aufbereitet werden.`
    },
    {
      id:'offmarket',cat:'verkaufen',q:'Was bedeutet Off-Market-Verkauf?',
      keys:['off market','offmarket','diskret verkaufen','nicht öffentlich vermarkten'],
      answer:`Bei einer Off-Market-Vermarktung wird das Objekt nicht oder nur sehr begrenzt öffentlich beworben. Stattdessen erfolgt die Ansprache gezielt über ein Käufer- bzw. Investorennetzwerk. Das kann bei diskreten Mandaten oder bestimmten Investmentobjekten sinnvoll sein. Ein öffentlicher Markt kann dagegen mehr Reichweite und Wettbewerb erzeugen – die Strategie sollte zum Objekt passen.`
    },
    {
      id:'spekulationssteuer',cat:'verkaufen',q:'Fällt beim Immobilienverkauf Steuer auf den Gewinn an?',
      keys:['spekulationssteuer','steuer verkauf immobilie','gewinn immobilienverkauf steuer','10 jahre immobilie'],
      answer:`Ob ein privater Immobilienverkauf steuerpflichtig ist, hängt unter anderem von Haltedauer und Nutzung ab. Bei selbstgenutzten und vermieteten Immobilien gelten unterschiedliche steuerliche Voraussetzungen und Ausnahmen. Da die Folgen erheblich sein können, sollte die steuerliche Situation vor dem Verkauf mit einem Steuerberater geklärt werden – insbesondere bei kurzen Haltedauern, mehreren Verkäufen oder betrieblichen Strukturen.`,
      note:'Keine Steuerberatung.'
    },
    {
      id:'mietgesuch',cat:'miete',q:'Wie kann ich ein Mietgesuch bei F&G anlegen?',
      keys:['mietgesuch','wohnung mieten suche','mietwohnung suchen','mietprofil'],
      answer:`Auf unserer eigenen Mietstrecke erfassen Sie Suchgebiet, Objektart, monatlichen Mietrahmen, Größe und Ausstattungswünsche. Das Profil wird getrennt von Kaufgesuchen geführt, damit Sie keine unpassenden Kaufangebote erhalten.`,
      actions:['mieten']
    },
    {
      id:'kaufgesuch',cat:'kaufen',q:'Wie kann ich ein Kaufgesuch anlegen?',
      keys:['kaufgesuch','suchprofil kauf','wohnung kaufen suche','immobilie suchen lassen'],
      answer:`Über die Kaufstrecke können Sie Suchgebiet, Objektart, Budget und weitere Kriterien hinterlegen. Das Kaufgesuch wird separat von Mietgesuchen geführt. Wenn Sie zusätzlich Objektprüfung, Verhandlung und Finanzierung wünschen, kann die Ankaufsberatung ergänzt werden.`,
      actions:['kaufen','ankauf']
    },
    {
      id:'kaution',cat:'miete',q:'Wie hoch darf eine Mietkaution bei Wohnraum sein?',
      keys:['mietkaution','kaution drei monatsmieten','wohnung kaution'],
      answer:`Bei Wohnraum darf eine vereinbarte Mietsicherheit grundsätzlich höchstens <strong>drei Monatsmieten ohne Betriebskosten</strong> betragen. Bei einer Barkaution ist der Mieter grundsätzlich zu drei gleichen monatlichen Teilzahlungen berechtigt.`,
      note:'Grundlage: § 551 BGB. Sonderfälle bitte rechtlich prüfen.'
    },
    {
      id:'vermietung-ablauf',cat:'miete',q:'Wie läuft eine Vermietung über F&G ab?',
      keys:['vermietung ablauf','wohnung vermieten makler','mieter suchen','vermietungsservice'],
      answer:`Bei einer Vermietung stehen zunächst Objekt, Zielmiete, Unterlagen und gewünschtes Mieterprofil im Fokus. Danach folgen Aufbereitung, Vermarktung, Interessentenqualifizierung, Besichtigungen, Auswahl, Vertragsvorbereitung und Übergabe. Ziel ist nicht nur Reichweite, sondern ein sauber dokumentierter und für Vermieter nachvollziehbarer Auswahlprozess.`,
      actions:['vermieten']
    },
    {
      id:'mieterunterlagen',cat:'unterlagen',q:'Welche Unterlagen werden von Mietinteressenten typischerweise verlangt?',
      keys:['mieter unterlagen','mietinteressent dokumente','gehaltsnachweis miete','schufa miete'],
      answer:`Je nach Vermieter und Objekt werden typischerweise Selbstauskunft, Identitätsnachweis, Einkommensnachweise und Bonitätsinformationen abgefragt. Welche Daten zu welchem Zeitpunkt erhoben werden dürfen, sollte datenschutz- und mietrechtlich sauber gestaltet werden. Nicht jede Information darf beliebig verlangt werden.`
    },
    {
      id:'standorte',cat:'fg',q:'In welchen Regionen ist Fischer & Geserich tätig?',
      keys:['standorte','wo tätig','regionen','berlin leipzig dresden potsdam','speckgürtel','deutschlandweit'],
      answer:`Unsere Kernmärkte sind <strong>Berlin, Leipzig, Dresden und der Berliner Speckgürtel</strong>. Zum Berliner Umland zählen für uns unter anderem Potsdam, Oranienburg, Birkenwerder, Teltow, Königs Wusterhausen, Erkner und Eberswalde. Abhängig von Immobilienart, Mandat und Transaktionsvolumen begleiten wir ausgewählte Vorhaben auch deutschlandweit.`,
      actions:['kontakt']
    },
    {
      id:'fg-leistungen',cat:'fg',q:'Welche Leistungen bietet Fischer & Geserich?',
      keys:['leistungen f&g','was macht fischer geserich','service','angebot f&g'],
      answer:`Fischer & Geserich verbindet <strong>Verkauf & Vermarktung</strong>, <strong>Ankaufsberatung & Investment</strong> sowie <strong>Immobilienfinanzierung</strong>. Ergänzt wird das Angebot durch Kauf- und Mietgesuche, Vermietung, Investmentwissen und digitale Rechner im F&G Investment Lab.`,
      actions:['verkaufen','ankauf','finanzierung','lab']
    },
    {
      id:'investment-lab',cat:'fg',q:'Was ist das F&G Investment Lab?',
      keys:['investment lab','rechner','immobilienwissen','renditerechner','f&g lab'],
      answer:`Das Investment Lab ist unser digitaler Arbeitsbereich für Immobilienentscheidungen. Dort finden Sie Rechner, Grundlagen zu Rendite und Cashflow, Standortwissen, ein wachsendes Immobilienlexikon und weitere Inhalte zur Einordnung von Investments. Die Tools ersetzen keine individuelle Prüfung, helfen aber bei der strukturierten Voranalyse.`,
      actions:['lab']
    },
    {
      id:'angebote',cat:'fg',q:'Wo finde ich aktuelle Immobilienangebote?',
      keys:['angebote','aktuelle immobilien','objekte','wohnungen verfügbar','immobilienangebot'],
      answer:`Aktuell veröffentlichte Einzelobjekte und Projekte finden Sie auf unserer Angebotsseite. Projektobjekte werden dort mit den verfügbaren Einheiten dargestellt.`,
      actions:['angebote']
    },
    {
      id:'kontakt',cat:'fg',q:'Wie erreiche ich Fischer & Geserich?',
      keys:['kontakt','telefon','email','erreichen','ansprechpartner'],
      answer:`Sie erreichen Fischer & Geserich über unsere Kontaktseite, telefonisch unter <strong>0152 03083048</strong> oder per E-Mail an <strong>info@fg-realestate.de</strong>. Für konkrete Vorhaben ist die passende Website-Strecke meist der schnellste Einstieg.`,
      actions:['kontakt']
    },
    {
      id:'frage-team',cat:'fg',q:'Kann ich meine Frage direkt an das Team senden?',
      keys:['frage senden','team fragen','nachricht senden','email frage','persönliche frage'],
      answer:`Ja. Wenn der Assistent eine Frage nicht abschließend beantworten kann oder Sie eine konkrete Einschätzung wünschen, können Sie Ihre Nachricht direkt aus dem Assistenten an unser Team senden. Erst beim aktiven Absenden werden die eingegebenen Kontaktdaten an F&G übertragen.`,
      actions:['kontakt']
    },
    {
      id:'mfhaus',cat:'wissen',q:'Was ist bei einem Mehrfamilienhaus besonders wichtig?',
      keys:['mehrfamilienhaus','mfh kaufen','zinshaus','wohn und geschäftshaus'],
      answer:`Bei Mehrfamilienhäusern stehen neben Lage und technischer Substanz vor allem Mieterliste, Ist- und Sollmieten, Mietverträge, Leerstand, Betriebskosten, Instandhaltung, CapEx, Energiezustand, Grundbuch, Baurecht und Finanzierungsfähigkeit im Mittelpunkt. Die Bewertung erfolgt stärker ertragsorientiert als bei einer selbstgenutzten Eigentumswohnung.`
    },
    {
      id:'zwangsversteigerung',cat:'wissen',q:'Was ist bei einer Zwangsversteigerung zu beachten?',
      keys:['zwangsversteigerung','versteigerung immobilie','amtsgericht immobilie'],
      answer:`Zwangsversteigerungen folgen einem anderen Prozess als ein normaler Kauf. Besonders wichtig sind Verkehrswertgutachten, Grundbuch- und Belastungssituation, mögliche bestehenbleibende Rechte, Finanzierung des Bargebots und eingeschränkte Gewährleistungsmöglichkeiten. Eine Besichtigung ist nicht immer in gleichem Umfang möglich. Eine individuelle rechtliche und wirtschaftliche Prüfung ist daher besonders wichtig.`
    },
    {
      id:'erbbaurecht',cat:'wissen',q:'Was bedeutet Erbbaurecht?',
      keys:['erbbaurecht','erbpacht','erbbaurechtsvertrag','erbbauszins'],
      answer:`Beim Erbbaurecht wird nicht das Grundstück selbst erworben, sondern ein zeitlich befristetes Recht, auf fremdem Grund ein Gebäude zu haben bzw. zu nutzen. Dafür fällt regelmäßig Erbbauzins an. Restlaufzeit, Anpassungsklauseln, Zustimmungsvorbehalte und Heimfallregelungen beeinflussen Wert und Finanzierbarkeit erheblich.`
    },
    {
      id:'wohnflaeche',cat:'wissen',q:'Warum ist die Wohnflächenangabe wichtig?',
      keys:['wohnfläche','wohnflächenberechnung','qm wohnung','flächenberechnung'],
      answer:`Die Wohnfläche beeinflusst Kaufpreisvergleiche, Miete und Finanzierung. Angaben aus Exposé, Grundriss und älteren Unterlagen sollten nicht automatisch als identisch behandelt werden. Bei Unklarheiten kann eine nachvollziehbare Flächenberechnung sinnvoll sein, insbesondere wenn der Quadratmeterpreis entscheidungsrelevant ist.`
    },
    {
      id:'baulasten',cat:'wissen',q:'Was sind Baulasten?',
      keys:['baulast','baulastenverzeichnis','abstandsfläche baulast'],
      answer:`Baulasten sind öffentlich-rechtliche Verpflichtungen eines Grundstückseigentümers gegenüber der Baubehörde, beispielsweise zu Abstandsflächen oder Zuwegungen. Sie stehen nicht zwingend im Grundbuch und sollten – soweit relevant – über das zuständige Baulastenverzeichnis geprüft werden.`
    },
    {
      id:'grundbuch',cat:'wissen',q:'Was steht im Grundbuch?',
      keys:['grundbuch','abteilung 1 2 3','grundbuchauszug','belastungen'],
      answer:`Das Grundbuch dokumentiert Eigentum und grundstücksbezogene Rechte bzw. Belastungen. Vereinfacht: Abteilung I betrifft Eigentümer, Abteilung II enthält bestimmte Lasten und Beschränkungen und Abteilung III Grundpfandrechte wie Grundschulden oder Hypotheken. Für einen Kauf ist nicht nur der Eigentümer, sondern auch die Belastungssituation relevant.`
    },
    {
      id:'mietvertrag-pruefen',cat:'investment',q:'Was sollte ich bei einem bestehenden Mietvertrag prüfen?',
      keys:['mietvertrag prüfen kapitalanlage','bestehender mieter','mietvertrag wohnung kauf'],
      answer:`Relevant sind unter anderem Mietbeginn, Nettokaltmiete, Betriebskosten, Staffel- oder Indexvereinbarungen, Kaution, Nebenabreden, Modernisierungen, bekannte Rückstände und tatsächliche Zahlungen. Zusätzlich sollte geprüft werden, ob die im Investmentmodell angenommene Miete mit der rechtlichen und tatsächlichen Situation übereinstimmt.`
    },
    {
      id:'indexmiete',cat:'wissen',q:'Was ist eine Indexmiete?',
      keys:['indexmiete','verbraucherpreisindex miete','miete indexiert'],
      answer:`Bei einer wirksam vereinbarten Indexmiete orientieren sich Mietanpassungen am Verbraucherpreisindex und folgen gesetzlichen Voraussetzungen. Sie ist von einer Staffelmiete und einer Erhöhung bis zur ortsüblichen Vergleichsmiete zu unterscheiden. Für Käufer einer vermieteten Wohnung ist die genaue Vertragsklausel entscheidend.`
    },
    {
      id:'staffelmiete',cat:'wissen',q:'Was ist eine Staffelmiete?',
      keys:['staffelmiete','mietstaffel','miete steigt fest'],
      answer:`Bei einer Staffelmiete werden zukünftige Miethöhen bzw. Erhöhungsbeträge bereits im Mietvertrag zeitlich fest vereinbart. Wirksamkeit und Zusammenspiel mit anderen Erhöhungsmöglichkeiten hängen von den gesetzlichen Voraussetzungen und der Vertragsgestaltung ab.`
    },
    {
      id:'finanzierungsvergleich',cat:'finanzierung',q:'Worauf sollte ich beim Vergleich von Bankangeboten achten?',
      keys:['bankangebote vergleichen','finanzierung vergleichen','zins annuität restschuld','effektivzins'],
      answer:`Nicht nur auf den Sollzins schauen. Wichtig sind Effektivzins, Monatsrate, anfängliche Tilgung, Restschuld, Sollzinsbindung, Sondertilgung, Tilgungswechsel, Bereitstellungszinsen, Auszahlungsbedingungen und mögliche Förderbausteine. Zwei Angebote mit ähnlicher Rate können wegen unterschiedlicher Tilgung eine deutlich andere Restschuld erzeugen.`
    },
    {
      id:'bereitstellungszinsen',cat:'finanzierung',q:'Was sind Bereitstellungszinsen?',
      keys:['bereitstellungszinsen','bereitstellungsfreie zeit','darlehen nicht abgerufen'],
      answer:`Bereitstellungszinsen können anfallen, wenn ein zugesagtes Darlehen nach einer vereinbarten bereitstellungsfreien Zeit noch nicht oder nicht vollständig abgerufen wurde. Das ist vor allem bei Neubau, Sanierung oder verzögerter Kaufpreisfälligkeit relevant.`
    },
    {
      id:'forward',cat:'finanzierung',q:'Was ist ein Forward-Darlehen?',
      keys:['forward darlehen','anschlusszins sichern','forward finanzierung'],
      answer:`Mit einem Forward-Darlehen kann eine Anschlussfinanzierung bereits vor Ablauf der bestehenden Zinsbindung vereinbart werden. Dafür wird die künftige Kondition vorab festgeschrieben. Ob das sinnvoll ist, hängt von Vorlaufzeit, Aufschlag, bestehendem Darlehen und Zinserwartung ab.`
    },
    {
      id:'zwischenfinanzierung',cat:'finanzierung',q:'Was ist eine Zwischenfinanzierung?',
      keys:['zwischenfinanzierung','überbrückungsdarlehen','alte immobilie noch nicht verkauft'],
      answer:`Eine Zwischenfinanzierung überbrückt einen zeitlichen Liquiditätsbedarf, zum Beispiel wenn der Kauf einer neuen Immobilie vor dem Verkauf und Kaufpreiseingang der bisherigen Immobilie erfolgt. Sie ist meist kurzfristiger und erfordert eine klare Rückführungsquelle.`
    },
    {
      id:'eigenkapital-nachweis',cat:'finanzierung',q:'Wie weise ich Eigenkapital gegenüber der Bank nach?',
      keys:['eigenkapital nachweis','kontoauszug bank','depot eigenkapital','vermögensnachweis'],
      answer:`Banken akzeptieren je nach Fall beispielsweise Giro- und Tagesgeldguthaben, Depots oder andere liquide Vermögenswerte als Nachweis. Entscheidend ist, dass Herkunft, Verfügbarkeit und gegebenenfalls notwendige Veräußerung nachvollziehbar sind. Bereits gebundene Vermögenswerte werden anders bewertet als frei verfügbares Guthaben.`
    },
    {
      id:'haushaltsrechnung',cat:'finanzierung',q:'Was ist die Haushaltsrechnung der Bank?',
      keys:['haushaltsrechnung','lebenshaltung bank','überschuss finanzierung','monatlicher überschuss'],
      answer:`Die Bank stellt regelmäßige Nettoeinnahmen den anerkannten Lebenshaltungskosten und bestehenden Verpflichtungen gegenüber. Der verbleibende Überschuss muss zur geplanten Rate und zu Sicherheitsreserven passen. Banken verwenden dabei teils eigene Pauschalen, weshalb dieselbe Person bei verschiedenen Instituten unterschiedlich bewertet werden kann.`
    },
    {
      id:'kaufbudget',cat:'finanzierung',q:'Wie hoch könnte mein grobes Kaufbudget sein?',
      keys:['kaufbudget','wie viel immobilie kann ich mir leisten','budget berechnen','maximaler kaufpreis'],
      answer:`Eine erste Näherung lässt sich aus gewünschter Monatsrate, Zins, Tilgung und verfügbarem Eigenkapital ableiten. Eine echte Finanzierungsgrenze hängt zusätzlich von Haushaltsrechnung, Alter, Einkommen, Objekt, Nebenkosten und Bankrichtlinie ab. Nutzen Sie den Budgetrechner nur als Orientierung.`,
      tool:'budget'
    },
    {
      id:'neubau-bestand',cat:'kaufen',q:'Neubau oder Bestandsimmobilie – was ist der Unterschied?',
      keys:['neubau oder bestand','bestandswohnung neubau','neubau kaufen'],
      answer:`Neubauten bieten oft moderne Energiestandards und geringeren kurzfristigen Sanierungsbedarf, haben aber häufig höhere Kaufpreise und bei Bauprojekten zusätzliche Fertigstellungs- bzw. Bauträgerrisiken. Bestand bietet mehr reale Historie zu Lage, Miete und Gebäudezustand, kann aber Sanierungs- und Modernisierungsbedarf mitbringen.`
    },
    {
      id:'besichtigung',cat:'kaufen',q:'Worauf sollte ich bei einer Besichtigung achten?',
      keys:['besichtigung tipps','wohnung besichtigen','hausbesichtigung','was prüfen besichtigung'],
      answer:`Achten Sie nicht nur auf Ausstattung. Relevant sind Zustand von Fenstern, Dach, Fassade, Leitungen und Heizung, Feuchtigkeit, Schallschutz, Belichtung, Grundriss, Gemeinschaftsflächen, Keller und Umfeld. Bei Eigentumswohnungen sind sichtbare Mängel am Gemeinschaftseigentum ebenso wichtig wie die Wohnung selbst. Notieren Sie offene Punkte für die Unterlagenprüfung.`
    },
    {
      id:'modernisierung',cat:'wissen',q:'Wie bewerte ich Sanierungs- oder Modernisierungsbedarf?',
      keys:['sanierung','modernisierung','renovierung kosten','sanierungsbedürftig'],
      answer:`Trennen Sie kosmetische Maßnahmen von technisch oder energetisch relevanten Gewerken. Bad und Boden sind anders zu bewerten als Dach, Fassade, Heizung, Leitungen, Fenster oder Feuchtigkeit. Bei WEG-Objekten kommt hinzu, ob die Maßnahme Sonder- oder Gemeinschaftseigentum betrifft und wie sie finanziert werden soll.`
    },
    {
      id:'denkmalschutz',cat:'wissen',q:'Was bedeutet Denkmalschutz für Käufer?',
      keys:['denkmalschutz','denkmal immobilie','denkmalgeschützt kaufen'],
      answer:`Bei denkmalgeschützten Gebäuden können bauliche Veränderungen genehmigungspflichtig sein und zusätzliche Abstimmung erfordern. Gleichzeitig können je nach Fall steuerliche Besonderheiten bestehen. Zustand, Genehmigungen, Instandhaltungskosten und konkrete Denkmaleigenschaft sollten vor dem Kauf geprüft werden.`
    },
    {
      id:'pv',cat:'investment',q:'Kann Photovoltaik ein Immobilieninvestment ergänzen?',
      keys:['photovoltaik','pv investment','solaranlage immobilie','pv dach'],
      answer:`PV kann die Wirtschaftlichkeit eines Gebäudes ergänzen, wenn Dach, Statik, Netzanschluss, Eigenverbrauchs- bzw. Einspeisekonzept, Investitionskosten und steuerliche Struktur passen. Bei WEGs oder vermieteten Mehrfamilienhäusern kommen zusätzliche rechtliche und organisatorische Fragen hinzu. Eine PV-Rechnung sollte getrennt vom Immobilien-Cashflow transparent modelliert werden.`
    },
    {
      id:'finanzierung-frau-ehepartner',cat:'finanzierung',q:'Muss mein Ehepartner mitfinanzieren?',
      keys:['ehepartner finanzierung','frau mitfinanzieren','mann mitdarlehensnehmer','gemeinsam kredit'],
      answer:`Nicht in jedem Fall. Ob ein Ehepartner Darlehensnehmer werden muss oder soll, hängt von Eigentumsstruktur, Einkommen, Bonität, Güterstand und Bankrichtlinie ab. Wenn beide Einkommen für die Tragfähigkeit benötigt werden oder beide Eigentümer werden, ist eine gemeinsame Finanzierung häufig naheliegend, aber nicht automatisch zwingend.`
    },
    {
      id:'finanzierung-andere-bank',cat:'finanzierung',q:'Kann ich mehrere Banken parallel vergleichen?',
      keys:['mehrere banken','bankvergleich','finanzierungsangebote vergleichen','mehrere finanzierungsanfragen'],
      answer:`Ja, ein strukturierter Vergleich ist sinnvoll. Wichtig ist, dass identische Eckdaten verglichen werden und unnötige, unkoordinierte Kreditanfragen vermieden werden. Ein Finanzierungspartner kann unterschiedliche Banken anhand derselben Zielstruktur vergleichen und Unterschiede bei Rate, Restschuld und Flexibilität sichtbar machen.`
    }
  ];

  // Synonyme helfen bei freier Sprache und typischen Schreibfehlern.
  const SYNONYMS = {
    makler:['courtage','provision','vermittler'], provision:['courtage','maklerlohn'],
    finanzierung:['darlehen','kredit','baufinanzierung','bank'], kredit:['finanzierung','darlehen'],
    wohnung:['immobilie','etw'], haus:['immobilie','efh'], mfh:['mehrfamilienhaus','zinshaus'],
    rendite:['mietrendite','ertrag'], cashflow:['überschuss','liquidität'],
    eigenkapital:['ek','eigenmittel'], rate:['annuität','monatsrate'],
    kaufen:['kauf','erwerben','ankauf'], verkaufen:['verkauf','veräußern'],
    mieten:['miete','mietgesuch'], vermieten:['vermietung','mieter'],
    berlin:['hauptstadt'], brandenburg:['speckgürtel','umland'],
    sachsen:['leipzig','dresden'], unterlagen:['dokumente','nachweise']
  };

  const fmtEUR = (n) => new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number.isFinite(n)?n:0);
  const fmtPct = (n, digits=2) => `${new Intl.NumberFormat('de-DE',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number.isFinite(n)?n:0)} %`;
  const num = (v) => {
    if (typeof v === 'number') return v;
    const s = String(v ?? '').trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');
    return Number.parseFloat(s) || 0;
  };
  const escapeHtml = (str) => String(str ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const normalize = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-z0-9äöü\s-]/g,' ').replace(/\s+/g,' ').trim();
  const tokens = (s) => normalize(s).split(' ').filter(w => w.length > 2);

  function levenshtein(a,b){
    if(a===b) return 0; if(!a.length) return b.length; if(!b.length) return a.length;
    const row=Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){let prev=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const temp=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,prev+(a[i-1]===b[j-1]?0:1));prev=temp;}}
    return row[b.length];
  }

  function expandedTokens(query){
    const base=tokens(query); const set=new Set(base);
    base.forEach(t=>{Object.entries(SYNONYMS).forEach(([k,vals])=>{if(t===k||vals.includes(t)){set.add(k);vals.forEach(v=>set.add(v));}})});
    return Array.from(set);
  }

  function scoreEntry(entry, query){
    const nq=normalize(query); const qt=expandedTokens(query);
    const title=normalize(entry.q); const hay=normalize([entry.q,(entry.keys||[]).join(' '),entry.answer].join(' '));
    let score=0;
    if(title===nq) score+=100;
    if(title.includes(nq) && nq.length>5) score+=42;
    (entry.keys||[]).forEach(k=>{const nk=normalize(k); if(nq.includes(nk)) score+=24; else if(nk.includes(nq)&&nq.length>4) score+=12;});
    qt.forEach(t=>{
      if(title.includes(t)) score+=9;
      if(hay.includes(t)) score+=3;
      if(t.length>=6){
        const words=hay.split(' ').filter(w=>Math.abs(w.length-t.length)<=2);
        if(words.some(w=>levenshtein(w,t)<=1)) score+=2;
      }
    });
    return score;
  }

  function searchKB(query, limit=4){
    return KB.map(e=>({entry:e,score:scoreEntry(e,query)})).filter(x=>x.score>2).sort((a,b)=>b.score-a.score).slice(0,limit);
  }

  function actionHtml(actionKeys=[]){
    const unique=[...new Set(actionKeys)].map(k=>PAGE_ACTIONS[k]).filter(Boolean);
    if(!unique.length) return '';
    return `<div class="fg-ai-actions">${unique.map((a,i)=>`<a class="fg-ai-action ${i===0?'is-gold':'is-light'}" href="${a.href}"><i class="fas ${a.icon}"></i>${a.label}</a>`).join('')}</div>`;
  }

  function suggestionsHtml(items=[]){
    if(!items.length) return '';
    return `<div class="fg-ai-suggestions">${items.slice(0,5).map(t=>`<button type="button" class="fg-ai-chip" data-fg-ai-question="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>`;
  }

  function addMessage(role, html, options={}){
    const wrap=document.createElement('div');
    wrap.className=`fg-ai-message ${role==='user'?'is-user':'is-assistant'}`;
    wrap.innerHTML=role==='user'
      ? `<div class="fg-ai-bubble"></div>`
      : `<div class="fg-ai-avatar"><i class="fas fa-wand-magic-sparkles"></i></div><div class="fg-ai-bubble"></div>`;
    wrap.querySelector('.fg-ai-bubble').innerHTML=html;
    messages.appendChild(wrap);
    messages.scrollTop=messages.scrollHeight;
    if(options.save!==false) saveSession();
    return wrap;
  }

  function addUser(text){addMessage('user',escapeHtml(text));}
  function showTyping(){
    const el=addMessage('assistant','<div class="fg-ai-typing"><span></span><span></span><span></span></div>',{save:false});
    el.dataset.typing='1'; return el;
  }
  function removeTyping(){messages.querySelector('[data-typing="1"]')?.remove();}

  function initialHtml(){
    return `<span class="fg-ai-kicker">F&G Immobiliennavigator</span>
      <p><strong>Guten Tag.</strong> Ich helfe mit über 80 Wissensmodulen bei Fragen zu Immobilienkauf, Verkauf, Finanzierung, Kapitalanlage, Vermietung, Kosten und Unterlagen.</p>
      <p>Sie können frei schreiben oder direkt einen Bereich wählen.</p>
      ${categoryGridHtml()}
      ${suggestionsHtml(['Wie wird ein Makler vergütet?','Welche Kaufnebenkosten fallen an?','Wie viel Eigenkapital brauche ich?','Wie prüfe ich eine Kapitalanlage?'])}`;
  }

  function categoryGridHtml(){
    const cats=['kaufen','verkaufen','finanzierung','investment','miete','kosten','unterlagen','wissen','fg'];
    return `<div class="fg-ai-category-grid">${cats.map(c=>{const [icon,title,sub]=CAT_META[c];return `<button type="button" class="fg-ai-category-card" data-fg-ai-category="${c}"><i class="fas ${icon}"></i><strong>${title}</strong><span>${sub}</span></button>`}).join('')}</div>`;
  }

  function categoryIntro(cat){
    const entries=KB.filter(e=>e.cat===cat).slice(0,8);
    const meta=CAT_META[cat]||CAT_META.wissen;
    addMessage('assistant',`<span class="fg-ai-kicker">${meta[1]}</span><p>Hier sind häufige Themen aus diesem Bereich. Sie können auch eine eigene Frage eintippen.</p>${suggestionsHtml(entries.map(e=>e.q))}${cat==='kosten'?`<div class="fg-ai-actions"><button class="fg-ai-action is-gold" data-fg-ai-tool="purchaseCosts"><i class="fas fa-calculator"></i>Kaufnebenkosten rechnen</button></div>`:''}${cat==='finanzierung'?`<div class="fg-ai-actions"><button class="fg-ai-action is-gold" data-fg-ai-tool="loanRate"><i class="fas fa-calculator"></i>Rate berechnen</button><button class="fg-ai-action is-light" data-fg-ai-tool="budget"><i class="fas fa-wallet"></i>Budget schätzen</button></div>`:''}${cat==='investment'?`<div class="fg-ai-actions"><button class="fg-ai-action is-gold" data-fg-ai-tool="yield"><i class="fas fa-chart-line"></i>Investment-Check</button></div>`:''}`);
  }

  function answerQuery(query){
    const q=String(query||'').trim(); if(!q) return;
    addUser(q); input.value=''; autoResize();
    const typing=showTyping();
    window.setTimeout(()=>{
      typing.remove();
      // Simple intents that are better handled directly.
      const nq=normalize(q);
      if(/^(hallo|hi|hey|guten tag|moin|servus)\b/.test(nq)){
        addMessage('assistant',`<p>Guten Tag! Wobei darf ich helfen?</p>${categoryGridHtml()}`);return;
      }
      if(nq.includes('rechner')||nq.includes('berechnen')){
        addMessage('assistant',`<p>Gerne. Welchen Rechner möchten Sie öffnen?</p><div class="fg-ai-actions"><button class="fg-ai-action is-gold" data-fg-ai-tool="purchaseCosts">Kaufnebenkosten</button><button class="fg-ai-action is-light" data-fg-ai-tool="loanRate">Monatsrate</button><button class="fg-ai-action is-light" data-fg-ai-tool="yield">Rendite & Cashflow</button><button class="fg-ai-action is-light" data-fg-ai-tool="budget">Kaufbudget</button></div>`);return;
      }
      const hits=searchKB(q,4);
      if(!hits.length||hits[0].score<6){
        const fallback=KB.filter(e=>['fg','kaufen','finanzierung'].includes(e.cat)).slice(0,4).map(e=>e.q);
        addMessage('assistant',`<p>Zu dieser Formulierung habe ich noch keine ausreichend sichere Standardantwort. Ich möchte lieber nichts erfinden.</p><p>Sie können die Frage anders formulieren oder direkt an unser Team senden.</p><div class="fg-ai-actions"><a class="fg-ai-action is-gold" href="/index.html#faq"><i class="fas fa-circle-question"></i>Frage an F&G stellen</a><a class="fg-ai-action is-light" href="/kontakt.html"><i class="fas fa-phone"></i>Persönlich kontaktieren</a></div>${suggestionsHtml(fallback)}`);return;
      }
      const best=hits[0].entry;
      let html=`<span class="fg-ai-kicker">${CAT_META[best.cat]?.[1]||'Immobilienwissen'}</span><p><strong>${escapeHtml(best.q)}</strong></p><p>${best.answer}</p>`;
      if(best.note) html+=`<div class="fg-ai-note">${best.note}</div>`;
      if(best.tool) html+=`<div class="fg-ai-actions"><button type="button" class="fg-ai-action is-gold" data-fg-ai-tool="${best.tool}"><i class="fas fa-calculator"></i>${toolLabel(best.tool)}</button></div>`;
      html+=actionHtml(best.actions||[]);
      const related=hits.slice(1).map(h=>h.entry.q);
      if(related.length) html+=suggestionsHtml(related);
      addMessage('assistant',html);
    },260);
  }

  function toolLabel(t){return ({purchaseCosts:'Kaufnebenkosten rechnen',loanRate:'Rate & Restschuld rechnen',yield:'Rendite & Cashflow rechnen',budget:'Kaufbudget grob schätzen'})[t]||'Tool öffnen';}

  function stateOptions(selected='Berlin'){
    return Object.entries(grESt).map(([s,r])=>`<option value="${s}" ${s===selected?'selected':''}>${s} (${String(r).replace('.',',')} %)</option>`).join('');
  }

  function renderTool(tool,prefill=''){
    if(tool==='purchaseCosts'){
      addMessage('assistant',`<span class="fg-ai-kicker">Rechner</span><div class="fg-ai-tool" data-tool-card="purchaseCosts"><h4>Kaufnebenkosten</h4><p>Grobe Orientierung für Grunderwerbsteuer, Notar/Grundbuch und Käuferprovision.</p><div class="fg-ai-tool-grid"><div class="fg-ai-field"><label>Kaufpreis</label><input inputmode="decimal" name="price" value="300000"></div><div class="fg-ai-field"><label>Bundesland</label><select name="state">${stateOptions()}</select></div><div class="fg-ai-field"><label>Notar + Grundbuch</label><input inputmode="decimal" name="notary" value="2,0"></div><div class="fg-ai-field"><label>Käufer-Maklerprovision</label><input inputmode="decimal" name="broker" value="3,57"></div></div><button class="fg-ai-tool-submit" data-calc="purchaseCosts">Berechnen</button><div data-result></div></div>`);
      return;
    }
    if(tool==='loanRate'){
      addMessage('assistant',`<span class="fg-ai-kicker">Finanzierungsrechner</span><div class="fg-ai-tool" data-tool-card="loanRate"><h4>Rate & Restschuld</h4><p>Annuitätendarlehen als Modellrechnung.</p><div class="fg-ai-tool-grid"><div class="fg-ai-field"><label>Darlehen</label><input inputmode="decimal" name="loan" value="300000"></div><div class="fg-ai-field"><label>Sollzins p.a.</label><input inputmode="decimal" name="interest" value="3,5"></div><div class="fg-ai-field"><label>Anfängliche Tilgung</label><input inputmode="decimal" name="repayment" value="2,0"></div><div class="fg-ai-field"><label>Betrachtung in Jahren</label><input inputmode="numeric" name="years" value="10"></div></div><button class="fg-ai-tool-submit" data-calc="loanRate">Berechnen</button><div data-result></div></div>`);return;
    }
    if(tool==='yield'){
      addMessage('assistant',`<span class="fg-ai-kicker">Investment-Check</span><div class="fg-ai-tool" data-tool-card="yield"><h4>Rendite & Cashflow</h4><p>Vorsteuer-Modell für eine schnelle Plausibilitätsprüfung.</p><div class="fg-ai-tool-grid"><div class="fg-ai-field"><label>Kaufpreis</label><input inputmode="decimal" name="price" value="300000"></div><div class="fg-ai-field"><label>Nettokaltmiete / Monat</label><input inputmode="decimal" name="rent" value="1400"></div><div class="fg-ai-field"><label>Nicht umlagefähig / Monat</label><input inputmode="decimal" name="nonrec" value="150"></div><div class="fg-ai-field"><label>Darlehen</label><input inputmode="decimal" name="loan" value="240000"></div><div class="fg-ai-field"><label>Sollzins p.a.</label><input inputmode="decimal" name="interest" value="3,5"></div><div class="fg-ai-field"><label>Tilgung p.a.</label><input inputmode="decimal" name="repayment" value="2,0"></div><div class="fg-ai-field is-full"><label>Eingesetztes Eigenkapital inkl. Nebenkosten</label><input inputmode="decimal" name="equity" value="90000"></div></div><button class="fg-ai-tool-submit" data-calc="yield">Investment prüfen</button><div data-result></div></div>`);return;
    }
    if(tool==='budget'){
      addMessage('assistant',`<span class="fg-ai-kicker">Budget-Orientierung</span><div class="fg-ai-tool" data-tool-card="budget"><h4>Grobe Kaufpreis-Spanne</h4><p>Aus gewünschter Rate, Zins/Tilgung und Eigenkapital. Keine Bankzusage.</p><div class="fg-ai-tool-grid"><div class="fg-ai-field"><label>Max. Monatsrate</label><input inputmode="decimal" name="rate" value="1800"></div><div class="fg-ai-field"><label>Eigenkapital</label><input inputmode="decimal" name="equity" value="80000"></div><div class="fg-ai-field"><label>Sollzins p.a.</label><input inputmode="decimal" name="interest" value="3,5"></div><div class="fg-ai-field"><label>Tilgung p.a.</label><input inputmode="decimal" name="repayment" value="2,0"></div><div class="fg-ai-field"><label>Bundesland</label><select name="state">${stateOptions()}</select></div><div class="fg-ai-field"><label>Makler Käuferanteil</label><input inputmode="decimal" name="broker" value="3,57"></div></div><button class="fg-ai-tool-submit" data-calc="budget">Budget schätzen</button><div data-result></div></div>`);return;
    }
  }

  function calcPurchase(card){
    const price=num($('[name="price"]',card).value); const state=$('[name="state"]',card).value; const taxRate=grESt[state]||0; const notary=num($('[name="notary"]',card).value); const broker=num($('[name="broker"]',card).value);
    const tax=price*taxRate/100, n=price*notary/100, b=price*broker/100, extras=tax+n+b;
    $('[data-result]',card).innerHTML=`<div class="fg-ai-result"><div class="fg-ai-result-grid"><div class="fg-ai-result-stat"><small>Grunderwerbsteuer</small><strong>${fmtEUR(tax)}</strong></div><div class="fg-ai-result-stat"><small>Notar + Grundbuch</small><strong>${fmtEUR(n)}</strong></div><div class="fg-ai-result-stat"><small>Makler Käuferanteil</small><strong>${fmtEUR(b)}</strong></div><div class="fg-ai-result-stat"><small>Nebenkosten gesamt</small><strong>${fmtEUR(extras)}</strong></div><div class="fg-ai-result-stat"><small>Gesamtaufwand</small><strong>${fmtEUR(price+extras)}</strong></div><div class="fg-ai-result-stat"><small>Nebenkostenquote</small><strong>${fmtPct(price?extras/price*100:0,1)}</strong></div></div><p>Modellrechnung. Provision und Notar-/Grundbuchkosten sind Eingabewerte; tatsächliche Kosten können abweichen. Grunderwerbsteuer ${state}: ${String(taxRate).replace('.',',')} % (Stand ${VERSION}).</p></div>`;
  }

  function calcLoan(card){
    const loan=num($('[name="loan"]',card).value), interest=num($('[name="interest"]',card).value)/100, repayment=num($('[name="repayment"]',card).value)/100, years=Math.max(1,Math.min(40,num($('[name="years"]',card).value)||10));
    const annual=loan*(interest+repayment), monthly=annual/12;
    const r=interest/12; const n=Math.round(years*12);
    let balance=loan;
    if(r>0){balance=loan*Math.pow(1+r,n)-monthly*((Math.pow(1+r,n)-1)/r);} else {balance=Math.max(0,loan-monthly*n);}
    balance=Math.max(0,balance);
    const repaid=Math.max(0,loan-balance);
    $('[data-result]',card).innerHTML=`<div class="fg-ai-result"><div class="fg-ai-result-grid"><div class="fg-ai-result-stat"><small>Anfängliche Monatsrate</small><strong>${fmtEUR(monthly)}</strong></div><div class="fg-ai-result-stat"><small>Jahresrate</small><strong>${fmtEUR(annual)}</strong></div><div class="fg-ai-result-stat"><small>Restschuld nach ${years} J.</small><strong>${fmtEUR(balance)}</strong></div><div class="fg-ai-result-stat"><small>Getilgter Betrag</small><strong>${fmtEUR(repaid)}</strong></div></div><p>Vereinfachtes Annuitätenmodell mit konstanter Rate und konstantem Sollzins in der Betrachtungszeit; ohne Gebühren, Sondertilgungen oder Tilgungswechsel.</p></div>`;
  }

  function calcYield(card){
    const price=num($('[name="price"]',card).value), rent=num($('[name="rent"]',card).value), nonrec=num($('[name="nonrec"]',card).value), loan=num($('[name="loan"]',card).value), interest=num($('[name="interest"]',card).value)/100, repayment=num($('[name="repayment"]',card).value)/100, equity=num($('[name="equity"]',card).value);
    const annualRent=rent*12, gross=price?annualRent/price*100:0, factor=annualRent?price/annualRent:0, debtAnnual=loan*(interest+repayment), debtMonthly=debtAnnual/12, cashMonthly=rent-nonrec-debtMonthly, principalAnnual=loan*repayment, eqReturn=equity?((cashMonthly*12+principalAnnual)/equity*100):0;
    $('[data-result]',card).innerHTML=`<div class="fg-ai-result"><div class="fg-ai-result-grid"><div class="fg-ai-result-stat"><small>Bruttorendite</small><strong>${fmtPct(gross,2)}</strong></div><div class="fg-ai-result-stat"><small>Kaufpreisfaktor</small><strong>${new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(factor)}x</strong></div><div class="fg-ai-result-stat"><small>Finanzierungsrate</small><strong>${fmtEUR(debtMonthly)}/M.</strong></div><div class="fg-ai-result-stat"><small>Cashflow vor Steuer</small><strong>${fmtEUR(cashMonthly)}/M.</strong></div><div class="fg-ai-result-stat"><small>Tilgung im 1. Jahr</small><strong>${fmtEUR(principalAnnual)}</strong></div><div class="fg-ai-result-stat"><small>EK-Rendite inkl. Tilgung</small><strong>${fmtPct(eqReturn,2)}</strong></div></div><p>Vereinfachte Modellrechnung vor Steuern. Leerstand, Instandhaltung, Neuvermietung, Kaufnebenkosten (soweit nicht im EK enthalten), Wertänderung und Sonderumlagen sind nicht automatisch berücksichtigt.</p></div>`;
  }

  function calcBudget(card){
    const rate=num($('[name="rate"]',card).value), equity=num($('[name="equity"]',card).value), interest=num($('[name="interest"]',card).value)/100, repayment=num($('[name="repayment"]',card).value)/100, state=$('[name="state"]',card).value, broker=num($('[name="broker"]',card).value)/100, tax=(grESt[state]||0)/100, notary=.02;
    const annuity=interest+repayment; const loan=annuity>0?rate*12/annuity:0; const extraRate=tax+broker+notary;
    // Solve price + ancillary(price) = loan + equity, assuming all equity may be used.
    const price=Math.max(0,(loan+equity)/(1+extraRate)); const extras=price*extraRate;
    $('[data-result]',card).innerHTML=`<div class="fg-ai-result"><div class="fg-ai-result-grid"><div class="fg-ai-result-stat"><small>Grobe Darlehensgröße</small><strong>${fmtEUR(loan)}</strong></div><div class="fg-ai-result-stat"><small>Grobe Kaufpreis-Spanne</small><strong>${fmtEUR(price)}</strong></div><div class="fg-ai-result-stat"><small>Geschätzte Nebenkosten</small><strong>${fmtEUR(extras)}</strong></div><div class="fg-ai-result-stat"><small>Gesamtmittel</small><strong>${fmtEUR(loan+equity)}</strong></div></div><p>Reine mathematische Orientierung. Eine Bank berücksichtigt zusätzlich Einkommen, Haushaltsrechnung, Alter, Objekt, Bonität und eigene Mindestanforderungen. Notar/Grundbuch hier pauschal mit 2,0 % gerechnet.</p></div>`;
  }


  function showInfo(){
    addMessage('assistant',`<span class="fg-ai-kicker">So funktioniert der Assistent</span><p>Dieser Assistent arbeitet <strong>ohne extern angebundenes KI-Modell</strong>. Freie Fragen werden lokal im Browser mit einem umfangreichen F&G-Wissensmodul, Synonymen und thematischer Ähnlichkeit abgeglichen.</p><ul><li>Keine Eingabe wird zur Beantwortung an OpenAI, Microsoft oder einen anderen KI-Anbieter gesendet.</li><li>Ihre Fragen im Assistenten bleiben im Browser und werden nicht an F&G übertragen.</li><li>Für eine persönliche Anfrage führt Sie der Assistent zur separaten Kontakt- bzw. FAQ-Strecke.</li><li>Rechner sind Orientierungshilfen, keine Finanzierungs-, Rechts- oder Steuerberatung.</li><li>Recht, Steuern, Förderprogramme und Bankrichtlinien können sich ändern.</li></ul><div class="fg-ai-note">Wissensstand: ${VERSION}. Bei konkreten Entscheidungen prüfen wir den Einzelfall persönlich.</div>`);
  }

  function contextualWelcome(){
    const p=location.pathname;
    if(p.includes('finanzierungsberatung')) return ['Welche Unterlagen braucht die Bank?','Wie berechnet sich die Monatsrate?','Wie viel Eigenkapital sollte ich einbringen?'];
    if(p.includes('verkaufen')) return ['Wie wird ein realistischer Verkaufspreis ermittelt?','Welche Unterlagen brauche ich als Verkäufer?','Wie wird ein Makler beim Immobilienkauf vergütet?'];
    if(p.includes('ankaufsberatung')||p.includes('kaufen')) return ['Welche Unterlagen sollte ich vor dem Kauf prüfen?','Wie prüfe ich eine Kapitalanlage sinnvoll?','Wie läuft ein Immobilienkauf typischerweise ab?'];
    if(p.includes('mieten')||p.includes('vermieten')) return ['Wie kann ich ein Mietgesuch bei F&G anlegen?','Wie hoch darf eine Mietkaution bei Wohnraum sein?','Wie läuft eine Vermietung über F&G ab?'];
    if(p.includes('investment-lab')) return ['Was ist die Bruttomietrendite?','Was bedeutet Cashflow bei einer Kapitalanlage?','Was ist die Eigenkapitalrendite?'];
    if(p.includes('angebote')) return ['Welche Unterlagen sollte ich vor dem Kauf prüfen?','Eigennutzung oder Kapitalanlage – was ist bei der Prüfung anders?','Wie kann ich ein Kaufgesuch anlegen?'];
    return null;
  }

  function openPanel(){
    panel.hidden=false; launcher.setAttribute('aria-expanded','true');
    if(!messages.children.length){addMessage('assistant',initialHtml(),{save:false});const ctx=contextualWelcome();if(ctx)addMessage('assistant',`<p>Passend zu dieser Seite interessieren häufig:</p>${suggestionsHtml(ctx)}`,{save:false});}
    window.setTimeout(()=>input.focus({preventScroll:true}),80); saveSession();
  }
  function closePanel(){panel.hidden=true;launcher.setAttribute('aria-expanded','false');}
  function resetConversation(){messages.innerHTML='';sessionStorage.removeItem(SESSION_KEY);addMessage('assistant',initialHtml(),{save:false});const ctx=contextualWelcome();if(ctx)addMessage('assistant',`<p>Passend zu dieser Seite interessieren häufig:</p>${suggestionsHtml(ctx)}`,{save:false});saveSession();}

  function saveSession(){
    try{sessionStorage.setItem(SESSION_KEY,JSON.stringify({open:!panel.hidden,html:messages.innerHTML}));}catch(e){}
  }
  function restoreSession(){
    try{const state=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(state?.html)messages.innerHTML=state.html;if(state?.open)openPanel();}catch(e){}
  }
  function autoResize(){input.style.height='auto';input.style.height=Math.min(88,input.scrollHeight)+'px';}

  launcher.addEventListener('click',()=>panel.hidden?openPanel():closePanel()); closeBtn.addEventListener('click',closePanel); resetBtn.addEventListener('click',resetConversation);
  form.addEventListener('submit',e=>{e.preventDefault();answerQuery(input.value)}); input.addEventListener('input',autoResize); input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});

  ROOT.addEventListener('click',e=>{
    const info=e.target.closest('[data-fg-ai-info]'); if(info){showInfo();return;}
    const q=e.target.closest('[data-fg-ai-question]'); if(q){answerQuery(q.dataset.fgAiQuestion);return;}
    const cat=e.target.closest('[data-fg-ai-category]'); if(cat){categoryIntro(cat.dataset.fgAiCategory);return;}
    const tool=e.target.closest('[data-fg-ai-tool]'); if(tool){renderTool(tool.dataset.fgAiTool,tool.dataset.prefill||'');return;}
    const calc=e.target.closest('[data-calc]'); if(calc){const card=calc.closest('[data-tool-card]');const t=calc.dataset.calc;if(t==='purchaseCosts')calcPurchase(card);if(t==='loanRate')calcLoan(card);if(t==='yield')calcYield(card);if(t==='budget')calcBudget(card);saveSession();return;}
  });

  nav.addEventListener('click',e=>{
    const b=e.target.closest('button[data-nav]'); if(!b)return; $$('.fg-ai-nav button').forEach(x=>x.classList.remove('is-active'));b.classList.add('is-active');
    const n=b.dataset.nav;
    if(n==='start')addMessage('assistant',`<p>Wählen Sie einen Themenbereich:</p>${categoryGridHtml()}`);
    if(n==='rechner')addMessage('assistant',`<p>Welchen Rechner möchten Sie nutzen?</p><div class="fg-ai-actions"><button class="fg-ai-action is-gold" data-fg-ai-tool="purchaseCosts">Kaufnebenkosten</button><button class="fg-ai-action is-light" data-fg-ai-tool="loanRate">Rate & Restschuld</button><button class="fg-ai-action is-light" data-fg-ai-tool="yield">Rendite & Cashflow</button><button class="fg-ai-action is-light" data-fg-ai-tool="budget">Kaufbudget</button></div>`);
    if(n==='wege')addMessage('assistant',`<p>Direkt zum passenden Vorhaben:</p>${actionHtml(['kaufen','mieten','verkaufen','vermieten','finanzierung','ankauf','angebote'])}`);
    if(n==='team')addMessage('assistant',`<p>Wenn Sie eine persönliche Einschätzung möchten, erreichen Sie uns direkt oder können Ihre Frage im FAQ-Bereich der Startseite senden.</p><div class="fg-ai-actions"><a class="fg-ai-action is-gold" href="/kontakt.html"><i class="fas fa-phone"></i>Kontakt aufnehmen</a><a class="fg-ai-action is-light" href="/index.html#faq"><i class="fas fa-circle-question"></i>Frage senden</a></div>`);
  });

  // Assistant starts closed; restore only this browser-tab session.
  restoreSession();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closePanel();});
})();
