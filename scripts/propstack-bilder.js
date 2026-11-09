/*
 * Update 49 §2 (09.11.2026): Propstack-Fotos beim Bauen leicht machen.
 * - Jedes Foto wird einmal geladen; daraus entstehen AVIF und WebP in 480, 960 und 1600 px Breite (nie breiter als das
 *   Original, die größte Stufe ist dann die Originalbreite) und ein JPEG in 1600 px als Rückfall.
 * - Cache zwischen den Builds in .cache/propstack-bilder, Schlüssel ist die Propstack-Bildadresse (sha1). Ein Foto, das schon
 *   im Cache liegt, wird nicht neu geladen; der tägliche Build um 06:00 bearbeitet nur neue Fotos. Auf Netlify sichert das
 *   Build-Plugin netlify/plugins/bild-cache den Ordner zwischen den Builds.
 * - Zeitbudget je Build (FG_BILD_BUDGET_S, Standard 420 s): Was nicht fertig wird, zeigt die Seite wie bisher (Netlify Image CDN,
 *   sonst Original) und kommt im nächsten Build dran. Ein Fehler bricht den Build nie ab.
 * - Das Original bleibt für die Großansicht (data-original in der Galerie) und für JSON-LD.
 * Ausgabe: /bilder/angebote/<schlüssel>-<breite>.<avif|webp|jpg>, kopiert nach dem Build (kopieren()).
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const WURZEL = path.join(__dirname, "..");
const CACHE = path.join(WURZEL, ".cache", "propstack-bilder");
const DATEIEN = path.join(CACHE, "dateien");
const MANIFEST = path.join(CACHE, "manifest.json");
const URL_PFAD = "/bilder/angebote";
const BREITEN = [480, 960, 1600];
const JPEG_BREITE = 1600;
const PROPSTACK_FOTO = /^https:\/\/images\.propstack\.de\//;
const QUALITAET = { avif: { quality: 50, effort: 4 }, webp: { quality: 75, effort: 4 }, jpeg: { quality: 78, mozjpeg: true } };

let manifest = null;
// Gemeinsam für alle Ladevorgänge dieses Moduls im selben Build (Datendatei und .eleventy.js): welche Fotos die Seiten zeigen.
const benutzt = (globalThis.__fgPropstackBilderBenutzt ||= new Set());
const geprueft = new Map();

const schluessel = (url) => crypto.createHash("sha1").update(String(url)).digest("hex").slice(0, 20);
const breitenFuer = (w) => [...new Set(BREITEN.map((b) => Math.min(b, w)))].sort((a, b) => a - b);
const datei = (k, w, ext) => `${k}-${w}.${ext}`;

function ladeManifest() {
  if (manifest) return manifest;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch { manifest = {}; }
  return manifest;
}

function speichereManifest() {
  geprueft.clear();
  fs.mkdirSync(CACHE, { recursive: true });
  const tmp = MANIFEST + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(manifest));
  fs.renameSync(tmp, MANIFEST);
}

function vollstaendig(e) {
  if (!e || !e.k || !Array.isArray(e.breiten)) return false;
  const noetig = [...e.breiten.flatMap((w) => [datei(e.k, w, "avif"), datei(e.k, w, "webp")]), datei(e.k, e.jpeg, "jpg")];
  return noetig.every((d) => fs.existsSync(path.join(DATEIEN, d)));
}

async function einFoto(sharp, url) {
  const antwort = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}`);
  const roh = Buffer.from(await antwort.arrayBuffer());
  const basis = sharp(roh, { failOn: "none" }).rotate();
  const meta = await basis.clone().metadata();
  // Nach dem Drehen (EXIF) gilt die angezeigte Breite.
  const gedreht = (meta.orientation || 1) >= 5;
  const w = gedreht ? meta.height : meta.width;
  const h = gedreht ? meta.width : meta.height;
  if (!w || !h) throw new Error("keine Maße");
  const k = schluessel(url);
  const breiten = breitenFuer(w);
  const jpeg = Math.min(JPEG_BREITE, w);
  fs.mkdirSync(DATEIEN, { recursive: true });
  const auftraege = [];
  for (const b of breiten) {
    auftraege.push(basis.clone().resize({ width: b, withoutEnlargement: true }).avif(QUALITAET.avif).toFile(path.join(DATEIEN, datei(k, b, "avif"))));
    auftraege.push(basis.clone().resize({ width: b, withoutEnlargement: true }).webp(QUALITAET.webp).toFile(path.join(DATEIEN, datei(k, b, "webp"))));
  }
  auftraege.push(basis.clone().resize({ width: jpeg, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg(QUALITAET.jpeg).toFile(path.join(DATEIEN, datei(k, jpeg, "jpg"))));
  await Promise.all(auftraege);
  return { k, w, h, breiten, jpeg, original_bytes: roh.length, am: new Date().toISOString().slice(0, 10) };
}

/**
 * Bereitet alle übergebenen Propstack-Adressen auf, die noch nicht im Cache liegen.
 * Gibt eine kurze Bilanz zurück; wirft nie.
 */
async function aufbereiten(urls, { budgetS = Number(process.env.FG_BILD_BUDGET_S || 420), parallel = 2 } = {}) {
  const start = Date.now();
  const bilanz = { gesamt: 0, aus_cache: 0, neu: 0, fehler: 0, offen: 0 };
  if (process.env.FG_BILD_AUFBEREITUNG === "aus") { console.log("Propstack-Fotos: Aufbereitung aus (FG_BILD_AUFBEREITUNG=aus)."); return bilanz; }
  let sharp;
  try { sharp = require("sharp"); } catch (error) { console.log("Propstack-Fotos: sharp fehlt, Fotos bleiben wie bisher:", error.message); return bilanz; }
  sharp.cache(false);
  ladeManifest();
  const liste = [...new Set((urls || []).filter((u) => PROPSTACK_FOTO.test(String(u || ""))))];
  bilanz.gesamt = liste.length;
  const offen = liste.filter((u) => {
    if (vollstaendig(manifest[u])) { bilanz.aus_cache++; return false; }
    return true;
  });
  let i = 0;
  let geaendert = false;
  const arbeiter = async () => {
    while (i < offen.length) {
      if ((Date.now() - start) / 1000 > budgetS) return;
      const url = offen[i++];
      try {
        manifest[url] = await einFoto(sharp, url);
        bilanz.neu++;
        geaendert = true;
        if (bilanz.neu % 10 === 0) speichereManifest();
      } catch (error) {
        bilanz.fehler++;
        delete manifest[url];
        console.log("Propstack-Foto übersprungen:", error.message, schluessel(url));
      }
    }
  };
  await Promise.all(Array.from({ length: parallel }, arbeiter));
  bilanz.offen = offen.length - bilanz.neu - bilanz.fehler;
  if (geaendert) speichereManifest();
  console.log(`Propstack-Fotos: ${bilanz.gesamt} gesamt, ${bilanz.aus_cache} aus dem Cache, ${bilanz.neu} neu, ${bilanz.fehler} Fehler, ${bilanz.offen} für den nächsten Build (${Math.round((Date.now() - start) / 1000)} s).`);
  return bilanz;
}

/** Eintrag für eine Adresse oder null (dann bleibt es beim bisherigen Weg). Merkt sich die Adresse für kopieren(). */
function eintrag(url) {
  if (!PROPSTACK_FOTO.test(String(url || ""))) return null;
  if (!geprueft.has(url)) { const e = ladeManifest()[url]; geprueft.set(url, e && vollstaendig(e) ? e : null); }
  const e = geprueft.get(url);
  if (e) benutzt.add(url);
  return e;
}

const srcset = (e, ext) => e.breiten.map((w) => `${URL_PFAD}/${datei(e.k, w, ext)} ${w}w`).join(", ");
const jpegUrl = (e) => `${URL_PFAD}/${datei(e.k, e.jpeg, "jpg")}`;

/** Kopiert die Dateien der Fotos, die die Seiten dieses Builds zeigen, nach <ausgabe>/bilder/angebote (alte Fotos bleiben im Cache, nicht auf der Seite). */
function kopieren(ausgabe) {
  try {
    const ziel = path.join(ausgabe, URL_PFAD);
    fs.mkdirSync(ziel, { recursive: true });
    let n = 0;
    for (const url of benutzt) {
      const e = eintrag(url);
      if (!e) continue;
      const namen = [...e.breiten.flatMap((w) => [datei(e.k, w, "avif"), datei(e.k, w, "webp")]), datei(e.k, e.jpeg, "jpg")];
      for (const d of namen) { fs.copyFileSync(path.join(DATEIEN, d), path.join(ziel, d)); n++; }
    }
    console.log(`Propstack-Fotos: ${n} Dateien nach ${URL_PFAD} kopiert.`);
  } catch (error) {
    console.log("Propstack-Fotos: Kopieren fehlgeschlagen:", error.message);
  }
}

/** Alle Adressen, die die Seiten zeigen: Galerien der Angebote, Projekte, Projekteinheiten und Referenzen, Titelbilder (auch gewählte). */
function adressenAus(daten) {
  const out = [];
  const objekt = (o) => { if (!o) return; if (o.main_image) out.push(o.main_image); if (o.cover && o.cover.url) out.push(o.cover.url); (o.gallery || []).forEach((u) => out.push(u)); };
  (daten.properties || []).forEach(objekt);
  (daten.projects || []).forEach((p) => { objekt(p); (p.units || []).forEach(objekt); });
  (daten.references || []).forEach(objekt);  // Update 50 §1: Referenzen zeigen alle Fotos der früheren Angebotsseite
  return out;
}

module.exports = { aufbereiten, eintrag, srcset, jpegUrl, kopieren, adressenAus, URL_PFAD, CACHE };
