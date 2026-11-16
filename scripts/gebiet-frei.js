// Update 61 §2/§3 (16.11.2026): Eine Gebietsseite mit Feld `freigabe` (z. B. "eberswalde") zählt erst, wenn der gleichnamige
// Schalter in _data/freigaben.js an ist. Bis dahin lesen alle Stellen, die content/gebiete/ durchgehen (Seiten, Menüzahl,
// Übersicht, Sitemap, Bildnachweise, Formular-Auszug), die Datei nicht; live bleibt alles wie vorher.
// Kapitel mit `mitFreigabe` ({ "<schalter>": { h2, absaetze, ... } }) bekommen bei offenem Schalter diesen Inhalt.
const freigaben = require("../_data/freigaben.js");

const frei = (page) => !page || !page.freigabe || Boolean(freigaben[page.freigabe]);

function mitFreigaben(page) {
  if (!page || !Array.isArray(page.abschnitte)) return page;
  return {
    ...page,
    abschnitte: page.abschnitte.map(({ mitFreigabe, ...a }) => {
      const an = Object.keys(mitFreigabe || {}).find((name) => freigaben[name]);
      return an ? { ...a, ...mitFreigabe[an] } : a;
    })
  };
}

module.exports = { frei, mitFreigaben };
