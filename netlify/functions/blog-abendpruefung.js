/*
 * Update 55 §1.4 (11.11.2026): Abendprüfung der Blogartikel, montags und donnerstags um 18:00 deutscher Zeit.
 *
 * Vorher lief `node scripts/blogplan.js abend` in Peers Sitzung und kam am 10.11. einen Tag zu spät. Jetzt läuft
 * die Prüfung als geplante Funktion:
 * - Um 18:00 ist die Frist für den Artikel von morgen (Dienstag oder Freitag) vorbei. Wer morgen erscheint, rechnet
 *   scripts/blogplan.js nach der Regel aus Update 55 §1.3; der 06:00-Build (taeglicher-build.js) wendet sie an.
 * - Ist der nächste Artikel danach nicht bereit, geht eine Mail an Peer mit dem, was fehlt. Bis zu seiner Frist
 *   sind dann noch drei bis vier Tage Zeit.
 *
 * Zeitplan (netlify.toml): Netlify rechnet in UTC. Damit es Sommer wie Winter 18:00 in Deutschland ist, läuft die
 * Funktion Mo und Do um 16:00 und 17:00 UTC und prüft nur in dem Lauf, in dem es in Europe/Berlin 18 Uhr ist.
 *
 * Daten: _data/blogplan.json und _data/blogquelle.json werden mit der Funktion gebündelt, also der Stand des letzten
 * Deploys. Den baut auch der 06:00-Build. Eine Seite gilt als vorhanden, wenn live.py ihre Karte geschrieben hat.
 *
 * Empfänger: BLOG_PRUEFUNG_EMPFAENGER (Netlify-Umgebungsvariable, kommagetrennt); ohne sie MARKTBERICHTE_EMPFAENGER
 * (Peers Adresse, eingetragen 07.11.2026, Update 44). Keine Adresse im Repo.
 * Log: nur Ergebnis und ob die Mail ging, keine Adressen. Geplante Funktionen sind von außen nicht aufrufbar.
 */
const { sendInternalNotification } = require("./_shared/mailer");
const blogplan = require("../../scripts/blogplan.js");
const planDaten = require("../../_data/blogplan.json");
const quelle = require("../../_data/blogquelle.json");

function stundeInBerlin(jetzt = new Date()) {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  return Number(teile.find((t) => t.type === "hour").value);
}

function empfaenger(env = process.env) {
  const roh = String(env.BLOG_PRUEFUNG_EMPFAENGER || env.MARKTBERICHTE_EMPFAENGER || "");
  return roh.split(",").map((s) => s.trim()).filter(Boolean).join(", ");
}

function mailText(r, jetzt) {
  const n = r.naechster;
  const zeit = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" }).format(jetzt);
  const fristDe = `${blogplan.deutsch(new Date(Date.parse(`${n.termin}T12:00:00Z`) - 864e5).toISOString().slice(0, 10))}, 18:00 Uhr`;
  return [
    `Abendprüfung der Blogartikel vom ${zeit} Uhr.`,
    "",
    `Der nächste Artikel ist noch nicht bereit: Nr. ${n.nr} (${n.slug}), Termin ${blogplan.deutsch(n.termin)}.`,
    `Frist: ${fristDe}. Ist er bis dahin nicht bereit, nimmt der nächste bereite Artikel den Termin, und Nr. ${n.nr} kommt am ersten Termin, nachdem er bereit ist.`,
    "",
    "Was fehlt:",
    ...n.fehlt.map((p) => `- ${p}`),
    "",
    "Send this to Jesu:",
    ...r.zeilen.map((z) => z.replace(/^Send this to Jesu: /, "")),
    "",
    "Regeln: scripts/blogplan.js, Plan: _data/blogplan.json. Diese Mail kommt montags und donnerstags um 18 Uhr (netlify/functions/blog-abendpruefung.js)."
  ].join("\n");
}

async function lauf({ jetzt = new Date(), plan = planDaten, karten = quelle, senden = sendInternalNotification, log = console.log, env = process.env } = {}) {
  if (stundeInBerlin(jetzt) !== 18) return { geprueft: false, grund: "nicht 18:00 in Berlin" };
  const da = new Set(karten.map((k) => k.slug));
  const r = blogplan.abendpruefung(plan, { jetzt, vorhanden: (slug) => da.has(slug) });
  log(`blog-abend morgen=${r.morgen ? r.morgen.nr ?? "leer" : "-"} naechster=${r.naechster ? r.naechster.nr : "-"} bereit=${r.naechster ? r.naechster.bereit : "-"}`);
  if (!r.mail) return { geprueft: true, mail: false, ergebnis: r };
  const an = empfaenger(env);
  if (!an) {
    log("blog-abend mail not sent: BLOG_PRUEFUNG_EMPFAENGER and MARKTBERICHTE_EMPFAENGER missing");
    return { geprueft: true, mail: false, grund: "kein Empfänger", ergebnis: r };
  }
  const n = r.naechster;
  const m = await senden({ subject: `Blog: Nr. ${n.nr} am ${blogplan.deutsch(n.termin)} ist noch nicht bereit`, text: mailText(r, jetzt), to: an });
  log("blog-abend mail " + (m && m.sent ? "sent" : "not sent"));
  return { geprueft: true, mail: Boolean(m && m.sent), ergebnis: r };
}

exports.handler = async function () {
  const r = await lauf();
  return { statusCode: 200, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ geprueft: r.geprueft, mail: r.mail || false }) };
};

exports._lauf = lauf;
exports._empfaenger = empfaenger;
exports._mailText = mailText;
exports.stundeInBerlin = stundeInBerlin;
