/* Widget aus Timons Finanzierungsplattform (Update 5, Abschnitt 2).
   Update 11 §2 (29.10.2026): Die Seite hat ein Widget, den Angebotsrechner. Der zweite Platzhalter
   („Was kann ich mir leisten?“, Feld `leisten`) ist gelöscht; dafür steht auf /finanzierungsberatung.html
   weiter der eigene Kaufpreisrahmen-Rechner. Ohne `angebot` oder ohne `anbieter` fehlt der Abschnitt
   „Finanzierungsangebot berechnen“.

   Einbettungscodes so einfügen, wie Timon sie schickt (zwischen die Backticks). Sie stehen auf der
   Seite in einem <template> und laden erst nach Einwilligung in „Externe Medien“ (fg-design.js).
   Ein Einbettungscode ist nicht geheim. Zugangsdaten zur Plattform gehören nicht hierher. */
module.exports = {
  // Name der Plattform, wie er im Platzhalter steht („Der Rechner kommt vom …“).
  // Update 17 §6 (30.10.2026): Baufi-Partnerportal, betrieben von der Vorgangshub GmbH, nicht FinCRM (vorher Update 6 §1: FinCRM).
  // Ohne Einbettungscode zeigt die Seite trotzdem nichts davon.
  anbieter: "Baufi-Partnerportal",
  // Firma hinter der Plattform laut deren Impressum; für Datenschutzerklärung und Platzhalter
  anbieterFirma: "",

  // Angebotsrechner, eigener Abschnitt #angebot vor den häufigen Fragen.
  // Update 11 §2: Code wörtlich, wie Timon ihn Peer geschickt hat (Portal „Baufi-Partnerportal“,
  // Instanz „Website“, Art Angebotsrechner). Lädt von baufi-partnerportal.de (Skript und iframe).
  angebot: `<div id="vh-widget-wk_178778264ad9"></div>
<script src="https://baufi-partnerportal.de/widgets/v1/loader.js" async></script>`,

  /* Lead-Messung: Schickt das Widget beim Absenden eine Browser-Nachricht (postMessage), hier
     Herkunft und ein Erkennungsmerkmal eintragen, dann geht `generate_lead` mit
     form_type „finanzierungswidget“ in den dataLayer. Beispiel:
     { origin: "https://widgets.beispiel.de", match: "lead_submitted" }
     `match` wird im Text der Nachricht gesucht (bei Objekten im JSON). Leer = keine Messung.
     Zum Herausfinden: Seite mit ?widgetdebug=1 öffnen, Widget absenden, Konsole ansehen. */
  leadMessage: null
};
