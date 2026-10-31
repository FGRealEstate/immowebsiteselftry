// Daten für /bildnachweise/ (Update 4, 2.2): jedes Foto mit Lizenz, je Quelle eine Zeile.
// Leistungsseiten, Startseite, Kontakt: _data/seitenbilder.json + fotoquellen.json.
// Gebietsseiten: hero, band und abschnitte[].bild in content/gebiete/*.json, nur wenn das Foto dort schon liegt.
// Blog (Update 4, 2.8): Bildzeilen „Foto: …“ unter den Abschnittsbildern in blog/<slug>/index.html (Ausgabe von live.py).
// Alles liegt in site/, damit der Build auf Netlify ohne die Ordner außerhalb auskommt.
// Update 9 (29.10.2026): Jede Zeile hat eine id (Sprungziel /bildnachweise/#bild-…) und bilder = Pfade der Bilddateien ohne
// Breite. Aus bilder baut .eleventy.js den Aufklapper „Bildnachweise dieser Seite“, so haben Seite und Aufklapper dieselbe Quelle.
const fs = require("fs");
const path = require("path");

const lizenzen = require("./lizenzen.json");
const fotoquellen = require("./fotoquellen.json");
const seitenbilder = require("./seitenbilder.json");
const blogPosts = require("./blog.json");
const freigaben = require("./freigaben.js");

const site = path.join(__dirname, "..");

function split(credit) {
  const cut = credit.lastIndexOf(", ");
  const license = credit.slice(cut + 2);
  if (!lizenzen[license]) throw new Error(`[bildnachweise] Lizenz "${license}" fehlt in lizenzen.json`);
  return { author: credit.slice(0, cut), license, licenseUrl: lizenzen[license] };
}

// Titel der Datei aus der Commons-Adresse; bei Pexels steht er in fotoquellen.json (titel)
function title(url) {
  const m = url.match(/\/wiki\/File:(.+)$/);
  if (m) return decodeURIComponent(m[1]).replace(/_/g, " ").replace(/\.(jpe?g|png)$/i, "");
  return "";
}

function host(url) {
  return url.includes("commons.wikimedia.org") ? "Wikimedia Commons" : url.includes("pexels.com") ? "Pexels" : new URL(url).host;
}

module.exports = function () {
  const seiten = new Map();
  for (const [name, bild] of Object.entries(seitenbilder)) {
    if (name.startsWith("_")) continue;
    // Bild einer Seite, die erst nach dem Launch kommt (Feld freigabe, _data/freigaben.js): erst dann im Nachweis
    if (bild.freigabe && !freigaben[bild.freigabe]) continue;
    const q = fotoquellen[bild.quelle];
    const entry = seiten.get(bild.quelle) || { id: `bild-seite-${bild.quelle}`, url: q.url, title: q.titel || title(q.url), host: host(q.url), ...split(q.credit), uses: [], bilder: [] };
    if (!entry.uses.includes(bild.verwendung)) entry.uses.push(bild.verwendung);
    // Pfad wie im Filter bild (.eleventy.js): mit Schrägstrich unter images/, sonst unter images/seiten/
    entry.bilder.push(name.includes("/") ? `/images/${name}` : `/images/seiten/${name}`);
    seiten.set(bild.quelle, entry);
  }

  const gebiete = new Map();
  const dir = path.join(site, "content", "gebiete");
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const page = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const specs = [["Titelbild", page.hero], ["Bild zwischen den Kapiteln", page.band], ...(page.abschnitte || []).map((a) => ["Abschnitt", a.bild])];
    for (const [role, spec] of specs) {
      if (!spec || !spec.name || !spec.url) continue;
      if (!fs.readdirSync(path.join(site, "images", "gebiete")).some((f) => f.startsWith(`${spec.name}-`))) continue;
      const entry = gebiete.get(spec.name) || { id: `bild-gebiet-${spec.name}`, url: spec.url, title: title(spec.url), host: host(spec.url), alt: spec.alt, ...split(spec.credit), uses: [], bilder: [`/images/gebiete/${spec.name}`] };
      entry.uses.push({ label: `${page.name}, ${role}`, href: `/standorte/${page.slug}/` });
      gebiete.set(spec.name, entry);
    }
  }

  // Lizenzfotos im Blog: Abschnittsbild mit Bildzeile, seit 31.10.2026 auch das Titelbild (A7); die Lizenzangabe muss in lizenzen.json stehen
  const blog = [];
  const FOTO = /<figure class="(?:sec-img|lead-img)"[^>]*>\s*<img src="([^"]+)" alt="([^"]*)"[^>]*><figcaption>Foto: <a href="([^"]+)"[^>]*>([^<]+)<\/a>, <a href="([^"]+)"[^>]*>([^<]+)<\/a>, zugeschnitten<\/figcaption>\s*<\/figure>/g;
  for (const post of blogPosts) {
    const html = fs.readFileSync(path.join(site, "blog", post.slug, "index.html"), "utf8");
    const treffer = [...html.matchAll(FOTO)];
    if (treffer.length !== html.split("<figcaption>Foto:").length - 1) throw new Error(`[bildnachweise] Blog ${post.slug}: Bildzeile in unerwartetem Format`);
    for (const [i, m] of treffer.entries()) {
      const [, , alt, url, author, licenseUrl, license] = m;
      if (lizenzen[license] !== licenseUrl) throw new Error(`[bildnachweise] Blog ${post.slug}: Lizenz "${license}" passt nicht zu lizenzen.json`);
      blog.push({ id: `bild-blog-${post.slug}-${i + 1}`, url, title: title(url), host: host(url), alt, author: author.replace(/&amp;/g, "&"), license, licenseUrl, uses: [{ label: post.titel, href: post.url }] });
    }
  }

  return {
    seiten: [...seiten.values()],
    blog,
    gebiete: [...gebiete.values()].sort((a, b) => a.uses[0].label.localeCompare(b.uses[0].label, "de"))
  };
};
