const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

exports.handler = async function (event) {
  console.log("PROPSTACK APPOINTMENT START", event.httpMethod);

  try {
    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const data = JSON.parse(event.body || "{}");
    console.log("APPOINTMENT PAYLOAD:", JSON.stringify(data, null, 2));

    const firstName = clean(data.first_name);
    const lastName = clean(data.last_name);
    const email = clean(data.email);
    const phone = clean(data.phone);
    const appointmentType = clean(data.appointment_type) || "Ankaufsberatung";
    const preferredDate = clean(data.preferred_date);
    const preferredTime = clean(data.preferred_time);
    const address = clean(data.address);
    const message = clean(data.message);
    const sourceUrl = clean(data.source_url);
    const utmSource = clean(data.utm_source);
    const utmMedium = clean(data.utm_medium);
    const utmCampaign = clean(data.utm_campaign);
    const utmContent = clean(data.utm_content);
    const utmTerm = clean(data.utm_term);
    const consent = data.privacy_consent === true || data.privacy_consent === "true";

    if (!firstName || !lastName || !email || !preferredDate || !preferredTime || !consent) {
      return json(400, { success: false, error: "Pflichtfelder fehlen." });
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const startsAt = `${preferredDate}T${preferredTime}:00+02:00`;
    const endsAt = addMinutesIso(startsAt, 45);
    const appointmentLabel = `${preferredDate} ${preferredTime}`;

    const note = [
      "Neue Terminbuchung über die Website",
      "",
      `Terminart: ${appointmentType}`,
      `Name: ${fullName}`,
      `E-Mail: ${email}`,
      `Telefon: ${phone || "-"}`,
      `Wunschtermin: ${appointmentLabel}`,
      `Adresse / Objekt / Suchgebiet: ${address || "-"}`,
      "",
      "Nachricht:",
      message || "-",
      "",
      "Einwilligung: Datenschutz-Einwilligung wurde aktiv bestätigt.",
      `Quelle: ${sourceUrl || "-"}`,
      `UTM Source: ${utmSource || "-"}`,
      `UTM Medium: ${utmMedium || "-"}`,
      `UTM Campaign: ${utmCampaign || "-"}`,
      `UTM Content: ${utmContent || "-"}`,
      `UTM Term: ${utmTerm || "-"}`
    ].join("\n");

    const contactPayload = {
      client: removeEmpty({
        first_name: firstName,
        last_name: lastName,
        name: fullName,
        email,
        phone,
        source: "Website Terminbuchung",
        description: note,
        note,
        owner: true,
        buyer: appointmentType.toLowerCase().includes("ankauf") || appointmentType.toLowerCase().includes("finanz"),
        accept_contact: true,
        gdpr_status: 2,
        partial_custom_fields: removeEmpty({
          website_lead: true,
          anliegen: appointmentType,
          lead_typ: "Termin",
          landingpage_typ: "Terminbuchung",
          standort: address,
          objektadresse: address,
          kontaktwunsch: "E-Mail",
          quelle_url: sourceUrl,
          nachricht: message,
          datenschutz_zugestimmt: true,
          website_rohdaten: compactJson({ appointmentType, preferredDate, preferredTime, address, message, sourceUrl, utmSource, utmMedium, utmCampaign, utmContent, utmTerm }),
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          utm_content: utmContent,
          utm_term: utmTerm
        })
      })
    };

    const contact = await propstackPost(apiKey, "/contacts", contactPayload);
    const contactId = getId(contact, ["client", "contact", "data"]);

    const contactUpdate = contactId ? await safePut(apiKey, `/contacts/${contactId}`, {
      client: removeEmpty({
        description: note,
        note,
        partial_custom_fields: contactPayload.client.partial_custom_fields
      })
    }) : null;

    const noteResult = contactId ? await safeCreateNote(apiKey, contactId, note, `Terminwunsch: ${fullName}`) : null;
    const taskResult = contactId ? await safeCreateTask(apiKey, { contactId, title: `Termin bestätigen: ${appointmentType} – ${fullName}`, body: note, dueDate: preferredDate }) : null;
    const eventResult = contactId ? await safeCreateEvent(apiKey, { contactId, startsAt, endsAt, title: `${appointmentType}: ${fullName}`, body: note, location: address || "Online / Telefon" }) : null;
    const mailResult = await sendNotificationMail({ fullName, email, phone, appointmentType, preferredDate, preferredTime, address, message });

    return json(200, {
      success: true,
      message: "Terminwunsch wurde übermittelt.",
      contact_id: contactId,
      contact,
      contact_update: contactUpdate,
      note: noteResult,
      task: taskResult,
      event: eventResult,
      mail: mailResult
    });
  } catch (error) {
    console.error("PROPSTACK APPOINTMENT ERROR:", error);
    return json(500, { success: false, error: error.message });
  }
};

async function safeCreateEvent(apiKey, input) {
  const attempts = [
    { event: removeEmpty({ title: input.title, body: input.body, starts_at: input.startsAt, ends_at: input.endsAt, location: input.location, client_ids: [input.contactId], state: "neutral", private: false }) },
    { event: removeEmpty({ title: input.title, body: input.body, starts_at: input.startsAt, ends_at: input.endsAt, location: input.location, client_id: input.contactId, state: "neutral", private: false }) }
  ];
  for (const body of attempts) {
    try { return await propstackPost(apiKey, "/events", body); } catch (error) { console.warn("APPOINTMENT EVENT ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Kalenderevent konnte per API nicht angelegt werden. Aufgabe wurde dennoch versucht." };
}

async function safeCreateTask(apiKey, input) {
  const attempts = [
    { task: removeEmpty({ title: input.title, body: input.body, due_date: input.dueDate, client_ids: [input.contactId] }) },
    { task: removeEmpty({ title: input.title, body: input.body, due_date: input.dueDate }) }
  ];
  for (const body of attempts) {
    try { return await propstackPost(apiKey, "/tasks", body); } catch (error) { console.warn("APPOINTMENT TASK ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Aufgabe konnte per API nicht angelegt werden." };
}

async function safeCreateNote(apiKey, contactId, body, title) {
  const attempts = [
    { note: { client_id: contactId, title, body, note_type: "note" } },
    { note: { client_id: contactId, title, text: body } }
  ];
  for (const payload of attempts) {
    try { return await propstackPost(apiKey, "/notes", payload); } catch (error) { console.warn("APPOINTMENT NOTE ATTEMPT FAILED:", error.message); }
  }
  return { ok: false, skipped: true, reason: "Notiz konnte nicht separat angelegt werden." };
}

async function sendNotificationMail(input) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return { sent: false, skipped: true };

  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { ciphers: "TLSv1.2" }
  });

  const to = process.env.APPOINTMENT_NOTIFICATION_EMAIL || process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL || "info@fg-realestate.de";
  const text = `Neue Terminbuchung\n\nTerminart: ${input.appointmentType}\nName: ${input.fullName}\nE-Mail: ${input.email}\nTelefon: ${input.phone || "-"}\nTermin: ${input.preferredDate} ${input.preferredTime}\nAdresse: ${input.address || "-"}\n\nNachricht:\n${input.message || "-"}`;

  const result = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    replyTo: input.email,
    subject: `Neue Terminbuchung: ${input.appointmentType} – ${input.fullName}`,
    text
  });

  return { sent: true, messageId: result.messageId };
}

async function safePut(apiKey, endpoint, body) { try { return await propstackPut(apiKey, endpoint, body); } catch(error) { return { ok: false, skipped: true, reason: error.message }; } }

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response, endpoint);
}

async function propstackPut(apiKey, endpoint, body) {
  console.log("PROPSTACK PUT:", endpoint, JSON.stringify(body, null, 2));
  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  return parseResponse(response, endpoint);
}

async function parseResponse(response, endpoint) {
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  console.log("PROPSTACK RESPONSE:", endpoint, response.status, data);
  if (!response.ok) throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
  return data;
}

function clean(value) { if (value === null || value === undefined) return ""; return String(value).trim(); }
function removeEmpty(object) { const result = {}; for (const [key, value] of Object.entries(object)) { if (value === null || value === undefined || value === "") continue; if (Array.isArray(value) && value.length === 0) continue; result[key] = value; } return result; }
function getId(response, keys) { if (!response) return null; if (response.id) return response.id; for (const key of keys) if (response[key]?.id) return response[key].id; if (response.data?.id) return response.data.id; return null; }
function addMinutesIso(iso, minutes) { const d = new Date(iso); d.setMinutes(d.getMinutes() + minutes); return d.toISOString(); }
function compactJson(value) { try { return JSON.stringify(value); } catch { return ""; } }
function json(statusCode, body) { return { statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }; }
