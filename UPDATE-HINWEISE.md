# F&G Website – Überarbeitung September 2026

## Enthaltene Anpassungen

- Mobile Überschriften verkleinert und gegen Abschneiden/unschöne Silbentrennung abgesichert
- Angebots- und Projektüberschriften responsiv korrigiert
- vier Kennzahlen-Kacheln auf der mobilen Startseite vollständig umrandet
- Investitionsrechner im Investment Lab zuverlässig eingebunden; Rechenfunktionen beibehalten
- redundante Unterauswahl bei Objektarten mit nur einer Option entfernt
- goldene Bereichsüberschriften einheitlich mit Linien links und rechts gestaltet
- Startseiten-Texte, Standortkarten Leipzig/Dresden und Handlungsaufforderung überarbeitet
- Teamdarstellung gekürzt; Rollen aktualisiert; Karten direkt mit den beruflichen Profilen verlinkt
- Propstack-Custom-Field „Investment oder Eigennutz“ in die Strategieerkennung aufgenommen
- Propstack-/Netlify-Webhooks robuster für Update-, Lösch- und Projekt-Events gemacht

## Propstack / Netlify

In Netlify müssen weiterhin `PROPSTACK_API_KEY` und `NETLIFY_BUILD_HOOK_URL` hinterlegt sein. Ein separater `NETLIFY_PROJECT_BUILD_HOOK_URL` ist optional; ohne ihn verwenden Projekt-Events automatisch den allgemeinen Build Hook.

Als öffentliche Statuswerte werden standardmäßig sowohl „Vermarkten“ als auch „Vermarktung“ erkannt; bei Projekten zusätzlich „Im Angebot“.

## Build

```bash
npm ci
npm run build
```

Der geprüfte Ausgabeordner ist `_site`.
