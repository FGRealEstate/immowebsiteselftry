# Consent-Audit 2026-07-23

## Behobene Probleme

- Cookiebot-Script aus dem globalen Layout entfernt.
- Direkte Google-Analytics-Einbindung aus dem globalen Layout entfernt.
- Direkt und ohne Einwilligung gestarteten Google Tag Manager entfernt.
- GTM-Noscript-Iframe entfernt, weil dieser die Einwilligungslogik umgehen würde.
- Eigenen F&G-Consent-Manager vollständig eingebunden.
- Website bleibt hinter dem Banner sichtbar und bedienbar (`disablePageInteraction: false`).
- Google Tag Manager wird erst nach Statistik- oder Marketing-Einwilligung geladen.
- Google Consent Mode steht vor einer Auswahl standardmäßig auf `denied`.
- Google Maps wird erst nach Einwilligung in externe Medien geladen, sofern ein API-Key hinterlegt ist.
- Fehlerhafte, bildschirmfüllende Logo-Darstellung durch feste Größenbegrenzung behoben.
- Cookie-Einstellungen sind dauerhaft über den Footer erneut aufrufbar.
- Standalone-Seite `/insta-objekt-anfrage/` auf dieselbe Consent-Logik umgestellt.
- Eleventy kopiert nun alle benötigten Consent-Dateien in `_site`.

## Dateien

- `_includes/base.njk`
- `consent-manager.js`
- `consent-manager.css`
- `.eleventy.js`
- `insta-objekt-anfrage.njk`
- `datenschutz.html`

## Verhalten

### Ohne Einwilligung

- Website sichtbar und nutzbar
- keine Anfrage an `googletagmanager.com`
- kein Google Analytics
- keine Marketing-Tags
- keine Google Maps

### Statistik akzeptiert

- Google Consent Mode: `analytics_storage = granted`
- Google Tag Manager wird geladen
- Analytics-Tags können über den GTM-Container ausgelöst werden

### Marketing akzeptiert

- `ad_storage`, `ad_user_data` und `ad_personalization` werden freigegeben
- GTM wird geladen

### Externe Medien akzeptiert

- Google Maps kann geladen werden, sobald ein API-Key eingetragen ist
