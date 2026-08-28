# Fischer & Geserich Real Estate – Website

Produktionsfertige Eleventy-Website mit Netlify Functions. Die Oberfläche, Landingpages, Bilder, das Investment Lab, der F&G Assistent und die Propstack-Anbindung bilden eine gemeinsame Codebasis.

## Lokal starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm ci
npm run start
```

Der Produktions-Build wird mit `npm run build` in `_site/` erzeugt. Vor jedem Build wird `fg-knowledge.js` automatisch aus den JSON-Inhalten unter `content/wissen/` und `content/lexikon/` neu erstellt.

## Deployment

Die Datei `netlify.toml` konfiguriert Build, Publish-Verzeichnis und Functions. Zugangsdaten gehören ausschließlich in die geschützten Umgebungsvariablen des Hosters und niemals in den Code.

Für Propstack werden – abhängig von den eingesetzten Funktionen – insbesondere `PROPSTACK_API_KEY`, `PROPSTACK_API_BASE`, `PROPSTACK_API_URL`, `PROPSTACK_PROJECTS_API_URL`, `PROPSTACK_BROKER_ID` und `PROPSTACK_APPOINTMENT_BROKER_ID` verwendet. E-Mail- und Kalenderfunktionen nutzen die vorhandenen `SMTP_*`, `MAIL_FROM`, `WEBSITE_*`, `MICROSOFT_*` und `APPOINTMENT_*` Variablen.

## Inhaltsstruktur

- `content/wissen/`: Fachartikel und Blogbeiträge
- `content/lexikon/`: Immobilienlexikon
- `content/standorte/`: Standortanalysen
- `_includes/`: Layouts, Formulare, FAQ- und Schema-Bausteine
- `style.css` und `fg-design.css`: technische Ergänzungen sowie die maßgebliche F&G-Designsprache
- `netlify/functions/`: bestehende Propstack-, Kontakt-, E-Mail- und Kalenderfunktionen
- `sitemap*.njk`: Sitemap-Index und thematische Teil-Sitemaps

Die frühere Verwaltungsseite ist bewusst nicht Bestandteil dieser Website. Alte URLs werden über `_redirects` auf passende aktive Seiten weitergeleitet.
