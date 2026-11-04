/*
 * Update 32 §7.3 (05.11.2026): geplante Funktion zum Sammel-Build der Propstack-Webhooks.
 * Läuft alle 2 Minuten (netlify.toml, [functions."propstack-build-sammler"] schedule). Schreibt ein Lebenszeichen
 * und löst einen Netlify-Build aus, sobald das erste vorgemerkte Ereignis die Sammelzeit erreicht hat.
 * Logik und Sicherungen: _shared/build-sammler.js. Geplante Funktionen sind von außen nicht aufrufbar.
 */

const { sammlerLauf } = require("./_shared/build-sammler");

exports.handler = async function propstackBuildSammler(event) {
  const ergebnis = await sammlerLauf(event);
  return {
    statusCode: ergebnis.ok ? 200 : 500,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(ergebnis)
  };
};
