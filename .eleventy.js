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
  // Freigabe des Bildhosts: [images] remote_images in netlify.toml. og:image und JSON-LD bleiben bei der Originaladresse.
  // Rückweg ohne Codeänderung: Umgebungsvariable FG_BILD_CDN=aus in Netlify setzen und neu bauen.
  const PROPSTACK_FOTO = /^https:\/\/images\.propstack\.de\//;
  const imageCdn = (url) => process.env.NETLIFY === "true" && process.env.FG_BILD_CDN !== "aus" && PROPSTACK_FOTO.test(String(url || ""));
  const cdnFoto = (url, w) => `/.netlify/images?url=${encodeURIComponent(url)}&w=${w}&q=75`;
  eleventyConfig.addFilter("propstackFoto", (url, w = 1200) => (imageCdn(url) ? cdnFoto(url, w) : url));
  eleventyConfig.addFilter("propstackSrcset", (url, breiten = [480, 800, 1200, 1600]) => (imageCdn(url) ? breiten.map((w) => `${cdnFoto(url, w)} ${w}w`).join(", ") : ""));
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
  const fakten6 = (text) => (typeof text === "string"
    ? [...FAKTEN6, ...KOMMA_U19, ...NOTAR_U22].reduce((t, [alt, neu]) => t.split(alt).join(neu), text) : text);
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
    const panel = liste.length
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
  // Blogartikel sind fertige Seiten aus Blogs/design-muster/_build/live.py; die Liste dazu steht in _data/blog.json.
  const blog = require("./_data/blog.json");

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
    "vendor", "images", "favicon.ico", "admin", "robots.txt", "_redirects",
    "css", "fonts", "fg-design.js", "fg-system.js", "fgs-motion.js"
  ].forEach((asset) => eleventyConfig.addPassthroughCopy(asset));

  eleventyConfig.addPassthroughCopy({ "BingSiteAuth.xml": "BingSiteAuth.xml" });
  // Blog: nur die Bilder; Artikel und Übersicht baut Eleventy neu (blog-artikel.njk, blog-index.njk),
  // die HTML-Dateien aus live.py sind nur noch die Quelle (_data/blogArtikel.js).
  eleventyConfig.addPassthroughCopy("blog/**/*.jpg");

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

  return {
    dir: { input: ".", output: "_site", includes: "_includes", layouts: "_includes" },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid"
  };
};
