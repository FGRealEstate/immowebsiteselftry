const PROPSTACK_BASE_URL =
  process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

const MICROSOFT_GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const CALENDAR_USER =
  process.env.MICROSOFT_CALENDAR_USER || "info@fg-realestate.de";

exports.handler = async function (event) {
  console.log("PROPSTACK APPOINTMENT START");
  console.log("METHOD:", event.httpMethod);

  try {
    if (event.httpMethod === "OPTIONS") {
      return json(200, { ok: true });
    }

    if (event.httpMethod !== "POST") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const booking = normalizeBookingPayload(JSON.parse(event.body || "{}"));
    console.log("BOOKING PAYLOAD:", JSON.stringify(booking, null, 2));

    if (
      !booking.firstName ||
      !booking.lastName ||
      !booking.email ||
      !booking.date ||
      !booking.time ||
      !booking.privacyConsent
    ) {
      return json(400, {
        success: false,
        error:
          "Pflichtfelder fehlen. Vorname, Nachname, E-Mail, Datum, Uhrzeit und Datenschutz-Einwilligung sind erforderlich.",
      });
    }

    const fullName = `${booking.firstName} ${booking.lastName}`.trim();
    const note = buildAppointmentNote(booking);

    // 1) Kontakt in Propstack anlegen/aktualisieren
    const contactPayload = {
      client: removeEmpty({
        first_name: booking.firstName,
        last_name: booking.lastName,
        name: fullName,
        email: booking.email,
        phone: booking.phone || "",
        source: "Website Terminbuchung",
        description: note,
        note,
        warning_notice: "Terminwunsch Website",
        accept_contact: true,
        gdpr_status: 2,
        partial_custom_fields: removeEmpty({
          website_lead: true,
          landingpage_typ: booking.appointmentTypeLabel,
          anliegen: booking.appointmentTypeLabel,
          kontaktwunsch: "Termin",
          quelle_url: booking.sourceUrl,
          datenschutz_zugestimmt: true,
          nachricht: booking.message,
          website_rohdaten: safeStringify(booking),
          utm_source: booking.utmSource,
          utm_medium: booking.utmMedium,
          utm_campaign: booking.utmCampaign,
          utm_content: booking.utmContent,
          utm_term: booking.utmTerm,
        }),
      }),
    };

    console.log("CONTACT PAYLOAD:", JSON.stringify(contactPayload, null, 2));

    const contactResponse = await propstackPost(apiKey, "/contacts", contactPayload);
    const contactId = getId(contactResponse, ["client", "contact", "data"]);

    if (!contactId) {
      return json(500, {
        success: false,
        error: "Kontakt wurde erstellt/aktualisiert, aber keine Kontakt-ID erhalten.",
        propstack_response: contactResponse,
      });
    }

    console.log("CONTACT SAVED:", contactId);

    // 2) Kontakt sicher nochmal patchen, falls Propstack beim POST Felder ignoriert
    const contactUpdateResult = await safeUpdateContact(apiKey, contactId, contactPayload.client);

    // 3) Microsoft Outlook/Teams Termin erstellen
    const microsoftToken = await getMicrosoftAccessToken();
    const microsoftEvent = await createMicrosoftTeamsCalendarEvent(
      microsoftToken,
      booking,
      fullName,
      note
    );

    console.log("MICROSOFT EVENT:", JSON.stringify(microsoftEvent, null, 2));

    const teamsJoinUrl =
      microsoftEvent?.onlineMeeting?.joinUrl ||
      microsoftEvent?.onlineMeetingUrl ||
      null;

    const outlookEventId = microsoftEvent?.id || null;
    const outlookWebLink = microsoftEvent?.webLink || null;

    // 4) Propstack Aufgabe/Aktivität erzeugen
    const taskResult = await safeCreateTask(apiKey, {
      contactId,
      booking,
      note: buildAppointmentTaskNote({
        booking,
        note,
        teamsJoinUrl,
        outlookWebLink,
        outlookEventId,
      }),
    });

    // 5) Optional zusätzlich Propstack Event probieren; falls API es nicht mag, nicht abbrechen
    const propstackEventResult = await safeCreatePropstackEvent(apiKey, {
      contactId,
      booking,
      note,
      teamsJoinUrl,
      outlookWebLink,
      outlookEventId,
    });

    return json(200, {
      success: true,
      message: "Ihr Terminwunsch wurde erfolgreich übermittelt.",
      contact_id: contactId,
      contact: contactResponse,
      contact_update: contactUpdateResult,
      microsoft_event: {
        id: outlookEventId,
        webLink: outlookWebLink,
        teamsJoinUrl,
      },
      propstack_task: taskResult,
      propstack_event: propstackEventResult,
    });
  } catch (error) {
    console.error("PROPSTACK APPOINTMENT ERROR:", error);

    return json(500, {
      success: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
};

/* =========================================================
   MICROSOFT GRAPH / TEAMS
========================================================= */

async function getMicrosoftAccessToken() {
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft ENV fehlt: MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID oder MICROSOFT_CLIENT_SECRET."
    );
  }

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    const error = new Error(
      `Microsoft Token Fehler ${response.status}: ${JSON.stringify(data)}`
    );
    error.response = data;
    throw error;
  }

  return data.access_token;
}

async function createMicrosoftTeamsCalendarEvent(accessToken, booking, fullName, note) {
  const start = buildBerlinDate(booking.date, booking.time);
  const durationMinutes = numberOrNull(booking.durationMinutes) || 60;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const subject = buildAppointmentSubject(booking, fullName);

  const bodyHtml = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;">
      <h2>${escapeHtml(subject)}</h2>
      <p>Vielen Dank für Ihre Terminbuchung. Der Termin findet online über Microsoft Teams statt.</p>

      <h3>Kontaktdaten</h3>
      <p>
        <strong>Name:</strong> ${escapeHtml(fullName)}<br>
        <strong>E-Mail:</strong> ${escapeHtml(booking.email)}<br>
        <strong>Telefon:</strong> ${escapeHtml(booking.phone || "-")}
      </p>

      <h3>Termin</h3>
      <p>
        <strong>Datum:</strong> ${escapeHtml(booking.date)}<br>
        <strong>Uhrzeit:</strong> ${escapeHtml(booking.time)} Uhr<br>
        <strong>Dauer:</strong> ${durationMinutes} Minuten<br>
        <strong>Terminart:</strong> ${escapeHtml(booking.appointmentTypeLabel || "-")}
      </p>

      <h3>Anliegen</h3>
      <p>${escapeHtml(booking.message || "-").replace(/\n/g, "<br>")}</p>

      <hr>
      <pre style="white-space:pre-wrap;font-family:Arial,sans-serif;">${escapeHtml(note)}</pre>
    </div>
  `;

  const payload = {
    subject,
    body: {
      contentType: "HTML",
      content: bodyHtml,
    },
    start: {
      dateTime: formatMicrosoftLocalDateTime(start),
      timeZone: "Europe/Berlin",
    },
    end: {
      dateTime: formatMicrosoftLocalDateTime(end),
      timeZone: "Europe/Berlin",
    },
    attendees: [
      {
        emailAddress: {
          address: booking.email,
          name: fullName,
        },
        type: "required",
      },
    ],
    location: {
      displayName: "Microsoft Teams",
    },
    isOnlineMeeting: true,
    onlineMeetingProvider: "teamsForBusiness",
    allowNewTimeProposals: true,
    reminderMinutesBeforeStart: 60,
    isReminderOn: true,
  };

  console.log("MICROSOFT EVENT PAYLOAD:", JSON.stringify(payload, null, 2));

  const response = await fetch(
    `${MICROSOFT_GRAPH_BASE_URL}/users/${encodeURIComponent(CALENDAR_USER)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: 'outlook.timezone="Europe/Berlin"',
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      `Microsoft Kalender Fehler ${response.status}: ${JSON.stringify(data)}`
    );
    error.response = data;
    throw error;
  }

  return data;
}

/* =========================================================
   PROPSTACK
========================================================= */

async function safeUpdateContact(apiKey, contactId, clientPayload) {
  try {
    const result = await propstackPut(apiKey, `/contacts/${contactId}`, {
      client: clientPayload,
    });
    return { ok: true, result };
  } catch (error) {
    console.warn("CONTACT UPDATE SKIPPED:", error.message);
    return { ok: false, skipped: true, reason: error.message };
  }
}

async function safeCreateTask(apiKey, input) {
  const dueDate = buildBerlinDate(input.booking.date, input.booking.time).toISOString();

  const attempts = [
    {
      label: "client_ids",
      endpoint: "/tasks",
      payload: {
        task: removeEmpty({
          title: buildAppointmentTaskTitle(input.booking),
          body: input.note,
          is_reminder: true,
          due_date: dueDate,
          client_ids: [input.contactId],
        }),
      },
    },
    {
      label: "client_id",
      endpoint: "/tasks",
      payload: {
        task: removeEmpty({
          title: buildAppointmentTaskTitle(input.booking),
          body: input.note,
          is_reminder: true,
          due_date: dueDate,
          client_id: input.contactId,
        }),
      },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      console.log("TASK CREATE ATTEMPT:", attempt.label);
      const result = await propstackPost(apiKey, attempt.endpoint, attempt.payload);
      return { ok: true, attempt: attempt.label, result };
    } catch (error) {
      lastError = error;
      console.warn("TASK CREATE ATTEMPT FAILED:", attempt.label, error.message);
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastError ? lastError.message : "Aufgabe konnte nicht erstellt werden.",
  };
}

async function safeCreatePropstackEvent(apiKey, input) {
  const start = buildBerlinDate(input.booking.date, input.booking.time);
  const durationMinutes = numberOrNull(input.booking.durationMinutes) || 60;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const description = buildAppointmentTaskNote({
    booking: input.booking,
    note: input.note,
    teamsJoinUrl: input.teamsJoinUrl,
    outlookWebLink: input.outlookWebLink,
    outlookEventId: input.outlookEventId,
  });

  const attempts = [
    {
      label: "event wrapper",
      payload: {
        event: removeEmpty({
          title: buildAppointmentSubject(
            input.booking,
            `${input.booking.firstName} ${input.booking.lastName}`.trim()
          ),
          body: description,
          description,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          client_ids: [input.contactId],
          state: "neutral",
        }),
      },
    },
    {
      label: "task wrapper event endpoint",
      payload: {
        task: removeEmpty({
          title: buildAppointmentSubject(
            input.booking,
            `${input.booking.firstName} ${input.booking.lastName}`.trim()
          ),
          body: description,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          client_ids: [input.contactId],
        }),
      },
    },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      console.log("PROPSTACK EVENT CREATE ATTEMPT:", attempt.label);
      const result = await propstackPost(apiKey, "/events", attempt.payload);
      return { ok: true, attempt: attempt.label, result };
    } catch (error) {
      lastError = error;
      console.warn("PROPSTACK EVENT CREATE ATTEMPT FAILED:", attempt.label, error.message);
    }
  }

  return {
    ok: false,
    skipped: true,
    reason: lastError ? lastError.message : "Propstack Event konnte nicht erstellt werden.",
  };
}

async function propstackPost(apiKey, endpoint, body) {
  console.log("PROPSTACK POST:", endpoint, JSON.stringify(body, null, 2));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return parsePropstackResponse(response, endpoint);
}

async function propstackPut(apiKey, endpoint, body) {
  console.log("PROPSTACK PUT:", endpoint, JSON.stringify(body, null, 2));

  const response = await fetch(`${PROPSTACK_BASE_URL}${endpoint}`, {
    method: "PUT",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return parsePropstackResponse(response, endpoint);
}

async function parsePropstackResponse(response, endpoint) {
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  console.log("PROPSTACK RESPONSE:", endpoint, response.status, data);

  if (!response.ok) {
    const error = new Error(
      `Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`
    );
    error.response = data;
    throw error;
  }

  return data;
}

/* =========================================================
   NORMALIZATION
========================================================= */

function normalizeBookingPayload(data) {
  const appointmentType = clean(
    data.appointment_type ||
      data.appointmentType ||
      data.type ||
      data.terminart ||
      "Ankaufsberatung"
  );

  const date = clean(data.date || data.appointment_date || data.appointmentDate);
  const time = clean(data.time || data.appointment_time || data.appointmentTime);

  return {
    firstName: clean(data.first_name || data.firstName || data.vorname),
    lastName: clean(data.last_name || data.lastName || data.nachname),
    email: clean(data.email || data.e_mail),
    phone: clean(data.phone || data.telefon || data.mobile),
    date,
    time: normalizeTime(time),
    durationMinutes: numberOrNull(data.duration_minutes || data.durationMinutes) || 60,
    appointmentType,
    appointmentTypeLabel: mapAppointmentTypeLabel(appointmentType),
    address: clean(data.address || data.location || data.objektadresse || data.suchgebiet),
    message: clean(data.message || data.nachricht || data.anliegen),
    sourceUrl: clean(data.source_url || data.sourceUrl || data.page_url),
    privacyConsent:
      data.privacy_consent === true ||
      data.privacy_consent === "true" ||
      data.privacy === "zugestimmt" ||
      data.consent === true ||
      data.consent === "true",
    utmSource: clean(data.utm_source),
    utmMedium: clean(data.utm_medium),
    utmCampaign: clean(data.utm_campaign),
    utmContent: clean(data.utm_content),
    utmTerm: clean(data.utm_term),
    raw: data,
  };
}

function buildAppointmentNote(booking) {
  return [
    "Neue Terminbuchung über die Website",
    "",
    `Name: ${booking.firstName} ${booking.lastName}`,
    `E-Mail: ${booking.email}`,
    `Telefon: ${booking.phone || "-"}`,
    `Terminart: ${booking.appointmentTypeLabel || "-"}`,
    `Datum: ${booking.date}`,
    `Uhrzeit: ${booking.time}`,
    `Dauer: ${booking.durationMinutes || 60} Minuten`,
    `Objektadresse / Suchgebiet: ${booking.address || "-"}`,
    "",
    "Anliegen:",
    booking.message || "-",
    "",
    "Marketing-Quelle:",
    `UTM Source: ${booking.utmSource || "-"}`,
    `UTM Medium: ${booking.utmMedium || "-"}`,
    `UTM Campaign: ${booking.utmCampaign || "-"}`,
    `UTM Content: ${booking.utmContent || "-"}`,
    `UTM Term: ${booking.utmTerm || "-"}`,
    "",
    "Einwilligung:",
    "Datenschutz-Einwilligung wurde aktiv bestätigt.",
    `Zeitpunkt: ${new Date().toISOString()}`,
    `Quelle: ${booking.sourceUrl || "-"}`,
  ].join("\n");
}

function buildAppointmentTaskNote(input) {
  return [
    input.note,
    "",
    "Microsoft Teams / Outlook:",
    `Teams-Link: ${input.teamsJoinUrl || "-"}`,
    `Outlook-Link: ${input.outlookWebLink || "-"}`,
    `Outlook Event ID: ${input.outlookEventId || "-"}`,
  ].join("\n");
}

function buildAppointmentSubject(booking, fullName) {
  return `${booking.appointmentTypeLabel || "Termin"} – ${fullName}`;
}

function buildAppointmentTaskTitle(booking) {
  return `Termin prüfen: ${booking.appointmentTypeLabel || "Website"} – ${booking.firstName} ${booking.lastName}`;
}

function mapAppointmentTypeLabel(value) {
  const text = normalize(value);

  if (text.includes("kapital") || text.includes("investment")) {
    return "Ankaufsberatung Kapitalanlage";
  }

  if (text.includes("eigen") || text.includes("selbstnutzer")) {
    return "Ankaufsberatung Eigennutzer";
  }

  if (text.includes("finanz")) {
    return "Finanzierungsberatung";
  }

  if (text.includes("verkauf") || text.includes("bewertung")) {
    return "Verkaufsberatung";
  }

  return clean(value) || "Ankaufsberatung";
}

/* =========================================================
   DATE HELPERS
========================================================= */

function buildBerlinDate(dateString, timeString) {
  const date = clean(dateString);
  const time = normalizeTime(timeString);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Ungültiges Datum: ${dateString}`);
  }

  if (!/^\d{2}:\d{2}$/.test(time)) {
    throw new Error(`Ungültige Uhrzeit: ${timeString}`);
  }

  // Sommerzeit/Winterzeit robust genug für Deutschland ohne externe Library:
  // Microsoft bekommt zusätzlich timeZone Europe/Berlin.
  return new Date(`${date}T${time}:00`);
}

function formatMicrosoftLocalDateTime(date) {
  const pad = (number) => String(number).padStart(2, "0");

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
    ":00",
  ].join("");
}

function normalizeTime(value) {
  const text = clean(value);

  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return text;

  return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
}

/* =========================================================
   GENERAL HELPERS
========================================================= */

function getId(response, keys) {
  if (!response) return null;
  if (response.id) return response.id;

  for (const key of keys) {
    if (response[key] && response[key].id) return response[key].id;
  }

  if (response.data && response.data.id) return response.data.id;
  return null;
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalize(value) {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

function numberOrNull(value) {
  const text = clean(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!text) return null;

  const number = Number(text);
  return Number.isNaN(number) ? null : number;
}

function removeEmpty(object) {
  const result = {};

  for (const [key, value] of Object.entries(object || {})) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (isPlainObject(value) && Object.keys(value).length === 0) continue;

    result[key] = value;
  }

  return result;
}

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function safeStringify(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return "";
  }
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}
