F&G REAL ESTATE 2.0 – EINBAU UND TEST

1. Vor dem Einbau vollständiges Repository-Backup erstellen.
2. Alle Dateien dieses Pakets in das Repository übernehmen.
3. Cookiebot ist aus _includes/base.njk entfernt. Die Domain kann nach erfolgreichem Test aus Cookiebot gelöscht bzw. das Abo beendet werden.
4. CookieConsent von Orest Bida wird als kostenlose MIT-lizenzierte Bibliothek über jsDelivr geladen. Der F&G-Code liegt in consent-manager.js.
5. Statistik: Aktuell wird ausschließlich GA4 nach Einwilligung in „Statistik“ geladen. Prüfen Sie im Google-Analytics-Konto und GTM, ob alte/doppelte Tags noch aktiv sind. Der bisherige GTM-Code wurde aus dem Template entfernt, um unkontrolliertes Tag-Feuern zu vermeiden.
6. Inhalte des Investment Labs liegen einzeln in content/wissen, content/lexikon, content/standorte und content/rechner. Diese Dateien sind über Decap CMS pflegbar.
7. Alte URLs: _redirects leitet Ankaufsberatung und Investitionsrechner in das Investment Lab. Prüfen Sie nach Deployment die Zielanker.
8. Build lokal: npm install, danach npm run build.
9. Tests: Website ohne Consent, nur notwendige Cookies, Statistik akzeptieren, Widerruf, Rechner mit 0 € Eigenkapital, 100-%-Finanzierung und freien Dezimalprozenten, Investment-Navigator, CMS, Propstack-Mietobjekt, mobile Navigation.
10. Datenschutz: Die technische Umsetzung garantiert keine Rechtskonformität. Datenschutzerklärung, Einwilligungstexte, Speicherdauer und eingesetzte Drittanbieter müssen vor Veröffentlichung rechtlich geprüft werden.

BEKANNTE GRENZEN
- Der F&G Navigator ist regelbasiert und kein generatives KI-Modell. Die Daten- und Funktionsschnittstellen sind für eine spätere Netlify-/Azure-Anbindung vorbereitet.
- Standortwerte wurden aus dem bestehenden Projekt übernommen und nicht als aktuelle Marktwerte verifiziert.
- Der Investitionsrechner ist eine Modellrechnung. Individuelle steuerliche Behandlung, anschaffungsnahe Herstellungskosten, Sonder-AfA und Verlustverrechnung müssen fachlich geprüft werden.
- Propstack-Feldnamen können account- und API-versionsabhängig sein. Bei fehlenden Mietwerten muss ein anonymisierter Rohdatensatz im Buildlog geprüft werden.
