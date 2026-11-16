/*
 * Update 57 §2, §3.3 und §12 (15.11.2026): Prüfung des fertigen Builds.
 *   1. Sitemap: jede Adresse hat eine Datei, kein .html, keine Weiterleitung, kein noindex, Canonical und og:url = Adresse.
 *   2. Links: kein interner Link (href oder absolute Adresse, auch im Schema) zeigt auf .html, auf eine Weiterleitung
 *      oder ins Leere.
 *   3. llms.txt: jede Seite, die dort steht, steht genau so in der Sitemap.
 *   4. _redirects: jedes interne Ziel ist eine Seite ohne .html und selbst keine Weiterleitung (keine Ketten).
 *   5. Blog (Update 57 §3.3): ein Artikel ist ganz live (Seite, Karte auf /blog/, Sitemap, llms.txt, Links von anderen
 *      Seiten) oder gar nicht (keine Seite, also 404, und nirgends erwähnt). Halb live gibt es nicht.
 * Der Build ruft pruefe() in .eleventy.js auf und bricht bei einem Fehler ab; die letzte gute Version bleibt dann live.
 *
 * Aufruf von Hand:
 *   node scripts/adressen.js [_site]   prüft einen Build-Ordner (Standard _site)
 *   node scripts/adressen.js --live    prüft die Live-Seite: jede Sitemap-Adresse antwortet 200 ohne Weiterleitung, ihr
 *                                      Canonical ist genau diese Adresse, jede .html-Hauptseite leitet mit 301 weiter
 */
const fs = require("fs");
const path = require("path");

const BASIS = "https://fg-realestate.de";
const AUSGELASSEN = new Set(["vendor", "admin", "_bibliothek", "images", "bilder", "fonts", "css"]);
const ABS = /https:\/\/fg-realestate\.de(\/[^"'\s<>)\\\]]*)?/g;
const HREF = /href\s*=\s*["']([^"']*)["']/g;

const istDatei = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };
const ohneAnker = (u) => u.replace(/[#?].*$/, "");
const schluessel = (p) => p.replace(/\/+$/, "") || "/"; // Netlify vergleicht Regeln ohne Schrägstrich am Ende

// Update 57 §6 / Update 62 §4: Titel endet genau einmal auf „ | Fischer & Geserich“; davor kein weiterer Markenteil als Endung.
const ENDUNG = " | Fischer & Geserich";
function titelEndungOk(titel) {
  if (!titel.endsWith(ENDUNG)) return false;
  const vorn = titel.slice(0, -ENDUNG.length);
  return !vorn.includes(ENDUNG.trim()) && !/(?:^|[|–-]\s*)Fischer & Geserich(?: Real Estate)?(?: GmbH)?\s*$/.test(vorn);
}

function weiterleitungen(dir) {
  const regeln = new Map();
  const f = path.join(dir, "_redirects");
  if (!istDatei(f)) return regeln;
  for (const zeile of fs.readFileSync(f, "utf8").split("\n")) {
    const t = zeile.trim().split(/\s+/);
    if (!t[0] || t[0].startsWith("#") || t.length < 2) continue;
    const [von, nach, status = "301"] = t;
    if (/[*:]/.test(von) || nach.includes("=") || !/^30[12]/.test(status)) continue;
    if (!regeln.has(schluessel(von))) regeln.set(schluessel(von), { von, nach, status });
  }
  return regeln;
}

// Datei, die Netlify unter einer Adresse ausliefert (/kaufen → kaufen.html, /blog/x/ → blog/x/index.html), sonst null.
function dateiFuer(dir, p) {
  if (p.endsWith("/")) return istDatei(path.join(dir, p, "index.html")) ? path.join(dir, p, "index.html") : null;
  const f = path.join(dir, p);
  if (istDatei(f)) return f;
  if (istDatei(f + ".html")) return f + ".html";
  return null;
}

function alleSeiten(dir, unter = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, unter), { withFileTypes: true })) {
    const rel = path.join(unter, e.name);
    if (e.isDirectory()) { if (!(unter === "" && AUSGELASSEN.has(e.name))) out.push(...alleSeiten(dir, rel)); }
    else if (e.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

const adresseVon = (rel) => "/" + rel.split(path.sep).join("/").replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");
const attribut = (html, muster) => { const m = html.match(muster); return m ? m[1] : null; };
const canonical = (html) => attribut(html, /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["']/i)
  || attribut(html, /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["']/i);
const ogUrl = (html) => attribut(html, /<meta\b[^>]*\bproperty=["']og:url["'][^>]*\bcontent=["']([^"']+)["']/i);
const noindex = (html) => /<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html);

function sitemapAdressen(dir) {
  const index = path.join(dir, "sitemap.xml");
  if (!istDatei(index)) return { adressen: [], fehler: ["sitemap.xml fehlt"] };
  const fehler = [];
  const adressen = [];
  for (const [, loc] of fs.readFileSync(index, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const datei = path.join(dir, loc.replace(BASIS, ""));
    if (!istDatei(datei)) { fehler.push(`Sitemap: ${loc} fehlt im Build`); continue; }
    for (const [, u] of fs.readFileSync(datei, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) adressen.push({ loc: u, teil: path.basename(datei) });
  }
  return { adressen, fehler };
}

function pruefe(dir, { plan, hinweise = [] } = {}) {
  const titelSeiten = new Map(); // Update 57 §6
  const fehler = [];
  const regeln = weiterleitungen(dir);
  const { adressen, fehler: smFehler } = sitemapAdressen(dir);
  fehler.push(...smFehler);
  const inSitemap = new Set(adressen.map((a) => a.loc));

  // 1. Sitemap
  const doppelt = adressen.map((a) => a.loc).filter((u, i, alle) => alle.indexOf(u) !== i);
  for (const u of new Set(doppelt)) fehler.push(`Sitemap: ${u} steht mehrfach drin`);
  for (const { loc } of adressen) {
    if (!loc.startsWith(BASIS + "/")) { fehler.push(`Sitemap: ${loc} ist keine Adresse von ${BASIS}`); continue; }
    const p = decodeURI(loc.slice(BASIS.length));
    if (/\.html$/.test(p)) fehler.push(`Sitemap: ${loc} endet auf .html`);
    if (regeln.has(schluessel(p))) fehler.push(`Sitemap: ${loc} wird weitergeleitet (${regeln.get(schluessel(p)).nach})`);
    const f = dateiFuer(dir, p);
    if (!f) { fehler.push(`Sitemap: ${loc} hat keine Seite im Build`); continue; }
    const html = fs.readFileSync(f, "utf8");
    const c = canonical(html);
    if (c !== loc) fehler.push(`Canonical: ${loc} hat ${c || "keins"}`);
    const og = ogUrl(html);
    if (og && og !== loc) fehler.push(`og:url: ${loc} hat ${og}`);
    if (noindex(html)) fehler.push(`Sitemap: ${loc} ist noindex`);
    // Update 57 §6: eine Endung „ | Fischer & Geserich“, sonst Fehler; über 60 Zeichen und doppelte Titel nur als Hinweis,
    // weil Angebotstitel aus Propstack-Daten kommen und den täglichen Build (und damit den Blog) nicht anhalten sollen
    const titel = ((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || "").trim()
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    // Update 62 §4: Der Name darf vorn im Titel stehen („Partner von Fischer & Geserich | Fischer & Geserich“, Brief), aber nicht
    // als zweite Endung davor (alte Endung „– Fischer & Geserich …“ oder „| Fischer & Geserich“ doppelt).
    if (!titelEndungOk(titel)) fehler.push(`Titel: ${loc} „${titel}“ endet nicht genau einmal auf „ | Fischer & Geserich“`);
    if (titel.length > 60) hinweise.push(`Titel: ${loc} hat ${titel.length} Zeichen`);
    if (titelSeiten.has(titel)) hinweise.push(`Titel: „${titel}“ doppelt (${titelSeiten.get(titel)} und ${loc})`);
    titelSeiten.set(titel, loc);
  }

  // 2. Links in allen Seiten
  const eingehend = new Map(); // Adresse → Set der Seiten, die darauf verlinken
  const linkFehler = new Map(); // Meldung → erste Seite, Anzahl
  const melde = (text, seite) => {
    const e = linkFehler.get(text) || { seite, n: 0 };
    e.n += 1;
    linkFehler.set(text, e);
  };
  for (const rel of alleSeiten(dir)) {
    const von = adresseVon(rel);
    const html = fs.readFileSync(path.join(dir, rel), "utf8");
    const ziele = new Set();
    for (const [, h] of html.matchAll(HREF)) if (h.startsWith("/") && !h.startsWith("//")) ziele.add(h);
    for (const [, p = "/"] of html.matchAll(ABS)) ziele.add(p);
    for (const roh of ziele) {
      if (/\$\{|\{\{|\{%/.test(roh)) continue; // Vorlage in einem Skript, keine Adresse
      let p = ohneAnker(roh);
      try { p = decodeURI(p); } catch { /* bleibt */ }
      if (!p || p.startsWith("/.netlify/") || p.startsWith("/qr/") || p === "/cdn-cgi/l/email-protection") continue;
      const endung = (p.match(/\.([a-z0-9]+)$/i) || [])[1];
      if (endung && endung.toLowerCase() !== "html") {
        if (!istDatei(path.join(dir, p))) melde(`Link: ${p} (Datei fehlt im Build)`, von);
        continue;
      }
      if (/\.html$/.test(p) && p !== "/404.html") { melde(`Link: ${p} endet auf .html`, von); continue; }
      if (regeln.has(schluessel(p))) { melde(`Link: ${p} wird weitergeleitet auf ${regeln.get(schluessel(p)).nach}`, von); continue; }
      if (!dateiFuer(dir, p)) {
        melde(dateiFuer(dir, p + "/") ? `Link: ${p} ohne Schrägstrich am Ende (Netlify leitet weiter)` : `Link: ${p} führt ins Leere`, von);
        continue;
      }
      if (p !== von) {
        if (!eingehend.has(p)) eingehend.set(p, new Set());
        eingehend.get(p).add(von);
      }
    }
  }
  for (const [text, { seite, n }] of linkFehler) fehler.push(`${text}: ${n}× auf ${n === 1 ? "" : "u. a. "}${seite}`);

  // 3. llms.txt
  const llmsDatei = path.join(dir, "llms.txt");
  const llms = istDatei(llmsDatei) ? fs.readFileSync(llmsDatei, "utf8") : "";
  if (!llms) fehler.push("llms.txt fehlt");
  const inLlms = new Set();
  for (const [u, p = "/"] of llms.matchAll(ABS)) {
    const ohne = ohneAnker(u);
    if (/\.[a-z0-9]+$/i.test(p) && !/\.html$/.test(ohneAnker(p))) continue; // Datei (z. B. llms-full.txt)
    inLlms.add(ohne);
    if (!inSitemap.has(ohne)) fehler.push(`llms.txt: ${ohne} steht nicht in der Sitemap`);
  }

  // 4. Ziele der Weiterleitungen
  for (const { von, nach } of regeln.values()) {
    if (!nach.startsWith("/") || /[*:]/.test(nach)) continue;
    const p = ohneAnker(nach);
    if (/\.html$/.test(p)) fehler.push(`_redirects: ${von} → ${nach} zielt auf .html`);
    else if (regeln.has(schluessel(p)) && schluessel(p) !== schluessel(von)) fehler.push(`_redirects: ${von} → ${nach} ist selbst eine Weiterleitung (Kette)`);
    else if (!dateiFuer(dir, p)) fehler.push(`_redirects: ${von} → ${nach} führt ins Leere`);
  }

  // 5. Blog: ganz live oder gar nicht
  const blogIndex = dateiFuer(dir, "/blog/");
  const karten = blogIndex ? fs.readFileSync(blogIndex, "utf8") : "";
  for (const a of (plan && plan.artikel) || []) {
    if (!a.slug) continue;
    const p = `/blog/${a.slug}/`;
    const teile = {
      Seite: Boolean(dateiFuer(dir, p)),
      Karte: karten.includes(`href="${p}"`) || karten.includes(`href='${p}'`),
      Sitemap: inSitemap.has(BASIS + p),
      "llms.txt": inLlms.has(BASIS + p),
      Links: [...(eingehend.get(p) || [])].some((s) => s !== "/blog/")
    };
    const da = Object.keys(teile).filter((k) => teile[k]);
    if (teile.Seite && da.length < 5) {
      fehler.push(`Blog: Nr. ${a.nr} ${p} ist halb live, es fehlt ${Object.keys(teile).filter((k) => !teile[k]).join(", ")}`);
    } else if (!teile.Seite && da.length) {
      fehler.push(`Blog: Nr. ${a.nr} ${p} hat keine Seite (404), steht aber in ${da.join(", ")}`);
    }
  }
  return fehler;
}

async function live() {
  const fehler = [];
  const holen = (u) => fetch(u, { redirect: "manual", headers: { "User-Agent": "fg-adressen-pruefung" }, signal: AbortSignal.timeout(20000) });
  const text = async (u) => (await holen(u)).text();
  const teile = [...(await text(`${BASIS}/sitemap.xml`)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const locs = [];
  for (const t of teile) locs.push(...[...(await text(t)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const reihe = locs.slice();
  const arbeiter = Array.from({ length: 6 }, async () => {
    while (reihe.length) {
      const loc = reihe.shift();
      try {
        const r = await holen(loc);
        if (r.status !== 200) { fehler.push(`${loc}: ${r.status}${r.headers.get("location") ? " → " + r.headers.get("location") : ""}`); continue; }
        const c = canonical(await r.text());
        if (c !== loc) fehler.push(`${loc}: Canonical ${c || "keins"}`);
      } catch (e) { fehler.push(`${loc}: ${e.message}`); }
    }
  });
  await Promise.all(arbeiter);
  const haupt = ["index", "agb", "angebote", "ankaufsberatung", "datenschutz", "finanzierungsberatung", "impressum", "investitionsrechner",
    "investment-lab", "kapitalanlage", "kaufen", "kontakt", "mehrfamilienhaus", "mieten", "objekt-anfragen", "ueber-uns", "verkaufen", "vermieten"];
  for (const n of haupt) {
    const r = await holen(`${BASIS}/${n}.html`);
    const ziel = n === "index" ? "/" : `/${n}`;
    const ort = (r.headers.get("location") || "").replace(BASIS, "");
    if (r.status !== 301 || ort !== ziel) fehler.push(`/${n}.html: ${r.status} → ${ort || "-"} (erwartet 301 → ${ziel})`);
  }
  return { fehler, anzahl: locs.length };
}

module.exports = { pruefe, weiterleitungen, dateiFuer, titelEndungOk };

if (require.main === module) {
  if (process.argv.includes("--live")) {
    live().then(({ fehler, anzahl }) => {
      console.log(fehler.length ? fehler.join("\n") : `ok: ${anzahl} Sitemap-Adressen 200 ohne Weiterleitung, Canonical = Adresse; .html-Hauptseiten 301`);
      process.exit(fehler.length ? 1 : 0);
    });
  } else {
    const dir = process.argv[2] || "_site";
    const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_data", "blogplan.json"), "utf8"));
    const hinweise = [];
    const fehler = pruefe(dir, { plan, hinweise });
    for (const h of hinweise) console.log("Hinweis " + h);
    console.log(fehler.length ? fehler.join("\n") : "ok");
    process.exit(fehler.length ? 1 : 0);
  }
}
