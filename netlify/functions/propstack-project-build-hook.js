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
 */

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
      buildHookConfigured: Boolean(process.env.NETLIFY_PROJECT_BUILD_HOOK_URL)
    });
  }

  let payload = {};
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return jsonResponse(400, { ok: false, error: "Invalid JSON payload" });
  }

  const buildHookUrl = process.env.NETLIFY_PROJECT_BUILD_HOOK_URL;
  if (!buildHookUrl) {
    return jsonResponse(500, { ok: false, error: "NETLIFY_PROJECT_BUILD_HOOK_URL fehlt." });
  }

  try {
    const response = await fetch(buildHookUrl, { method: "POST" });
    if (!response.ok) {
      return jsonResponse(502, {
        ok: false,
        error: `Netlify Project Build Hook antwortete mit Status ${response.status}.`
      });
    }

    console.log("Propstack Project Build ausgelöst", {
      netlifyStatus: response.status,
      eventType: payload.event || payload.event_type || payload.type || null,
      projectId: payload.project_id || payload.projectId || payload.id || payload.data?.id || null
    });

    return jsonResponse(200, {
      ok: true,
      triggered: true,
      netlifyStatus: response.status
    });
  } catch (error) {
    console.error("Project Build Hook Fehler:", error);
    return jsonResponse(500, { ok: false, error: error.message });
  }
};
