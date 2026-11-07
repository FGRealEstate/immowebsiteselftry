/*
 * Update 44 §2.5 (07.11.2026): Uptime-Prüfung alle 15 Minuten (Zeitplan in netlify.toml).
 *
 * Geprüft wird mit GET, ohne etwas abzuschicken:
 *   start      die Startseite
 *   gebiet     eine Gebietsseite (/standorte/berlin/)
 *   angebot    ein Angebot: das erste aus /angebote.html; gibt es gerade keins, entfällt die Prüfung (kein Fehler)
 *   bewertung  der Endpunkt des Bewertungsformulars (/.netlify/functions/propstack-lead). Er nimmt nur POST an;
 *              auf GET antwortet er 405. Als Fehler gilt dort nur 5xx oder keine Antwort.
 * Seiten gelten als Fehler, wenn sie nicht mit 200 antworten oder nach 10 s keine Antwort da ist.
 *
 * Schlägt dieselbe Prüfung zweimal hintereinander fehl, geht eine E-Mail an info@fg-realestate.de und an die
 * Adressen in UPTIME_EMPFAENGER (Netlify-Umgebungsvariable, kommagetrennt; Peers Adresse kommt dort hinein).
 * Eine Störung wird einmal gemeldet; die nächste Mail kommt erst, wenn die Prüfung wieder geklappt hat und erneut
 * zweimal hintereinander fehlschlägt. Der Zähler liegt in Netlify Blobs (Store „uptime“, Schlüssel „stand“).
 *
 * Log: nur die Statuscodes („uptime start=200 gebiet=200 angebot=200 bewertung=405“).
 * Geplante Funktionen sind von außen nicht aufrufbar.
 */
const { sendInternalNotification } = require("./_shared/mailer");

const BASIS = (process.env.UPTIME_BASIS || "https://fg-realestate.de").replace(/\/$/, "");
const IMMER = "info@fg-realestate.de";
const TIMEOUT_MS = 10000;

async function holen(url, abruf) {
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), TIMEOUT_MS);
  try {
    const antwort = await abruf(url, { method: "GET", redirect: "follow", signal: steuerung.signal, headers: { "User-Agent": "FG-Uptime/1.0" } });
    const text = url.endsWith("/angebote.html") ? await antwort.text() : "";
    return { status: antwort.status, text };
  } catch (_) {
    return { status: 0, text: "" };
  } finally {
    clearTimeout(uhr);
  }
}

async function pruefen({ abruf = fetch } = {}) {
  const ergebnis = {};
  const [start, gebiet, uebersicht, bewertung] = await Promise.all([
    holen(BASIS + "/", abruf),
    holen(BASIS + "/standorte/berlin/", abruf),
    holen(BASIS + "/angebote.html", abruf),
    holen(BASIS + "/.netlify/functions/propstack-lead", abruf)
  ]);
  ergebnis.start = { status: start.status, ok: start.status === 200 };
  ergebnis.gebiet = { status: gebiet.status, ok: gebiet.status === 200 };
  const treffer = /href="(\/angebote\/[^"#?]+\/)"/.exec(uebersicht.text);
  if (uebersicht.status !== 200) {
    ergebnis.angebot = { status: uebersicht.status, ok: false, hinweis: "Angebotsübersicht" };
  } else if (!treffer) {
    ergebnis.angebot = { status: "kein Angebot", ok: true };
  } else {
    const angebot = await holen(BASIS + treffer[1], abruf);
    ergebnis.angebot = { status: angebot.status, ok: angebot.status === 200 };
  }
  ergebnis.bewertung = { status: bewertung.status, ok: bewertung.status > 0 && bewertung.status < 500 };
  return ergebnis;
}

function empfaenger() {
  const zusatz = String(process.env.UPTIME_EMPFAENGER || "").split(",").map((s) => s.trim()).filter(Boolean);
  return [IMMER, ...zusatz.filter((a) => a.toLowerCase() !== IMMER)].join(", ");
}

const NAMEN = { start: "Startseite", gebiet: "Gebietsseite /standorte/berlin/", angebot: "Angebotsseite", bewertung: "Bewertungsformular (Endpunkt)" };

async function lauf({ abruf = fetch, speicher, senden = sendInternalNotification, log = console.log, jetzt = new Date() } = {}) {
  const ergebnis = await pruefen({ abruf });
  log("uptime " + Object.entries(ergebnis).map(([k, v]) => `${k}=${v.status}`).join(" "));
  const stand = (speicher && (await speicher.get("stand", { type: "json" }).catch(() => null))) || {};
  const neu = {};
  const melden = [];
  for (const [k, v] of Object.entries(ergebnis)) {
    const alt = stand[k] || { fehler: 0, gemeldet: false };
    if (v.ok) {
      neu[k] = { fehler: 0, gemeldet: false };
    } else {
      neu[k] = { fehler: alt.fehler + 1, gemeldet: alt.gemeldet };
      if (neu[k].fehler >= 2 && !alt.gemeldet) {
        melden.push(k);
        neu[k].gemeldet = true;
      }
    }
  }
  if (melden.length) {
    const zeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(jetzt);
    const zeilen = melden.map((k) => `- ${NAMEN[k]}: Status ${ergebnis[k].status || "keine Antwort"} (zweimal hintereinander)`);
    const text = [
      `Die Uptime-Prüfung von ${BASIS} meldet am ${zeit} Uhr eine Störung:`,
      "",
      ...zeilen,
      "",
      "Alle Prüfungen dieses Laufs: " + Object.entries(ergebnis).map(([k, v]) => `${NAMEN[k]} ${v.status || "keine Antwort"}`).join(", ") + ".",
      "Geprüft wird alle 15 Minuten mit GET, ohne etwas abzuschicken (netlify/functions/uptime-pruefung.js)."
    ].join("\n");
    const r = await senden({ subject: "Website-Störung: " + melden.map((k) => NAMEN[k]).join(", "), text, to: empfaenger() });
    log("uptime mail " + (r && r.sent ? "sent" : "not sent"));
    if (!(r && r.sent)) for (const k of melden) neu[k].gemeldet = false;
  }
  if (speicher) await speicher.setJSON("stand", neu).catch(() => log("uptime state not saved"));
  return { ergebnis, melden };
}

function speicherOeffnen(event) {
  try {
    const { connectLambda, getStore } = require("@netlify/blobs");
    if (event && event.blobs) connectLambda(event);
    return getStore({ name: "uptime", consistency: "eventual" });
  } catch (_) {
    return null;
  }
}

exports.handler = async function uptimePruefung(event) {
  await lauf({ speicher: speicherOeffnen(event) });
  return { statusCode: 200, body: "" };
};

exports._lauf = lauf;
exports._pruefen = pruefen;
exports._empfaenger = empfaenger;
