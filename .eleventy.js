module.exports = function(eleventyConfig) {
  // Erst nach dem Launch (Update 5): ohne Freigabe werden diese Vorlagen nicht gebaut (_data/freigaben.js).
  const freigaben = require("./_data/freigaben.js");
  if (!freigaben.referenzen) {
    eleventyConfig.ignores.add("referenzen.njk");
    eleventyConfig.ignores.add("referenz-detail.njk");
  }
  if (!freigaben.gewerbe) eleventyConfig.ignores.add("gewerbeimmobilien.njk");
  // Existing helper used by the current website.
  eleventyConfig.addFilter("pad2", (value) => String(value).padStart(2, "0"));
  // Geschützte Leerzeichen: Zahl und Einheit (4.726 €/m², 10 %, 950 m²) und § mit Nummer bleiben in einer Zeile.
  // Marktzahl im Zahlenblock: Wert groß, Einheit klein dahinter. Die Einheit darf in eine eigene Zeile
  // umbrechen, damit fünf Zahlen nebeneinander passen.
  eleventyConfig.addFilter("factValue", (value) => {
    const text = String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/(Ø) (\d)/g, "$1\u00a0$2");
    const match = text.match(/^(.*\d)\s*(€\/m²|€|%)$/);
    return match ? `${match[1]} <span class="fgd-fact-unit">${match[2]}</span>` : text;
  });
  eleventyConfig.addFilter("nbsp", (value) => String(value ?? "")
    .replace(/(\d) (€|%|m²|Minuten|Prozent|Hektar|Betten|Einwohner|Kauffälle|Fälle)/g, "$1\u00a0$2")
    .replace(/§ (\d)/g, "§\u00a0$1")
    .replace(/(Ø) (\d)/g, "$1\u00a0$2"));

  // Gebietsseiten (Brief Design-Pass 3.1 #7): Quellen als hochgestellte Fußnoten. Im JSON steht
  // [[3]] oder [[3,5]] für Eintrag 3 (und 5) der Liste „Quellen“; fn macht daraus Links auf #quelle-3,
  // nofn entfernt die Marken für Meta-Texte und JSON-LD.
  const FN_MARK = /\s*\[\[(\d+(?:\s*,\s*\d+)*)\]\]/g;
  eleventyConfig.addFilter("fn", (value) => String(value ?? "").replace(FN_MARK, (all, list) =>
    `<sup class="fgd-fn">${list.split(",").map((n) => n.trim())
      .map((n) => `<a href="#quelle-${n}" aria-label="Quelle ${n}">${n}</a>`).join("<span>,</span>")}</sup>`));
  eleventyConfig.addFilter("nofn", (value) => String(value ?? "").replace(FN_MARK, ""));
  // Gebietsseiten (Update 7 §3.6): Einleitung in den ersten Satz und den Rest teilen. Satzende ist . ! oder ?,
  // auch mit Fußnote [[n]] dahinter, gefolgt von Leerzeichen und einem Großbuchstaben oder „. Ohne zweiten Satz ist rest leer.
  eleventyConfig.addFilter("ersterSatz", (value) => {
    const text = String(value ?? "");
    const m = text.match(/^(.+?[.!?](?:\[\[[\d,\s]+\]\])?)\s+(?=[A-ZÄÖÜ„])/);
    return m ? { erster: m[1], rest: text.slice(m[0].length) } : { erster: text, rest: "" };
  });
  // Investment Lab: Daten ohne den Ausbau der Lexikon-Einträge (Update 4, 2.13). Das Lab zeigt nur explanation und
  // practiceExample; der Ausbau steht auf /lexikon/<slug>/ und würde die Seite nur größer machen.
  eleventyConfig.addFilter("ohneAusbau", (data) => ({ ...data, lexicon: (data.lexicon || []).map(({ ausbau, ...rest }) => rest) }));

  eleventyConfig.addFilter("json", (value) => {
    try {
      return JSON.stringify(value ?? null);
    } catch (error) {
      console.warn("JSON filter failed:", error);
      return "null";
    }
  });

  // Related glossary terms for machine-readable internal linking.
  eleventyConfig.addFilter("relatedTerms", (body, lexicon, limit) => {
    const text = Array.isArray(body) ? body.join(" ") : String(body || "");
    const stems = new Set(
      (text.toLowerCase().match(/[a-zäöüß]{4,}/g) || []).map((word) => word.slice(0, 6))
    );
    return (lexicon || [])
      .filter((entry) => stems.has(entry.term.toLowerCase().slice(0, 6)))
      .slice(0, limit || 5);
  });

  // Neues Design: ein Fallback-Link, solange die Zielseite noch gebaut wird (siehe _data/nav.js).
  eleventyConfig.addFilter("navHref", (item) => (item && (item.fallback || item.href)) || "#");
  // Propstack liefert Preise mit Cent („225.000,00 €“); auf den Angebotsseiten ohne „,00“ (Daten bleiben unverändert).
  eleventyConfig.addFilter("eur", (value) => (value ? String(value).replace(/,00 €/g, " €") : value));

  // Update 7 §4: Propstack-Fotos auf Produktion über das Netlify Image CDN (passende Breite, webp/avif statt Originaldatei bis 6,3 MB).
  // Nur in Netlify-Builds (NETLIFY=true, setzt Netlify selbst); lokal und in der Cloudflare-Testumgebung bleiben die Originale.
  // Freigabe des Bildhosts: [images] remote_images in netlify.toml. JSON-LD bleibt bei der Originaladresse, og:image siehe propstackOg.
  // Rückweg ohne Codeänderung: Umgebungsvariable FG_BILD_CDN=aus in Netlify setzen und neu bauen.
  const PROPSTACK_FOTO = /^https:\/\/images\.propstack\.de\//;
  const imageCdn = (url) => process.env.NETLIFY === "true" && process.env.FG_BILD_CDN !== "aus" && PROPSTACK_FOTO.test(String(url || ""));
  const cdnFoto = (url, w) => `/.netlify/images?url=${encodeURIComponent(url)}&w=${w}&q=75`;
  // Update 49 §2 (09.11.2026): Fotos, die der Build schon aufbereitet hat (scripts/propstack-bilder.js), kommen von der eigenen
  // Seite: src ist das JPEG in 1600 px, srcset die WebP-Reihe; der Transform „propstack-picture“ ergänzt AVIF und WebP als
  // <source>. Fotos, die (noch) nicht aufbereitet sind, laufen weiter über das Netlify Image CDN bzw. als Original.
  const bilder = require("./scripts/propstack-bilder.js");
  eleventyConfig.addFilter("propstackFoto", (url, w = 1200) => { const e = bilder.eintrag(url); return e ? bilder.jpegUrl(e) : imageCdn(url) ? cdnFoto(url, w) : url; });
  // Update 23 B6: Vorschaubild fürs Teilen als JPG 1200 × 630 (mittig zugeschnitten) über dasselbe CDN; absolute Adresse, weil
  // WhatsApp und LinkedIn sie von außen abrufen. Außerhalb von Netlify bleibt die Originaladresse.
  eleventyConfig.addFilter("propstackOg", (url) => (imageCdn(url) ? `https://fg-realestate.de/.netlify/images?url=${encodeURIComponent(url)}&w=1200&h=630&fit=cover&fm=jpg&q=75` : url));
  eleventyConfig.addFilter("propstackSrcset", (url, breiten = [480, 800, 1200, 1600]) => { const e = bilder.eintrag(url); return e ? bilder.srcset(e, "webp") : imageCdn(url) ? breiten.map((w) => `${cdnFoto(url, w)} ${w}w`).join(", ") : ""; });
  // Update 49 §2: <img> mit aufbereitetem Propstack-Foto als <picture>: AVIF zuerst, dann WebP, das <img> behält das JPEG
  // als Rückfall und alle übrigen Merkmale (Klassen, loading, fetchpriority, data-*). display: contents, damit das Bild im
  // Layout bleibt, wo es war (Galerie, Kacheln). Ohne sizes gilt wie bisher 100vw.
  const PS_IMG = new RegExp(`<img\\b[^>]*\\ssrc="${bilder.URL_PFAD}/[^"]+\\.jpg"[^>]*>`, "g");
  eleventyConfig.addTransform("propstack-picture", function (content) {
    if (!String(this.page && this.page.outputPath || "").endsWith(".html") || !content.includes(`src="${bilder.URL_PFAD}/`)) return content;
    return content.replace(PS_IMG, (img) => {
      const set = (img.match(/\ssrcset="([^"]*)"/) || [])[1];
      if (!set || !/\.webp\s/.test(set)) return img;
      const sizes = (img.match(/\ssizes="([^"]*)"/) || [])[1] || "100vw";
      const ohne = img.replace(/\ssrcset="[^"]*"/, "").replace(/\ssizes="[^"]*"/, "");
      const avif = set.replace(/\.webp(\s)/g, ".avif$1");
      return `<picture class="fgs-ps" style="display:contents"><source type="image/avif" srcset="${avif}" sizes="${sizes}"><source type="image/webp" srcset="${set}" sizes="${sizes}">${ohne}</picture>`;
    });
  });
  eleventyConfig.on("eleventy.after", ({ dir }) => bilder.kopieren(dir.output));
  // Exposé-Texte aus Propstack kommen meist als reiner Text mit Leerzeilen und „- “-Listen.
  // Für die Objektseiten: Leerzeile = neuer Absatz, „- “/„• “-Zeilen = Liste. Text mit HTML-Absätzen bleibt, wie er ist.
  eleventyConfig.addFilter("exposeText", (value) => {
    const text = String(value || "").trim();
    if (!text || /<(p|br|ul|ol|li|div)\b/i.test(text)) return text;
    const esc = (v) => v.replace(/&(?![a-z]+;|#\d+;)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const out = [];
    for (const block of text.split(/\n\s*\n/)) {
      let para = [];
      let list = [];
      // Zeilenumbruch nach langer Zeile ohne Satzende ist ein harter Umbruch aus einer Vorlage (PDF): Leerzeichen statt <br>.
      const flushPara = () => { if (para.length) out.push(`<p>${para.map((l, i) => (i ? (para[i - 1].length >= 60 && !/[.:!?]$/.test(para[i - 1]) ? " " : "<br>") : "") + esc(l)).join("")}</p>`); para = []; };
      const flushList = () => { if (list.length) out.push(`<ul>${list.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`); list = []; };
      // Mehrere kurze Zeilen ohne Satzende (z. B. „Kennzahlen auf einen Blick“) sind eine Aufzählung.
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length >= 3 && lines.every((l) => l.length <= 60 || (l.length <= 90 && !/[.!?]$/.test(l)))) {
        out.push(`<ul>${lines.map((l) => `<li>${esc(l.replace(/^[-–•*]\s+/, ""))}</li>`).join("")}</ul>`);
        continue;
      }
      for (const raw of block.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        const item = line.match(/^[-–•*]\s+(.*)$/);
        if (item) { flushPara(); list.push(item[1]); } else { flushList(); para.push(line); }
      }
      flushPara();
      flushList();
    }
    return out.join("\n");
  });
  // Gebiete (_data/serviceArea.js): gebaute Seiten als Link, noch nicht gebaute als Text.
  const escHtml = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  // current (optional): URL der aktuellen Seite, damit das Menü die eigene Seite markiert.
  eleventyConfig.addFilter("areaLink", (place, label, current) => {
    const text = escHtml(label || place.name);
    const mark = current && current === place.url ? ' aria-current="page"' : "";
    return place.exists ? `<a href="${place.url}"${mark}>${text}</a>` : `<span class="fgd-area-soon">${text}</span>`;
  });
  // Update 6, §2 (27.10.2026): Fakten, die Timon korrigiert hat, gelten auf allen Seiten. Die Vorlagen sind direkt
  // geändert; Texte aus dem generierten mangoTexte.js (nicht bearbeiten) ersetzt fakten6 beim Bauen, Satz für Satz.
  const KNK_NEU = "Die Kaufnebenkosten liegen meist bei 7,5 bis 15 Prozent des Kaufpreises, je nach Bundesland und je nachdem, ob eine Maklerprovision anfällt. In Bayern können es ohne Makler auch nur rund 5,5 Prozent sein.";
  const FAKTEN6 = [
    ["Ihre Kaufnebenkosten liegen je nach Bundesland bei 8 bis 12 Prozent, bei einer Wohnung für 100.000 Euro reichen also grob 10.000 bis 12.000 Euro Eigenkapital.", KNK_NEU],
    [", weil Ihre Kaufnebenkosten je nach Bundesland bei 8 bis 12 Prozent liegen.", ". " + KNK_NEU],
    ["Ein Kunde mit Wohnsitz in Dubai", "Ein Kunde mit Wohnsitz in Zypern"],
    ["Bei schlechteren Energieeffizienzklassen verlangen Banken inzwischen einen Modernisierungsfahrplan, bevor sie überhaupt finanzieren.",
      "Bei schlechteren Energieeffizienzklassen verlangen viele Banken inzwischen einen energetischen Modernisierungsfahrplan. Noch nicht alle tun das, in den nächsten Jahren wird es aber bei den meisten Banken Standard sein."],
    // Update 6 §3.4: erster Satz der FAQ-Antwort D3 (110-Prozent-Finanzierung), nur auf Finanzierungsberatung
    ["Weil sie Ihren Skalierungseffekt zerstört, bevor er überhaupt entstehen konnte.", "Weil Sie sich damit oft die zweite Immobilie verbauen."]
  ];
  // Update 19 §1 (30.10.2026): kein Komma vor „und“/„oder“ zwischen zwei Hauptsätzen. Antworten aus mangoTexte.js,
  // Satz für Satz; Liste der Sätze in PLAN.md (Update 19)
  const KOMMA_U19 = [
    ["in Deutschland investieren, und Steuerausländer", "in Deutschland investieren und Steuerausländer"],
    ["bei 110 Prozent, und mehr als 120 Prozent", "bei 110 Prozent und mehr als 120 Prozent"],
    ["unter Zeitdruck, und genau das besprechen", "unter Zeitdruck und genau das besprechen"],
    ["sinnvoll ist das nicht, und das sagen wir", "sinnvoll ist das nicht und das sagen wir"],
    ["bewusst nicht an, und wir haben es", "bewusst nicht an und wir haben es"],
    ["kostenlose Wertermittlung, und bevor irgendetwas", "kostenlose Wertermittlung und bevor irgendetwas"],
    ["keine Finanzierung, und der Verkauf platzt", "keine Finanzierung und der Verkauf platzt"]
  ];
  // Update 22 §9 (31.10.2026): Notarkosten wie im Brief („etwa 600 bis 5.000 Euro“). A9 (Prüfen Sie die Finanzierung vor dem
  // Notartermin?) bekommt die zwei Sätze des Briefs; die Antwort „Was kostet ein Notarvertrag“ (Ankaufsberatung und Kapitalanlage,
  // dieselbe ID, also dieselbe Antwort) verliert „meist einige hundert Euro“. Update 21 liegt nicht vor; Wortlaut in PLAN.md.
  const NOTAR_U22 = [
    ["Ein Vertragsentwurf kostet je nach Kaufvolumen bereits einige hundert Euro, der spätere Kaufvertrag noch deutlich mehr. Wenn sich erst danach herausstellt, dass die Finanzierung nicht funktioniert, bleiben Sie auf diesen Kosten sitzen.",
      "Ein Vertragsentwurf beim Notar kostet je nach Kaufpreis und Notar etwa 600 bis 5.000 Euro. Scheitert die Finanzierung erst danach, sind diese Kosten schon entstanden."],
    ["im vierstelligen Bereich, der reine Vertragsentwurf davor kostet zum Glück deutlich weniger, meist einige hundert Euro, gelegentlich etwas mehr.",
      "im vierstelligen Bereich. Ein Vertragsentwurf beim Notar kostet je nach Kaufpreis und Notar etwa 600 bis 5.000 Euro."]
  ];
  // Update 49 §1.1.3 (09.11.2026): F&G vermittelt auch an Sondereigentumsverwaltungen (Timon). FAQ A4 und A10 aus mangoTexte.js.
  const SEV_U49 = [
    ["Die Vermittlung an Gutachter, Handwerker und Hausverwaltungen ist", "Die Vermittlung an Gutachter, Handwerker, Hausverwaltungen und Sondereigentumsverwaltungen ist"]
  ];
  const fakten6 = (text) => (typeof text === "string"
    ? [...FAKTEN6, ...KOMMA_U19, ...NOTAR_U22, ...SEV_U49].reduce((t, [alt, neu]) => t.split(alt).join(neu), text) : text);
  eleventyConfig.addFilter("fakten6", fakten6);
  // Update 6 §3.1 (27.10.2026): neue Antworten für A1, A2 und A3, Wortlaut von Jesus Team. A2 gilt auf jeder Seite,
  // auf der die Frage steht (Startseite, Kaufen). Gilt für sichtbaren Text und FAQPage-Markup.
  const FAQ_U6 = {
    A1: "Wir vermitteln Immobilien, beraten beim Ankauf und vermitteln Immobilienfinanzierungen. So sehen wir bei jedem Vorhaben gleichzeitig das Objekt, den Preis und die Finanzierung.",
    A2: "Ja. Wer selbst einzieht, braucht vor allem eine Rate, die auch in ein paar Jahren noch zum Leben passt. Bei einer Kapitalanlage kommen Miete, Rendite, laufende Kosten und die langfristige Finanzierung dazu. Auf unserer Angebotsseite sind beide Strategien deshalb getrennt gekennzeichnet.",
    // Update 19 §6: an den neuen Antwortblock der Finanzierungsseite angeglichen (Selbstauskunft, Plattformen, direkte Bankkontakte nur
    // für Sonderfälle); die letzten zwei Sätze bleiben
    A3: "Am Anfang steht Ihre Selbstauskunft mit Einkommen, Eigenkapital und Vorhaben. Daran sehen wir, was machbar ist, und vergleichen über die Plattformen Europace und Baufinex, welche Bank Ihr Vorhaben finanziert. Direkte Bankkontakte nutzen wir für Fälle, die dort nicht passen. Wir begleiten die erste Eigentumswohnung genauso wie das Mehrfamilienhaus. Ob eine Bank zusagt, entscheidet am Ende immer die Bank.",
    // Design-Pass 2 §3 (28.10.2026), Tabelle „Text replacements on the homepage“, wörtlich
    A6: "Bei Wohnungen, die wir als Kapitalanlage anbieten, können Sie auf der Angebotsseite selbst rechnen. Kaufpreis und Miete sind eingetragen, Zins, Tilgung, Eigenkapital und Kosten stellen Sie selbst ein und sehen sofort, wie sich Cashflow und Restschuld verändern. Für eine ausführlichere Rechnung gibt es unser Investment Lab."
  };
  // FAQ „In welchen Regionen…“ (A5, C6): Die Antwort im generierten mangoTexte.js nennt noch die
  // alte Ortsliste. Sichtbarer Text und FAQPage-Markup nehmen deshalb den Text aus serviceArea.js.
  eleventyConfig.addFilter("areaFaq", (items, text) => (items || []).map((item) =>
    ["A5", "C6"].includes(item.id) ? { ...item, a: text } : { ...item, a: FAQ_U6[item.id] || fakten6(item.a) }));
  // Leistungsseiten (_includes/fgd-service.njk): FAQ-Einträge sind entweder { q, a } oder
  // { ref: "C3" }; ein ref holt die freigegebene Antwort wörtlich aus mangoTexte.faq.
  // FG-Gap-Answers: Einträge mit timon: "<Nummer>" bzw. quelle: "<Nummer>" erscheinen (sichtbar und im
  // FAQPage-Markup) erst, wenn die Nummer in freigaben.timonFaq bzw. freigaben.quelleFaq steht.
  const faqFrei = (items) => (items || []).filter((item) =>
    (!item.timon || (freigaben.timonFaq || []).includes(String(item.timon))) &&
    (!item.quelle || (freigaben.quelleFaq || []).includes(String(item.quelle))));
  eleventyConfig.addFilter("faqFrei", faqFrei);
  eleventyConfig.addFilter("serviceFaq", (items, faqSets, areaText) => {
    const all = Object.values(faqSets || {}).flat();
    return faqFrei(items).map((item) => {
      if (!item.ref) return item;
      const found = all.find((entry) => entry.id === item.ref);
      if (!found) throw new Error(`serviceFaq: unbekannte FAQ-ID ${item.ref}`);
      const answer = ["A5", "C6"].includes(found.id) ? areaText : (FAQ_U6[found.id] || found.a);
      // zusatz: ein Satz, der hinten an die Antwort kommt (FG-Timon-Answers-Update §3.4)
      return { q: item.q || found.q, a: fakten6(answer) + (item.zusatz ? " " + item.zusatz : "") };
    });
  });
  // Design-System: ein Eintrag einer Liste nach Feldwert, z. B. gebiete | findBy("slug", "oranienburg").
  // (Nunjucks' selectattr kennt keinen Vergleich und gäbe alle Einträge zurück.) Unbekannter Wert bricht den Build ab.
  eleventyConfig.addFilter("findBy", (list, key, value) => {
    const found = (list || []).find((entry) => entry && entry[key] === value);
    if (!found) throw new Error(`[findBy] ${key}=${value}: nicht gefunden`);
    return found;
  });
  eleventyConfig.addFilter("lexEntry", (entries, slug) => (entries || []).find((entry) => entry.slug === slug));
  // Lexikon-Übersicht: Begriffe nach Anfangsbuchstaben (Ä/Ö/Ü unter A/O/U), innerhalb alphabetisch
  eleventyConfig.addFilter("lexGruppen", (entries) => {
    const g = {};
    [...(entries || [])].sort((a, b) => a.term.localeCompare(b.term, "de")).forEach((e) => {
      const b = e.term.normalize("NFD").charAt(0).toUpperCase();
      (g[b] = g[b] || []).push(e);
    });
    return g;
  });
  // Lexikon-Eintrag: Datum 2026-08-26 als 26.08.2026
  eleventyConfig.addFilter("lexDatum", (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : d; });
  // Lexikon-Eintrag: alphabetischer Vorgänger und Nachfolger
  eleventyConfig.addFilter("lexNachbarn", (entries, slug) => {
    const s = [...(entries || [])].sort((a, b) => a.term.localeCompare(b.term, "de"));
    const i = s.findIndex((e) => e.slug === slug);
    return { prev: i > 0 ? s[i - 1] : null, next: i >= 0 && i < s.length - 1 ? s[i + 1] : null };
  });
  eleventyConfig.addFilter("navGroupCurrent", (group, url) => (group.areas && String(url || "").startsWith("/standorte/"))
    || [...(group.items || []), ...(group.towns || [])].some((item) => (item.fallback || item.href) === url));

  // Blog-Karten auf der Startseite: kleines Vorschaubild, falls vorhanden, sonst das Titelbild
  // des Artikels; der Alt-Text kommt aus dem Titelbild des Artikels selbst.
  const fs = require("fs");
  eleventyConfig.addFilter("blogThumb", (slug) => fs.existsSync(`images/home/blog/${slug}.webp`)
    ? `/images/home/blog/${slug}.webp`
    : `/blog/${slug}/lead.jpg`);
  // Bildquellen der Leistungsseiten, der Startseite und von Kontakt (Update 4, 2.2): Schlüssel aus _data/seitenbilder.json →
  // Quelle in _data/fotoquellen.json → Lizenz in _data/lizenzen.json; der Filter bild unten liest daraus die Dateien.
  const seitenbilder = require("./_data/seitenbilder.json");
  // Update 9 (29.10.2026): Auf und unter den Fotos steht kein Nachweis mehr. Jede Seite des Design-Systems bekommt direkt über der
  // Fußzeile den geschlossenen Aufklapper „Bildnachweise dieser Seite“ (Platzhalter am Ende von <main> in base.njk). Die Liste
  // entsteht aus den Bildern im fertigen HTML und den Zeilen von /bildnachweise/ (_data/bildnachweise.js, Feld bilder), so können
  // Seite und Aufklapper nicht auseinanderlaufen: Titel mit Link auf die Dateiseite, Urheber, Lizenz mit Link, „zugeschnitten“.
  // CC0 fehlt, es verlangt keinen Nachweis. Die Kartenbilder (aus OpenStreetMap gezeichnet) bekommen die Zeile mit der ODbL.
  // Ein Foto aus images/seiten/, images/gebiete/ oder seitenbilder.json ohne Zeile in bildnachweise.js bricht den Build ab.
  // Update 40 §1.4 (06.11.2026): „Photo credits must not be visible on the pages … make sure it's on /bildnachweise/“. Der
  // Aufklapper wird nicht mehr ausgegeben; die Prüfung je Seite bleibt, so steht jedes Foto einer Seite auf /bildnachweise/.
  const AUFKLAPPER_ZEIGEN = false;
  const bildnachweise = require("./_data/bildnachweise.js")();
  const nachweisJeBild = new Map();
  for (const b of [...bildnachweise.seiten, ...bildnachweise.gebiete]) for (const p of b.bilder) nachweisJeBild.set(p, b);
  const fotoPfade = new Set(Object.keys(seitenbilder).filter((k) => !k.startsWith("_")).map((k) => k.includes("/") ? `/images/${k}` : `/images/seiten/${k}`));
  const OHNE_NACHWEIS = ["CC0"];
  const escAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const link = (href, text) => `<a href="${escAttr(href)}" target="_blank" rel="noopener">${escAttr(text)}</a>`;
  const KARTENZEILE = `Karte: Kartendaten © ${link("https://www.openstreetmap.org/copyright", "OpenStreetMap-Mitwirkende")}, ${link("https://opendatacommons.org/licenses/odbl/", "ODbL")}`;
  // Nachweis zu einem Bild (Schlüssel aus seitenbilder.json oder Pfad ohne Breite), z. B. für das ImageObject im JSON-LD
  eleventyConfig.addFilter("bildnachweis", (name) => nachweisJeBild.get(String(name).startsWith("/") ? name : name.includes("/") ? `/images/${name}` : `/images/seiten/${name}`) || null);
  eleventyConfig.addTransform("bildnachweise-seite", function (content) {
    const platzhalter = "<!-- bildnachweise-seite -->";
    if (!content.includes(platzhalter)) return content;
    const zeilen = new Map();
    let karte = false;
    // Erst die Fotos im Inhalt, dann die im Kopf (Menü: vier Regionsfotos auf jeder Seite) und in der Fußzeile. Eine Zeile je
    // Datei auf Commons, auch wenn die Datei in zwei Zuschnitten vorkommt (Kachel Sachsen und Titelbild Dresden).
    const start = content.indexOf('<main id="inhalt">');
    const ende = content.indexOf("</main>");
    const reihenfolge = start >= 0 && ende > start ? content.slice(start, ende) + content.slice(0, start) + content.slice(ende) : content;
    for (const [img] of reihenfolge.matchAll(/<img\b[^>]*>/g)) {
      const urls = [...img.matchAll(/\s(?:src|srcset)="([^"]+)"/g)].flatMap((m) => m[1].split(",").map((x) => x.trim().split(/\s+/)[0]));
      for (const url of urls) {
        // Update 22 §8.6: der Handy-Zuschnitt (-hoch) steht jetzt auch im <img> (Karten „Verwandte Leistungen“); Nachweis wie das Bild selbst
        const pfad = url.replace(/^https:\/\/fg-realestate\.de/, "").replace(/-\d+\.(webp|jpe?g|png|avif)$/, "").replace(/-hoch$/, "");
        if (/\/(buero-)?karte(-[^/]*)?$/.test(pfad)) { karte = true; continue; }
        const b = nachweisJeBild.get(pfad);
        if (!b && (pfad.startsWith("/images/seiten/") || pfad.startsWith("/images/gebiete/") || fotoPfade.has(pfad))) {
          throw new Error(`[bildnachweise-seite] ${this.page.inputPath}: ${pfad} fehlt in _data/bildnachweise.js`);
        }
        if (b && !OHNE_NACHWEIS.includes(b.license)) zeilen.set(b.url, `${link(b.url, b.title)}, ${escAttr(b.author)}, ${link(b.licenseUrl, b.license)}, zugeschnitten`);
      }
    }
    const liste = [...zeilen.values(), ...(karte ? [KARTENZEILE] : [])];
    const panel = AUFKLAPPER_ZEIGEN && liste.length
      ? `<div class="fgs-wrap"><details class="fgs-pagecredits" id="bildnachweise-dieser-seite"><summary>Bildnachweise dieser Seite</summary><ul>${liste.map((z) => `<li>${z}</li>`).join("")}</ul></details></div>`
      : "";
    return content.replace(platzhalter, panel);
  });
  // Design-System (Design-Sprint, 28.10.2026): Bildangaben für fgs-macros.njk → { src, srcset, w, h }.
  // Eingabe: Schlüssel aus seitenbilder.json („verkaufen-hero“, „home/hero-berlin-mitte“) oder ein Pfad ohne Breite
  // („/images/gebiete/oranienburg-schloss“). Die Breiten liest der Filter von der Platte, Breite und Höhe aus dem
  // Kopf der größten WebP-Datei. Fehlt die Datei, bricht der Build ab (keine Platzhalter, Brief 3.7).
  // Design-Pass 3 §4.1/§4.2 (tools/titelbilder.py): gibt es <name>-hoch-<breite>.webp, kommt der Handy-Zuschnitt 4:5 als
  // hoch { src, srcset, w, h } dazu, und farbe ist die Durchschnittsfarbe aus _data/bildfarben.json (Grund, solange das Foto lädt).
  const bildfarben = require("./_data/bildfarben.json");
  const bildCache = new Map();
  const webpGroesse = (file) => {
    const b = fs.readFileSync(file).subarray(0, 32);
    const typ = b.toString("ascii", 12, 16);
    if (typ === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (typ === "VP8L") return [1 + (((b[22] & 0x3f) << 8) | b[21]), 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6))];
    if (typ === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    throw new Error(`[bild] ${file}: unbekanntes WebP-Format ${typ}`);
  };
  // Design-Pass 3 §2.6 Punkt 6 („AVIF with a WebP fallback“): eine WebP-Reihe „/pfad-960.webp 960w, …“ als AVIF-Reihe, wenn
  // tools/avif.py für jede Breite eine AVIF-Datei geschrieben hat, die nicht älter ist als ihr WebP. Fehlt eine, bleibt es
  // beim WebP (""), sonst wählte der Browser aus einer lückenhaften Reihe eine falsche Breite.
  const avifSet = (srcset) => {
    const teile = String(srcset || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!teile.length || !teile.every((s) => /\.webp(\s|$)/.test(s))) return "";
    const neu = teile.map((s) => s.replace(/\.webp(\s|$)/, ".avif$1"));
    const aktuell = (s, i) => {
      const avif = `.${s.split(/\s+/)[0]}`;
      const webp = `.${teile[i].split(/\s+/)[0]}`;
      return fs.existsSync(avif) && fs.existsSync(webp) && fs.statSync(avif).mtimeMs >= fs.statSync(webp).mtimeMs;
    };
    return neu.every(aktuell) ? neu.join(", ") : "";
  };
  eleventyConfig.addFilter("avifSet", avifSet);
  const bildFilter = (name) => {
    if (bildCache.has(name)) return bildCache.get(name);
    let base = name;
    if (!String(name).startsWith("/")) {
      if (!seitenbilder[name]) throw new Error(`[bild] ${name}: nicht in seitenbilder.json`);
      base = name.includes("/") ? `/images/${name}` : `/images/seiten/${name}`;
    }
    const dir = `.${base.slice(0, base.lastIndexOf("/"))}`;
    const stem = base.slice(base.lastIndexOf("/") + 1);
    const ws = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
      .map((f) => f.startsWith(`${stem}-`) && /^\d+\.webp$/.test(f.slice(stem.length + 1)) ? Number(f.slice(stem.length + 1, -5)) : 0)
      .filter(Boolean).sort((a, b) => a - b);
    if (!ws.length) throw new Error(`[bild] ${name}: keine Dateien ${base}-<breite>.webp`);
    const max = ws[ws.length - 1];
    const [w, h] = webpGroesse(`${dir}/${stem}-${max}.webp`);
    const mid = ws.find((x) => x >= 960) || max;
    const out = { src: `${base}-${mid}.webp`, srcset: ws.map((x) => `${base}-${x}.webp ${x}w`).join(", "), w, h };
    const hs = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
      .map((f) => f.startsWith(`${stem}-hoch-`) && /^\d+\.webp$/.test(f.slice(stem.length + 6)) ? Number(f.slice(stem.length + 6, -5)) : 0)
      .filter(Boolean).sort((a, b) => a - b);
    if (hs.length) {
      const [hw, hh] = webpGroesse(`${dir}/${stem}-hoch-${hs[hs.length - 1]}.webp`);
      out.hoch = { src: `${base}-hoch-${hs[0]}.webp`, srcset: hs.map((x) => `${base}-hoch-${x}.webp ${x}w`).join(", "), w: hw, h: hh };
      out.hoch.avif = avifSet(out.hoch.srcset);
    }
    out.avif = avifSet(out.srcset);
    if (bildfarben[base]) out.farbe = bildfarben[base];
    bildCache.set(name, out);
    return out;
  };
  eleventyConfig.addFilter("bild", bildFilter);
  // Update 22 §8.6 (Bildregel 2.6.2): eigener Zuschnitt eines Bildes für eine Rahmenform, z. B. b | zuschnitt("2x3") →
  // Dateien <stamm>-2x3-<breite>.webp aus seitenbilder.json; gibt es ihn nicht, null (die Vorlage nimmt dann das Bild selbst).
  eleventyConfig.addFilter("zuschnitt", (b, art) => {
    const stamm = String((b && b.src) || "").replace(/-\d+\.webp$/, "");
    if (!stamm.startsWith("/images/")) return null;
    const dir = `.${stamm.slice(0, stamm.lastIndexOf("/"))}`;
    const name = `${stamm.slice(stamm.lastIndexOf("/") + 1)}-${art}-`;
    return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.startsWith(name) && /^\d+\.webp$/.test(f.slice(name.length))) ? bildFilter(`${stamm}-${art}`) : null;
  });
  eleventyConfig.addFilter("blogLeadAlt", (slug) => {
    try {
      const html = fs.readFileSync(`blog/${slug}/index.html`, "utf8");
      const match = html.match(/<img[^>]+src="lead\.jpg"[^>]*alt="([^"]*)"/) || html.match(/<img[^>]+alt="([^"]*)"[^>]*src="lead\.jpg"/);
      return match ? match[1] : "";
    } catch (error) {
      return "";
    }
  });
  eleventyConfig.addFilter("deDate", (iso) => {
    const [y, m, d] = String(iso || "").split("-");
    return y && m && d ? `${d}.${m}.${y}` : "";
  });

  const labContent = require("./_data/labContent.js")();
  const gebiete = require("./_data/gebiete.js")();
  // Blogartikel sind fertige Seiten aus Blogs/design-muster/_build/live.py. Update 42 §2: Welche davon an diesem Tag
  // erscheinen, rechnet _data/blog.js aus _data/blogplan.json (deutsche Zeit; zum Testen FG_JETZT).
  const blog = require("./_data/blog");
  const blogplan = require("./scripts/blogplan");
  const inhaltsstand = require("./scripts/inhaltsstand");

  // Thematic sitemap index. Exact exclusions prevent valid URLs such as
  // /lexikon/verwaltungskosten/ from disappearing by an overly broad match.
  const SITEMAP_EXCLUDE_EXACT = new Set(["/404.html"]);
  // /_bibliothek/: Musterseite des Design-Systems (Design-Sprint, CP1), noindex und nicht in der Sitemap.
  const SITEMAP_EXCLUDE_PREFIX = ["/admin/", "/_bibliothek/"];
  const SITEMAP_SECTIONS = [
    { key: "seiten", title: "Kern- und Serviceseiten" },
    { key: "angebote", title: "Objektangebote", prefix: "/angebote/" },
    { key: "projekte", title: "Immobilienprojekte", prefix: "/projekte/" },
    { key: "referenzen", title: "Referenzen", prefix: "/referenzen/" },
    { key: "lexikon", title: "Immobilienlexikon", prefix: "/lexikon/" },
    { key: "blog", title: "Blog", prefix: "/blog/" },
    { key: "standorte", title: "Standortanalysen", prefix: "/standorte/" }
  ];

  const sitemapLastmod = (item) => {
    const data = item.data || {};
    const stated = (data.entry && data.entry.updated)
      || (data.article && data.article.updated)
      || (data.location && data.location.updated)
      || (data.gebiet && data.gebiet.updated);
    if (stated && /^\d{4}-\d{2}-\d{2}$/.test(stated)) return stated;
    return (item.date instanceof Date ? item.date : new Date()).toISOString().slice(0, 10);
  };

  eleventyConfig.addCollection("sitemapSections", (api) => {
    const pages = api.getAll().filter((item) => {
      const url = item.url;
      if (!url) return false;
      if (!(url.endsWith("/") || url.endsWith(".html"))) return false;
      if (SITEMAP_EXCLUDE_EXACT.has(url)) return false;
      if (SITEMAP_EXCLUDE_PREFIX.some((prefix) => url.startsWith(prefix))) return false;
      return true;
    });

    // Propstack is global data on the generated pages. Reading it here lets
    // the sitemap enumerate every paginated object/project URL instead of
    // depending on Eleventy's collection view of only the first pagination item.
    const propstackData = pages.find((item) => item.data && item.data.propstack)?.data?.propstack || {};

    const dynamicBySection = {
      angebote: (propstackData.properties || []).map((property) => ({
        loc: property.url,
        lastmod: new Date().toISOString().slice(0, 10)
      })),
      projekte: (propstackData.projects || []).map((project) => ({
        loc: project.url,
        lastmod: new Date().toISOString().slice(0, 10)
      })),
      // Referenzen (Update 4, 3.2): ohne freigegebene verkaufte Objekte steht /referenzen/ auf noindex und fehlt hier.
      referenzen: freigaben.referenzen && (propstackData.references || []).length
        ? [{ loc: "/referenzen/", lastmod: new Date().toISOString().slice(0, 10) }].concat(propstackData.references.map((reference) => ({
          loc: reference.url,
          lastmod: new Date().toISOString().slice(0, 10)
        })))
        : null,
      lexikon: (labContent.lexicon || []).map((entry) => ({
        loc: `/lexikon/${entry.slug}/`,
        lastmod: entry.updated || new Date().toISOString().slice(0, 10)
      })),
      blog: [{
        loc: "/blog/",
        lastmod: blog.reduce((latest, post) => post.dateModified > latest ? post.dateModified : latest, "0000-00-00")
      }].concat(blog.map((post) => ({ loc: post.url, lastmod: post.dateModified }))),
      // Neue Gebietsseiten zuerst, damit ihr Datum vor dem der alten Standortseite mit gleicher URL gilt.
      standorte: gebiete.map((gebiet) => ({
        loc: gebiet.url,
        lastmod: gebiet.updated || new Date().toISOString().slice(0, 10)
      })).concat((labContent.legacyLocations || []).map((location) => ({
        loc: `/standorte/${location.slug}/`,
        lastmod: location.updated || new Date().toISOString().slice(0, 10)
      })))
    };

    // Update 42 §1.3 (07.11.2026): lastmod jeder Standort-URL ist der Tag, an dem sich ihr Inhalt zuletzt geändert hat,
    // aus Git (scripts/inhaltsstand.js): die eigene JSON-Datei mit Text und Zahlen und die Vorlage der Seite. Eine Änderung
    // der Vorlage zählt für alle Seiten, die sie baut. Gemeinsame Teile aller Seiten (Kopf, Fuß, Bewertungen,
    // Ansprechpartner) und reiner Programmcode (_data/*.js) zählen nicht. Ohne Git-Geschichte wie bisher das Feld `updated`.
    const gebietDatei = new Map(fs.readdirSync("content/gebiete").filter((f) => f.endsWith(".json"))
      .map((f) => [`/standorte/${JSON.parse(fs.readFileSync(`content/gebiete/${f}`, "utf8")).slug}/`, `content/gebiete/${f}`]));
    const standortQuellen = (loc) => {
      if (loc === "/standorte/") return ["standorte.njk", "content/uebersicht/standorte.json"];
      if (gebietDatei.has(loc)) return [gebietDatei.get(loc), "gebiet-detail.njk"];
      const location = (labContent.legacyLocations || []).find((l) => `/standorte/${l.slug}/` === loc);
      if (location) return [`content/standorte/${location.slug}.json`, "standort-detail.njk"];
      return null;
    };
    // Update 42 §2.4: Ein Artikel kommt am Tag, an dem er erscheint, in die Sitemap. Sein lastmod ist mindestens dieser Tag
    // (dateModified aus _data/blog.js), die Übersicht /blog/ mindestens der Tag des neuesten Artikels. Ohne das hätte ein
    // neuer Artikel das ältere Datum der Vorlage blog-artikel.njk.
    const blogNeuester = blog.reduce((latest, post) => post.dateModified > latest ? post.dateModified : latest, "0000-00-00");
    const blogStand = (entry) => {
      const post = blog.find((p) => p.url === entry.loc);
      const tag = entry.loc === "/blog/" ? blogNeuester : post && post.dateModified;
      return tag && tag > entry.lastmod ? { ...entry, lastmod: tag } : entry;
    };
    const standortStand = (entry) => {
      const quellen = standortQuellen(entry.loc);
      const tag = quellen && inhaltsstand.stand(quellen, { cwd: __dirname });
      return tag ? { ...entry, lastmod: tag } : entry;
    };

    const seen = new Set();
    return SITEMAP_SECTIONS.map((section) => {
      let sourceUrls;

      if (section.key === "referenzen" && !dynamicBySection.referenzen) {
        sourceUrls = [];
      } else if (dynamicBySection[section.key]) {
        // Eleventy can expose only part of a paginated template during collection creation.
        // Keep every rendered page we can see (including optional CMS pages), then
        // expand every data-driven detail URL explicitly and deduplicate below.
        const renderedSectionPages = pages
          .filter((item) => item.url === section.prefix || item.url.startsWith(section.prefix))
          .map((item) => ({ loc: item.url, lastmod: sitemapLastmod(item) }));
        sourceUrls = renderedSectionPages.concat(dynamicBySection[section.key]);
      } else {
        sourceUrls = pages
          .filter((item) => section.prefix
            ? item.url.startsWith(section.prefix)
            : !SITEMAP_SECTIONS.some((candidate) => candidate.prefix && item.url.startsWith(candidate.prefix)))
          .map((item) => ({ loc: item.url, lastmod: sitemapLastmod(item) }));
      }

      const urls = sourceUrls
        .filter((entry) => (seen.has(entry.loc) ? false : seen.add(entry.loc)))
        .map((entry) => (section.key === "standorte" ? standortStand(entry) : section.key === "blog" ? blogStand(entry) : entry))
        .sort((a, b) => a.loc.localeCompare(b.loc));

      return {
        key: section.key,
        title: section.title,
        count: urls.length,
        lastmod: urls.reduce((latest, entry) => entry.lastmod > latest ? entry.lastmod : latest, "0000-00-00"),
        urls
      };
    }).filter((section) => section.count > 0);
  });

  // Current site assets and integrations. Propstack/Netlify functions are not
  // touched here; this only controls build-time passthrough files.
  [
    "style.css", "fg-polish.css", "script.js", "fg-assistant.js", "fg-knowledge.js", "fg-assistant.css",
    "investment-lab.js", "investitionsrechner.js", "consent-manager.js", "consent-manager.css", "analytics.js",
    "vendor", "images", "favicon.ico", "admin", "robots.txt", // _redirects: eigener Schritt unten (Update 42); llms.txt: Vorlage llms.txt.njk (Update 40 §1.8)
    "css", "fonts", "fg-design.js", "fg-system.js", "fgs-motion.js"
  ].forEach((asset) => eleventyConfig.addPassthroughCopy(asset));

  eleventyConfig.addPassthroughCopy({ "BingSiteAuth.xml": "BingSiteAuth.xml" });
  // Update 35 B5: IndexNow-Schlüsseldatei (Besitznachweis, öffentlich). Schlüssel in netlify/functions/_shared/indexnow.js.
  const indexnow = require("./netlify/functions/_shared/indexnow");
  eleventyConfig.addPassthroughCopy(`${indexnow.SCHLUESSEL}.txt`);
  // Blog: nur die Bilder; Artikel und Übersicht baut Eleventy neu (blog-artikel.njk, blog-index.njk),
  // die HTML-Dateien aus live.py sind nur noch die Quelle (_data/blogArtikel.js).
  // Update 42 §2: nur die Bilder der Artikel, die an diesem Tag erscheinen, dazu og.jpg der Übersicht.
  eleventyConfig.addPassthroughCopy("blog/*.jpg");
  blog.forEach((post) => eleventyConfig.addPassthroughCopy(`blog/${post.slug}/*.jpg`));

  // Update 42 §2.3: _redirects geht nicht mehr unverändert in den Build. Die Zeilen „/wissen/… /blog/<artikel>/ 301“
  // gelten, sobald der Artikel erscheint; vorher stehen sie mit Raute da und die Adresse geht über „/wissen/* /blog/ 302“.
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const path = require("path");
    const quelle = fs.readFileSync(path.join(__dirname, "_redirects"), "utf8");
    const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "_data", "blogplan.json"), "utf8"));
    fs.writeFileSync(path.join(dir.output, "_redirects"), blogplan.weiterleitungen(quelle, plan, blog.map((post) => post.slug)));
  });

  // Design-Pass 2 §9 Schritt 6 (LCP mobil < 2,5 s): fg-system.css ohne Kommentare und überflüssigen Leerraum
  // ausliefern, rund 10 KB weniger auf jeder Seite. Nur die Ausgabe in _site; die Quelle bleibt kommentiert.
  // Zeichenketten bleiben unberührt; ein Leerzeichen bleibt überall, wo es zwischen zwei Zeichen stand,
  // außer neben { } ; , > (dort hat es in CSS keine Bedeutung).
  const cssKlein = (css) => {
    const OHNE = "{};,>";
    let out = "", i = 0;
    while (i < css.length) {
      const c = css[i];
      if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < css.length && css[j] !== c) j += css[j] === "\\" ? 2 : 1;
        out += css.slice(i, j + 1); i = j + 1; continue;
      }
      if (c === "/" && css[i + 1] === "*") {
        const j = css.indexOf("*/", i + 2);
        i = j < 0 ? css.length : j + 2;
        continue;
      }
      if (/\s/.test(c)) {
        let j = i; while (j < css.length && /\s/.test(css[j])) j++;
        const p = out[out.length - 1], n = css[j];
        if (out && p !== " " && j < css.length && !OHNE.includes(p) && !OHNE.includes(n)) out += " ";
        i = j; continue;
      }
      if (OHNE.includes(c) && out[out.length - 1] === " ") out = out.slice(0, -1);
      out += c; i++;
    }
    return out.trim() + "\n";
  };
  eleventyConfig.on("eleventy.after", ({ dir }) => {
    const datei = require("path").join(dir.output, "css", "fg-system.css");
    if (fs.existsSync(datei)) fs.writeFileSync(datei, cssKlein(fs.readFileSync(datei, "utf8")));
  });

  // Update 35 B5: /indexnow.json mit einem Hash je Seite aus den Sitemaps. Im Netlify-Produktionsbuild vergleicht der
  // Build mit der Liste, die gerade live ist, und schreibt geänderte, neue und entfernte Adressen nach „geaendert“.
  // netlify/functions/deploy-succeeded.js meldet genau diese nach dem Deploy an IndexNow. Lokal und für die
  // Testumgebung bleibt „geaendert“ leer (kein Abruf der Live-Seite).
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const path = require("path");
    const crypto = require("crypto");
    const seiten = {};
    for (const f of fs.readdirSync(dir.output).filter((n) => /^sitemap-[a-z-]+\.xml$/.test(n)).sort()) {
      for (const [, loc] of fs.readFileSync(path.join(dir.output, f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
        if (!loc.startsWith(indexnow.BASIS + "/")) continue;
        let rel = decodeURI(loc.slice(indexnow.BASIS.length));
        if (rel.endsWith("/")) rel += "index.html";
        const datei = path.join(dir.output, rel);
        if (!fs.existsSync(datei)) continue;
        seiten[loc] = crypto.createHash("sha256").update(fs.readFileSync(datei)).digest("hex").slice(0, 16);
      }
    }
    let geaendert = [];
    if (process.env.NETLIFY === "true" && process.env.CONTEXT === "production") {
      try {
        const r = await fetch(`${indexnow.BASIS}/indexnow.json?v=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
        const alt = r.status === 404 ? {} : (await r.json()).seiten || {};
        // Geändert oder neu, dazu entfernte Seiten (IndexNow will auch gelöschte Adressen; die Maschine sieht dann 404).
        if (r.status === 404 || r.ok) geaendert = Object.keys(seiten).filter((u) => alt[u] !== seiten[u])
          .concat(Object.keys(alt).filter((u) => !(u in seiten)));
      } catch (error) {
        console.warn("IndexNow: Liste der Live-Seite nicht lesbar, diesmal kein Ping.", error.message);
      }
    }
    fs.writeFileSync(path.join(dir.output, "indexnow.json"),
      JSON.stringify({ erstellt: new Date().toISOString(), seiten, geaendert }) + "\n");
    console.log(`IndexNow: ${Object.keys(seiten).length} Seiten, ${geaendert.length} geändert`);
  });

  return {
    dir: { input: ".", output: "_site", includes: "_includes", layouts: "_includes" },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid"
  };
};
