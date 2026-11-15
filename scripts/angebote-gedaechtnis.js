/*
 * Update 53 §2 (umgesetzt mit Update 57 §11, 15.11.2026): Angebote, die Propstack nicht mehr liefert, werden kein 404.
 *
 * Jeder Build schreibt /angebote-gedaechtnis.json: jede Adresse eines Angebots oder Projekts, die je eine Seite hatte,
 * mit dem Ziel, auf das sie zeigen soll (ihre Gebietsseite, ohne Gebiet /angebote). Grundlage ist die Liste, die gerade
 * live ist; neue Adressen kommen dazu, keine fällt heraus. Hat eine gemerkte Adresse im neuen Build keine Seite, hängt
 * .eleventy.js für sie „301“ an _redirects an. Hat dieselbe Propstack-ID inzwischen eine andere Adresse (Titel geändert),
 * geht die Weiterleitung dorthin. Aus der Sitemap fällt die Adresse von selbst, und IndexNow meldet sie als entfernt
 * (indexnow.json, „geaendert“).
 *
 * Die Liste enthält nur Pfade und Ziele, die ohnehin öffentlich waren, keine Preise und keine Personen.
 *
 * Abruf der Live-Liste: 404 heißt „erster Lauf“ (leer). Ist sie im Netlify-Produktionsbuild nach drei Versuchen nicht
 * lesbar, bricht der Build ab, damit nichts vergessen wird; live bleibt dann die letzte gute Version.
 * Lokal und für die Testumgebung: Warnung, weiter mit leerer Liste. FG_GEDAECHTNIS_VORHER=<Datei> liest eine lokale
 * Liste statt der Live-Liste (nur außerhalb von Netlify, für Tests).
 */
const fs = require("fs");

const BASIS = "https://fg-realestate.de";
const ADRESSE = "/angebote-gedaechtnis.json";
const UEBERSICHT = "/angebote";
const produktion = () => process.env.NETLIFY === "true" && process.env.CONTEXT === "production";

async function laden() {
  const datei = process.env.FG_GEDAECHTNIS_VORHER;
  if (datei && !process.env.NETLIFY) {
    try { return JSON.parse(fs.readFileSync(datei, "utf8")); } catch (error) {
      console.warn("GEDAECHTNIS: lokale Datei nicht lesbar:", error.message);
      return { eintraege: [] };
    }
  }
  let letzterFehler = "";
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const r = await fetch(`${BASIS}${ADRESSE}?v=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
      if (r.status === 404) return { eintraege: [] };
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      if (!d || !Array.isArray(d.eintraege)) throw new Error("kein Feld eintraege");
      return d;
    } catch (error) {
      letzterFehler = error.message;
      await new Promise((ok) => setTimeout(ok, 2000 * versuch));
    }
  }
  if (produktion()) throw new Error(`GEDAECHTNIS: ${ADRESSE} der Live-Seite nicht lesbar (${letzterFehler}). Build abgebrochen, damit keine Weiterleitung verloren geht.`);
  console.warn(`GEDAECHTNIS: Live-Liste nicht lesbar (${letzterFehler}), weiter mit leerer Liste (nur lokal).`);
  return { eintraege: [] };
}

const zielVon = (o) => (o && o.area && o.area.url) || UEBERSICHT;

/* aktuell: { properties, projects, references } aus _data/propstack.js. Liefert die fortgeschriebene Liste und die
   Weiterleitungen für diesen Build. */
function fortschreiben(vorher, aktuell) {
  const seiten = new Map(); // url -> { id, ziel }
  const add = (url, id, ziel) => { if (url) seiten.set(url, { id: String(id), ziel }); };
  for (const p of aktuell.properties || []) add(p.url, p.id, zielVon(p));
  for (const p of aktuell.projects || []) add(p.url, `projekt-${p.id}`, zielVon(p));
  const referenzen = new Set((aktuell.references || []).map((r) => r.url).filter(Boolean));

  const eintraege = new Map();
  for (const e of (vorher && vorher.eintraege) || []) if (e && e.url) eintraege.set(e.url, { url: e.url, id: String(e.id), ziel: e.ziel || UEBERSICHT });
  for (const [url, s] of seiten) eintraege.set(url, { url, id: s.id, ziel: s.ziel });

  const aktuelleUrlZuId = new Map([...seiten].map(([url, s]) => [s.id, url]));
  const abgaenge = [];
  for (const e of [...eintraege.values()].sort((a, b) => a.url.localeCompare(b.url))) {
    if (seiten.has(e.url) || referenzen.has(e.url)) continue; // Seite gibt es (Angebot, Projekt oder Referenz)
    const neueAdresse = aktuelleUrlZuId.get(e.id);
    abgaenge.push({ von: e.url, nach: neueAdresse || e.ziel });
  }
  return {
    erstellt: new Date().toISOString(),
    eintraege: [...eintraege.values()].sort((a, b) => a.url.localeCompare(b.url)),
    abgaenge
  };
}

/* Zeilen für _redirects: mit und ohne Schrägstrich am Ende. */
function regeln(gedaechtnis) {
  const zeilen = [];
  for (const { von, nach } of (gedaechtnis && gedaechtnis.abgaenge) || []) {
    if (!/^\/(angebote|projekte)\/[a-z0-9-]+\/$/.test(von) || !/^\/[a-z0-9/-]*$/.test(nach)) continue;
    zeilen.push(`${von} ${nach} 301`, `${von.slice(0, -1)} ${nach} 301`);
  }
  return zeilen;
}

module.exports = { laden, fortschreiben, regeln, ADRESSE };
