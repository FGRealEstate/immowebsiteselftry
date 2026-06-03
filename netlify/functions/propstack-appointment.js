const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
  console.log("PROPSTACK APPOINTMENT START", event.httpMethod);
  try {
    if (event.httpMethod !== "POST") return json(405, { success: false, error: "Method not allowed" });
    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    const data = JSON.parse(event.body || "{}");

    const firstName = clean(data.first_name);
    const lastName = clean(data.last_name);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const preferredDate = clean(data.preferred_date);
    const preferredTime = clean(data.preferred_time);
    const address = clean(data.address);
    const message = clean(data.message);
    const sourceUrl = clean(data.source_url);
    const consent = data.privacy_consent === true || data.privacy_consent === "true";
    if (!firstName || !lastName || !email || !preferredDate || !preferredTime || !consent) return json(400, { success: false, error: "Pflichtfelder fehlen." });

    const fullName = `${firstName} ${lastName}`.trim();
    const startsAt = `${preferredDate}T${preferredTime}:00+02:00`;
    const endsAt = addMinutesIso(startsAt, 45);
    const note = [
      "Neue Terminbuchung Ankaufsberatung über die Website",
      "",
      `Name: ${fullName}`,
      `E-Mail: ${email}`,
      `Telefon: ${phone || "-"}`,
      `Wunschtermin: ${preferredDate} ${preferredTime}`,
      `Adresse / Objekt: ${address || "-"}`,
      "",
      "Nachricht:", message || "-", "",
      "Einwilligung: Datenschutz-Einwilligung wurde aktiv bestätigt.",
      `Quelle: ${sourceUrl || "-"}`
    ].join("\n");

    const contact = await propstackPost(apiKey, "/contacts", { client: removeEmpty({ first_name: firstName, last_name: lastName, name: fullName, email, phone, source: "Website Terminbuchung", note, owner: true, partial_custom_fields: removeEmpty({ termin_ankaufsberatung_gewuenscht: true, termin_wunschtermin: `${preferredDate} ${preferredTime}`, objektadresse: address, quelle_url: sourceUrl }) }) });
    const contactId = getId(contact, ["client", "contact", "data"]);

    const eventResult = await safeCreateEvent(apiKey, { contactId, startsAt, endsAt, title: `Ankaufsberatung: ${fullName}`, body: note, location: address || "Online / Telefon" });
    await sendNotificationMail({ fullName, email, phone, preferredDate, preferredTime, address, message });

    return json(200, { success: true, message: "Terminwunsch wurde übermittelt.", contact_id: contactId, contact, event: eventResult });
  } catch (error) {
    console.error("PROPSTACK APPOINTMENT ERROR:", error);
    return json(500, { success: false, error: error.message });
  }
};

async function safeCreateEvent(apiKey, input) {
  const attempts = [
    { endpoint: "/events", body: { event: removeEmpty({ title: input.title, body: input.body, starts_at: input.startsAt, ends_at: input.endsAt, location: input.location, client_id: input.contactId, state: "neutral", private: false }) } },
    { endpoint: "/tasks", body: { task: removeEmpty({ title: input.title, body: input.body, due_date: input.startsAt.slice(0, 10), client_id: input.contactId }) } }
  ];
  for (const attempt of attempts) {
    try { return await propstackPost(apiKey, attempt.endpoint, attempt.body); } catch (error) { console.warn("APPOINTMENT CREATE ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Termin/Aufgabe konnte per API nicht angelegt werden." };
}

async function sendNotificationMail(input) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, skipped: true };
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST || "smtp.office365.com", port: Number(process.env.SMTP_PORT || 587), secure: false, requireTLS: true, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, tls: { ciphers: "TLSv1.2" } });
  const to = process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL || "info@fg-realestate.de";
  const text = `Neue Terminbuchung Ankaufsberatung\n\nName: ${input.fullName}\nE-Mail: ${input.email}\nTelefon: ${input.phone || "-"}\nTermin: ${input.preferredDate} ${input.preferredTime}\nAdresse: ${input.address || "-"}\n\nNachricht:\n${input.message || "-"}`;
  const result = await transporter.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, replyTo: input.email, subject: `Neue Terminbuchung Ankaufsberatung: ${input.fullName}`, text });
  return { sent: true, messageId: result.messageId };
}

async function propstackPost(apiKey, endpoint, body) { const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, { method: "POST", headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) }); const text = await response.text(); let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; } console.log("PROPSTACK RESPONSE:", endpoint, response.status, data); if (!response.ok) throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`); return data; }
function clean(value) { if (value === null || value === undefined) return ""; return String(value).trim(); }
function removeEmpty(object) { const result = {}; for (const [key, value] of Object.entries(object)) { if (value === null || value === undefined || value === "") continue; result[key] = value; } return result; }
function getId(response, keys) { if (!response) return null; if (response.id) return response.id; for (const key of keys) if (response[key]?.id) return response[key].id; if (response.data?.id) return response.data.id; return null; }
function addMinutesIso(iso, minutes) { const d = new Date(iso); d.setMinutes(d.getMinutes() + minutes); return d.toISOString(); }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
