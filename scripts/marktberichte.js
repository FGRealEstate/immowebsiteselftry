#!/usr/bin/env node
/*
 * Update 44 §2.6 (07.11.2026): Marktzahlen frisch halten. Einmal im Monat, beim ersten Produktions-Build des Monats,
 * eine Liste für Peer, welche amtlichen Berichte seit der letzten Prüfung erschienen sind, je Region:
 * Gutachterausschüsse (Berlin, Brandenburg mit Potsdam und den Landkreisen, Leipzig, Dresden), GREIX und die
 * Berliner Halbjahres- und Quartalsberichte (auf den Marktanalyse-Seiten des Berliner Gutachterausschusses).
 *
 * Ändert keinen Text der Website. Jesu schreibt das Update, Timon gibt frei (wie bei Teil 6).
 *
 * Wie: Jede Quellseite wird geladen, die Links auf Berichte werden mit dem Stand der letzten Prüfung verglichen; neu ist,
 * was damals nicht da war. Bei GREIX wird zusätzlich geprüft, ob das PDF des nächsten Quartals schon da ist.
 * Ist eine Quelle nicht erreichbar, steht das in der Liste, und ihre bekannten Berichte bleiben im Stand.
 *
 * Wo: Stand und Liste in Netlify Blobs (Store „marktberichte“, Schlüssel „stand“ und „liste-JJJJ-MM“), die Liste
 * dazu im Build-Log und als Mail an MARKTBERICHTE_EMPFAENGER (Netlify-Umgebungsvariable, Peers Adresse; ohne sie
 * keine Mail). Ohne Stand in Blobs gilt scripts/marktberichte-stand.json (Ausgangsstand vom 07.11.2026).
 * Der Build scheitert nie an diesem Schritt: Fehler werden geloggt, nach 60 s ist Schluss.
 *
 * Aufruf im Build: netlify/plugins/marktberichte (onPostBuild, nur CONTEXT=production). Lokal:
 *   node scripts/marktberichte.js --lokal       Liste gegen marktberichte-stand.json, nichts wird gespeichert
 *   node scripts/marktberichte.js --ausgang     marktberichte-stand.json neu schreiben (Ausgangsstand)
 */
const fs = require("fs");
const path = require("path");

const STAND_DATEI = path.join(__dirname, "marktberichte-stand.json");
const UA = "Mozilla/5.0 (compatible; FG-Marktberichte/1.0; +https://fg-realestate.de/)";
const TIMEOUT_MS = 20000;

const BB = "https://gutachterausschuss.brandenburg.de";
const QUELLEN = [
  { region: "Berlin", name: "Gutachterausschuss Berlin, Marktanalysen (Umsatzzahlen je Quartal und Halbjahr)", url: "https://www.berlin.de/gutachterausschuss/marktinformationen/marktanalyse/artikel.174968.php", link: /\.pdf(\?|$)/i },
  { region: "Berlin", name: "Gutachterausschuss Berlin, Marktanalysen", url: "https://www.berlin.de/gutachterausschuss/marktinformationen/marktanalyse/artikel.168624.php", link: /\.pdf(\?|$)/i },
  { region: "Brandenburg", name: "Grundstücksmarktberichte", url: BB + "/gaa/de/marktinformationen/grundstuecksmarktberichte/", link: /\.pdf(\?|$)/i },
  { region: "Brandenburg", name: "Zwischenauswertungen und Berichte (Halbjahr, Quartal)", url: BB + "/gaa/de/marktinformationen/zwischenauswertungen-und-berichte/", link: /\.pdf(\?|$)/i },
  // Die Übersicht /gaa/de/pressemitteilungen/ listet keine Links (geprüft 07.11.2026), die Startseite die neuesten.
  { region: "Brandenburg", name: "Pressemitteilungen (Startseite)", url: BB + "/", link: /\/pressemitteilungen\/detail\//i },
  { region: "Leipzig", name: "Gutachterausschuss Leipzig", url: "https://www.leipzig.de/grundstuecksmarktbericht", link: /Gutachterausschuss\/[^/]*bericht[^/]*\.pdf(\?|$)/i },
  { region: "Dresden", name: "Gutachterausschuss Dresden", url: "https://www.dresden.de/de/leben/stadtportrait/statistik/geoinformationen/gutachterausschuss/grundstuecksmarktbericht.php", link: /vermessung\/[^/]*(bericht|markt)[^/]*\.pdf(\?|$)/i },
  { region: "GREIX", name: "Kiel Institut, GREIX-Meldungen", url: "https://www.kielinstitut.de/de/forschung/forschungszentren/makrooekonomie/makrofinanzen/german-real-estate-index-greix/", link: /\/medien\/aktuelles\/greix/i }
];
const GREIX_PDF = (j, q) => `https://cloud-data-greix-website.s3.eu-central-1.amazonaws.com/website/Documentation/kaufpreisindex_${j}q${q}.pdf`;

// Kürzel in Dateinamen und Pressemitteilungen des Landes Brandenburg
const KREISE = {
  BAR: "Barnim", BRB: "Brandenburg an der Havel", CB: "Cottbus", EE: "Elbe-Elster", FF: "Frankfurt (Oder)", HVL: "Havelland",
  LDS: "Dahme-Spreewald", LOS: "Oder-Spree", LOSFF: "Oder-Spree und Frankfurt (Oder)", MOL: "Märkisch-Oderland", OHV: "Oberhavel",
  OPR: "Ostprignitz-Ruppin", OSL: "Oberspreewald-Lausitz", P: "Potsdam", PM: "Potsdam-Mittelmark", PR: "Prignitz", SPN: "Spree-Neiße",
  TF: "Teltow-Fläming", UM: "Uckermark", OGA: "Land Brandenburg (Oberer Gutachterausschuss)", BRA: "Land Brandenburg"
};

function heute() {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (k) => t.find((x) => x.type === k).value;
  return { iso: `${g("year")}-${g("month")}-${g("day")}`, monat: `${g("year")}-${g("month")}`, de: `${g("day")}.${g("month")}.${g("year")}` };
}

function text(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&#34;|&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&middot;/g, "·").replace(/\s+/g, " ").trim()
    .replace(/^(description|download|file_download|picture_as_pdf|open_in_new)\s+/i, "").replace(/\s+PDF\s*·\s*[\d,.]+\s*[KM]B$/i, "");
}

function teilregion(quelle, url) {
  if (quelle.region !== "Brandenburg") return "";
  const datei = decodeURIComponent(url.split("/").pop() || "");
  let m = /^(?:GMB|GA|OGA)_?([A-Z]+)?/.exec(datei);
  if (/^OGA/.test(datei)) return KREISE.OGA;
  if (m && m[1] && KREISE[m[1]]) return KREISE[m[1]];
  m = /detail\/~\d{2}-\d{2}-\d{4}-([a-z]+)-/i.exec(url);
  if (m && KREISE[m[1].toUpperCase()]) return KREISE[m[1].toUpperCase()];
  return "";
}

async function holen(url, methode = "GET") {
  const steuerung = new AbortController();
  const uhr = setTimeout(() => steuerung.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: methode, redirect: "follow", signal: steuerung.signal, headers: { "User-Agent": UA } });
    return { status: r.status, url: r.url, body: methode === "GET" && r.ok ? await r.text() : "" };
  } catch (_) {
    return { status: 0, url, body: "" };
  } finally {
    clearTimeout(uhr);
  }
}

function links(quelle, seite) {
  const gefunden = {};
  const re = /<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(seite.body))) {
    let url;
    try {
      url = new URL(m[2].replace(/&amp;/g, "&"), seite.url || quelle.url);
    } catch (_) {
      continue;
    }
    if (!quelle.link.test(url.pathname + url.search)) continue;
    url.search = "";
    url.hash = "";
    const attr = m[1] + " " + m[3];
    const titelAttr = /title="([^"]*)"/i.exec(attr);
    let titel = titelAttr ? text(titelAttr[1]).replace(/^Herunterladen\s+"?/, "").replace(/"?\s*\(PDF.*$/i, "") : "";
    if (!titel) titel = text(m[4]) || decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").replace(/^~/, "").replace(/-/g, " ");
    titel = titel.replace(/^(.*?Veröffentlicht am \d{2}\.\d{2}\.\d{4}).*$/, "$1");
    // Derselbe Bericht kann mehrfach verlinkt sein (Bild und Text): der längere Titel gewinnt.
    if (!gefunden[url.toString()] || titel.length > gefunden[url.toString()].length) gefunden[url.toString()] = titel.slice(0, 160);
  }
  return gefunden;
}

async function greixPdfs(jahr) {
  const gefunden = {};
  const proben = [];
  for (const j of [jahr - 1, jahr]) for (const q of [1, 2, 3, 4]) proben.push([j, q]);
  const antworten = await Promise.all(proben.map(([j, q]) => holen(GREIX_PDF(j, q), "HEAD").then((r) => [j, q, r.status])));
  for (const [j, q, status] of antworten) if (status === 200) gefunden[GREIX_PDF(j, q)] = `GREIX Kaufpreisindex ${q}. Quartal ${j} (PDF)`;
  return gefunden;
}

async function pruefen(stand) {
  const alt = (stand && stand.bekannt) || {};
  const bekannt = { ...alt };
  const neu = [];
  const fehler = [];
  const seiten = await Promise.all(QUELLEN.map((q) => holen(q.url)));
  QUELLEN.forEach((q, i) => {
    const s = seiten[i];
    if (s.status !== 200) {
      fehler.push(`${q.region}: ${q.name} nicht erreichbar (Status ${s.status || "keine Antwort"}), ${q.url}`);
      return;
    }
    for (const [url, titel] of Object.entries(links(q, s))) {
      if (!(url in alt) && !neu.some((n) => n.url === url)) neu.push({ region: q.region, teil: teilregion(q, url), titel, url });
      bekannt[url] = titel;
    }
  });
  const pdfs = await greixPdfs(Number(heute().monat.slice(0, 4)));
  for (const [url, titel] of Object.entries(pdfs)) {
    if (!(url in alt) && !neu.some((n) => n.url === url)) neu.push({ region: "GREIX", teil: "", titel, url });
    bekannt[url] = titel;
  }
  return { neu, fehler, bekannt };
}

const REIHENFOLGE = ["Berlin", "Brandenburg", "Leipzig", "Dresden", "GREIX"];

function liste({ neu, fehler }, stand, jetzt) {
  const seit = stand && stand.datum ? stand.datum.split("-").reverse().join(".") : "unbekannt";
  const z = [`Neue amtliche Marktberichte seit der letzten Prüfung am ${seit}, geprüft am ${jetzt.de}`, ""];
  for (const r of REIHENFOLGE) {
    const eintraege = neu.filter((n) => n.region === r);
    z.push(`${r}: ${eintraege.length ? "" : "nichts Neues"}`.trim());
    for (const n of eintraege) z.push(`- ${n.teil ? n.teil + ": " : ""}${n.titel}\n  ${n.url}`);
    z.push("");
  }
  if (fehler.length) z.push("Nicht geprüft:", ...fehler.map((f) => "- " + f), "");
  z.push("Keine Textänderung auf der Website. Jesu schreibt das Update, Timon gibt frei.");
  z.push("(scripts/marktberichte.js, Update 44 §2.6)");
  return z.join("\n");
}

function blobs() {
  try {
    const { getStore } = require("@netlify/blobs");
    return getStore({ name: "marktberichte", consistency: "eventual" });
  } catch (error) {
    console.log("Marktberichte: Netlify Blobs nicht verfügbar:", error.message);
    return null;
  }
}

async function imBuild() {
  const jetzt = heute();
  const store = blobs();
  let stand = null;
  if (store) {
    try {
      stand = await store.get("stand", { type: "json" });
    } catch (error) {
      console.log("Marktberichte: Stand nicht lesbar:", error.message);
      return;
    }
  }
  if (!stand) stand = JSON.parse(fs.readFileSync(STAND_DATEI, "utf8"));
  if (stand.monat === jetzt.monat) {
    console.log(`Marktberichte: für ${jetzt.monat} schon geprüft (am ${stand.datum}).`);
    return;
  }
  const ergebnis = await pruefen(stand);
  const text = liste(ergebnis, stand, jetzt);
  console.log(text);
  if (!store) return;
  await store.set("liste-" + jetzt.monat, text);
  await store.setJSON("stand", { datum: jetzt.iso, monat: jetzt.monat, bekannt: ergebnis.bekannt });
  const an = String(process.env.MARKTBERICHTE_EMPFAENGER || "").trim();
  if (!an) {
    console.log("Marktberichte: keine Mail, MARKTBERICHTE_EMPFAENGER fehlt.");
    return;
  }
  const { sendInternalNotification } = require("../netlify/functions/_shared/mailer");
  const r = await sendInternalNotification({ subject: `Marktberichte ${jetzt.monat}: ${ergebnis.neu.length} neu`, text, to: an });
  console.log("Marktberichte: Mail " + (r.sent ? "verschickt" : "nicht verschickt") + ".");
}

async function lokal(ausgang) {
  const jetzt = heute();
  const stand = ausgang ? { bekannt: {} } : JSON.parse(fs.readFileSync(STAND_DATEI, "utf8"));
  const ergebnis = await pruefen(stand);
  if (ausgang) {
    const neuStand = { _hinweis: "Ausgangsstand für scripts/marktberichte.js (Update 44 §2.6). Gilt nur, solange Netlify Blobs keinen Stand hat.", datum: jetzt.iso, monat: jetzt.monat, bekannt: ergebnis.bekannt };
    fs.writeFileSync(STAND_DATEI + ".tmp", JSON.stringify(neuStand, null, 1) + "\n");
    fs.renameSync(STAND_DATEI + ".tmp", STAND_DATEI);
    console.log(`Ausgangsstand geschrieben: ${Object.keys(ergebnis.bekannt).length} Berichte.`);
    if (ergebnis.fehler.length) console.log("Nicht geprüft:\n" + ergebnis.fehler.join("\n"));
    return;
  }
  console.log(liste(ergebnis, stand, jetzt));
}

if (require.main === module) {
  const arg = process.argv[2];
  const lauf = arg === "--lokal" ? lokal(false) : arg === "--ausgang" ? lokal(true) : Promise.resolve(console.log("Marktberichte: im Build über netlify/plugins/marktberichte; lokal mit --lokal oder --ausgang."));
  const schluss = setTimeout(() => {
    console.log("Marktberichte: nach 60 s abgebrochen.");
    process.exit(0);
  }, 60000);
  lauf.catch((error) => console.log("Marktberichte: Fehler:", error.message)).finally(() => {
    clearTimeout(schluss);
    process.exit(0);
  });
}

module.exports = { imBuild, links, teilregion, liste, QUELLEN };
