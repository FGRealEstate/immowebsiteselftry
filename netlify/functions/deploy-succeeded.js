/*
 * Update 35 B5 (05.11.2026): IndexNow-Ping nach jedem Produktions-Deploy.
 * Netlify ruft eine Funktion mit dem Namen „deploy-succeeded“ selbst auf, sobald ein Deploy veröffentlicht ist
 * (ereignisgesteuerte Funktion). Sie liest /indexnow.json der Live-Seite, also des eben veröffentlichten Builds,
 * und meldet die Adressen unter „geaendert“ (geänderte, neue und entfernte Seiten aus den Sitemaps, siehe .eleventy.js)
 * an api.indexnow.org. Die Suchmaschinen holen den Schlüssel unter https://fg-realestate.de/<Schlüssel>.txt ab.
 * Nur Produktion; Branch- und Vorschau-Deploys melden nichts. Im Log stehen nur Anzahl und Statuscode.
 * Ruft jemand die Funktion von außen auf, liest sie trotzdem nur die Live-Liste und meldet nur eigene Adressen,
 * und nur, wenn die Liste höchstens 30 Minuten alt ist.
 */
const { SCHLUESSEL, HOST, BASIS } = require("./_shared/indexnow");

const antwort = (statusCode, daten) => ({
  statusCode,
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(daten)
});

exports.handler = async function deploySucceeded(event) {
  let payload = {};
  try { payload = JSON.parse(event.body || "{}").payload || {}; } catch (error) { /* leer */ }
  if (payload.context !== "production") return antwort(200, { ok: true, ping: false, grund: "kein Produktions-Deploy" });

  let liste;
  try {
    const r = await fetch(`${BASIS}/indexnow.json?v=${Date.now()}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    liste = await r.json();
  } catch (error) {
    console.warn("IndexNow: /indexnow.json nicht lesbar.", error.message);
    return antwort(200, { ok: false, ping: false, grund: "Liste nicht lesbar" });
  }

  const alter = Date.now() - Date.parse(liste.erstellt || 0);
  if (!(alter >= 0 && alter < 30 * 60 * 1000)) return antwort(200, { ok: true, ping: false, grund: "Liste älter als 30 Minuten" });

  const urlList = [...new Set(Array.isArray(liste.geaendert) ? liste.geaendert : [])]
    .filter((u) => typeof u === "string" && u.startsWith(BASIS + "/"))
    .slice(0, 10000);
  if (!urlList.length) {
    console.log("IndexNow: keine geänderten Seiten.");
    return antwort(200, { ok: true, ping: false, anzahl: 0 });
  }

  try {
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: SCHLUESSEL, keyLocation: `${BASIS}/${SCHLUESSEL}.txt`, urlList }),
      signal: AbortSignal.timeout(15000)
    });
    console.log(`IndexNow: ${urlList.length} Adressen gemeldet, Antwort ${r.status}.`);
    return antwort(200, { ok: r.status === 200 || r.status === 202, ping: true, anzahl: urlList.length, status: r.status });
  } catch (error) {
    console.warn("IndexNow: Ping fehlgeschlagen.", error.message);
    return antwort(200, { ok: false, ping: true, anzahl: urlList.length, grund: "Ping fehlgeschlagen" });
  }
};
