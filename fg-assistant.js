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
  const SESSION_KEY = 'fg_ai_assistant_session_v4';
  let dialogState = { flow: null, stage: null, data: {} };

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
      id:'makler-verguetung-allgemein',cat:'kosten',q:'Wie wird ein Makler vergütet?',
      keys:['wie wird ein makler vergütet','makler vergütung allgemein','wie verdient makler geld','makler honorar','maklerlohn'],
      answer:`<strong>Kurz gesagt:</strong> Ein Immobilienmakler wird in der Regel erfolgsabhängig über eine vereinbarte Provision vergütet. Ob und in welcher Höhe eine Provision anfällt, hängt von Objektart, Auftrag und Vertragskonstellation ab.<ul><li><strong>Kauf von Wohnung oder Einfamilienhaus durch Verbraucher:</strong> Für die Verteilung der Maklerkosten gelten besondere gesetzliche Regeln. Bei Tätigkeit für beide Seiten müssen sich beide Seiten grundsätzlich in gleicher Höhe verpflichten.</li><li><strong>Wohnraumvermietung:</strong> Hier gilt grundsätzlich das Bestellerprinzip.</li><li><strong>Mehrfamilienhäuser, Gewerbe- und Investmenttransaktionen:</strong> Die Vergütung wird regelmäßig individuell vereinbart; auch reine Käufer- oder Verkäuferprovisionen sind möglich.</li></ul>Die konkrete Provision sollte immer transparent im Maklervertrag, Exposé oder Provisionshinweis ausgewiesen sein.`,
      note:'Bei Verbraucher-Käufen von Wohnungen/EFH gelten insbesondere §§ 656a–656d BGB; bei Wohnraumvermietung das Wohnungsvermittlungsgesetz. Keine Rechtsberatung.',
      actions:['verkaufen','ankauf']
    },
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
    },
    {"id":"verkauf-erbschaft","cat":"verkaufen","q":"Was ist beim Verkauf einer geerbten Immobilie wichtig?","keys":["immobilie geerbt verkaufen","erbschaft immobilie verkauf","erbengemeinschaft haus verkaufen"],"answer":"Bei einer geerbten Immobilie sollten zuerst Eigentumsnachweis, Erbfolge bzw. Erbschein und gegebenenfalls die Abstimmung innerhalb einer Erbengemeinschaft geklärt werden. Danach folgen Bewertung, Unterlagenprüfung und Vermarktungsstrategie. Steuerliche Folgen hängen stark vom Einzelfall ab und sollten separat steuerlich geprüft werden.","actions":["verkaufen"]},
    {"id":"verkauf-scheidung","cat":"verkaufen","q":"Wie läuft ein Immobilienverkauf bei Trennung oder Scheidung ab?","keys":["scheidung immobilie verkaufen","trennung haus verkaufen","gemeinsame immobilie verkauf"],"answer":"Bei gemeinsamem Eigentum müssen die Eigentümer die Verkaufsentscheidung und die wesentlichen Konditionen gemeinsam tragen. Zusätzlich sollten Darlehen, Grundbuch, mögliche Ausgleichszahlungen und der zeitliche Ablauf sauber abgestimmt werden. Wir können die Vermarktung strukturieren; familien- und steuerrechtliche Fragen gehören in die jeweilige Fachberatung.","actions":["verkaufen"]},
    {"id":"verkauf-grundschuld","cat":"verkaufen","q":"Kann ich eine Immobilie mit eingetragener Grundschuld verkaufen?","keys":["grundschuld verkaufen","immobilie mit grundschuld verkaufen","bank im grundbuch verkauf"],"answer":"Ja. Eine bestehende Grundschuld verhindert einen Verkauf grundsätzlich nicht. Im Kaufvertrag und in der Abwicklung wird geregelt, ob sie gelöscht, abgelöst oder in besonderen Fällen übernommen wird; bei laufenden Darlehen stimmt der Notar die Ablösung regelmäßig mit der finanzierenden Bank ab.","actions":["verkaufen"]},
    {"id":"verkauf-laufendes-darlehen","cat":"verkaufen","q":"Was passiert mit meinem laufenden Darlehen beim Verkauf?","keys":["darlehen beim verkauf","kredit ablösen immobilienverkauf","vorfälligkeitsentschädigung verkauf"],"answer":"Ein laufendes Immobiliendarlehen wird beim Verkauf häufig aus dem Kaufpreis abgelöst. Ob eine Vorfälligkeitsentschädigung entsteht oder andere Möglichkeiten bestehen, hängt vom Darlehensvertrag und der konkreten Situation ab. Die Bank stellt für die notarielle Abwicklung die Ablöseinformationen bereit.","actions":["verkaufen","finanzierung"]},
    {"id":"verkauf-preisstrategie","cat":"verkaufen","q":"Wie legt man den richtigen Angebotspreis fest?","keys":["angebotspreis festlegen","preisstrategie immobilie","zu hoch anbieten","verkaufspreis strategie"],"answer":"Der Angebotspreis sollte aus Vergleichsdaten, Mikrolage, Objektzustand, Nachfrage und der konkreten Vermarktungsstrategie abgeleitet werden. Ein bewusst überhöhter Startpreis kann Reichweite und Verhandlungsposition verschlechtern; ein zu niedriger Preis verschenkt dagegen Potenzial. Entscheidend ist die Positionierung im aktuellen Teilmarkt.","actions":["verkaufen"]},
    {"id":"verkauf-alleinauftrag","cat":"verkaufen","q":"Was ist ein Makleralleinauftrag?","keys":["alleinauftrag makler","makleralleinauftrag","qualifizierter alleinauftrag"],"answer":"Ein Makleralleinauftrag bündelt die Vermarktung bei einem Makler für einen vereinbarten Zeitraum. Das ermöglicht eine einheitliche Preis-, Kommunikations- und Interessentenstrategie. Umfang, Laufzeit und Pflichten sollten im konkreten Maklervertrag transparent geregelt sein.","note":"Keine Rechtsberatung.","actions":["verkaufen"]},
    {"id":"verkauf-mehrere-makler","cat":"verkaufen","q":"Ist es sinnvoll, mehrere Makler gleichzeitig zu beauftragen?","keys":["mehrere makler gleichzeitig","zwei makler immobilie","mehrere makler verkauf"],"answer":"Mehrere parallele Vermarktungen können zu unterschiedlichen Preisen, doppelten Inseraten und einem unruhigen Marktauftritt führen. Gerade bei hochwertigen oder erklärungsbedürftigen Immobilien ist eine klar verantwortete Vermarktungsstrategie häufig sinnvoller. Entscheidend ist aber die konkrete Vertrags- und Objektsituation.","actions":["verkaufen"]},
    {"id":"verkauf-besichtigung","cat":"verkaufen","q":"Wie sollten Besichtigungen im Verkaufsprozess organisiert werden?","keys":["besichtigungen verkauf","besichtigung organisieren makler","interessenten qualifizieren"],"answer":"Gute Besichtigungen beginnen mit einer Vorqualifizierung der Interessenten und vollständigen Objektinformationen. Termine sollten so gesteuert werden, dass ernsthafte Nachfrage sichtbar wird und der Verkäufer nicht unnötig belastet wird. Nach der Besichtigung sollten Finanzierung, Rückfragen und Kaufinteresse strukturiert nachgefasst werden.","actions":["verkaufen"]},
    {"id":"verkauf-gebote","cat":"verkaufen","q":"Wie gehe ich mit mehreren Kaufangeboten um?","keys":["mehrere kaufangebote","mehrere gebote immobilie","bieterverfahren"],"answer":"Nicht nur der höchste Preis ist relevant. Finanzierungsstatus, gewünschter Übergabetermin, Bedingungen und Verlässlichkeit des Käufers gehören ebenso in die Bewertung. Bei mehreren ernsthaften Interessenten kann ein transparent strukturierter Angebotsprozess sinnvoll sein.","actions":["verkaufen"]},
    {"id":"verkauf-energieausweis-fehlt","cat":"unterlagen","q":"Was mache ich, wenn beim Verkauf der Energieausweis fehlt?","keys":["energieausweis fehlt verkauf","kein energieausweis","energieausweis beantragen verkauf"],"answer":"Für viele Wohnimmobilien ist im Vermarktungsprozess ein Energieausweis erforderlich. Welcher Ausweistyp benötigt wird und ob eine Ausnahme greift, hängt vom Gebäude ab. Fehlende Unterlagen sollten früh identifiziert und rechtzeitig beschafft werden, damit die Vermarktung nicht ins Stocken gerät.","actions":["verkaufen"]},
    {"id":"verkauf-weg","cat":"verkaufen","q":"Was ist beim Verkauf einer Eigentumswohnung in einer WEG wichtig?","keys":["wohnung in weg verkaufen","eigentumswohnung verkauf weg","weg unterlagen verkauf"],"answer":"Neben den üblichen Objektunterlagen sind bei einer Eigentumswohnung insbesondere Teilungserklärung, Wirtschaftsplan, Hausgeld, Rücklagenstand, Beschlusssammlung bzw. Protokolle und mögliche Sonderumlagen relevant. Käufer und finanzierende Banken wollen die wirtschaftliche Situation der WEG nachvollziehen können.","actions":["verkaufen"]},
    {"id":"verkauf-mfh-kennzahlen","cat":"verkaufen","q":"Welche Kennzahlen sind beim Verkauf eines Mehrfamilienhauses wichtig?","keys":["mfh verkaufen kennzahlen","mehrfamilienhaus verkauf jahresnettokaltmiete","zinshaus verkaufen"],"answer":"Bei Mehrfamilienhäusern stehen Mieterliste, Jahresnettokaltmiete, Wohn-/Nutzfläche, Leerstand, Mietpotenziale, nicht umlagefähige Kosten, Instandhaltungszustand und CapEx-Risiken im Mittelpunkt. Käufer betrachten zusätzlich Kaufpreisfaktor, Rendite, Finanzierung und Entwicklungspotenzial.","actions":["verkaufen"]},
    {"id":"verkauf-grundstueck","cat":"verkaufen","q":"Was ist beim Verkauf eines Grundstücks besonders wichtig?","keys":["grundstück verkaufen","bauland verkaufen","grundstück bewerten"],"answer":"Bei Grundstücken sind Planungsrecht, Erschließung, Baulasten, Altlasten, Zuschnitt, Bebaubarkeit und gegebenenfalls bestehende Rechte besonders wertrelevant. Ein Quadratmeterpreis allein reicht deshalb für die Einordnung meist nicht aus.","actions":["verkaufen"]},
    {"id":"verkauf-gewerbe","cat":"verkaufen","q":"Vermittelt F&G auch Gewerbe- oder Investmentimmobilien?","keys":["gewerbeimmobilie verkaufen","investmentimmobilie verkaufen","gewerbe vermittlung"],"answer":"Wir prüfen auch Gewerbe- und Investmenttransaktionen, wenn Objektart, Mandat und Transaktionsvolumen zu unserem Leistungsprofil passen. Bei solchen Objekten stehen Ertrag, Mietverträge, Bonität der Nutzer, technische Risiken und Exit-Perspektive stärker im Vordergrund als bei klassischem Wohneigentum.","actions":["verkaufen"]},
    {"id":"kauf-hausgeld","cat":"kaufen","q":"Was sagt das Hausgeld bei einer Eigentumswohnung aus?","keys":["hausgeld wohnung","hausgeld eigentumswohnung","was ist hausgeld"],"answer":"Das Hausgeld ist die regelmäßige Zahlung des Wohnungseigentümers an die Gemeinschaft und umfasst unterschiedliche Kostenpositionen. Für Kapitalanleger ist wichtig zu trennen, welche Bestandteile auf den Mieter umlagefähig sind und welche beim Eigentümer verbleiben. Zusätzlich sollten Rücklagenzuführung und mögliche Sonderumlagen betrachtet werden.","actions":["ankauf"]},
    {"id":"kauf-wirtschaftsplan","cat":"kaufen","q":"Warum sollte ich den Wirtschaftsplan einer WEG prüfen?","keys":["wirtschaftsplan weg prüfen","weg wirtschaftsplan kauf","wirtschaftsplan wohnung"],"answer":"Der Wirtschaftsplan zeigt die geplanten Einnahmen und Ausgaben der WEG und ist Grundlage des laufenden Hausgelds. Zusammen mit Jahresabrechnungen, Protokollen und Rücklagen hilft er, die laufende Kostenstruktur und mögliche Risiken besser einzuschätzen.","actions":["ankauf"]},
    {"id":"kauf-instandhaltungsstau","cat":"kaufen","q":"Wie erkenne ich Instandhaltungsstau vor dem Kauf?","keys":["instandhaltungsstau erkennen","sanierungsstau wohnung haus","technische prüfung immobilie"],"answer":"Hinweise ergeben sich aus Besichtigung, Baualter, Dach, Fassade, Leitungen, Heizung, Fenstern, Feuchtigkeit sowie bei WEGs aus Protokollen und beschlossenen Maßnahmen. Bei größeren oder technisch komplexen Objekten kann eine zusätzliche sachverständige Prüfung sinnvoll sein.","actions":["ankauf"]},
    {"id":"kauf-neubau-bautraeger","cat":"kaufen","q":"Was ist beim Kauf vom Bauträger anders?","keys":["bauträger kauf","neubau vom bauträger","bauträgervertrag"],"answer":"Beim Bauträgerkauf werden Grundstück bzw. Miteigentumsanteil und Bauleistung typischerweise in einem notariellen Vertrag verbunden. Zahlungsplan, Baubeschreibung, Fertigstellung, Abnahme, Sonderwünsche und Sicherheiten sind deshalb besonders wichtig. Der Vertragsentwurf sollte vor Beurkundung sorgfältig geprüft werden.","actions":["ankauf","finanzierung"]},
    {"id":"kauf-kaufpreisverhandlung","cat":"kaufen","q":"Wie verhandle ich den Kaufpreis einer Immobilie?","keys":["kaufpreis verhandeln","preisverhandlung immobilie","angebot immobilie abgeben"],"answer":"Eine gute Verhandlung basiert auf nachvollziehbaren Argumenten: Vergleichspreise, Zustand, Instandhaltungsbedarf, Mietsituation, Finanzierungssicherheit und zeitliche Interessen des Verkäufers. Ein pauschales Niedrigangebot ohne Begründung ist oft weniger wirksam als eine belastbare, schnell umsetzbare Kaufposition.","actions":["ankauf"]},
    {"id":"kauf-vertragsentwurf","cat":"kaufen","q":"Was sollte ich im Kaufvertragsentwurf prüfen?","keys":["kaufvertragsentwurf prüfen","notarvertrag prüfen","kaufvertrag immobilie entwurf"],"answer":"Zu prüfen sind insbesondere Kaufgegenstand, Kaufpreis, Fälligkeit, Besitz-/Nutzen-/Lastenwechsel, Grundbuchrechte, Haftungsregelungen, Räumungs- oder Mietverhältnisse und besondere Vereinbarungen. Notarielle Vertragsfragen sollten direkt mit dem Notariat bzw. eigener Rechtsberatung geklärt werden.","note":"Keine Rechtsberatung.","actions":["ankauf"]},
    {"id":"kauf-eigenmittel-zahlung","cat":"kaufen","q":"Wie zahle ich meinen Eigenkapitalanteil beim Kaufpreis?","keys":["eigenkapital kaufpreis überweisen","restkaufpreis selbst zahlen","eigenmittel verkäufer konto"],"answer":"Nach Eintritt der Kaufpreisfälligkeit wird der nicht durch das Bankdarlehen gedeckte Kaufpreisanteil grundsätzlich aus den eigenen Mitteln auf das im Kaufvertrag bzw. in der Fälligkeitsmitteilung angegebene Konto gezahlt. Betrag, Empfänger, Verwendungszweck und Fälligkeit sollten exakt mit den notariellen Unterlagen abgeglichen werden.","note":"Bei Unsicherheit vor Überweisung Notariat und finanzierende Bank einbeziehen.","actions":["finanzierung"]},
    {"id":"kauf-bank-auszahlung","cat":"finanzierung","q":"Wann zahlt die Bank den Darlehensbetrag an den Verkäufer aus?","keys":["bank auszahlung kaufpreis","darlehen verkäufer auszahlen","auszahlung immobilienkredit"],"answer":"Die Bank zahlt aus, wenn ihre Auszahlungsvoraussetzungen erfüllt sind und die Kaufpreisfälligkeit vorliegt. Dazu gehören je nach Bank unter anderem Darlehensunterlagen, Grundschuldbestellung, Nachweise zum Eigenkapitaleinsatz und die notarielle Fälligkeitsmitteilung.","actions":["finanzierung"]},
    {"id":"kauf-schluessel","cat":"kaufen","q":"Wann bekomme ich die Schlüssel zur gekauften Immobilie?","keys":["schlüsselübergabe kauf","schlüssel nach kaufpreis","besitzübergang immobilie"],"answer":"Die Schlüsselübergabe ist meist an den vertraglich vereinbarten Besitz-, Nutzen- und Lastenwechsel gekoppelt, häufig nach vollständiger Kaufpreiszahlung. Maßgeblich ist der notarielle Kaufvertrag; dort sollten Übergabetag und Voraussetzungen eindeutig geregelt sein.","actions":["ankauf"]},
    {"id":"finanzierung-voll","cat":"finanzierung","q":"Ist eine 100-%-Finanzierung möglich?","keys":["100 finanzierung","vollfinanzierung","kaufpreis komplett finanzieren"],"answer":"Eine Finanzierung des vollständigen Kaufpreises kann bei sehr guter Bonität und einem bankseitig passenden Objekt grundsätzlich möglich sein. Häufig erwartet die Bank dennoch, dass zumindest Kaufnebenkosten aus Eigenmitteln getragen werden. Konditionen und Auswahl möglicher Banken sind meist anspruchsvoller als bei niedrigerem Beleihungsauslauf.","actions":["finanzierung"]},
    {"id":"finanzierung-110","cat":"finanzierung","q":"Kann auch der Kaufpreis inklusive Nebenkosten finanziert werden?","keys":["110 finanzierung","nebenkosten mitfinanzieren","ohne eigenkapital finanzieren"],"answer":"Eine Finanzierung über den reinen Kaufpreis hinaus ist deutlich anspruchsvoller und nicht bei jeder Bank darstellbar. Sie setzt in der Regel sehr starke Bonität, nachhaltiges Einkommen und ein überzeugendes Objekt voraus. Je höher die Finanzierung im Verhältnis zum bankseitigen Wert, desto wichtiger werden Kondition und Risikoprüfung.","actions":["finanzierung"]},
    {"id":"finanzierung-aktien","cat":"finanzierung","q":"Kann ein Wertpapierdepot als Eigenkapital berücksichtigt werden?","keys":["aktien als eigenkapital","depot eigenkapital finanzierung","wertpapiere immobilienfinanzierung"],"answer":"Wertpapiere können Vermögen darstellen, werden von Banken aber je nach Institut und Schwankungsrisiko unterschiedlich berücksichtigt. Entscheidend ist, ob sie verkauft und als liquide Eigenmittel eingesetzt, verpfändet oder lediglich als Reserve nachgewiesen werden sollen.","actions":["finanzierung"]},
    {"id":"finanzierung-privatdarlehen","cat":"finanzierung","q":"Wie behandelt die Bank ein Privatdarlehen von Familie oder Freunden?","keys":["privatdarlehen freund finanzierung","familien darlehen eigenkapital","darlehen von eltern immobilie"],"answer":"Ein Privatdarlehen ist wirtschaftlich regelmäßig Fremdkapital und sollte gegenüber der Bank transparent angegeben werden. Laufzeit, Rückzahlung, Nachrang und monatliche Belastung können die Bankprüfung beeinflussen. Eine echte Schenkung wird anders beurteilt als ein rückzahlbares Darlehen.","actions":["finanzierung"]},
    {"id":"finanzierung-schenkung","cat":"finanzierung","q":"Kann eine Schenkung der Eltern als Eigenkapital dienen?","keys":["schenkung eltern eigenkapital","eltern schenken geld immobilie","familie eigenkapital"],"answer":"Ja, liquide geschenkte Mittel können grundsätzlich als Eigenkapital eingesetzt werden, wenn Herkunft und Verfügbarkeit nachvollziehbar sind. Schenkungssteuerliche Fragen und Dokumentation sollten bei größeren Beträgen separat geprüft werden.","actions":["finanzierung"]},
    {"id":"finanzierung-probezeit","cat":"finanzierung","q":"Kann ich während der Probezeit finanzieren?","keys":["probezeit finanzierung","immobilienkredit probezeit","baufinanzierung in probezeit"],"answer":"Probezeit ist für viele Banken ein Risikofaktor, aber nicht in jedem Fall ein Ausschluss. Berufsbild, bisheriger Werdegang, Einkommen, Eigenkapital, Mitdarlehensnehmer und Objekt können die Beurteilung verbessern. Manche Banken warten das Ende der Probezeit ab, andere prüfen individuell.","actions":["finanzierung"]},
    {"id":"finanzierung-elternzeit","cat":"finanzierung","q":"Wie bewertet die Bank Elternzeit?","keys":["elternzeit finanzierung","elterngeld baufinanzierung","immobilienkredit elternzeit"],"answer":"Banken betrachten das nachhaltig erwartete Einkommen nach der Elternzeit und die aktuelle Haushaltsrechnung. Wichtig sind Rückkehrperspektive, Arbeitsvertrag, Elterngeld, Einkommen des zweiten Antragstellers und vorhandene Reserven. Die Bewertung unterscheidet sich je nach Bank.","actions":["finanzierung"]},
    {"id":"finanzierung-auslandseinkommen","cat":"finanzierung","q":"Kann Einkommen aus dem Ausland für eine Finanzierung berücksichtigt werden?","keys":["auslandseinkommen finanzierung","gehalt ausland immobilienkredit deutschland","foreign income mortgage germany"],"answer":"Das ist grundsätzlich möglich, aber stark bankabhängig. Währung, Arbeitgeber, Steuerland, Aufenthaltsstatus und Nachweisbarkeit des Einkommens spielen eine Rolle. Die Auswahl geeigneter Banken ist meist kleiner als bei rein deutschem Einkommen.","actions":["finanzierung"]},
    {"id":"finanzierung-rentner","cat":"finanzierung","q":"Ist eine Immobilienfinanzierung im Rentenalter möglich?","keys":["rentner finanzierung","immobilienkredit rente","baufinanzierung alter"],"answer":"Ja, aber die Bank achtet besonders auf nachhaltiges Einkommen, Laufzeit, Tilgungsstruktur, Vermögen und die langfristige Tragbarkeit. Ein pauschales Höchstalter gibt es nicht für alle Banken gleichermaßen; die Kreditrichtlinien unterscheiden sich.","actions":["finanzierung"]},
    {"id":"finanzierung-bestehende-kredite","cat":"finanzierung","q":"Wie wirken sich bestehende Kredite auf die Immobilienfinanzierung aus?","keys":["konsumkredit baufinanzierung","autokredit finanzierung immobilie","bestehende kredite bank"],"answer":"Bestehende Raten reduzieren den monatlichen Haushaltsüberschuss und können damit das mögliche Immobilienbudget senken. Banken berücksichtigen Kreditraten, Leasing, Unterhalt und weitere regelmäßige Verpflichtungen in der Haushaltsrechnung.","actions":["finanzierung"]},
    {"id":"finanzierung-bankbewertung","cat":"finanzierung","q":"Warum bewertet die Bank die Immobilie anders als den Kaufpreis?","keys":["bankbewertung niedriger kaufpreis","beleihungswert","bank wert immobilie"],"answer":"Die Bank ermittelt für ihre Kreditentscheidung einen eigenen Objekt- bzw. Beleihungswert nach internen und regulatorischen Vorgaben. Dieser kann vom vereinbarten Kaufpreis abweichen. Liegt der bankseitige Wert niedriger, kann dadurch mehr Eigenkapital erforderlich oder die Kondition schlechter werden.","actions":["finanzierung"]},
    {"id":"finanzierung-beleihungsauslauf","cat":"finanzierung","q":"Was bedeutet Beleihungsauslauf?","keys":["beleihungsauslauf","ltv finanzierung","loan to value immobilie"],"answer":"Der Beleihungsauslauf beschreibt vereinfacht das Verhältnis zwischen Darlehen und dem von der Bank angesetzten Objektwert bzw. Beleihungswert. Niedrigere Ausläufe bedeuten für die Bank regelmäßig weniger Risiko und können günstigere Konditionen ermöglichen.","actions":["finanzierung"]},
    {"id":"finanzierung-tilgungswechsel","cat":"finanzierung","q":"Was ist ein Tilgungssatzwechsel?","keys":["tilgungssatzwechsel","tilgung ändern darlehen","rate anpassen baufinanzierung"],"answer":"Ein Tilgungssatzwechsel erlaubt innerhalb vereinbarter Grenzen die Änderung der laufenden Tilgung und damit der Rate. Ob, wie oft und in welchem Umfang das möglich ist, hängt vom Darlehensvertrag ab. Diese Flexibilität kann bei wechselndem Einkommen wertvoll sein.","actions":["finanzierung"]},
    {"id":"finanzierung-zusage-vor-notar","cat":"finanzierung","q":"Sollte die Finanzierung vor dem Notartermin stehen?","keys":["finanzierung vor notar","notar ohne finanzierungszusage","kaufvertrag bevor bank zusagt"],"answer":"Aus Käufersicht ist eine belastbare Finanzierung vor dem Notartermin sehr wichtig, weil der notarielle Kaufvertrag regelmäßig verbindliche Zahlungspflichten auslöst. Eine bloße Konditionsindikation ist nicht dasselbe wie eine objektbezogene Kreditentscheidung.","actions":["finanzierung"]},
    {"id":"investment-nettorendite","cat":"investment","q":"Was ist die Nettomietrendite?","keys":["nettorendite","netto mietrendite","rendite nach kosten"],"answer":"Die Nettomietrendite berücksichtigt im Gegensatz zur Bruttomietrendite zusätzliche nicht umlagefähige Bewirtschaftungskosten und – je nach Berechnung – auch Kaufnebenkosten. Wichtig ist, bei Vergleichen immer dieselbe Definition zu verwenden.","actions":["lab"]},
    {"id":"investment-leverage","cat":"investment","q":"Was bedeutet der Leverage-Effekt bei Immobilien?","keys":["leverage immobilie","fremdkapital hebel","hebeleffekt immobilien"],"answer":"Leverage beschreibt den Effekt von Fremdkapital auf die Eigenkapitalrendite. Liegt die wirtschaftliche Objektverzinsung über den Fremdkapitalkosten, kann Fremdkapital die Eigenkapitalrendite erhöhen; bei schlechter Entwicklung wirkt der Hebel aber genauso in die negative Richtung.","actions":["lab","finanzierung"]},
    {"id":"investment-capex","cat":"investment","q":"Was bedeutet CapEx bei einer Immobilie?","keys":["capex immobilie","investitionsbedarf immobilie","sanierungskosten investment"],"answer":"CapEx sind größere Investitionen in Substanz und technische Anlagen, etwa Dach, Heizung, Fassade, Leitungen oder umfassende Wohnungsmodernisierungen. Für die Investmentrechnung sollten erwartbare CapEx separat vom laufenden Cashflow geplant werden.","actions":["lab","ankauf"]},
    {"id":"investment-mikrolage","cat":"investment","q":"Wie wichtig ist die Mikrolage bei einer Kapitalanlage?","keys":["mikrolage kapitalanlage","lage investment wohnung","standortanalyse immobilie"],"answer":"Sehr wichtig. Zwei Wohnungen im selben Stadtteil können wegen Straße, ÖPNV, Lärm, Nahversorgung, Bebauung und Zielgruppe unterschiedliche Vermietbarkeit und Preisentwicklung haben. Deshalb sollte eine Standortanalyse nicht auf Stadt- oder Bezirksebene enden.","actions":["lab","ankauf"]},
    {"id":"investment-exit","cat":"investment","q":"Warum sollte ich beim Kauf schon an den Exit denken?","keys":["exit strategie immobilie","wiederverkauf kapitalanlage","verkaufbarkeit investment"],"answer":"Die spätere Käufergruppe beeinflusst den heutigen Wert. Grundriss, Größe, Teilmarkt, Mietvertrag, WEG-Struktur und Finanzierbarkeit bestimmen, wie liquide ein Objekt später ist. Ein gutes Investment sollte deshalb nicht nur beim Einstieg, sondern auch beim möglichen Verkauf plausibel sein.","actions":["ankauf","lab"]},
    {"id":"investment-mietpotenzial","cat":"investment","q":"Wie bewerte ich Mietsteigerungspotenzial?","keys":["mietpotenzial","untervermietet","miete steigern kapitalanlage","sollmiete"],"answer":"Mietpotenzial sollte aus bestehendem Mietvertrag, ortsüblicher Vergleichsmiete, gesetzlichen Grenzen, Modernisierung, Neuvermietungsszenarien und realistischer Marktnachfrage abgeleitet werden. Eine theoretische Sollmiete ist kein sicherer zukünftiger Ertrag.","note":"Mietrechtliche Einzelfragen bitte rechtlich prüfen.","actions":["ankauf","lab"]},
    {"id":"investment-portfolio","cat":"investment","q":"Wie unterscheidet sich der Kauf eines Portfolios von einer einzelnen Wohnung?","keys":["immobilienportfolio kaufen","portfolio deal immobilien","mehrere wohnungen kaufen"],"answer":"Bei einem Portfolio steigt die Bedeutung von Datenqualität, Mieterliste, technischer Due Diligence, Konzentrationsrisiken, Finanzierungsstruktur und Transaktionsorganisation. Kennzahlen sollten sowohl je Einheit als auch auf Gesamtportfolioebene geprüft werden.","actions":["ankauf","finanzierung"]},
    {"id":"investment-dscr","cat":"investment","q":"Was bedeutet Schuldendienstdeckungsgrad bei Immobilien?","keys":["dscr immobilie","schuldendienstdeckungsgrad","debt service coverage ratio"],"answer":"Der Schuldendienstdeckungsgrad setzt den für den Schuldendienst verfügbaren Ertrag ins Verhältnis zu Zins und Tilgung. Werte über 1 bedeuten vereinfacht, dass der betrachtete Ertrag den Schuldendienst deckt; Banken und Investoren verwenden jedoch unterschiedliche Definitionen und Sicherheitsmargen.","actions":["lab","finanzierung"]},
    {"id":"miete-selbstauskunft","cat":"miete","q":"Welche Angaben gehören in eine Mieterselbstauskunft?","keys":["mieterselbstauskunft","selbstauskunft mieter","unterlagen wohnungsbewerbung"],"answer":"Typisch sind Identität, Haushaltsgröße, Beschäftigung bzw. Einkommen und weitere für das Mietverhältnis relevante Angaben. Welche Fragen zulässig und erforderlich sind, hängt vom Stadium der Vermietung und vom Einzelfall ab. Sensible Daten sollten nur zweckgebunden erhoben werden.","actions":["mieten","vermieten"]},
    {"id":"miete-schufa","cat":"miete","q":"Brauche ich für eine Mietwohnung eine SCHUFA-Auskunft?","keys":["schufa miete","bonitätsauskunft wohnung","schufa wohnungsbewerbung"],"answer":"Viele Vermieter möchten einen Bonitätsnachweis sehen. Welche Form verlangt wird, ist unterschiedlich. Neben einer SCHUFA-Auskunft können je nach Vermieter Einkommensnachweise und weitere Unterlagen relevant sein.","actions":["mieten"]},
    {"id":"miete-kaution-raten","cat":"miete","q":"Kann die Mietkaution in Raten gezahlt werden?","keys":["kaution in raten","mietkaution drei raten","kaution ratenzahlung"],"answer":"Bei Wohnraummietverhältnissen sieht § 551 BGB für eine vereinbarte Geldkaution grundsätzlich die Möglichkeit der Zahlung in drei gleichen monatlichen Teilzahlungen vor. Die erste Rate ist zu Beginn des Mietverhältnisses fällig.","note":"Keine Rechtsberatung.","actions":["mieten"]},
    {"id":"miete-haustiere","cat":"miete","q":"Darf ich Haustiere in der Mietwohnung halten?","keys":["haustiere mietwohnung","hund katze miete","tierhaltung mietvertrag"],"answer":"Das hängt von Tierart, Mietvertrag und Einzelfall ab. Pauschale Aussagen sind bei der Tierhaltung oft nicht sinnvoll; bei Hund oder Katze sollte die konkrete Regelung und gegebenenfalls die Zustimmung des Vermieters geprüft werden.","note":"Keine Rechtsberatung.","actions":["mieten"]},
    {"id":"miete-uebergabe","cat":"miete","q":"Was gehört in ein Wohnungsübergabeprotokoll?","keys":["übergabeprotokoll miete","wohnungsübergabe mieter","zählerstände protokoll"],"answer":"Ein Übergabeprotokoll sollte Zustand, erkennbare Mängel, Schlüsselanzahl sowie relevante Zählerstände dokumentieren. Fotos können die Dokumentation ergänzen. Beide Seiten sollten eine identische Fassung erhalten.","actions":["mieten","vermieten"]},
    {"id":"vermietung-mietpreis","cat":"miete","q":"Wie wird eine realistische Angebotsmiete festgelegt?","keys":["mietpreis festlegen","wohnung vermieten welche miete","angebotsmiete"],"answer":"Ausgangspunkt sind Lage, Zustand, Größe, Ausstattung, Vergleichsangebote und die rechtlichen Rahmenbedingungen des konkreten Mietverhältnisses. Eine maximale Portal-Miete ist nicht automatisch rechtlich zulässig oder wirtschaftlich optimal.","note":"Mietrechtliche Einzelfragen bitte rechtlich prüfen.","actions":["vermieten"]},
    {"id":"vermietung-bonitaet","cat":"miete","q":"Wie prüft man Mietinteressenten sinnvoll?","keys":["mieter bonität prüfen","mietinteressenten auswählen","mieterprüfung"],"answer":"Eine strukturierte Mieterauswahl verbindet vollständige Selbstauskunft, nachvollziehbare Einkommens-/Bonitätsunterlagen und persönliche Plausibilitätsprüfung. Dabei sollten Datenschutz, Gleichbehandlung und der Grundsatz der Datenminimierung beachtet werden.","actions":["vermieten"]},
    {"id":"vermietung-expose","cat":"miete","q":"Was gehört in ein gutes Vermietungsexposé?","keys":["vermietung expose","wohnungsanzeige vermieten","mietexpose"],"answer":"Ein gutes Exposé zeigt realistische Fotos, Grundriss, Lage, Größe, Zimmer, Mietkonditionen, Nebenkosten, Energieangaben und relevante Ausstattungsmerkmale. Ziel ist nicht maximale Anzahl an Anfragen, sondern möglichst passende Interessenten.","actions":["vermieten"]},
    {"id":"wissen-niessbrauch","cat":"wissen","q":"Was bedeutet Nießbrauch bei einer Immobilie?","keys":["nießbrauch immobilie","niessbrauch grundbuch","wohnung mit nießbrauch"],"answer":"Nießbrauch ist ein weitreichendes Nutzungsrecht, das dem Berechtigten regelmäßig die Nutzung und das Ziehen von Erträgen ermöglicht. Ein eingetragener Nießbrauch kann Wert, Nutzung und Finanzierbarkeit erheblich beeinflussen und sollte vor einem Kauf oder Verkauf rechtlich und wirtschaftlich geprüft werden.","note":"Keine Rechtsberatung."},
    {"id":"wissen-wohnrecht","cat":"wissen","q":"Was bedeutet ein eingetragenes Wohnrecht?","keys":["wohnrecht grundbuch","lebenslanges wohnrecht","immobilie mit wohnrecht"],"answer":"Ein dingliches Wohnrecht kann einer Person das Recht geben, eine Immobilie oder Teile davon zu bewohnen. Inhalt, Rang und Dauer sind für Marktwert und Finanzierung wesentlich. Die konkrete Grundbucheintragung sollte fachlich geprüft werden.","note":"Keine Rechtsberatung."},
    {"id":"wissen-vorkaufsrecht","cat":"wissen","q":"Was ist ein Vorkaufsrecht?","keys":["vorkaufsrecht immobilie","vorkaufsberechtigter","gemeindliches vorkaufsrecht"],"answer":"Ein Vorkaufsrecht kann einem Berechtigten ermöglichen, unter bestimmten Voraussetzungen in einen bereits vereinbarten Kauf einzutreten. Es gibt unterschiedliche gesetzliche und vertragliche Vorkaufsrechte; Reichweite und Verfahren hängen vom konkreten Recht ab.","note":"Keine Rechtsberatung."},
    {"id":"wissen-dienstbarkeit","cat":"wissen","q":"Was ist eine Grunddienstbarkeit?","keys":["grunddienstbarkeit","wegerecht grundbuch","leitungsrecht immobilie"],"answer":"Eine Grunddienstbarkeit belastet ein Grundstück zugunsten eines anderen Grundstücks, etwa durch Wege-, Leitungs- oder Nutzungsrechte. Sie kann Nutzung, Bebaubarkeit und Wert beeinflussen und sollte im Grundbuch sowie anhand der Bewilligungsunterlagen geprüft werden."},
    {"id":"wissen-altlasten","cat":"wissen","q":"Wie prüfe ich Altlasten bei einem Grundstück?","keys":["altlasten grundstück","altlastenkataster","bodenkontamination immobilie"],"answer":"Bei Grundstücken oder gewerblich vorgeprägten Standorten kann eine Auskunft aus dem zuständigen Altlasten- bzw. Bodeninformationssystem sinnvoll sein. Bei Verdachtsmomenten können zusätzliche historische Recherchen oder Bodenuntersuchungen erforderlich werden.","actions":["ankauf"]},
    {"id":"wissen-sanierungsgebiet","cat":"wissen","q":"Was bedeutet es, wenn eine Immobilie im Sanierungsgebiet liegt?","keys":["sanierungsgebiet immobilie","städtebauliches sanierungsgebiet","sanierungsvermerk grundbuch"],"answer":"In förmlich festgelegten Sanierungsgebieten können besondere Genehmigungs-, Ausgleichs- oder Verfahrensregeln gelten. Vor Kauf oder Verkauf sollte geprüft werden, welche konkreten Folgen sich aus Satzung, Grundbuch und zuständiger Behörde ergeben.","note":"Keine Rechtsberatung."},
    {"id":"wissen-milieuschutz","cat":"wissen","q":"Was bedeutet Milieuschutz bei einer Berliner Immobilie?","keys":["milieuschutz berlin","erhaltungsgebiet wohnung","soziale erhaltungsverordnung"],"answer":"In sozialen Erhaltungsgebieten können bestimmte bauliche Veränderungen, Nutzungsänderungen oder Aufteilungen zusätzlichen Genehmigungen unterliegen. Die genaue Rechtslage unterscheidet sich nach Gebiet und Vorhaben und sollte vor einer Investitionsentscheidung aktuell geprüft werden.","note":"Keine Rechtsberatung.","actions":["ankauf"]},
    {"id":"fg-beratungskosten","cat":"fg","q":"Kostet ein erstes Gespräch mit Fischer & Geserich etwas?","keys":["erstgespräch kosten","beratung kosten f&g","termin kostenlos"],"answer":"Für die konkrete Zusammenarbeit unterscheiden sich Vergütung und Leistungsumfang nach Auftrag – etwa Verkauf, Vermietung, Ankaufsberatung oder Finanzierung. Vor einer Beauftragung sollten Umfang und mögliche Kosten transparent geklärt werden. Für die verbindliche Einordnung Ihres Falls sprechen Sie am besten direkt mit uns.","actions":["kontakt"]},
    {"id":"fg-deutschlandweit","cat":"fg","q":"Wann ist F&G deutschlandweit tätig?","keys":["deutschlandweit tätig","außerhalb kernmarkt","bundesweit immobilien"],"answer":"Unsere Kernmärkte sind Berlin, Leipzig, Dresden und der Berliner Speckgürtel. Abhängig von Immobilienart, Mandatsumfang und Transaktionsvolumen prüfen wir ausgewählte Verkaufs-, Ankaufs- und Finanzierungsvorhaben auch deutschlandweit.","actions":["kontakt"]},
    {"id":"fg-speckguertel","cat":"fg","q":"Welche Standorte zählen bei F&G zum Berliner Speckgürtel?","keys":["speckgürtel standorte","berliner umland f&g","potsdam oranienburg teltow erkner"],"answer":"Zu unserem erweiterten Marktgebiet im Berliner Speckgürtel zählen unter anderem Potsdam, Oranienburg, Birkenwerder, Teltow, Königs Wusterhausen, Erkner und Eberswalde. Weitere Standorte im Umland prüfen wir objektspezifisch.","actions":["kontakt"]}
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
    sachsen:['leipzig','dresden'], unterlagen:['dokumente','nachweise'], bewertung:['wert','marktwert','verkehrswert'], termin:['gespräch','telefonat','teams'], schnell:['dringend','zeitnah','sofort']
  };

  const CORE_MARKETS = new Set(['berlin','leipzig','dresden']);
  const SPECKGUERTEL = new Set(['potsdam','oranienburg','birkenwerder','teltow','konigs wusterhausen','königs wusterhausen','kw','erkner','eberswalde']);
  const LOCATION_ALIASES = [
    ['Berlin','berlin'],['Leipzig','leipzig'],['Dresden','dresden'],['Brandenburg','brandenburg'],['Sachsen','sachsen'],['Potsdam','potsdam'],['Oranienburg','oranienburg'],['Birkenwerder','birkenwerder'],['Teltow','teltow'],['Königs Wusterhausen','königs wusterhausen'],['Königs Wusterhausen','konigs wusterhausen'],['Königs Wusterhausen','kw'],['Erkner','erkner'],['Eberswalde','eberswalde'],
    ['Hamburg','hamburg'],['München','münchen'],['München','munchen'],['Köln','köln'],['Köln','koln'],['Frankfurt am Main','frankfurt am main'],['Frankfurt am Main','frankfurt'],['Düsseldorf','düsseldorf'],['Düsseldorf','dusseldorf'],['Stuttgart','stuttgart'],['Hannover','hannover'],['Bremen','bremen'],['Dortmund','dortmund'],['Essen','essen'],['Nürnberg','nürnberg'],['Nürnberg','nurnberg'],['Augsburg','augsburg'],['Freiburg','freiburg'],['Kiel','kiel'],['Rostock','rostock'],['Magdeburg','magdeburg'],['Erfurt','erfurt'],['Jena','jena'],['Chemnitz','chemnitz'],['Halle','halle'],['Mainz','mainz'],['Wiesbaden','wiesbaden'],['Mannheim','mannheim'],['Karlsruhe','karlsruhe'],['Bonn','bonn'],['Münster','münster'],['Münster','munster']
  ];
  const RELATED_BY_CAT = {
    kaufen:['Wie läuft ein Immobilienkauf typischerweise ab?','Welche Unterlagen sollte ich vor dem Kauf prüfen?','Wie kann ich ein Kaufgesuch anlegen?'],
    verkaufen:['Wie wird ein realistischer Verkaufspreis ermittelt?','Welche Unterlagen brauche ich als Verkäufer?','Wie läuft ein professioneller Immobilienverkauf ab?','Wie wird ein Makler vergütet?'],
    finanzierung:['Wie viel Eigenkapital sollte ich einbringen?','Welche Unterlagen braucht die Bank?','Wie berechnet sich die Monatsrate?'],
    investment:['Wie prüfe ich eine Kapitalanlage sinnvoll?','Was ist die Bruttomietrendite?','Was bedeutet Cashflow bei einer Kapitalanlage?'],
    miete:['Wie kann ich ein Mietgesuch bei F&G anlegen?','Wie hoch darf eine Mietkaution bei Wohnraum sein?','Wie läuft eine Vermietung über F&G ab?'],
    kosten:['Welche Kaufnebenkosten fallen beim Immobilienkauf an?','Wann wird die Maklerprovision fällig?','Wie hoch sind Notar- und Grundbuchkosten?'],
    unterlagen:['Welche Unterlagen brauche ich als Verkäufer?','Welche Unterlagen sollte ich vor dem Kauf prüfen?','Welche Unterlagen braucht die Bank?'],
    wissen:['Was ist eine Auflassungsvormerkung?','Was ist eine Grundschuld?','Was ist bei einem Mehrfamilienhaus besonders wichtig?'],
    fg:['Welche Leistungen bietet Fischer & Geserich?','In welchen Regionen ist Fischer & Geserich tätig?','Wie erreiche ich Fischer & Geserich?']
  };
  const ENTRY_GATES = {
    'vermietet-verkaufen': /vermiet|mieter/,
    'makler-miete': /miet|bestellerprinzip/,
    'spekulationssteuer': /steuer|gewinn|halte|10 jahr|zehn jahr/,
    'zwangsversteigerung': /zwangs|versteiger/,
    'erbbaurecht': /erbba|erbpacht/,
    'mietsteigerung': /miete.*erhoh|mieterhoh|mietsteiger/
  };

  const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  function extractLocation(raw){
    const nq=normalize(raw);
    for(const [label,alias] of LOCATION_ALIASES){
      const na=normalize(alias);
      if(new RegExp(`(^|\\s)${na.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}(?=\\s|$)`).test(nq)) return label;
    }
    const m=String(raw||'').match(/\bin\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+){0,2})/);
    return m ? m[1].trim() : '';
  }

  function locationClass(location){
    const n=normalize(location);
    if(CORE_MARKETS.has(n)) return 'core';
    if(SPECKGUERTEL.has(n)) return 'speckguertel';
    return location ? 'national' : 'unknown';
  }

  function locationCoverageHtml(location, purpose='Vorhaben'){
    const cls=locationClass(location);
    if(cls==='core') return `<p><strong>${escapeHtml(location)} gehört zu unseren Kernmärkten.</strong> Dort begleiten wir Immobilienvorhaben direkt – je nach Objekt vom Verkauf über Ankaufsberatung bis zur Finanzierung.</p>`;
    if(cls==='speckguertel') return `<p><strong>${escapeHtml(location)} zählt zu unserem Marktgebiet im Berliner Speckgürtel.</strong> Vorhaben dort können wir grundsätzlich direkt einordnen und begleiten.</p>`;
    if(cls==='national') return `<p><strong>${escapeHtml(location)} liegt außerhalb unserer vier Kernmärkte Berlin, Leipzig, Dresden und Berliner Speckgürtel.</strong> Das schließt ein Mandat nicht aus: Abhängig von Immobilienart, Transaktionsvolumen und Aufgabenstellung sind wir bei ausgewählten ${escapeHtml(purpose)} auch deutschlandweit tätig. Wir prüfen deshalb zuerst, ob Objekt und Mandat zu unserem Leistungsprofil passen.</p>`;
    return `<p>Unsere Kernmärkte sind <strong>Berlin, Leipzig, Dresden und der Berliner Speckgürtel</strong>. Abhängig von Immobilienart, Mandat und Transaktionsvolumen begleiten wir ausgewählte Vorhaben auch deutschlandweit.</p>`;
  }

  function propertyTypeFrom(text){
    const n=normalize(text);
    if(/mehrfamilienhaus|\bmfh\b|zinshaus|wohn-? und geschaftshaus|wohn und geschaftshaus/.test(n)) return 'Mehrfamilienhaus / Investmentobjekt';
    if(/eigentumswohnung|\betw\b|wohnung/.test(n)) return 'Eigentumswohnung';
    if(/einfamilienhaus|\befh\b|villa|reihenhaus|doppelhaushalfte|haus/.test(n)) return 'Haus';
    if(/grundstuck|bauland/.test(n)) return 'Grundstück';
    if(/gewerbe|laden|buro|halle|hotel/.test(n)) return 'Gewerbeimmobilie';
    return '';
  }

  function occupancyFrom(text){
    const n=normalize(text);
    if(/teilvermiet/.test(n)) return 'teilvermietet';
    if(/vermiet|mieter/.test(n)) return 'vermietet';
    if(/eigengenutzt|selbst genutzt|selbstgenutzt|frei|leerstand|leer/.test(n)) return 'frei / eigengenutzt';
    return '';
  }

  function looksLikeQuestion(text){
    const n=normalize(text);
    return /^(wie|was|wer|wann|warum|wieso|weshalb|wo|welche|welcher|welches|kann|konnen|darf|muss|ist|sind|gibt|kostet|zahlt)\b/.test(n) || String(text||'').includes('?');
  }

  const CONTACT_EMAIL = 'info@fg-realestate.de';
  const CONTACT_PHONE = '+4915203083048';
  const CONTACT_PHONE_DISPLAY = '0152 03083048';

  function cleanForMail(value){
    return String(value ?? '').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
  }
  function stateSummaryText(extra=''){
    const d=dialogState?.data||{};
    const labels={location:'Standort',propertyType:'Immobilientyp',occupancy:'Nutzung',reason:'Ziel/Anlass',timing:'Zeitrahmen',price:'Preisvorstellung',purpose:'Nutzung',budget:'Budget',equity:'Eigenkapital',objectStatus:'Objektstatus',financingStatus:'Finanzierungsstatus',rooms:'Zimmer/Größe',maxRent:'Max. Miete',moveIn:'Einzug',household:'Haushalt',targetRent:'Zielmiete',employment:'Beschäftigung',applicants:'Darlehensnehmer',residence:'Aufenthalt',monthlyRate:'Max. Rate',goal:'Investmentziel',details:'Weitere Angaben'};
    const lines=[];
    Object.entries(d).forEach(([k,v])=>{if(v && labels[k]) lines.push(`${labels[k]}: ${cleanForMail(v)}`);});
    if(extra) lines.push(`Frage/Notiz: ${cleanForMail(extra)}`);
    return lines.length?lines.join('\n'):'Noch keine Eckdaten erfasst.';
  }
  function contactHandoffHtml(query='', intro='Diese Frage kann ich ohne persönliche Einordnung nicht zuverlässig beantworten.'){
    const subject='Anfrage über den F&G Immobilienassistenten';
    const body=`Guten Tag Fischer & Geserich Team,\n\nich habe eine Frage bzw. ein Vorhaben über den Website-Assistenten:\n\n${stateSummaryText(query)}\n\nBitte melden Sie sich bei mir.\n`;
    const mail=`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return `<div class="fg-ai-handoff"><p><strong>${escapeHtml(intro)}</strong></p><p>Damit Sie keine unpassende Standardantwort erhalten, geben wir hier direkt an unser Team ab.</p><div class="fg-ai-actions"><a class="fg-ai-action is-gold" href="${mail}"><i class="fas fa-envelope"></i>E-Mail schreiben</a><a class="fg-ai-action is-call" href="tel:${CONTACT_PHONE}"><i class="fas fa-phone"></i>${CONTACT_PHONE_DISPLAY}</a></div><div class="fg-ai-note">Ihre bisher erfassten Eckdaten werden nur dann in die E-Mail übernommen, wenn Sie den E-Mail-Button selbst öffnen und versenden.</div></div>`;
  }
  function completeFlowHtml(title,nextText,actions=[]){
    const d=dialogState.data||{};
    const pairs=[['Standort',d.location],['Objekt',d.propertyType],['Nutzung',d.purpose||d.occupancy],['Budget/Kaufpreis',d.budget||d.price],['Eigenkapital',d.equity],['Zeitrahmen',d.timing]].filter(x=>x[1]);
    const summary=pairs.length?`<div class="fg-ai-summary">${pairs.slice(0,6).map(([a,b])=>`<div><small>${escapeHtml(a)}</small><strong>${escapeHtml(b)}</strong></div>`).join('')}</div>`:'';
    return `<span class="fg-ai-kicker">${escapeHtml(title)}</span>${summary}<p>${nextText}</p>${actionHtml(actions)}${contactHandoffHtml('', 'Sie möchten die Angaben direkt an uns weitergeben?')}`;
  }
  function valueFromOptions(text, options){
    const n=normalize(text);
    for(const [label,rx] of options){if(rx.test(n)) return label;}
    return '';
  }
  function plainLocation(text){
    const found=extractLocation(text); if(found) return found;
    const raw=String(text||'').trim();
    if(raw && raw.length<60 && !/[?]/.test(raw) && !/^\d/.test(raw)) return raw.replace(/^(in|aus)\s+/i,'').trim();
    return '';
  }
  function isExplicitSellIntent(text){
    const n=normalize(text);
    return /\b(ich|wir)\s+(mochte|mochten|will|wollen|plane|planen|muss|mussen)\b.*\b(verkaufen|veraussern)\b/.test(n) || /\b(meine|unsere|ein|eine)\s+(immobilie|wohnung|haus|mfh|mehrfamilienhaus|grundstuck|objekt)\b.*\bverkaufen\b/.test(n) || /\bverkaufsanfrage\b/.test(n);
  }
  function isExplicitBuyIntent(text){
    const n=normalize(text);
    return /\b(ich|wir)\s+(mochte|mochten|will|wollen|plane|planen|suche|suchen)\b.*\b(kaufen|erwerben|kaufimmobilie|eigentumswohnung|haus)\b/.test(n) || /\b(kaufgesuch|immobilie zum kauf|wohnung zum kauf)\b/.test(n);
  }
  function isExplicitRentIntent(text){
    const n=normalize(text);
    return /\b(ich|wir)\s+(mochte|mochten|will|wollen|suche|suchen|brauche|benotige)\b.*\b(mieten|mietwohnung|wohnung zur miete|haus zur miete)\b/.test(n) || /\bmietgesuch\b/.test(n);
  }
  function isExplicitLetIntent(text){
    const n=normalize(text);
    return /\b(ich|wir)\s+(mochte|mochten|will|wollen|plane|planen|muss|mussen)\b.*\bvermieten\b/.test(n) || /\b(mieter suchen|vermietungsanfrage)\b/.test(n);
  }
  function isExplicitFinanceIntent(text){
    const n=normalize(text);
    return /\b(ich|wir)\s+(brauche|benotige|mochte|mochten|will|wollen|suche|suchen)\b.*\b(finanzierung|darlehen|kredit|baufinanzierung)\b/.test(n) || /\bfinanzierung\s+(prufen|anfragen|machen|brauchen)\b/.test(n);
  }
  function isExplicitInvestmentIntent(text){
    const n=normalize(text);
    return /\b(ich|wir)\s+(mochte|mochten|will|wollen|plane|planen|suche|suchen)\b.*\b(kapitalanlage|investment|renditeobjekt|anlageimmobilie|investieren)\b/.test(n) || /\bkapitalanlage\s+(kaufen|suchen|prufen)\b/.test(n);
  }
  function isExplicitValuationIntent(text){
    const n=normalize(text);
    return /\b(wert|marktwert|verkehrswert|bewertung)\b.*\b(immobilie|wohnung|haus|grundstuck)\b/.test(n) || /\bwas ist (meine|unsere).*wert\b/.test(n);
  }
  function asksCoverage(text){
    const n=normalize(text);
    return /bildet.*fischer|bildet.*f&g|seid ihr.*tatig|arbeitet ihr|konnt ihr|ubernehmt ihr|macht ihr|region|standort|deutschlandweit|außerhalb|ausserhalb/.test(n);
  }
  function asksDirectContact(text){
    const n=normalize(text);
    return /anrufen|telefon|telefonieren|ruckruf|rückruf|email|e-mail|mail schreiben|kontaktieren|ansprechpartner|mitarbeiter sprechen/.test(n);
  }

  function flowMessage(kicker,body,choices=[],note=''){
    addMessage('assistant',`<span class="fg-ai-kicker">${escapeHtml(kicker)}</span>${body}${choices.length?suggestionsHtml(choices):''}${note?`<div class="fg-ai-note">${note}</div>`:''}`);
    saveSession();
  }

  function sellFlowStart(raw=''){
    const location=extractLocation(raw), type=propertyTypeFrom(raw), occ=occupancyFrom(raw);
    dialogState={flow:'sell',stage:'',data:{location:location||'',propertyType:type||'',occupancy:occ||''}};
    flowMessage('Verkauf konkretisieren', locationCoverageHtml(location,'Verkaufsmandaten')+'<p>Ich führe Sie kurz durch die Punkte, die für eine erste Einordnung wirklich relevant sind.</p>');
    if(!dialogState.data.location){dialogState.stage='location';flowMessage('1 · Standort','<p>Wo befindet sich die Immobilie?</p>',[], 'Ort oder Stadtteil reicht zunächst.');return;}
    if(!type){dialogState.stage='propertyType';flowMessage('2 · Immobilientyp','<p>Um welche Art Immobilie handelt es sich?</p>',['Eigentumswohnung','Haus','Mehrfamilienhaus / Investmentobjekt','Grundstück','Gewerbeimmobilie']);return;}
    if(!occ){dialogState.stage='occupancy';flowMessage('3 · Nutzung','<p>Wie wird die Immobilie aktuell genutzt?</p>',['frei / eigengenutzt','vermietet','teilvermietet']);return;}
    dialogState.stage='reason'; flowMessage('4 · Verkaufsziel','<p>Was ist Ihnen beim Verkauf am wichtigsten?</p>',['bestmöglicher Preis','schneller Verkauf','diskrete Vermarktung','erst einmal Marktwert kennen','Erbschaft / Nachlass','Trennung / Neuordnung']);
  }
  function advanceSell(){
    const d=dialogState.data;
    if(!d.propertyType){dialogState.stage='propertyType';flowMessage('2 · Immobilientyp','<p>Um welche Art Immobilie handelt es sich?</p>',['Eigentumswohnung','Haus','Mehrfamilienhaus / Investmentobjekt','Grundstück','Gewerbeimmobilie']);return;}
    if(!d.occupancy){dialogState.stage='occupancy';flowMessage('3 · Nutzung','<p>Wie wird die Immobilie aktuell genutzt?</p>',['frei / eigengenutzt','vermietet','teilvermietet']);return;}
    if(!d.reason){dialogState.stage='reason';flowMessage('4 · Verkaufsziel','<p>Was ist Ihnen beim Verkauf am wichtigsten?</p>',['bestmöglicher Preis','schneller Verkauf','diskrete Vermarktung','erst einmal Marktwert kennen','Erbschaft / Nachlass','Trennung / Neuordnung']);return;}
    if(!d.timing){dialogState.stage='timing';flowMessage('5 · Zeitrahmen','<p>In welchem Zeitraum soll eine Entscheidung fallen?</p>',['sofort / innerhalb 3 Monate','3–6 Monate','6–12 Monate','noch offen / zunächst beraten']);return;}
    if(!d.price){dialogState.stage='price';flowMessage('6 · Preis & Bewertung','<p>Gibt es bereits eine Preisvorstellung oder wünschen Sie zunächst eine Marktwerteinschätzung?</p>',['Preisvorstellung vorhanden','Marktwert noch offen','bereits Maklerbewertung vorhanden']);return;}
    dialogState.stage='details'; flowMessage('7 · Eckdaten',`<p>Letzter Schritt: Nennen Sie gern die wichtigsten Eckdaten in einer Nachricht.</p><p>${d.propertyType?.startsWith('Mehrfamilienhaus')?'Hilfreich: Anzahl Einheiten, Fläche, Jahresnettokaltmiete, Leerstand und grober Zustand.':'Hilfreich: Fläche, Zimmer, Baujahr/Zustand und besondere Merkmale.'}</p>`,[], 'Sie können diesen Punkt auch mit „überspringen“ abschließen.');
  }
  function handleSellFlow(text){
    if(dialogState.flow!=='sell' || looksLikeQuestion(text)) return false;
    const d=dialogState.data, st=dialogState.stage;
    if(st==='location'){const v=plainLocation(text);if(!v){flowMessage('Standort','<p>Den Standort konnte ich nicht sicher erkennen.</p>');addMessage('assistant',contactHandoffHtml(text));return true;}d.location=v;addMessage('assistant',locationCoverageHtml(v,'Verkaufsmandaten'));advanceSell();return true;}
    if(st==='propertyType'){const v=propertyTypeFrom(text)||valueFromOptions(text,[['Eigentumswohnung',/eigentumswohnung|wohnung/],['Haus',/haus|villa|reihen|doppel/],['Mehrfamilienhaus / Investmentobjekt',/mehrfamilien|mfh|zinshaus|investment/],['Grundstück',/grundstuck|bauland/],['Gewerbeimmobilie',/gewerbe|halle|laden|buro|hotel/]]);if(!v){flowMessage('Immobilientyp','<p>Das konnte ich nicht eindeutig zuordnen.</p>',['Eigentumswohnung','Haus','Mehrfamilienhaus / Investmentobjekt','Grundstück','Gewerbeimmobilie']);return true;}d.propertyType=v;advanceSell();return true;}
    if(st==='occupancy'){const v=occupancyFrom(text);if(!v){flowMessage('Nutzung','<p>Bitte wählen Sie die aktuelle Nutzung.</p>',['frei / eigengenutzt','vermietet','teilvermietet']);return true;}d.occupancy=v;advanceSell();return true;}
    if(st==='reason'){d.reason=String(text).trim();advanceSell();return true;}
    if(st==='timing'){d.timing=String(text).trim();advanceSell();return true;}
    if(st==='price'){d.price=String(text).trim();advanceSell();return true;}
    if(st==='details'){d.details=/uberspringen|überspringen/.test(normalize(text))?'':String(text).trim();dialogState.stage='complete';addMessage('assistant',completeFlowHtml('Verkauf – erste Einordnung','Für eine belastbare Preis- und Vermarktungsempfehlung sollte unser Team die Objektunterlagen und Ihre Zielsetzung persönlich prüfen.',['verkaufen']));saveSession();return true;}
    return false;
  }

  function buyFlowStart(raw=''){
    const location=extractLocation(raw), type=propertyTypeFrom(raw);
    dialogState={flow:'buy',stage:'purpose',data:{location:location||'',propertyType:type||''}};
    flowMessage('Kaufvorhaben','<p>Ich ordne kurz ein, ob eher Kaufgesuch, Ankaufsberatung oder Finanzierung der richtige nächste Schritt ist.</p><p>Geht es um <strong>Eigennutzung</strong> oder eine <strong>Kapitalanlage</strong>?</p>',['Eigennutzung','Kapitalanlage']);
  }
  function advanceBuy(){
    const d=dialogState.data;
    if(!d.location){dialogState.stage='location';flowMessage('2 · Suchgebiet','<p>Wo möchten Sie kaufen?</p>');return;}
    if(!d.propertyType){dialogState.stage='propertyType';flowMessage('3 · Immobilientyp','<p>Was suchen Sie?</p>',['Eigentumswohnung','Haus','Mehrfamilienhaus / Investmentobjekt','Grundstück','Gewerbeimmobilie']);return;}
    if(!d.budget){dialogState.stage='budget';flowMessage('4 · Budget','<p>In welcher Kaufpreisspanne suchen Sie ungefähr?</p>',['bis 250.000 €','250.000–500.000 €','500.000–1 Mio. €','über 1 Mio. €','noch offen']);return;}
    if(!d.objectStatus){dialogState.stage='objectStatus';flowMessage('5 · Objektstatus','<p>Haben Sie bereits ein konkretes Objekt?</p>',['Ja, konkretes Objekt vorhanden','Nein, ich suche noch','Mehrere Objekte im Vergleich']);return;}
    if(!d.financingStatus){dialogState.stage='financingStatus';flowMessage('6 · Finanzierung','<p>Wie weit ist die Finanzierung geklärt?</p>',['noch nicht geprüft','Budget grob geprüft','Finanzierungsbestätigung vorhanden','Kauf aus Eigenmitteln']);return;}
    if(!d.timing){dialogState.stage='timing';flowMessage('7 · Zeitplan','<p>Wann möchten Sie idealerweise kaufen?</p>',['sofort / bis 3 Monate','3–6 Monate','6–12 Monate','noch offen']);return;}
    dialogState.stage='complete';
    const acts=/konkretes|vergleich/.test(normalize(d.objectStatus))?['ankauf','finanzierung']:['kaufen','ankauf'];
    addMessage('assistant',completeFlowHtml('Kauf – nächste Schritte', d.purpose==='Kapitalanlage'?'Bei Kapitalanlagen sollten Objektwirtschaftlichkeit, Finanzierung, Miet-/Kostenstruktur und Exit gemeinsam geprüft werden.':'Bei Eigennutzung stehen Tragbarkeit, Objektqualität, Lage und langfristige persönliche Planung im Mittelpunkt.',acts));saveSession();
  }
  function handleBuyFlow(text){
    if(dialogState.flow!=='buy' || looksLikeQuestion(text)) return false; const d=dialogState.data,st=dialogState.stage;
    if(st==='purpose'){const v=valueFromOptions(text,[['Eigennutzung',/eigennutz|selbst|wohnen/],['Kapitalanlage',/kapital|investment|vermiet|rendite/]]);if(!v){flowMessage('Nutzung','<p>Bitte wählen Sie Eigennutzung oder Kapitalanlage.</p>',['Eigennutzung','Kapitalanlage']);return true;}d.purpose=v;advanceBuy();return true;}
    if(st==='location'){const v=plainLocation(text);if(!v){addMessage('assistant',contactHandoffHtml(text,'Den gewünschten Standort konnte ich nicht sicher erkennen.'));return true;}d.location=v;addMessage('assistant',locationCoverageHtml(v,'Ankaufsmandaten'));advanceBuy();return true;}
    if(st==='propertyType'){const v=propertyTypeFrom(text);if(!v){flowMessage('Immobilientyp','<p>Bitte wählen Sie einen Immobilientyp.</p>',['Eigentumswohnung','Haus','Mehrfamilienhaus / Investmentobjekt','Grundstück','Gewerbeimmobilie']);return true;}d.propertyType=v;advanceBuy();return true;}
    if(st==='budget'){d.budget=String(text).trim();advanceBuy();return true;}
    if(st==='objectStatus'){d.objectStatus=String(text).trim();advanceBuy();return true;}
    if(st==='financingStatus'){d.financingStatus=String(text).trim();advanceBuy();return true;}
    if(st==='timing'){d.timing=String(text).trim();advanceBuy();return true;}
    return false;
  }

  function rentFlowStart(raw=''){
    dialogState={flow:'rent',stage:'location',data:{location:extractLocation(raw)||''}};
    if(dialogState.data.location){dialogState.stage='propertyType';flowMessage('Mietgesuch','<p>Welche Art Immobilie suchen Sie?</p>',['Wohnung','Haus']);}
    else flowMessage('Mietgesuch','<p>In welchem Ort bzw. Suchgebiet möchten Sie mieten?</p>');
  }
  function advanceRent(){const d=dialogState.data;if(!d.propertyType){dialogState.stage='propertyType';flowMessage('2 · Immobilientyp','<p>Was möchten Sie mieten?</p>',['Wohnung','Haus']);return;}if(!d.rooms){dialogState.stage='rooms';flowMessage('3 · Größe','<p>Wie viele Zimmer bzw. welche Mindestgröße benötigen Sie?</p>');return;}if(!d.maxRent){dialogState.stage='maxRent';flowMessage('4 · Budget','<p>Wie hoch darf die monatliche Warm- oder Nettokaltmiete maximal sein?</p>');return;}if(!d.moveIn){dialogState.stage='moveIn';flowMessage('5 · Einzug','<p>Ab wann suchen Sie?</p>',['sofort','innerhalb 1–3 Monate','später / flexibel']);return;}if(!d.household){dialogState.stage='household';flowMessage('6 · Haushalt','<p>Wie viele Personen ziehen ein? Haustiere oder besondere Anforderungen können Sie gern ergänzen.</p>');return;}dialogState.stage='complete';addMessage('assistant',completeFlowHtml('Mietgesuch – vorbereitet','Die Eckdaten können Sie jetzt direkt in unser getrenntes Mietgesuch übernehmen.',['mieten']));saveSession();}
  function handleRentFlow(text){if(dialogState.flow!=='rent'||looksLikeQuestion(text))return false;const d=dialogState.data,st=dialogState.stage;if(st==='location'){const v=plainLocation(text);if(!v){addMessage('assistant',contactHandoffHtml(text));return true;}d.location=v;advanceRent();return true;}if(st==='propertyType'){d.propertyType=/haus/.test(normalize(text))?'Haus':'Wohnung';advanceRent();return true;}if(st==='rooms'){d.rooms=String(text).trim();advanceRent();return true;}if(st==='maxRent'){d.maxRent=String(text).trim();advanceRent();return true;}if(st==='moveIn'){d.moveIn=String(text).trim();advanceRent();return true;}if(st==='household'){d.household=String(text).trim();advanceRent();return true;}return false;}

  function letFlowStart(raw=''){
    dialogState={flow:'let',stage:'location',data:{location:extractLocation(raw)||'',propertyType:propertyTypeFrom(raw)||''}};
    if(dialogState.data.location){dialogState.stage='propertyType';advanceLet();} else flowMessage('Vermietung','<p>Wo befindet sich die Immobilie?</p>');
  }
  function advanceLet(){const d=dialogState.data;if(!d.propertyType){dialogState.stage='propertyType';flowMessage('2 · Immobilientyp','<p>Was möchten Sie vermieten?</p>',['Eigentumswohnung','Haus','Gewerbeimmobilie']);return;}if(!d.details){dialogState.stage='details';flowMessage('3 · Eckdaten','<p>Wie groß ist die Immobilie ungefähr? Nennen Sie gern Fläche, Zimmer und aktuellen Zustand.</p>');return;}if(!d.timing){dialogState.stage='timing';flowMessage('4 · Vermietungsstart','<p>Ab wann soll vermietet werden?</p>',['sofort','innerhalb 1–3 Monate','später / flexibel']);return;}if(!d.targetRent){dialogState.stage='targetRent';flowMessage('5 · Mietpreis','<p>Gibt es bereits eine gewünschte Nettokaltmiete?</p>',['Mietvorstellung vorhanden','Miete soll von F&G eingeordnet werden']);return;}dialogState.stage='complete';addMessage('assistant',completeFlowHtml('Vermietung – erste Einordnung','Als Nächstes sollten Objektunterlagen, rechtlich zulässige Mietstruktur und Zielgruppe konkret geprüft werden.',['vermieten']));saveSession();}
  function handleLetFlow(text){if(dialogState.flow!=='let'||looksLikeQuestion(text))return false;const d=dialogState.data,st=dialogState.stage;if(st==='location'){const v=plainLocation(text);if(!v){addMessage('assistant',contactHandoffHtml(text));return true;}d.location=v;advanceLet();return true;}if(st==='propertyType'){const v=propertyTypeFrom(text)||(/wohnung/.test(normalize(text))?'Eigentumswohnung':'');if(!v){flowMessage('Immobilientyp','<p>Bitte wählen Sie einen Immobilientyp.</p>',['Eigentumswohnung','Haus','Gewerbeimmobilie']);return true;}d.propertyType=v;advanceLet();return true;}if(st==='details'){d.details=String(text).trim();advanceLet();return true;}if(st==='timing'){d.timing=String(text).trim();advanceLet();return true;}if(st==='targetRent'){d.targetRent=String(text).trim();advanceLet();return true;}return false;}

  function financeFlowStart(raw=''){
    dialogState={flow:'finance',stage:'objectStatus',data:{location:extractLocation(raw)||''}};
    flowMessage('Finanzierung','<p>Ich führe Sie durch die wichtigsten Punkte, damit wir danach wissen, welche Finanzierungsprüfung sinnvoll ist.</p><p>Gibt es bereits ein konkretes Objekt?</p>',['Ja, Objekt vorhanden','Nein, ich möchte mein Budget kennen','Kaufvertrag bereits in Vorbereitung']);
  }
  function advanceFinance(){const d=dialogState.data;if(!d.purpose){dialogState.stage='purpose';flowMessage('2 · Nutzung','<p>Eigennutzung oder Kapitalanlage?</p>',['Eigennutzung','Kapitalanlage']);return;}if(!d.price){dialogState.stage='price';flowMessage('3 · Kaufpreis/Budget','<p>Wie hoch ist der Kaufpreis bzw. das gewünschte Kaufbudget ungefähr?</p>');return;}if(!d.equity){dialogState.stage='equity';flowMessage('4 · Eigenkapital','<p>Wie viel Eigenkapital möchten oder können Sie maximal einbringen?</p>',['unter 25.000 €','25.000–75.000 €','75.000–150.000 €','über 150.000 €','noch offen']);return;}if(!d.employment){dialogState.stage='employment';flowMessage('5 · Einkommen','<p>Welche berufliche Situation trifft hauptsächlich zu?</p>',['angestellt unbefristet','angestellt befristet','selbstständig / freiberuflich','Beamter / öffentlicher Dienst','Rente / Pension','sonstiges']);return;}if(!d.applicants){dialogState.stage='applicants';flowMessage('6 · Antragsteller','<p>Wer soll das Darlehen aufnehmen?</p>',['ich allein','gemeinsam mit Ehe-/Lebenspartner','noch offen']);return;}if(!d.residence){dialogState.stage='residence';flowMessage('7 · Aufenthalt','<p>Falls relevant: Wie ist Ihr Aufenthaltsstatus in Deutschland?</p>',['deutsche/EU-Staatsangehörigkeit','unbefristeter Aufenthaltstitel','befristeter Aufenthaltstitel','nicht relevant / möchte ich persönlich klären']);return;}if(!d.monthlyRate){dialogState.stage='monthlyRate';flowMessage('8 · Wunschrate','<p>Gibt es eine maximale gewünschte monatliche Bankrate?</p>',['noch offen','unter 1.500 €','1.500–2.500 €','2.500–4.000 €','über 4.000 €']);return;}dialogState.stage='complete';addMessage('assistant',completeFlowHtml('Finanzierung – Vorprüfung vorbereitet','Für die belastbare Bankprüfung benötigen wir anschließend Selbstauskunft, Einkommens-/Vermögensnachweise und – bei einem konkreten Kauf – die Objektunterlagen.',['finanzierung']));saveSession();}
  function handleFinanceFlow(text){if(dialogState.flow!=='finance'||looksLikeQuestion(text))return false;const d=dialogState.data,st=dialogState.stage;if(st==='objectStatus'){d.objectStatus=String(text).trim();advanceFinance();return true;}if(st==='purpose'){const v=valueFromOptions(text,[['Eigennutzung',/eigennutz|selbst/],['Kapitalanlage',/kapital|investment|vermiet/]]);if(!v){flowMessage('Nutzung','<p>Bitte Eigennutzung oder Kapitalanlage wählen.</p>',['Eigennutzung','Kapitalanlage']);return true;}d.purpose=v;advanceFinance();return true;}if(st==='price'){d.price=String(text).trim();advanceFinance();return true;}if(st==='equity'){d.equity=String(text).trim();advanceFinance();return true;}if(st==='employment'){d.employment=String(text).trim();advanceFinance();return true;}if(st==='applicants'){d.applicants=String(text).trim();advanceFinance();return true;}if(st==='residence'){d.residence=String(text).trim();advanceFinance();return true;}if(st==='monthlyRate'){d.monthlyRate=String(text).trim();advanceFinance();return true;}return false;}

  function investmentFlowStart(raw=''){
    dialogState={flow:'investment',stage:'objectStatus',data:{location:extractLocation(raw)||'',propertyType:propertyTypeFrom(raw)||''}};
    flowMessage('Kapitalanlage','<p>Möchten Sie ein konkretes Investment prüfen oder suchen Sie zunächst nach passenden Objekten?</p>',['konkretes Objekt prüfen','Kapitalanlage suchen','mehrere Objekte vergleichen']);
  }
  function advanceInvestment(){const d=dialogState.data;if(!d.location){dialogState.stage='location';flowMessage('2 · Standort','<p>In welchem Markt suchen oder prüfen Sie?</p>');return;}if(!d.propertyType){dialogState.stage='propertyType';flowMessage('3 · Objektart','<p>Welche Objektart interessiert Sie?</p>',['Eigentumswohnung','Mehrfamilienhaus / Investmentobjekt','Haus','Gewerbeimmobilie']);return;}if(!d.budget){dialogState.stage='budget';flowMessage('4 · Investmentvolumen','<p>In welcher Kaufpreisspanne bewegen Sie sich?</p>',['bis 250.000 €','250.000–500.000 €','500.000–1 Mio. €','1–4 Mio. €','über 4 Mio. €']);return;}if(!d.equity){dialogState.stage='equity';flowMessage('5 · Eigenkapital','<p>Wie viel Eigenkapital soll ungefähr eingesetzt werden?</p>',['möglichst gering','10–20 %','20–30 %','über 30 %','noch offen']);return;}if(!d.goal){dialogState.stage='goal';flowMessage('6 · Ziel','<p>Welches Ziel hat Priorität?</p>',['laufender Cashflow','langfristiger Vermögensaufbau','Wertsteigerung / Entwicklung','steuerliche Struktur','Mischstrategie']);return;}dialogState.stage='complete';addMessage('assistant',completeFlowHtml('Investment – Strategie eingeordnet','Für die konkrete Entscheidung sollten Miete, nicht umlagefähige Kosten, CapEx, Finanzierung, Mikrolage und Exit gemeinsam modelliert werden.',['ankauf','lab','finanzierung']));saveSession();}
  function handleInvestmentFlow(text){if(dialogState.flow!=='investment'||looksLikeQuestion(text))return false;const d=dialogState.data,st=dialogState.stage;if(st==='objectStatus'){d.objectStatus=String(text).trim();advanceInvestment();return true;}if(st==='location'){const v=plainLocation(text);if(!v){addMessage('assistant',contactHandoffHtml(text));return true;}d.location=v;advanceInvestment();return true;}if(st==='propertyType'){const v=propertyTypeFrom(text);if(!v){flowMessage('Objektart','<p>Bitte wählen Sie eine Objektart.</p>',['Eigentumswohnung','Mehrfamilienhaus / Investmentobjekt','Haus','Gewerbeimmobilie']);return true;}d.propertyType=v;advanceInvestment();return true;}if(st==='budget'){d.budget=String(text).trim();advanceInvestment();return true;}if(st==='equity'){d.equity=String(text).trim();advanceInvestment();return true;}if(st==='goal'){d.goal=String(text).trim();advanceInvestment();return true;}return false;}

  function handleActiveFlow(text){
    if(handleSellFlow(text))return true;
    if(handleBuyFlow(text))return true;
    if(handleRentFlow(text))return true;
    if(handleLetFlow(text))return true;
    if(handleFinanceFlow(text))return true;
    if(handleInvestmentFlow(text))return true;
    return false;
  }

  function handleDirectIntent(text){
    const location=extractLocation(text);
    if(asksDirectContact(text) && !isExplicitFinanceIntent(text)){addMessage('assistant',contactHandoffHtml(text,'Gerne – hier erreichen Sie uns direkt.'));return true;}
    if(isExplicitValuationIntent(text)){sellFlowStart(text);dialogState.data.reason='Marktwert / Bewertung';return true;}
    if(isExplicitSellIntent(text)){sellFlowStart(text);return true;}
    if(isExplicitFinanceIntent(text)){financeFlowStart(text);return true;}
    if(isExplicitInvestmentIntent(text)){investmentFlowStart(text);return true;}
    if(isExplicitBuyIntent(text)){buyFlowStart(text);return true;}
    if(isExplicitLetIntent(text)){letFlowStart(text);return true;}
    if(isExplicitRentIntent(text)){rentFlowStart(text);return true;}
    if(asksCoverage(text) && location){addMessage('assistant',`<span class="fg-ai-kicker">Regionale Einordnung</span>${locationCoverageHtml(location,'Immobilienvorhaben')}<p>Geht es um Verkauf, Kauf, Kapitalanlage oder Finanzierung?</p>${suggestionsHtml(['Ich möchte verkaufen','Ich möchte kaufen','Ich suche eine Kapitalanlage','Ich brauche eine Finanzierung'])}`);return true;}
    return false;
  }

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

  function topicCategories(query){
    const n=normalize(query), cats=new Set();
    if(/makler|provision|courtage|kosten|grunderwerb|notar|steuer/.test(n))cats.add('kosten');
    if(/finanz|kredit|darlehen|bank|zins|tilgung|eigenkapital|schufa|rate/.test(n)){cats.add('finanzierung');cats.add('unterlagen');}
    if(/verkauf|verkaufen|verausser|angebotspreis|bewertung/.test(n)){cats.add('verkaufen');cats.add('unterlagen');}
    if(/kauf|kaufen|notar|grundbuch|weg|wohnungseigentum/.test(n)){cats.add('kaufen');cats.add('wissen');}
    if(/rendite|cashflow|kapitalanlage|investment|mieteinnahme|faktor|capex/.test(n))cats.add('investment');
    if(/mietwohnung|mieten|vermieten|kaution|mieter|mietvertrag/.test(n))cats.add('miete');
    if(/fischer|geserich|f&g|standort|region|kontakt|leistung/.test(n))cats.add('fg');
    return cats;
  }
  function scoreEntry(entry, query){
    const nq=normalize(query), qt=expandedTokens(query), title=normalize(entry.q), keyText=normalize((entry.keys||[]).join(' '));
    const gate=ENTRY_GATES[entry.id]; if(gate&&!gate.test(nq))return -40;
    let score=0;
    if(title===nq)score+=140;
    if(nq.length>6&&(title.includes(nq)||nq.includes(title)))score+=48;
    (entry.keys||[]).forEach(k=>{const nk=normalize(k);if(nq===nk)score+=95;else if(nq.includes(nk)&&nk.length>4)score+=42;else if(nk.includes(nq)&&nq.length>6)score+=22;});
    qt.forEach(t=>{if(title.split(' ').includes(t))score+=8;if(keyText.split(' ').includes(t))score+=5;if(t.length>=6){const words=(title+' '+keyText).split(' ').filter(w=>Math.abs(w.length-t.length)<=1);if(words.some(w=>levenshtein(w,t)<=1))score+=2;}});
    const cats=topicCategories(query); if(cats.size){if(cats.has(entry.cat))score+=12;else if(!['wissen','unterlagen'].includes(entry.cat))score-=7;}
    return score;
  }
  function searchKB(query, limit=5){
    return KB.map(e=>({entry:e,score:scoreEntry(e,query)})).filter(x=>x.score>5).sort((a,b)=>b.score-a.score).slice(0,limit);
  }
  const SHARED_KB=Array.isArray(window.FG_SHARED_KNOWLEDGE)?window.FG_SHARED_KNOWLEDGE:[];
  function scoreShared(entry,query){
    const nq=normalize(query), title=normalize(entry.title||''), summary=normalize(entry.summary||''), keys=normalize((entry.keywords||[]).join(' '));
    let score=0; if(title===nq)score+=130; if(nq.length>5&&(title.includes(nq)||nq.includes(title)))score+=52;
    expandedTokens(query).forEach(t=>{if(title.split(' ').includes(t))score+=10;if(keys.split(' ').includes(t))score+=7;if(summary.split(' ').includes(t))score+=3;});
    return score;
  }
  function searchShared(query,limit=4){return SHARED_KB.map(e=>({entry:e,score:scoreShared(e,query)})).filter(x=>x.score>=18).sort((a,b)=>b.score-a.score).slice(0,limit)}
  function confidentShared(hits){if(!hits.length)return null;const f=hits[0],s=hits[1];if(f.score>=58)return f;if(f.score<24)return null;if(s&&f.score-s.score<5&&f.score<42)return null;return f;}
  function confidentHit(hits){
    if(!hits.length)return null;
    const first=hits[0],second=hits[1];
    if(first.score>=70)return first;
    if(first.score<22)return null;
    if(second && first.score-second.score<4 && first.score<38)return null;
    return first;
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
      <p><strong>Guten Tag.</strong> Ich helfe mit über 180 strukturierten Wissenseinträgen und geführten Prozessen bei Fragen zu Immobilienkauf, Verkauf, Finanzierung, Kapitalanlage, Vermietung, Kosten und Unterlagen.</p>
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
    const q=String(query||'').trim(); if(!q)return;
    addUser(q); input.value=''; autoResize();
    const typing=showTyping();
    window.setTimeout(()=>{
      typing.remove(); const nq=normalize(q);
      if(/^(hallo|hi|hey|guten tag|moin|servus)\b/.test(nq)){dialogState={flow:null,stage:null,data:{}};addMessage('assistant',`<p>Guten Tag! Wobei darf ich helfen?</p>${categoryGridHtml()}${suggestionsHtml(['Ich möchte verkaufen','Ich möchte kaufen','Ich brauche eine Finanzierung','Ich suche eine Kapitalanlage'])}`);return;}
      if(/^(abbrechen|neu starten|zurucksetzen|reset|von vorne)$/i.test(nq)){dialogState={flow:null,stage:null,data:{}};addMessage('assistant',`<p>Alles klar. Wir starten neu. Worum geht es?</p>${suggestionsHtml(['Ich möchte verkaufen','Ich möchte kaufen','Ich möchte mieten','Ich möchte vermieten','Ich brauche eine Finanzierung','Ich suche eine Kapitalanlage'])}`);return;}

      // Ein neues klares Vorhaben darf einen bestehenden Prozess jederzeit überschreiben.
      if(handleDirectIntent(q))return;

      // In einem laufenden Prozess bleiben echte Wissensfragen Wissensfragen; normale Antworten führen den Prozess fort.
      if(handleActiveFlow(q))return;

      if(nq.includes('rechner')||/berechne|ausrechnen|kalkulier/.test(nq)){addMessage('assistant',`<p>Welchen Rechner möchten Sie öffnen?</p><div class="fg-ai-actions"><button class="fg-ai-action is-gold" data-fg-ai-tool="purchaseCosts">Kaufnebenkosten</button><button class="fg-ai-action is-light" data-fg-ai-tool="loanRate">Monatsrate</button><button class="fg-ai-action is-light" data-fg-ai-tool="yield">Rendite & Cashflow</button><button class="fg-ai-action is-light" data-fg-ai-tool="budget">Kaufbudget</button></div>`);return;}

      const hits=searchKB(q,5), best=confidentHit(hits);
      if(!best){
        const sharedHit=confidentShared(searchShared(q,4));
        if(sharedHit){const item=sharedHit.entry;addMessage('assistant',`<span class="fg-ai-kicker">${escapeHtml(item.category||'Immobilienwissen')}</span><p><strong>${escapeHtml(item.title)}</strong></p><p>${escapeHtml(item.answer)}</p><div class="fg-ai-actions"><a class="fg-ai-action is-gold" href="${escapeHtml(item.url)}"><i class="fas fa-book-open"></i>Im Investment Lab vertiefen</a><a class="fg-ai-action is-light" href="mailto:info@fg-realestate.de?subject=${encodeURIComponent('Frage zu '+item.title)}"><i class="fas fa-envelope"></i>E-Mail schreiben</a></div>`);return;}
        addMessage('assistant',contactHandoffHtml(q));return;
      }
      const entry=best.entry;
      let html=`<span class="fg-ai-kicker">${CAT_META[entry.cat]?.[1]||'Immobilienwissen'}</span><p><strong>${escapeHtml(entry.q)}</strong></p><p>${entry.answer}</p>`;
      if(entry.note)html+=`<div class="fg-ai-note">${entry.note}</div>`;
      if(entry.tool)html+=`<div class="fg-ai-actions"><button type="button" class="fg-ai-action is-gold" data-fg-ai-tool="${entry.tool}"><i class="fas fa-calculator"></i>${toolLabel(entry.tool)}</button></div>`;
      html+=actionHtml(entry.actions||[]);
      const related=(RELATED_BY_CAT[entry.cat]||[]).filter(t=>normalize(t)!==normalize(entry.q)).slice(0,4);if(related.length)html+=suggestionsHtml(related);
      addMessage('assistant',html);
    },180);
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
    addMessage('assistant',`<span class="fg-ai-kicker">So funktioniert der Assistent</span><p>Dieser Assistent arbeitet <strong>ohne extern angebundenes KI-Modell</strong>. Freie Fragen werden lokal im Browser mit einem umfangreichen F&G-Wissensmodul, Intent-Erkennung, Synonymen, Sicherheitsregeln und geführten Entscheidungsprozessen abgeglichen.</p><ul><li>Keine Eingabe wird zur Beantwortung an OpenAI, Microsoft oder einen anderen KI-Anbieter gesendet.</li><li>Ihre Fragen im Assistenten bleiben im Browser und werden nicht an F&G übertragen.</li><li>Wenn eine Frage nicht sicher erkannt wird, bietet der Assistent direkt E-Mail oder Telefon an, statt eine unsichere Antwort zu erfinden.</li><li>Rechner sind Orientierungshilfen, keine Finanzierungs-, Rechts- oder Steuerberatung.</li><li>Recht, Steuern, Förderprogramme und Bankrichtlinien können sich ändern.</li></ul><div class="fg-ai-note">Wissensstand: ${VERSION}. Bei konkreten Entscheidungen prüfen wir den Einzelfall persönlich.</div>`);
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
  function resetConversation(){messages.innerHTML='';dialogState={flow:null,stage:null,data:{}};sessionStorage.removeItem(SESSION_KEY);addMessage('assistant',initialHtml(),{save:false});const ctx=contextualWelcome();if(ctx)addMessage('assistant',`<p>Passend zu dieser Seite interessieren häufig:</p>${suggestionsHtml(ctx)}`,{save:false});saveSession();}

  function saveSession(){
    try{sessionStorage.setItem(SESSION_KEY,JSON.stringify({open:!panel.hidden,html:messages.innerHTML,dialogState}));}catch(e){}
  }
  function restoreSession(){
    try{const state=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(state?.html)messages.innerHTML=state.html;if(state?.dialogState)dialogState=state.dialogState;if(state?.open)openPanel();}catch(e){}
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
    if(n==='team')addMessage('assistant',contactHandoffHtml('', 'Sie möchten direkt mit uns sprechen?'));
  });

  // Assistant starts closed; restore only this browser-tab session.
  restoreSession();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closePanel();});
})();
