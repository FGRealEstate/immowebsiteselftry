const { sendInternalNotification } = require("./_shared/mailer");
const nachfrage = require("./_shared/nachfrage");
const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

/**
 * netlify/functions/bewertung-nachfrage.js (Update 19 §5, 30.10.2026)
 * Antworten aus dem Formular /immobilienbewertung/nachfrage/ (Link aus der Bestätigungsmail nach einer
 * Bewertungsanfrage, siehe _shared/nachfrage.js).
 *
 * - k aus dem Link prüfen (Kontakt-ID + Signatur mit NACHFRAGE_SECRET, ersatzweise dem Propstack-Schlüssel)
 * - Antworten als Aufgabe an denselben Propstack-Kontakt wie die erste Anfrage
 * - zusätzlich per Mail an das Postfach für Website-Anfragen (wie propstack-lead), damit nichts verloren
 *   geht, falls Propstack nicht antwortet
 */
exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return json(405, { success: false, error: "Method not allowed" });

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { success: false, error: "Ungültige Daten" });
  }

  // Honeypot wie in den anderen Formularen
  if (String(data.company_website || "").trim()) return json(200, { success: true, message: "Vielen Dank." });

  const secret = nachfrage.geheimnis(process.env);
  if (!secret) return json(500, { success: false, error: "Nachfrage ist nicht eingerichtet (kein Geheimnis für die Signatur)." });

  const contactId = await nachfrage.pruefen(secret, data.k);
  if (!contactId) return json(400, { success: false, error: "Der Link ist ungültig. Bitte öffnen Sie den Link aus unserer E-Mail." });

  const fehler = nachfrage.pruefeAntworten(data);
  if (fehler) return json(400, { success: false, error: fehler });

  const text = nachfrage.notiz(data, contactId);
  const title = `Bewertung: Antworten auf die Nachfrage – Kontakt ${contactId}`;

  let task = { ok: false, skipped: true, reason: "PROPSTACK_API_KEY fehlt" };
  const apiKey = process.env.PROPSTACK_API_KEY;
  if (apiKey) {
    task = await createTask(apiKey, { title, body: text, contactId });
  }

  const mail = await sendInternalNotification({ subject: title, text });

  if (task.ok === false && !mail.sent) {
    return json(502, { success: false, error: "Die Antworten konnten gerade nicht übermittelt werden.", task, mail });
  }
  return json(200, { success: true, message: "Vielen Dank, Ihre Antworten sind angekommen.", task, mail });
};

// Wie safeCreateFollowUpTask in propstack-lead.js: erst mit Uhrzeit, dann nur mit Datum
async function createTask(apiKey, { title, body, contactId }) {
  const dueAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const clientId = /^\d+$/.test(contactId) ? Number(contactId) : contactId;
  for (const due of [dueAt, dueAt.slice(0, 10)]) {
    try {
      const response = await fetch(`${PROPSTACK_BASE_URL}/tasks`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ task: { title, body, is_reminder: true, due_date: due, client_ids: [clientId] } }),
      });
      const raw = await response.text();
      if (response.ok) return { ok: true, status: response.status };
      console.warn("NACHFRAGE TASK FAILED:", response.status, raw.slice(0, 500));
    } catch (error) {
      console.warn("NACHFRAGE TASK ERROR:", error.message);
    }
  }
  return { ok: false, reason: "Aufgabe konnte per API nicht angelegt werden; die Antworten stehen in der Mail." };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

exports.handler = require("./_shared/formpost").wrap("bewertung-nachfrage", exports.handler);
