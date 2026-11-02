/**
 * Bewertung: Nachfrage per E-Mail (Update 19 §5, 30.10.2026)
 *
 * Ablauf: Nach einer Bewertungsanfrage (propstack-lead, Anliegen mit „Bewertung“) bekommt der Absender eine
 * Bestätigungsmail mit einem Link auf /immobilienbewertung/nachfrage/. Dort stehen ein paar Fragen, die von der
 * Objektart abhängen (Fragen von Timon). Die Antworten schickt das Formular an bewertung-nachfrage; die Funktion
 * hängt sie an denselben Propstack-Kontakt wie die erste Anfrage und schickt sie zusätzlich per Mail an das
 * Postfach für Website-Anfragen.
 *
 * Im Link stehen nur die Propstack-Kontakt-ID mit Signatur (k), die Objektgruppe (typ) und ob die
 * Grundstücksgröße schon angegeben war (gf=1). Keine Namen, keine E-Mail-Adresse. Die Signatur ist ein HMAC mit
 * dem Geheimnis NACHFRAGE_SECRET (Netlify-Umgebungsvariable); ohne Geheimnis gibt es keinen Link und keine Mail.
 * Livegang 31.10.2026 (Peer: „kannst du da nicht das aktuelle system nehmen … mit propstack?“): Fehlt NACHFRAGE_SECRET,
 * dient der Propstack-Schlüssel, der auf Netlify schon hinterlegt ist, als Geheimnis (geheimnis()). Er bleibt auf dem
 * Server; aus der Signatur (HMAC) lässt er sich nicht zurückrechnen. Wird der Schlüssel getauscht, gelten alte Links nicht mehr.
 *
 * Design-Pass 3 §0.4 (30.10.2026): Grundstück bekommt keine Nachfrage, nur die Bestätigungsmail ohne Link;
 * Gewerbe behält nur die Frage zur Modernisierung.
 *
 * Web Crypto statt node:crypto, damit die Testumgebung (Cloudflare, test-env/functions/api/test) dasselbe Modul nutzt.
 */

const PFAD = "/immobilienbewertung/nachfrage/";

// Objektart aus dem Bewertungsformular → Fragengruppe auf der Nachfrageseite
const GRUPPEN = {
  Eigentumswohnung: "wohnung",
  Einfamilienhaus: "haus",
  Zweifamilienhaus: "haus",
  "Doppelhaushälfte": "haus",
  Reihenhaus: "haus",
  Mehrfamilienhaus: "mfh",
  "Grundstück": "grundstueck",
  Gewerbe: "gewerbe",
};
const GRUPPEN_NAME = {
  wohnung: "Wohnung",
  haus: "Haus",
  mfh: "Mehrfamilienhaus",
  grundstueck: "Grundstück",
  gewerbe: "Gewerbe",
};

const ETAGEN = ["Souterrain", "Erdgeschoss", "Obergeschoss", "Dachgeschoss", "Penthouse", "Maisonette"];
const WOHNUNG_AUSSEN = ["Balkon", "Loggia", "Terrasse"];
const HAUS_AUSSEN = ["Balkon", "Terrasse"];

// Feld → Beschriftung in der Notiz (Reihenfolge = Reihenfolge in der Notiz)
const FELDER = [
  ["modernisierung_jahr", "Zuletzt modernisiert (Jahr)"],
  ["modernisierung_was", "Was wurde modernisiert"],
  ["etage", "Etage"],
  ["wohnung_aussen", "Balkon, Loggia oder Terrasse"],
  ["wohnung_aussen_m2", "Größe von Balkon, Loggia oder Terrasse (m²)"],
  ["haus_grundstueck_m2", "Grundstücksgröße (m²)"],
  ["haus_aussen", "Balkon oder Terrasse"],
  ["mfh_ist_miete", "Ist-Jahresnettokaltmiete (€)"],
  ["mfh_soll_miete", "Erwartete Soll-Miete in sechs bis zwölf Monaten (€ pro Jahr)"],
];

const clean = (value) => (value === null || value === undefined ? "" : String(value).trim());
const liste = (value) => (Array.isArray(value) ? value : value ? [value] : []).map(clean).filter(Boolean);

function gruppeFuer(objectType) {
  return GRUPPEN[clean(objectType)] || "";
}

// Design-Pass 3 §0.4: für Grundstücke keine Fragen, die Bestätigungsmail kommt ohne Link
function ohneFragen(objectType) {
  return gruppeFuer(objectType) === "grundstueck";
}

function base64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signatur(secret, contactId) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`nachfrage-v1:${contactId}`)));
  return base64url(mac.slice(0, 16));
}

/** Geheimnis für die Signatur: NACHFRAGE_SECRET, sonst der Propstack-Schlüssel (eigener Präfix); "" ohne beides. */
function geheimnis(env) {
  const eigenes = clean(env && env.NACHFRAGE_SECRET);
  if (eigenes) return eigenes;
  const propstack = clean(env && env.PROPSTACK_API_KEY);
  return propstack ? `fg-nachfrage-v1|${propstack}` : "";
}

/** Link für die Bestätigungsmail; "" ohne Geheimnis oder Kontakt-ID. */
async function link({ secret, base, contactId, objectType, plotGiven }) {
  const id = clean(contactId);
  if (!clean(secret) || !/^[\w-]{1,64}$/.test(id) || ohneFragen(objectType)) return "";
  const params = new URLSearchParams({ k: `${id}.${await signatur(secret, id)}` });
  const gruppe = gruppeFuer(objectType);
  if (gruppe) params.set("typ", gruppe);
  if (plotGiven) params.set("gf", "1");
  return `${clean(base).replace(/\/+$/, "")}${PFAD}?${params.toString()}`;
}

/** Prüft k aus dem Link; gibt die Kontakt-ID zurück oder "". */
async function pruefen(secret, k) {
  const wert = clean(k);
  const punkt = wert.lastIndexOf(".");
  if (!clean(secret) || punkt < 1) return "";
  const id = wert.slice(0, punkt);
  const sig = wert.slice(punkt + 1);
  if (!/^[\w-]{1,64}$/.test(id)) return "";
  const soll = await signatur(secret, id);
  if (soll.length !== sig.length) return "";
  let diff = 0;
  for (let i = 0; i < soll.length; i += 1) diff |= soll.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? id : "";
}

function istBewertung(rawConcern) {
  return /bewertung/i.test(clean(rawConcern));
}

const SIGNATUR = [
  "Fischer & Geserich Real Estate GmbH",
  "Schützenstraße 30, 12165 Berlin",
  "Telefon +49 1520 3083048 · info@fg-realestate.de",
  "Geschäftsführer: Timon Fischer, Lennart Geserich",
  "Amtsgericht Charlottenburg, HRB 283559 B",
];

const esc = (value) =>
  clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Adresse für die Bestätigungsmail: „Straße Hausnummer, PLZ Ort“ aus den Formularfeldern (oder location), sonst "". */
function adresseText(d) {
  const x = d || {};
  const strasse = [clean(x.street || x.strasse), clean(x.house_number || x.houseNumber || x.hausnummer)].filter(Boolean).join(" ");
  const ort = [clean(x.zip_code || x.zipCode || x.plz), clean(x.city || x.ort)].filter(Boolean).join(" ");
  return [strasse, ort].filter(Boolean).join(", ") || clean(x.location);
}

/** true, wenn „Mit einem Anruf“ gewählt ist (contact_preference = „Telefon“, wie das Propstack-Feld Kontaktwunsch). */
function perAnruf(contactPreference) {
  const v = clean(contactPreference).toLowerCase();
  return v === "telefon" || v.includes("anruf");
}

/** Bestätigungsmail an den Absender der Bewertungsanfrage, Update 28 §3.2 (Text von Timon über Jesu, wörtlich):
 *  Version A „Per E-Mail“, Version B „Mit einem Anruf“ (anruf = true).
 *  Ohne Link (Grundstück) fehlt in A der Absatz zu den Fragen, in B nur der letzte Satz mit dem Link.
 *  Ohne Adresse heißt es „zu Ihrer Immobilie.“ statt „zu Ihrer Immobilie in …“. */
function bestaetigung({ firstName, lastName, link: url, adresse, anruf }) {
  const name = [clean(firstName), clean(lastName)].filter(Boolean).join(" ");
  const wo = clean(adresse) ? ` in ${clean(adresse)}` : "";
  const einstieg = anruf
    ? `vielen Dank für Ihre Anfrage zu Ihrer Immobilie${wo}. Innerhalb weniger Stunden haben wir einen indikativen Marktwert für Sie und rufen Sie dazu an.`
    : `vielen Dank für Ihre Anfrage zu Ihrer Immobilie${wo}. Innerhalb weniger Stunden schicken wir Ihnen einen indikativen Marktwert per E-Mail.`;
  // Absatz zu den Folgefragen: [Text vor dem Link, mit Link?]
  let fragen = null;
  if (anruf) {
    const basis = "Für einen festen Angebotspreis brauchen wir noch einige Angaben zu Ihrer Immobilie. Die können wir am Telefon, persönlich bei einem Termin oder per E-Mail klären, ganz wie es Ihnen lieber ist.";
    fragen = url ? `${basis} Wenn Sie möchten, beantworten Sie die Fragen schon vorab hier: ` : basis;
  } else if (url) {
    fragen = "Für einen festen Angebotspreis brauchen wir noch einige Angaben zu Ihrer Immobilie, zum Beispiel zu Modernisierungen, zur Etage und zu Balkon oder Terrasse. Die Fragen beantworten Sie in wenigen Minuten hier: ";
  }
  const gruss = ["Mit freundlichen Grüßen", "Timon Fischer und Lennart Geserich", "Fischer & Geserich Real Estate GmbH"];
  const anrede = name ? `Guten Tag ${name},` : "Guten Tag,";
  const text = [anrede, einstieg, ...(fragen ? [url ? `${fragen}${url}` : fragen] : []), gruss.join("\n"), `--\n${SIGNATUR.join("\n")}`].join("\n\n");
  const p = 'style="margin:0 0 16px"';
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#08082F">
<p ${p}>${esc(anrede)}</p>
<p ${p}>${esc(einstieg)}</p>${fragen ? `
<p ${p}>${esc(fragen)}${url ? `<a href="${esc(url)}">${esc(url)}</a>` : ""}</p>` : ""}
<p ${p}>${gruss.map(esc).join("<br>")}</p>
<p style="margin:24px 0 0;font-size:13px;color:#555">${SIGNATUR.map(esc).join("<br>")}</p>
</div>`;
  return { subject: "Ihre Wertermittlung bei Fischer & Geserich", text, html };
}

/** Antworten prüfen; gibt eine Fehlermeldung zurück oder "". */
function pruefeAntworten(d) {
  const jahr = clean(d.modernisierung_jahr);
  if (jahr && !/^\d{4}$/.test(jahr)) return "Bitte geben Sie das Jahr vierstellig an.";
  if (clean(d.etage) && !ETAGEN.includes(clean(d.etage))) return "Unbekannte Etage.";
  if (liste(d.wohnung_aussen).some((v) => !WOHNUNG_AUSSEN.includes(v))) return "Unbekannte Angabe bei Balkon, Loggia oder Terrasse.";
  if (liste(d.haus_aussen).some((v) => !HAUS_AUSSEN.includes(v))) return "Unbekannte Angabe bei Balkon oder Terrasse.";
  if (clean(d.modernisierung_was).length > 500) return "Die Angabe zur Modernisierung ist zu lang.";
  for (const key of ["wohnung_aussen_m2", "haus_grundstueck_m2", "mfh_ist_miete", "mfh_soll_miete"]) {
    if (clean(d[key]).length > 20) return "Eine Zahl ist zu lang.";
  }
  if (!FELDER.some(([key]) => liste(d[key]).length)) return "Bitte beantworten Sie mindestens eine Frage.";
  return "";
}

/** Notiz für Propstack und die Mail an das Postfach. */
function notiz(d, contactId) {
  const gruppe = GRUPPEN_NAME[clean(d.typ)] || "nicht angegeben";
  const zeilen = [
    "Antworten auf die Nachfrage zur Bewertung (Formular aus der Bestätigungsmail)",
    `Propstack-Kontakt: ${contactId}`,
    `Objektart laut Link: ${gruppe}`,
    "",
  ];
  for (const [key, label] of FELDER) {
    const werte = liste(d[key]);
    if (werte.length) zeilen.push(`${label}: ${werte.join(", ")}`);
  }
  return zeilen.join("\n");
}

module.exports = {
  PFAD, GRUPPEN, ETAGEN, WOHNUNG_AUSSEN, HAUS_AUSSEN, FELDER,
  gruppeFuer, ohneFragen, geheimnis, link, pruefen, istBewertung, adresseText, perAnruf, bestaetigung, pruefeAntworten, notiz,
};
