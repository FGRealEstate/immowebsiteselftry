/*
 * Dedizierter Propstack -> Netlify Webhook für PROJEKTE.
 *
 * In Propstack diesen Endpoint für Projekt-Events hinterlegen:
 * https://fg-realestate.de/.netlify/functions/propstack-project-build-hook
 *
 * Die eigentliche Build-/Statuslogik bleibt zentral in propstack-build-hook.js.
 * Dieser Wrapper erzwingt lediglich entity_type="project", damit ein Projekt-
 * Event niemals versehentlich als Einheit interpretiert wird.
 */
const shared = require("./propstack-build-hook");

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body)
  };
}

exports.handler = async function projectBuildHook(event, context) {
  if (!["POST", "GET"].includes(event.httpMethod)) {
    return response(405, { ok: false, error: "Method Not Allowed" });
  }

  try {
    if (event.httpMethod === "POST") {
      const payload = event.body ? JSON.parse(event.body) : {};
      const forcedPayload = { ...payload, entity_type: "project", fg_webhook_source: "project" };
      return shared.handler({ ...event, body: JSON.stringify(forcedPayload) }, context);
    }

    const query = { ...(event.queryStringParameters || {}), entity_type: "project", fg_webhook_source: "project" };
    return shared.handler({ ...event, queryStringParameters: query }, context);
  } catch (error) {
    console.error("Project webhook wrapper error:", error);
    return response(400, { ok: false, error: "Invalid project webhook payload" });
  }
};
