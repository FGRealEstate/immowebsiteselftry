// Gebietsseiten im neuen Design (Brief Gebietsseiten). Je Seite eine JSON-Datei in
// content/gebiete/. Schreibregeln und Format: Website-Redesign/research/towns/SCHREIBREGELN.md.
// Ein Link auf die Landkreis-Seite erscheint erst, wenn es diese Seite gibt.
// Fotos (Brief Design-Pass 3.1 #5): hero und abschnitte[].bild nennen ein Bild in images/gebiete/.
// Solange keine Datei <name>-<breite>.webp über 960 px dort liegt, bleibt der Kopf navy und der Abschnitt
// ohne Bild. Die Fotos legt tools/gebietsfotos.py ab (Download freigegeben mit Update 4, 27.10.2026).
// Fußnoten [[n]] müssen auf einen Eintrag der Liste quellen zeigen, sonst bricht der Build ab.
// Design-Sprint CP3 (28.10.2026, Brief 5.3): band = Bild über die ganze Breite zwischen den Kapiteln (wie hero);
// anbindung = Absätze neben der Lagekarte, karte = { alt } für images/gebiete/karte-<slug>-<breite>.webp
// (tools/gebietskarte.py). Die Karte erscheint nur, wenn Datei und Text da sind. nachbarn[] bekommen das
// Titelfoto der Nachbarseite für die Bildkarten unter „In der Nähe“.
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "content", "gebiete");
const imageDir = path.join(__dirname, "..", "images", "gebiete");

// Bildnachweis nach den CC-Bedingungen: Urheber, Lizenz mit Link, Link zur Quelle, Hinweis auf den Zuschnitt.
// credit hat die Form "Urheber, Lizenz"; die Lizenz muss in dieser Liste stehen, sonst bricht der Build ab.
// Lizenzlinks gemeinsam mit den Leistungsseiten und /bildnachweise/ in lizenzen.json.
const LICENSES = require("./lizenzen.json");

function attribution(spec, file) {
  if (!spec || !spec.credit) return {};
  const cut = spec.credit.lastIndexOf(", ");
  const license = cut > 0 ? spec.credit.slice(cut + 2) : "";
  if (!LICENSES[license]) throw new Error(`[gebiete] ${file}: Lizenz in credit "${spec.credit}" unbekannt`);
  return { author: spec.credit.slice(0, cut), license, licenseUrl: LICENSES[license] };
}

function photo(spec) {
  if (!spec || !spec.name) return null;
  // Titelbilder bleiben je Datei ≤ 200 000 Byte (tools/gebietsfotos.py); wo 1600 px das nicht schafft, liegt 1440/1280/1120 bereit.
  const widths = [960, 1120, 1280, 1440, 1600, 2000, 2400].filter((w) => fs.existsSync(path.join(imageDir, `${spec.name}-${w}.webp`)));
  const main = widths.includes(1600) ? 1600 : widths.filter((w) => w > 960).pop();
  if (!main) return null;
  const base = `/images/gebiete/${spec.name}`;
  return {
    ...spec,
    ...attribution(spec),
    src: `${base}-${main}.webp`,
    srcset: widths.map((w) => `${base}-${w}.webp ${w}w`).join(", ")
  };
}

function checkFootnotes(page, file) {
  const text = JSON.stringify([page.kurzantwort, page.kurzantwortMehr, page.abschnitte, page.verkaufen, page.kaufen, page.finanzieren, page.faq, page.anbindung]);
  const max = (page.quellen || []).length;
  for (const match of text.matchAll(/\[\[([\d,\s]+)\]\]/g)) {
    for (const n of match[1].split(",").map((v) => Number(v.trim()))) {
      if (!(n >= 1 && n <= max)) throw new Error(`[gebiete] ${file}: Fußnote [[${match[1]}]] zeigt auf keine Quelle (1–${max})`);
    }
  }
}

// Design-Pass 2 §5 (28.10.2026), Vorbild omniyat.com/marasi-bay: nur die ersten Sätze sind sichtbar, der Rest steht im Aufklapper.
// Satzende ist . ! oder ?, auch mit Fußnote [[n]] dahinter, gefolgt von Leerzeichen und einem Großbuchstaben oder „ (wie der
// Filter ersterSatz). Kein Satzende sind Ordnungszahlen vor Monat, Jahrhundert und Halbjahr („am 1. Oktober“) und „St.“.
const SATZENDE = /[.!?](?:\[\[[\d,\s]+\]\])?(?=\s+[A-ZÄÖÜ„])/g;
const ORDNUNGSZAHL_VOR = /^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jahrhunderts?|Halbjahr|Quartal)\b/;
function ersteSaetze(absaetze, n) {
  const sichtbar = [];
  const rest = [];
  let offen = n;
  for (const p of absaetze || []) {
    if (offen <= 0) { rest.push(p); continue; }
    let schnitt = -1;
    let gezaehlt = 0;
    for (const m of p.matchAll(SATZENDE)) {
      const wort = p.slice(0, m.index).split(/\s/).pop() + m[0][0];
      const danach = p.slice(m.index + m[0].length).trimStart();
      if ((/^\d{1,2}\.$/.test(wort) && ORDNUNGSZAHL_VOR.test(danach)) || wort === "St.") continue;
      gezaehlt += 1;
      if (gezaehlt === offen) { schnitt = m.index + m[0].length; break; }
    }
    if (schnitt < 0) { sichtbar.push(p); offen -= gezaehlt + 1; continue; }
    sichtbar.push(p.slice(0, schnitt));
    const r = p.slice(schnitt).trim();
    if (r) rest.push(r);
    offen = 0;
  }
  return { sichtbar, rest };
}

// §5 Zeile 5: Link „Mehr zu {Ort}: Bodenrichtwerte, Mieten, Erhaltungsgebiete“ unter dem ersten Absatz eines Ortskapitels.
// Ort ist der Teil der Überschrift vor dem Doppelpunkt (wie der Name auf der Karte). Steht dort ein Artikel im Nominativ
// („Lehnitz, Sachsenhausen und die Ortsteile“), bleiben nur die Ortsnamen davor, ohne klein geschriebene Teile wie „neue Quartiere“,
// damit „Mehr zu …“ grammatisch stimmt. Von den drei Themen stehen nur die da, die im aufgeklappten Text vorkommen.
const THEMEN = [["Bodenrichtwerte", /Bodenrichtwert/], ["Mieten", /[Mm]iete/], ["Erhaltungsgebiete", /Erhaltungsgebiet|Milieuschutz/]];
// Update 8 §3.2 (29.10.2026): `mehrZuOrt` im Kapitel setzt den Ort für „Mehr zu …“ selbst, wenn die Überschrift nicht im Dativ passt (Potsdam: „Innenstadt und Vorstädten“).
function mehrZu(kopf, rest) {
  let ort = kopf;
  const artikel = ort.match(/^(.+?) und (der|die|das) .+$/);
  if (artikel) {
    const namen = artikel[1].split(", ").filter((n) => /^[A-ZÄÖÜ]/.test(n));
    ort = namen.length > 1 ? `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}` : namen[0];
  }
  const text = (rest || []).join(" ");
  const themen = THEMEN.filter(([, rx]) => rx.test(text)).map(([wort]) => wort);
  return `Mehr zu ${ort}${themen.length ? ": " + themen.join(", ") : ""}`;
}

// §5 Zeile 2: vier Kennzahlen in einer Reihe, die volle Liste im Aufklapper. Fünf Zahlen je Seite; es fällt zuerst die
// Einwohnerzahl weg, dann die Miete, sonst der letzte Wert einer Art, die zweimal vorkommt (Brief: typisch Eigentumswohnung,
// Einfamilienhaus, Bodenrichtwerte, Kauffälle). Jede Zahl bekommt die Nummer ihrer Quelle in der Liste quellen.
const zahlArt = (label) => /Einwohner/.test(label) ? "einwohner" : /miet/i.test(label) ? "miete" : /Bodenrichtwert|Bauland/.test(label) ? "boden"
  : /Kauffälle|Verkäufe|verkauft|Erwerbsvorgänge/.test(label) ? "kauffaelle" : /wohnung/i.test(label) ? "wohnung" : /häuser/i.test(label) ? "haus" : "sonst";
function kernzahlen(zahlen) {
  const arten = zahlen.map((z) => zahlArt(z.label));
  let weg = arten.indexOf("einwohner");
  if (weg < 0) weg = arten.lastIndexOf("miete");
  if (weg < 0) for (let i = arten.length - 1; i >= 0 && weg < 0; i -= 1) if (arten.indexOf(arten[i]) !== i) weg = i;
  if (weg < 0 && zahlen.length > 4) weg = zahlen.length - 1;
  return zahlen.filter((z, i) => i !== weg).slice(0, 4);
}
function quelleNr(z, quellen, file) {
  let i = z.url ? quellen.findIndex((q) => q.url === z.url) : -1;
  if (i < 0) i = quellen.findIndex((q) => q.name === z.quelle);
  if (i < 0) throw new Error(`[gebiete] ${file}: Zahl "${z.wert}" hat keine Quelle in der Liste quellen`);
  return i + 1;
}

module.exports = () => {
  if (!fs.existsSync(dir)) return [];
  const pages = fs.readdirSync(dir).filter((file) => file.endsWith(".json")).sort().map((file) => {
    let page;
    try {
      page = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch (error) {
      console.warn("[gebiete] Fehler in", file, error.message);
      return null;
    }
    checkFootnotes(page, file);
    page.zahlen = (page.zahlen || []).map((z) => ({ ...z, quelleNr: quelleNr(z, page.quellen || [], file) }));
    [page.hero, page.band, ...(page.abschnitte || []).map((a) => a.bild)].forEach((spec) => attribution(spec, file));
    return page;
  }).filter(Boolean);
  // Übergeordnete Seite: neue Gebietsseite oder (für Berlin, bis zur neuen Übersicht) die alte Standortseite.
  const legacyDir = path.join(__dirname, "..", "content", "standorte");
  const legacy = fs.existsSync(legacyDir) ? fs.readdirSync(legacyDir).filter((file) => file.endsWith(".json")).map((file) => file.replace(/\.json$/, "")) : [];
  const replaced = new Set(pages.flatMap((page) => page.ersetzt || []));
  const urls = new Set([...pages.map((page) => `/standorte/${page.slug}/`), ...legacy.filter((slug) => !replaced.has(slug)).map((slug) => `/standorte/${slug}/`)]);
  // inOrt/fuerOrt: Präposition für Überschriften („in Oranienburg“, „im Landkreis Oberhavel“).
  // Update 7, Frage 10: Die Lagekarte steht im Ortskapitel, das Lage und Anbindung beschreibt. Das ist das Kapitel, aus dem
  // mehr als die Hälfte der Sätze neben der früheren Karte (anbindung) stammt; gibt es keins, das erste Ortskapitel.
  const kartenKapitel = (page) => {
    const ohneFn = (t) => String(t || "").replace(/\[\[\d+\]\]/g, "");
    const saetze = (page.anbindung || []).flatMap((p) => ohneFn(p).split(/(?<=[.!?])\s+/)).map((s) => s.trim()).filter(Boolean);
    const texte = (page.abschnitte || []).map((a) => ohneFn((a.absaetze || []).join(" ")));
    const zaehler = texte.map((t) => saetze.filter((s) => t.includes(s.slice(0, 60))).length);
    const best = zaehler.indexOf(Math.max(0, ...zaehler));
    return best >= 0 && zaehler[best] * 2 > saetze.length ? best : 0;
  };
  const built = pages.map((page) => ({
    ...page,
    inOrt: page.inOrt || `in ${page.nameLang}`,
    fuerOrt: page.fuerOrt || page.nameLang,
    url: `/standorte/${page.slug}/`,
    kreis: page.kreis ? { ...page.kreis, exists: urls.has(page.kreis.url) } : null,
    // Nachbarseiten erst verlinken, wenn es sie gibt (die Bezirksseiten entstehen nacheinander).
    nachbarn: (page.nachbarn || []).filter((n) => urls.has(n.url)),
    heroPhoto: photo(page.hero),
    bandPhoto: photo(page.band),
    // Unterseiten haben einen Schrägstrich im slug (berlin/pankow); die Kartendatei heißt karte-berlin-pankow-<breite>.webp
    karte: page.karte && (page.anbindung || []).length && fs.existsSync(path.join(imageDir, `karte-${page.slug.replace(/\//g, "-")}-960.webp`))
      ? { ...page.karte, name: `karte-${page.slug.replace(/\//g, "-")}` } : null,
    abschnitte: (page.abschnitte || []).map((a) => {
      const doppelpunkt = a.h2.indexOf(": ");
      const kopf = doppelpunkt > 0 ? a.h2.slice(0, doppelpunkt) : a.h2;
      // kopfWort: Zeichen des längsten Worts im Ortsnamen; umbrechen darf die Zeile an Leerzeichen, nach / und nach Bindestrich
      const kopfWort = Math.max(...kopf.split(/\s+|(?<=[-\/])/).map((w) => w.length));
      return { ...a, foto: photo(a.bild), kopf, kopfWort, zusatz: doppelpunkt > 0 ? a.h2.slice(doppelpunkt + 2) : "", mehr: mehrZu(a.mehrZuOrt || kopf, (a.absaetze || []).slice(1)) };
    }),
    kartenKapitel: kartenKapitel(page),
    // Design-Pass 2 §5 Zeile 1: H1 in zwei Teilen, der Ortsname groß, „Immobilie verkaufen, kaufen und finanzieren“ darunter
    h1Teile: (() => { const m = String(page.h1).match(/^(.+?) (im|in) (.+)$/); return m ? { dienst: m[1], praep: m[2], ort: m[3] } : null; })(),
    kernzahlen: kernzahlen(page.zahlen),
    ...Object.fromEntries(["verkaufen", "kaufen", "finanzieren"].filter((k) => page[k]).map((k) => [k, { ...page[k], ...ersteSaetze(page[k].absaetze, 2) }]))
  }));
  const byUrl = new Map(built.map((page) => [page.url, page]));
  const card = (url) => {
    const target = byUrl.get(url);
    return target ? { heroPhoto: target.heroPhoto, label: target.typ === "stadt" ? "Übersicht" : target.kicker || (target.kreis && target.kreis.name) || "Brandenburg" } : { heroPhoto: null, label: "" };
  };
  return built.map((page) => ({
    ...page,
    nachbarn: page.nachbarn.map((n) => ({ ...n, ...card(n.url) })),
    kreis: page.kreis ? { ...page.kreis, ...card(page.kreis.url) } : null
  }));
};
