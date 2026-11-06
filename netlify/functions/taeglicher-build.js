/*
 * Update 40 §1.2 (06.11.2026): täglicher Produktions-Build um 06:00 deutscher Zeit.
 *
 * Ein Statuswechsel in Propstack löst nicht immer einen Build aus (Befund Update 32 §7.7). Dieser Lauf ruft
 * jeden Morgen den Netlify-Build-Hook (NETLIFY_BUILD_HOOK_URL). Ein verkauftes oder zurückgezogenes Angebot ist
 * damit spätestens nach 24 Stunden von der Seite, auch wenn kein Webhook ankommt.
 *
 * Zeitplan (netlify.toml): Netlify rechnet geplante Funktionen in UTC. Damit es Sommer wie Winter 06:00 in
 * Deutschland ist, läuft die Funktion um 04:00 und 05:00 UTC und baut nur in dem Lauf, in dem es in
 * Europe/Berlin gerade 6 Uhr ist.
 *
 * Log: nur „build triggered“ und der Statuscode des Build-Hooks.
 * Geplante Funktionen sind von außen nicht aufrufbar.
 */

function stundeInBerlin(jetzt = new Date()) {
  // formatToParts: „de-DE“ schreibt sonst „06 Uhr“.
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  return Number(teile.find((t) => t.type === "hour").value);
}

async function taeglicherBuild({ jetzt = new Date(), hookUrl = process.env.NETLIFY_BUILD_HOOK_URL, abruf = fetch, log = console.log } = {}) {
  if (stundeInBerlin(jetzt) !== 6) return { gebaut: false, grund: "nicht 06:00 in Berlin" };
  if (!hookUrl) {
    log("build not triggered: NETLIFY_BUILD_HOOK_URL missing");
    return { gebaut: false, grund: "kein Build-Hook" };
  }
  let ziel = hookUrl;
  try {
    const url = new URL(hookUrl);
    url.searchParams.set("trigger_title", "Täglicher Build 06:00 (Update 40 §1.2)");
    ziel = url.toString();
  } catch {
    ziel = hookUrl;
  }
  const antwort = await abruf(ziel, { method: "POST" });
  log("build triggered", antwort.status);
  return { gebaut: true, status: antwort.status };
}

exports.handler = async function () {
  const ergebnis = await taeglicherBuild();
  return { statusCode: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(ergebnis) };
};

exports.taeglicherBuild = taeglicherBuild;
exports.stundeInBerlin = stundeInBerlin;
