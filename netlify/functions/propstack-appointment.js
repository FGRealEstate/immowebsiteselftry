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

    const lead = normalizeAppointmentPayload(data);

    if (!lead.firstName || !lead.lastName || !lead.email || !lead.date || !lead.time || !lead.consent) {
      return json(400, {
        success: false,
        error: "Pflichtfelder fehlen. Benötigt werden Vorname, Nachname, E-Mail, Datum, Uhrzeit und Datenschutz-Einwilligung."
      });
    }

    const slot = buildSlot(lead.date, lead.time);
    const fullName = `${lead.firstName} ${lead.lastName}`.trim();
    const note = buildNote({ ...lead, fullName, startsAt: slot.starts_at, endsAt: slot.ends_at });

    const availability = await checkSlotAvailability(apiKey, slot.starts_at, slot.ends_at);
    if (!availability.available) {
      return json(409, {
        success: false,
        error: "Dieser Termin ist leider gerade nicht mehr verfügbar. Bitte wählen Sie eine andere Uhrzeit."
      });
    }

    const contactPayload = buildContactPayload(lead, fullName, note);
    console.log("CONTACT PAYLOAD:", JSON.stringify(contactPayload, null, 2));

    const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);

    if (!contactId) {
      return json(500, {
        success: false,
        error: "Kontakt wurde erstellt/aktualisiert, aber keine Kontakt-ID erhalten.",
        propstack_response: contactResponse
      });
    }

    const updateResult = await safePut(apiKey, `/contacts/${contactId}`, {
      client: removeEmpty({
        description: note,
        note,
        accept_contact: true,
        gdpr_status: 2,
        partial_custom_fields: contactPayload.client.partial_custom_fields
      })
    });

    const eventResult = await createCalendarEvent(apiKey, {
      contactId,
      title: `${lead.appointmentType}: ${fullName}`,
      body: noteToHtml(note),
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      location: lead.address || "Telefon / Online",
      brokerId: clean(process.env.PROPSTACK_APPOINTMENT_BROKER_ID || process.env.PROPSTACK_BROKER_ID)
    });

    const reminderResult = await createReminderTask(apiKey, {
      contactId,
      title: `Termin vorbereiten: ${lead.appointmentType} – ${fullName}`,
      body: noteToHtml(note),
      dueDate: slot.starts_at,
      remindAt: addMinutesIso(slot.starts_at, -60),
      brokerId: clean(process.env.PROPSTACK_APPOINTMENT_BROKER_ID || process.env.PROPSTACK_BROKER_ID)
    });

    const mailResult = await sendNotificationMail({ ...lead, fullName, slotLabel: `${lead.date} ${lead.time}` });

    return json(200, {
      success: true,
      message: "Terminwunsch wurde erfolgreich übermittelt.",
      contact_id: contactId,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      contact: contactResponse,
      contact_update: updateResult,
      event: eventResult,
      reminder: reminderResult,
      notification_mail: mailResult
    });
  } catch (error) {
    console.error("PROPSTACK APPOINTMENT ERROR:", error);
    return json(500, {
      success: false,
      error: error.message,
      response: error.response || null
    });
  }
};

function normalizeAppointmentPayload(data) {
  const firstName = clean(data.first_name || data.firstName);
  const lastName = clean(data.last_name || data.lastName);
  const email = clean(data.email);
  const phone = clean(data.phone);
  const appointmentType = clean(data.appointment_type || data.appointmentType || data.topic) || "Ankaufsberatung";
  const date = clean(data.preferred_date || data.preferredDate || data.date);
  const rawTime = clean(data.preferred_time || data.preferredTime || data.time);
  const time = normalizeTime(rawTime);
  const address = clean(data.address || data.location || data.object_address || data.objectAddress);
  const message = clean(data.message || data.note || data.nachricht);
  const sourceUrl = clean(data.source_url || data.sourceUrl);

  return {
    firstName,
    lastName,
    email,
    phone,
    appointmentType,
    date,
    time,
    address,
    message,
    sourceUrl,
    utmSource: clean(data.utm_source || data.utmSource),
    utmMedium: clean(data.utm_medium || data.utmMedium),
    utmCampaign: clean(data.utm_campaign || data.utmCampaign),
    utmContent: clean(data.utm_content || data.utmContent),
    utmTerm: clean(data.utm_term || data.utmTerm),
    consent: data.privacy_consent === true || data.privacy_consent === "true" || data.consent === true || data.consent === "true"
  };
}

function buildContactPayload(lead, fullName, note) {
  const topicText = lead.appointmentType.toLowerCase();
  const isFinance = topicText.includes("finanz");
  const isBuyer = topicText.includes("ankauf") || topicText.includes("eigen") || topicText.includes("kapital") || isFinance;

  return {
    client: removeEmpty({
      first_name: lead.firstName,
      last_name: lead.lastName,
      name: fullName,
      email: lead.email,
      phone: lead.phone,
      source: "Website Terminbuchung",
      description: note,
      note,
      buyer: isBuyer,
      owner: false,
      accept_contact: true,
      gdpr_status: 2,
      warning_notice: "Terminwunsch prüfen",
      partial_custom_fields: removeEmpty({
        website_lead: true,
        anliegen: lead.appointmentType,
        lead_typ: "Terminbuchung",
        landingpage_typ: "Terminbuchung",
        standort: lead.address,
        objektadresse: lead.address,
        kontaktwunsch: "E-Mail",
        quelle_url: lead.sourceUrl,
        nachricht: lead.message,
        datenschutz_zugestimmt: true,
        finanzierung_interesse: isFinance ? "Ja" : undefined,
        finanzierungsberatung_gewunscht: isFinance ? "Ja" : undefined,
        website_rohdaten: compactJson(lead),
        utm_source: lead.utmSource,
        utm_medium: lead.utmMedium,
        utm_campaign: lead.utmCampaign,
        utm_content: lead.utmContent,
        utm_term: lead.utmTerm
      })
    })
  };
}

function buildNote(input) {
  return [
    "Neue Terminbuchung über die Website",
    "",
    `Terminart: ${input.appointmentType}`,
    `Name: ${input.fullName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone || "-"}`,
    `Wunschtermin: ${formatDate(input.date)} ${input.time} Uhr`,
    `Start im Kalender: ${input.startsAt}`,
    `Ende im Kalender: ${input.endsAt}`,
    `Adresse / Objekt / Suchgebiet: ${input.address || "-"}`,
    "",
    "Nachricht:",
    input.message || "-",
    "",
    "Einwilligung:",
    "Datenschutz-Einwilligung wurde aktiv bestätigt.",
    `Quelle: ${input.sourceUrl || "-"}`,
    "",
    "Marketing-Quelle:",
    `UTM Source: ${input.utmSource || "-"}`,
    `UTM Medium: ${input.utmMedium || "-"}`,
    `UTM Campaign: ${input.utmCampaign || "-"}`,
    `UTM Content: ${input.utmContent || "-"}`,
    `UTM Term: ${input.utmTerm || "-"}`
  ].join("\n");
}

async function checkSlotAvailability(apiKey, startsAt, endsAt) {
  const params = new URLSearchParams({
    starts_at_before: endsAt,
    ends_at_after: startsAt
  });

  const brokerId = clean(process.env.PROPSTACK_APPOINTMENT_BROKER_ID || process.env.PROPSTACK_BROKER_ID);
  if (brokerId) params.set("broker", brokerId);

  try {
    const response = await propstackGet(apiKey, `/events?${params.toString()}`);
    const events = normalizeArray(response)
      .filter((entry) => clean(entry.state).toLowerCase() !== "cancelled")
      .filter((entry) => Boolean(entry.starts_at && entry.ends_at));

    const requestedStart = new Date(startsAt).getTime();
    const requestedEnd = new Date(endsAt).getTime();

    const blocked = events.some((entry) => {
      const start = new Date(entry.starts_at).getTime();
      const end = new Date(entry.ends_at).getTime();
      return requestedStart < end && requestedEnd > start;
    });

    return { available: !blocked, blocked_events_count: events.length };
  } catch (error) {
    console.warn("SLOT AVAILABILITY CHECK FAILED:", error.message);
    return { available: true, skipped: true, reason: error.message };
  }
}

async function createCalendarEvent(apiKey, input) {
  const noteTypeId = numberOrNull(process.env.PROPSTACK_APPOINTMENT_NOTE_TYPE_ID);

  const payload = {
    task: removeEmpty({
      is_event: true,
      title: input.title,
      body: input.body,
      client_ids: [input.contactId],
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location,
      private: false,
      all_day: false,
      state: "neutral",
      broker_id: numberOrNull(input.brokerId),
      note_type_id: noteTypeId
    })
  };

  try {
    return await propstackPost(apiKey, "/tasks", payload);
  } catch (error) {
    console.warn("CALENDAR EVENT CREATE FAILED:", error.message);
    return { ok: false, skipped: true, reason: error.message, attempted_payload: payload };
  }
}

async function createReminderTask(apiKey, input) {
  const noteTypeId = numberOrNull(process.env.PROPSTACK_REMINDER_NOTE_TYPE_ID || process.env.PROPSTACK_APPOINTMENT_NOTE_TYPE_ID);

  const payload = {
    task: removeEmpty({
      is_reminder: true,
      title: input.title,
      body: input.body,
      client_ids: [input.contactId],
      due_date: input.dueDate,
      remind_at: input.remindAt,
      broker_id: numberOrNull(input.brokerId),
      note_type_id: noteTypeId
    })
  };

  try {
    return await propstackPost(apiKey, "/tasks", payload);
  } catch (error) {
    console.warn("REMINDER TASK CREATE FAILED:", error.message);
    return { ok: false, skipped: true, reason: error.message, attempted_payload: payload };
  }
}

async function sendNotificationMail(input) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return { sent: false, skipped: true, reason: "SMTP_USER oder SMTP_PASS nicht gesetzt" };
  }

  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: { ciphers: "TLSv1.2" }
  });

  const to = process.env.APPOINTMENT_NOTIFICATION_EMAIL || process.env.PROPSTACK_PORTAL_INQUIRY_EMAIL || "info@fg-realestate.de";

  const text = [
    "Neue Terminbuchung über die Website",
    "",
    `Terminart: ${input.appointmentType}`,
    `Name: ${input.fullName}`,
    `E-Mail: ${input.email}`,
    `Telefon: ${input.phone || "-"}`,
    `Termin: ${formatDate(input.date)} ${input.time} Uhr`,
    `Adresse / Suchgebiet: ${input.address || "-"}`,
    "",
    "Nachricht:",
    input.message || "-"
  ].join("\n");

  const result = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    replyTo: input.email,
    subject: `Neue Terminbuchung: ${input.appointmentType} – ${input.fullName}`,
    text
  });

  return { sent: true, messageId: result.messageId };
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  return parseResponse(response, endpoint);
}

async function propstackGet(apiKey, endpoint) {
  console.log("PROPSTACK GET:", endpoint);

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json"
    }
  });

  return parseResponse(response, endpoint);
}

async function propstackPut(apiKey, endpoint, body) {
  console.log("PROPSTACK PUT:", endpoint, JSON.stringify(body, null, 2));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });

  return parseResponse(response, endpoint);
}

async function safePut(apiKey, endpoint, body) {
  try {
    return await propstackPut(apiKey, endpoint, body);
  } catch (error) {
    console.warn("SAFE PUT SKIPPED:", error.message);
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function parseResponse(response, endpoint) {
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  console.log("PROPSTACK RESPONSE:", endpoint, response.status, data);

  if (!response.ok) {
    const error = new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
    error.response = data;
    throw error;
  }

  return data;
}

function buildSlot(date, time) {
  const duration = numberOrDefault(process.env.APPOINTMENT_SLOT_DURATION_MINUTES, 60);
  const normalizedTime = normalizeTime(time);
  const endTime = addMinutesToTime(normalizedTime, duration);

  return {
    time: normalizedTime,
    end_time: endTime,
    starts_at: toBerlinIso(date, normalizedTime),
    ends_at: toBerlinIso(date, endTime)
  };
}

function normalizeTime(value) {
  const text = clean(value).replace(" Uhr", "").split(/[–-]/)[0].trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return text;
  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

function addMinutesToTime(time, minutes) {
  const [hours, mins] = normalizeTime(time).split(":").map((value) => Number(value));
  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMins = total % 60;
  return `${pad(nextHours)}:${pad(nextMins)}`;
}

function addMinutesIso(iso, minutes) {
  const date = new Date(iso);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function toBerlinIso(date, time) {
  return `${date}T${time}:00${berlinOffset(date)}`;
}

function berlinOffset(date) {
  const [year, month, day] = date.split("-").map(Number);
  const current = Date.UTC(year, month - 1, day, 12, 0, 0);
  const dstStart = lastSundayUtc(year, 3);
  const dstEnd = lastSundayUtc(year, 10);
  return current >= dstStart && current < dstEnd ? "+02:00" : "+01:00";
}

function lastSundayUtc(year, month) {
  const date = new Date(Date.UTC(year, month, 0, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.getTime();
}

function normalizeArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.events)) return response.events;
  if (Array.isArray(response.tasks)) return response.tasks;
  if (Array.isArray(response.data)) return response.data;
  return [];
}

function removeEmpty(object) {
  const result = {};

  for (const [key, value] of Object.entries(object)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isPlainObject(value) && Object.keys(value).length === 0) continue;
    result[key] = value;
  }

  return result;
}

function getId(response, keys) {
  if (!response) return null;
  if (response.id) return response.id;

  for (const key of keys) {
    if (response[key] && response[key].id) return response[key].id;
  }

  if (response.data && response.data.id) return response.data.id;
  return null;
}

function noteToHtml(note) {
  return clean(note)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function formatDate(date) {
  const parts = clean(date).split("-");
  if (parts.length !== 3) return date;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function compactJson(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

