/*
 * Dedizierter Propstack -> Netlify Webhook fuer PROJEKTE.
 *
 * Propstack Ziel-URL:
 * https://fg-realestate.de/.netlify/functions/propstack-project-build-hook
 *
 * Dieser Endpoint ist absichtlich schlank: Bei einem Project-Event wird direkt
 * der separate Netlify Build Hook fuer Projekte ausgeloest. Dadurch ist die
 * Projekt-Aktualisierung unabhaengig von @netlify/blobs und von der Property-Logik.
 *
 * Erforderliche Environment Variable:
 * - NETLIFY_PROJECT_BUILD_HOOK_URL
 *
 * Update 32 §7.3 (05.11.2026): wie propstack-build-hook mit Geheimnis (PROPSTACK_WEBHOOK_SECRET: Propstack-Signatur
 * oder ?token=) und Sammel-Build (_shared/build-sammler.js). Ohne Geheimnis wie bisher offen, mit Warnung im Log;
 * geht das Sammeln nicht sicher, wird wie bisher sofort gebaut.
 */

const { geheimnisPruefen, bauenOderVormerken, sammlerStand } = require("./_shared/build-sammler");

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

exports.handler = async function projectBuildHook(event) {
  if (!["POST", "GET"].includes(event.httpMethod)) {
    return jsonResponse(405, { ok: false, error: "Method Not Allowed" });
  }

  // GET dient nur als Health-Check im Browser und loest KEINEN Build aus.
  if (event.httpMethod === "GET") {
    return jsonResponse(200, {
      ok: true,
      ready: true,
      webhook: "propstack-project-build-hook",
      buildHookConfigured: Boolean(process.env.NETLIFY_PROJECT_BUILD_HOOK_URL),
      secretConfigured: Boolean(process.env.PROPSTACK_WEBHOOK_SECRET),
      sammler: await sammlerStand(event)
    });
  }

  if (!geheimnisPruefen(event).ok) {
    return jsonResponse(401, { ok: false, error: "Unauthorized" });
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  const buildHookUrl = process.env.NETLIFY_PROJECT_BUILD_HOOK_URL || process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) {
    return jsonResponse(500, { ok: false, error: "NETLIFY_PROJECT_BUILD_HOOK_URL bzw. NETLIFY_BUILD_HOOK_URL fehlt." });
  }

  const projectId = payload.project_id || payload.projectId || payload.id || payload.data?.id || null;
  try {
    const trigger = await bauenOderVormerken(event, { entityType: "project", entityId: projectId });

    console.log("Propstack Project Build", trigger.gesammelt ? "vorgemerkt" : "ausgelöst", {
      netlifyStatus: trigger.netlifyStatus || null,
      eventType: payload.event || payload.event_type || payload.type || null,
      projectId
    });

    return jsonResponse(200, { ok: true, ...trigger });
  } catch (error) {
    console.error("Project Build Hook Fehler:", error);
    return jsonResponse(500, { ok: false, error: error.message });
  }
};
