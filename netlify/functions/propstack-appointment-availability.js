const PROPSTACK_BASE_URL = process.env.PROPSTACK_API_BASE || "https://api.propstack.de/v1";

const DEFAULT_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "14:00",
  "15:00",
  "16:00"
];

exports.handler = async function (event) {
  console.log("PROPSTACK APPOINTMENT AVAILABILITY START", event.httpMethod);

  try {
    if (event.httpMethod !== "GET") {
      return json(405, { success: false, error: "Method not allowed" });
    }

    const apiKey = process.env.PROPSTACK_API_KEY;
    if (!apiKey) {
      return json(500, { success: false, error: "PROPSTACK_API_KEY fehlt" });
    }

    const date = clean(event.queryStringParameters && event.queryStringParameters.date);

    if (!isIsoDate(date)) {
      return json(400, { success: false, error: "Datum fehlt oder ist ungültig." });
    }

    const availability = await getAvailableSlots(apiKey, date);

    return json(200, {
      success: true,
      date,
      slots: availability.slots,
      blocked_events_count: availability.blockedEventsCount
    });
  } catch (error) {
    console.error("PROPSTACK APPOINTMENT AVAILABILITY ERROR:", error);
    return json(500, { success: false, error: error.message });
  }
};

async function getAvailableSlots(apiKey, date) {
  const slots = buildCandidateSlots(date);

  if (!slots.length) {
    return { slots: [], blockedEventsCount: 0 };
  }

  const dayStart = toBerlinIso(date, "00:00");
  const dayEnd = toBerlinIso(date, "23:59");

  const params = new URLSearchParams({
    starts_at_before: dayEnd,
    ends_at_after: dayStart
  });

  const brokerId = clean(process.env.PROPSTACK_APPOINTMENT_BROKER_ID || process.env.PROPSTACK_BROKER_ID);
  if (brokerId) params.set("broker", brokerId);

  let events = [];

  try {
    const response = await propstackGet(apiKey, `/events?${params.toString()}`);
    events = normalizeArray(response);
  } catch (error) {
    console.warn("EVENT AVAILABILITY READ FAILED:", error.message);
    events = [];
  }

  const busy = events
    .filter((entry) => clean(entry.state).toLowerCase() !== "cancelled")
    .map((entry) => ({
      start: new Date(entry.starts_at || entry.start || entry.startsAt).getTime(),
      end: new Date(entry.ends_at || entry.end || entry.endsAt).getTime()
    }))
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end));

  const now = Date.now();
  const freeSlots = slots.filter((slot) => {
    const start = new Date(slot.starts_at).getTime();
    const end = new Date(slot.ends_at).getTime();

    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    if (start <= now) return false;

    return !busy.some((blocked) => start < blocked.end && end > blocked.start);
  });

  return {
    slots: freeSlots.map((slot) => ({
      time: slot.time,
      label: `${slot.time}–${slot.end_time}`,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at
    })),
    blockedEventsCount: busy.length
  };
}

function buildCandidateSlots(date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6) return [];

  const duration = numberOrDefault(process.env.APPOINTMENT_SLOT_DURATION_MINUTES, 60);
  const rawSlots = clean(process.env.APPOINTMENT_SLOTS)
    ? clean(process.env.APPOINTMENT_SLOTS).split(",").map((slot) => clean(slot)).filter(Boolean)
    : DEFAULT_SLOTS;

  return rawSlots.map((time) => {
    const endTime = addMinutesToTime(time, duration);
    return {
      time,
      end_time: endTime,
      starts_at: toBerlinIso(date, time),
      ends_at: toBerlinIso(date, endTime)
    };
  });
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
    throw new Error(`Propstack Fehler ${response.status} bei ${endpoint}: ${JSON.stringify(data)}`);
  }

  return data;
}

function normalizeArray(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.events)) return response.events;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.tasks)) return response.tasks;
  return [];
}

function addMinutesToTime(time, minutes) {
  const [hours, mins] = clean(time).split(":").map((value) => Number(value));
  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMins = total % 60;
  return `${pad(nextHours)}:${pad(nextMins)}`;
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

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(clean(value));
}

function numberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
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
