/*
 * Update 32 §7.3 (05.11.2026): Geheimnis und Sammel-Build für die Propstack-Webhooks
 * (propstack-build-hook, propstack-project-build-hook, propstack-build-sammler).
 *
 * 1. Geheimnis: Ist PROPSTACK_WEBHOOK_SECRET gesetzt, nimmt ein Webhook nur noch Ereignisse an, die
 *    - die Propstack-Signatur tragen (Kopfzeile X-Propstack-Signature = HMAC-SHA256 des Rohtexts, hex;
 *      Propstack schickt sie, wenn beim Anlegen des Webhooks in der Web-Oberfläche ein „Secret Key“
 *      eingetragen ist, docs.propstack.de/reference/webhooks), oder
 *    - ?token=<Geheimnis> in der Adresse haben (für Webhooks, die per API angelegt sind).
 *    Ohne PROPSTACK_WEBHOOK_SECRET verhalten sich die Webhooks wie bisher und schreiben eine Warnung ins Log
 *    (Übergang, bis Propstack und Netlify umgestellt sind).
 *
 * 2. Sammeln: Ein Ereignis, das einen Build braucht, löst ihn nicht sofort aus, sondern wird in Netlify Blobs
 *    vorgemerkt („offen“). Die geplante Funktion propstack-build-sammler (alle 2 Minuten, netlify.toml) löst
 *    einen Build aus, sobald das erste vorgemerkte Ereignis PROPSTACK_BUILD_DEBOUNCE_SECONDS alt ist
 *    (Standard 180 s). Alles, was bis dahin kommt, steckt im selben Build; der Build liest die Daten erst
 *    beim Start aus Propstack.
 *    Sicherungen, damit keine Änderung liegen bleibt (dann wird wie bisher sofort gebaut):
 *    - Blobs nicht erreichbar oder Fehler beim Lesen/Schreiben;
 *    - der Sammler hat sich seit 6 Minuten nicht gemeldet (Lebenszeichen „sammler-lebt“);
 *    - das älteste offene Ereignis wartet schon länger als Sammelzeit + 10 Minuten;
 *    - PROPSTACK_BUILD_SAMMELN=aus.
 *
 * Logs ohne Personendaten: nur Typ und ID des Datensatzes, Zeiten und Zähler.
 */

const crypto = require("crypto");

const STORE_NAME = "propstack-build-sammler";
const SCHLUESSEL_OFFEN = "offen";
const SCHLUESSEL_LEBT = "sammler-lebt";
const LEBT_MAX_MS = 6 * 60 * 1000;
const HAENGT_ZUSATZ_MS = 10 * 60 * 1000;

let testSpeicher = null;

function sammelSekunden() {
  const value = Number(process.env.PROPSTACK_BUILD_DEBOUNCE_SECONDS || 180);
  return Number.isFinite(value) && value >= 0 ? value : 180;
}

function gleich(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function kopfWert(headers, name) {
  const gesucht = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (key.toLowerCase() === gesucht) return Array.isArray(value) ? value[0] : value;
  }
  return "";
}

/** Prüft das Webhook-Geheimnis. { ok, aktiv, art } – aktiv=false heißt: kein Geheimnis gesetzt (Übergang). */
function geheimnisPruefen(event) {
  const geheimnis = process.env.PROPSTACK_WEBHOOK_SECRET || "";
  if (!geheimnis) {
    console.warn("Propstack-Webhook: PROPSTACK_WEBHOOK_SECRET ist nicht gesetzt, Ereignis ohne Geheimnis angenommen (Übergang, Update 32 §7.3).");
    return { ok: true, aktiv: false, art: "ohne" };
  }
  const token = event?.queryStringParameters?.token;
  if (token && gleich(token, geheimnis)) return { ok: true, aktiv: true, art: "token" };

  const signatur = String(kopfWert(event?.headers, "x-propstack-signature") || "").trim().toLowerCase().replace(/^sha256=/, "");
  if (signatur && event?.body != null) {
    const roh = event.isBase64Encoded ? Buffer.from(event.body, "base64") : Buffer.from(String(event.body), "utf8");
    const soll = crypto.createHmac("sha256", geheimnis).update(roh).digest("hex");
    if (gleich(signatur, soll)) return { ok: true, aktiv: true, art: "signatur" };
  }
  console.warn("Propstack-Webhook abgewiesen: Geheimnis fehlt oder stimmt nicht.", {
    methode: event?.httpMethod || null,
    signatur: Boolean(signatur),
    token: Boolean(token)
  });
  return { ok: false, aktiv: true, art: "falsch" };
}

function speicherOeffnen(event) {
  if (testSpeicher) return testSpeicher;
  if (/^(aus|0|false|nein)$/i.test(String(process.env.PROPSTACK_BUILD_SAMMELN || "").trim())) return null;
  try {
    const { connectLambda, getStore } = require("@netlify/blobs");
    if (event && event.blobs) connectLambda(event);
    return getStore({ name: STORE_NAME, consistency: "strong" });
  } catch (error) {
    console.warn("Build-Sammler: Netlify Blobs nicht verfügbar.", error.message);
    return null;
  }
}

function buildHookUrl(entityType) {
  return entityType === "project"
    ? (process.env.NETLIFY_PROJECT_BUILD_HOOK_URL || process.env.NETLIFY_BUILD_HOOK_URL)
    : (process.env.NETLIFY_BUILD_HOOK_URL || process.env.NETLIFY_PROJECT_BUILD_HOOK_URL);
}

/** Löst den Netlify-Build sofort aus. titel erscheint in Netlify als Auslöser des Deploys. */
async function sofortBauen(entityType, titel) {
  const url = buildHookUrl(entityType);
  if (!url) {
    throw new Error(entityType === "project" ? "NETLIFY_PROJECT_BUILD_HOOK_URL fehlt." : "NETLIFY_BUILD_HOOK_URL fehlt.");
  }
  let ziel = url;
  if (titel) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("trigger_title", String(titel).slice(0, 120));
      ziel = parsed.toString();
    } catch {
      ziel = url;
    }
  }
  const response = await fetch(ziel, { method: "POST" });
  if (!response.ok) {
    throw new Error(`Netlify Build Hook antwortete mit Status ${response.status}.`);
  }
  return { triggered: true, netlifyStatus: response.status };
}

/**
 * Für die Webhooks: Build vormerken (Sammeln) oder, wenn das nicht sicher geht, sofort auslösen.
 * details: { entityType, entityId }. Wirft nur, wenn auch der sofortige Build scheitert.
 */
async function bauenOderVormerken(event, details = {}) {
  const typ = details.entityType || "unknown";
  const id = details.entityId == null ? null : String(details.entityId).slice(0, 20);
  const sofort = async (grund) => {
    console.log("Build-Sammler: sofort bauen.", { grund, typ, id });
    const r = await sofortBauen(typ, `Propstack ${typ} ${id || ""} (sofort: ${grund})`);
    return { ...r, gesammelt: false, grund };
  };

  const speicher = speicherOeffnen(event);
  if (!speicher) return sofort("kein Speicher");

  let offen;
  try {
    const lebt = await speicher.get(SCHLUESSEL_LEBT, { type: "json" });
    const lebtAm = lebt && Date.parse(lebt.am);
    if (!lebtAm || Date.now() - lebtAm > LEBT_MAX_MS) return sofort("Sammler ohne Lebenszeichen");
    offen = await speicher.get(SCHLUESSEL_OFFEN, { type: "json" });
  } catch (error) {
    console.warn("Build-Sammler: Lesen fehlgeschlagen.", error.message);
    return sofort("Speicherfehler beim Lesen");
  }

  const jetzt = Date.now();
  const seit = offen && Date.parse(offen.seit);
  if (seit && jetzt - seit > sammelSekunden() * 1000 + HAENGT_ZUSATZ_MS) {
    const r = await sofort("offene Gruppe zu alt");
    try { await speicher.delete(SCHLUESSEL_OFFEN); } catch {}
    return r;
  }

  const neu = seit
    ? { ...offen, zuletzt: new Date(jetzt).toISOString(), anzahl: (Number(offen.anzahl) || 1) + 1 }
    : { seit: new Date(jetzt).toISOString(), zuletzt: new Date(jetzt).toISOString(), anzahl: 1 };
  neu.letzte = [...(Array.isArray(offen?.letzte) ? offen.letzte : []), { typ, id }].slice(-10);
  try {
    await speicher.setJSON(SCHLUESSEL_OFFEN, neu);
  } catch (error) {
    console.warn("Build-Sammler: Vormerken fehlgeschlagen.", error.message);
    return sofort("Speicherfehler beim Schreiben");
  }
  const bauAb = new Date(Date.parse(neu.seit) + sammelSekunden() * 1000).toISOString();
  console.log("Build-Sammler: vorgemerkt.", { typ, id, anzahl: neu.anzahl, seit: neu.seit, bauAb });
  return { triggered: false, gesammelt: true, anzahl: neu.anzahl, seit: neu.seit, bauAb };
}

/** Für die geplante Funktion: Lebenszeichen schreiben, fällige Gruppe bauen. */
async function sammlerLauf(event) {
  const speicher = speicherOeffnen(event);
  if (!speicher) return { ok: false, fehler: "kein Speicher" };
  const jetzt = Date.now();
  try {
    await speicher.setJSON(SCHLUESSEL_LEBT, { am: new Date(jetzt).toISOString() });
  } catch (error) {
    console.error("Build-Sammler: Lebenszeichen nicht geschrieben.", error.message);
    return { ok: false, fehler: "Lebenszeichen" };
  }
  let offen;
  try {
    offen = await speicher.get(SCHLUESSEL_OFFEN, { type: "json" });
  } catch (error) {
    console.error("Build-Sammler: Lesen fehlgeschlagen.", error.message);
    return { ok: false, fehler: "Lesen" };
  }
  const seit = offen && Date.parse(offen.seit);
  if (!seit) return { ok: true, offen: false };
  if (jetzt - seit < sammelSekunden() * 1000) return { ok: true, offen: true, wartet: true, anzahl: offen.anzahl || 1 };

  const typen = new Set((offen.letzte || []).map((e) => e.typ));
  const typ = typen.size === 1 && typen.has("project") ? "project" : "unit";
  try {
    const r = await sofortBauen(typ, `Propstack: ${offen.anzahl || 1} Ereignis(se) gesammelt`);
    // Erst nach dem Auslösen löschen: scheitert der Build-Hook, versucht es der nächste Lauf erneut.
    // Ereignisse zwischen Lesen und Löschen sind im Build enthalten, weil er Propstack erst beim Start liest.
    await speicher.delete(SCHLUESSEL_OFFEN);
    console.log("Build-Sammler: ein Build für die Gruppe.", { anzahl: offen.anzahl || 1, seit: offen.seit, letzte: offen.letzte || [] });
    return { ok: true, gebaut: true, anzahl: offen.anzahl || 1, ...r };
  } catch (error) {
    console.error("Build-Sammler: Build-Hook fehlgeschlagen, nächster Lauf versucht es erneut.", error.message);
    return { ok: false, fehler: error.message };
  }
}

/** Für den Health-Check (GET ohne id): nur Zeiten und Zähler. */
async function sammlerStand(event) {
  const speicher = speicherOeffnen(event);
  if (!speicher) return { speicher: false };
  try {
    const lebt = await speicher.get(SCHLUESSEL_LEBT, { type: "json" });
    const offen = await speicher.get(SCHLUESSEL_OFFEN, { type: "json" });
    return {
      speicher: true,
      sammlerLebt: lebt?.am || null,
      offen: offen?.seit ? { seit: offen.seit, anzahl: offen.anzahl || 1 } : null,
      sammelSekunden: sammelSekunden()
    };
  } catch (error) {
    return { speicher: false, fehler: error.message.slice(0, 120) };
  }
}

module.exports = {
  geheimnisPruefen,
  bauenOderVormerken,
  sammlerLauf,
  sammlerStand,
  sofortBauen,
  sammelSekunden,
  _testSpeicher(s) { testSpeicher = s; }
};
