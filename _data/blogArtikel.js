// Blogartikel im neuen Design (Brief Design-Pass §4.8).
// Quelle bleibt die Ausgabe von Blogs/design-muster/_build/live.py in blog/<slug>/index.html:
// Text, Grafiken, Fragen, Quellen und JSON-LD kommen wörtlich von dort und werden hier nicht geändert.
// Übernommen wird nur der Artikel selbst; Kopf, Menü, Lesemodus, Seitenleisten und Fuß der alten
// Vorlage fallen weg, die liefert base.njk. Passt die Vorlage nicht mehr, bricht der Build ab.
const fs = require("fs");
const path = require("path");
const posts = require("./blog.json");
const nav = require("./nav.js");
const kontakte = require("./kontakte.js");

// Bezeichnung und Notiz einer Leistung wie im Menü
const menuItems = nav.menu.flatMap((g) => g.items);
const leistung = (href) => {
  if (href === "/immobilienbewertung/") return { href, label: "Kostenlose Immobilienbewertung", note: "Marktwert meist am selben Tag" };
  const item = menuItems.find((i) => i.href === href);
  if (!item) throw new Error(`blogArtikel: Leistung ${href} nicht im Menü`);
  return { href, label: item.label, note: item.note };
};

const ENT = { amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'", nbsp: " ", shy: "" };
const text = (html) => html.replace(/<[^>]+>/g, "").replace(/&(amp|lt|gt|quot|#39|nbsp|shy);/g, (m, e) => ENT[e]).trim();

// Leistungen je Kategorie (Brief §4.8: verwandte Leistungen am Ende) und Ansprechpartner (Brief §4.0)
const KATEGORIEN = {
  "finanzierung": { kontakt: "timon", button: "gespraech", leistungen: ["/finanzierungsberatung.html", "/kapitalanlage.html", "/ankaufsberatung.html"] },
  "kauf-kapitalanlage": { kontakt: "lennart", button: "gespraech", leistungen: ["/kapitalanlage.html", "/ankaufsberatung.html", "/kaufen.html"] },
  "bewertung-markt": { kontakt: "lennart", button: "bewertung", leistungen: ["/immobilienbewertung/", "/verkaufen.html", "/ankaufsberatung.html"] },
  "vermietung": { kontakt: "lennart", button: "gespraech", leistungen: ["/vermieten.html", "/betreuung-nach-dem-kauf/", "/kapitalanlage.html"] },
  "steuern": { kontakt: "timon", button: "gespraech", leistungen: ["/kapitalanlage.html", "/finanzierungsberatung.html", "/betreuung-nach-dem-kauf/"] }
};

// Ende des festen Skripts der Vorlage (Menü, Lesemodus, Fortschritt); danach stehen die Skripte der Artikelgrafiken.
const SKRIPT_ENDE = 'addEventListener("scroll",function(){tick();shrink()},{passive:true});tick();shrink();\n})();';

function eins(html, re, slug, was) {
  const m = html.match(re);
  if (!m) throw new Error(`blogArtikel ${slug}: ${was} nicht gefunden`);
  return m;
}

function artikel(post) {
  const slug = post.slug;
  const html = fs.readFileSync(path.join("blog", slug, "index.html"), "utf8");
  const kopf = html.slice(0, html.indexOf("</head>"));

  const kat = eins(html, /<a class="tag" href="\.\.\/#([a-z-]+)">([^<]*)<\/a>/, slug, "Kategorie");
  if (!KATEGORIEN[kat[1]]) throw new Error(`blogArtikel ${slug}: Kategorie ${kat[1]} ohne Zuordnung`);
  const lead = eins(html, /<figure class="lead-img"[^>]*>\s*<img src="([^"]+)" alt="([^"]*)" width="(\d+)" height="(\d+)"/, slug, "Aufmacherbild");
  // Livegang 31.10.2026: Ist das Titelbild ein Lizenzfoto (A7), steht die Bildzeile von artikel.py in der figure.
  const leadBild = (html.match(/<figure class="lead-img"[^>]*>\s*<img [^>]*>(<figcaption>Foto: [\s\S]*?<\/figcaption>)?\s*<\/figure>/) || [])[1];
  const dl = eins(html, /<p class="dateline"><span>(.*?)<\/span><span class="by">(.*?)<\/span><\/p>/, slug, "Datumszeile");

  const tocHtml = eins(html, /<nav class="toc" aria-label="Inhalt">([\s\S]*?)<\/nav>/, slug, "Inhaltsverzeichnis")[1];
  const toc = [...tocHtml.matchAll(/<a href="(#[^"]+)"(?: class="sub")?>(.*?)<\/a>/g)].map((m) => ({ href: m[1], label: m[2] }));

  const start = html.indexOf('<article class="body">');
  const ende = html.indexOf("</article>", start);
  if (start < 0 || ende < 0) throw new Error(`blogArtikel ${slug}: Artikeltext nicht gefunden`);
  const body = html.slice(start + '<article class="body">'.length, ende).trim();
  if (body.includes("<article")) throw new Error(`blogArtikel ${slug}: verschachtelter Artikel`);
  // Links der Vorlage auf die alte Übersicht zeigen auf /blog/, Links auf fg-realestate.de bleiben auf der
  // eigenen Seite (wichtig für die Testumgebung); der Linktext ändert sich nicht.
  const bodyNeu = body
    .replace(/href="\.\.\/(#[a-z-]+)?"/g, (m, anker) => `href="/blog/${anker || ""}"`)
    .replace(/href="https:\/\/fg-realestate\.de\//g, 'href="/');

  const css = (kopf.match(/<style>\n?([\s\S]*?)<\/style>/) || [, ""])[1].trim();
  const skripte = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const fest = skripte.find((s) => s.includes(SKRIPT_ENDE));
  if (!fest) throw new Error(`blogArtikel ${slug}: Skript der Vorlage nicht erkannt`);
  const js = fest.slice(fest.indexOf(SKRIPT_ENDE) + SKRIPT_ENDE.length).trim();

  const jsonld = JSON.parse(eins(html, /<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/, slug, "JSON-LD")[1]);
  // Autor (Update 4, 3.3): Person aus dem JSON-LD von artikel.py, erst nach Zustimmung von Timon und Lennart
  // (AUTOREN_FREIGEGEBEN). Zugeordnet über die Profiladresse; bis dahin ist der Autor die Firma und autor bleibt null.
  const verfasser = [].concat(jsonld).map((x) => x && x.author).find(Boolean);
  let autor = null;
  if (verfasser && verfasser["@type"] === "Person") {
    const pfad = String(verfasser.url || "").replace(/^https:\/\/fg-realestate\.de/, "");
    const key = Object.keys(kontakte).find((k) => kontakte[k].profile && kontakte[k].profile.href === pfad);
    if (!key) throw new Error(`blogArtikel ${slug}: Autor ${verfasser.name} ohne Profil in kontakte.js`);
    autor = { key, name: verfasser.name, url: pfad };
  }
  const woerter = text(body.replace(/<(style|script)[\s\S]*?<\/\1>/g, " ").replace(/</g, " <")).split(/\s+/).filter(Boolean).length;

  return {
    ...post,
    title: text(eins(kopf, /<title>(.*?)<\/title>/, slug, "Titel")[1]),
    description: text(eins(kopf, /<meta name="description" content="([^"]*)">/, slug, "Beschreibung")[1]),
    crumb: eins(html, /<nav class="crumbs"[^>]*>[\s\S]*?<span>(.*?)<\/span><\/nav>/, slug, "Brotkrume")[1],
    katId: kat[1],
    katLabel: kat[2],
    kat: KATEGORIEN[kat[1]],
    leistungen: KATEGORIEN[kat[1]].leistungen.map(leistung),
    h1: eins(html, /<div class="head">[\s\S]*?<h1>(.*?)<\/h1>/, slug, "H1")[1],
    stand: dl[1],
    by: dl[2].replace(/href="https:\/\/fg-realestate\.de\//g, 'href="/'),
    autor,
    minuten: Number(eins(html, /<span class="pill">(\d+) Min\. Lesezeit<\/span>/, slug, "Lesezeit")[1]),
    lead: { src: lead[1], alt: lead[2], width: lead[3], height: lead[4], caption: leadBild ? leadBild.slice("<figcaption>".length, -"</figcaption>".length) : null },
    toc,
    woerter,
    zeigeToc: woerter > 1200,
    body: bodyNeu,
    css,
    js,
    jsonld
  };
}

module.exports = () => posts.map(artikel);
