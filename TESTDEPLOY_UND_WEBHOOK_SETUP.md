# F&G Testdeploy + Projekt-Webhook

## 1. Änderungen zuerst als Testdeploy prüfen

Empfohlener Workflow in GitHub Desktop:

1. Repository öffnen und oben bei **Current Branch** auf **New Branch** klicken.
2. Branch z. B. `website-ux-testdeploy` nennen und von `main` erstellen.
3. Die überarbeiteten Dateien in diesen Branch übernehmen.
4. In GitHub Desktop committen und **Publish branch** klicken.
5. Wenn Netlify mit GitHub verbunden ist, entsteht bei Pull Requests normalerweise automatisch ein **Deploy Preview**. Alternativ kann in Netlify unter *Project configuration > Build & deploy > Continuous deployment* ein Branch Deploy für `website-ux-testdeploy` aktiviert werden.
6. Erst wenn der Preview-Link geprüft wurde, Pull Request nach `main` mergen.

Damit bleibt `main` unangetastet, bis die neue Version freigegeben ist. Eine lokale 11ty-Vorschau kann zusätzlich mit `npm start` geöffnet werden.

## 2. Separater Propstack-Webhook nur für Projekte

Neue Netlify Function:

`/.netlify/functions/propstack-project-build-hook`

In Propstack für **Projekt-Ereignisse** eine eigene Webhook-Konfiguration anlegen und als Ziel verwenden:

`https://fg-realestate.de/.netlify/functions/propstack-project-build-hook`

Der bestehende Einheiten-Webhook kann unverändert auf der bisherigen Function bleiben.

### Benötigte Netlify Environment Variables

- `PROPSTACK_API_KEY`
- `NETLIFY_BUILD_HOOK_URL`

Optional / bereits vom Code unterstützt:

- `PROPSTACK_API_BASE=https://api.propstack.de/v1`
- `PROPSTACK_PROJECTS_API_URL` – falls euer Propstack-Account einen abweichenden Projekt-Endpunkt verwendet
- `PROPSTACK_PUBLIC_STATUS_KEYWORDS=vermarktung`
- `PROPSTACK_PUBLIC_PROJECT_STATUS_KEYWORDS=vermarktung,im angebot`
- `PROPSTACK_BUILD_DEBOUNCE_SECONDS=60`

Wichtig: `PROPSTACK_PROJECTS_API_URL` sollte auf den **Collection-Endpunkt** zeigen (z. B. `.../projects?expand=1`). Die Detailabfrage entfernt Query-Parameter automatisch und ergänzt die Projekt-ID sauber.

## 3. Projekt-Datentransfer

`_data/propstack.js` lädt weiterhin getrennt:

- Einheiten über `PROPSTACK_API_URL` bzw. `/units?expand=1`
- Projekte über `PROPSTACK_PROJECTS_API_URL` oder die bekannten Projekt-Endpunkte

Einheiten eines Projekts werden nur veröffentlicht, wenn das Projekt selbst einen öffentlichen Status hat. Der neue Projekt-Webhook sorgt dafür, dass Änderungen am Projekt selbst zuverlässig einen neuen Netlify-Build anstoßen.

## 4. Site Name Google / Bing

Die technische Vorbereitung ist bereits vorhanden und wurde beibehalten/ergänzt:

- `WebSite` Structured Data mit `name = Fischer & Geserich Real Estate`
- `Organization` / `RealEstateAgent` Structured Data
- `og:site_name`
- `application-name`
- `apple-mobile-web-app-title`
- Canonical URL und konsistenter Markenname

Suchmaschinen entscheiden letztlich selbst, welchen Site Name sie anzeigen. Nach einem Deploy sollte die Startseite in Google Search Console und Bing Webmaster Tools erneut zur Indexierung angestoßen werden.
