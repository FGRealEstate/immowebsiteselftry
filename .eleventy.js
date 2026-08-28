module.exports = function(eleventyConfig) {

    // Wird in den wissenschaftlich aufbereiteten Wissensartikeln verwendet.
    eleventyConfig.addFilter("pad2", (value) => String(value).padStart(2, "0"));

    // Eigener JSON-Filter für Nunjucks-Templates, z. B. {{ value | json | safe }}
    eleventyConfig.addFilter("json", (value) => {
        try {
            return JSON.stringify(value ?? null);
        } catch (error) {
            console.warn("JSON filter failed:", error);
            return "null";
        }
    });

    // Verwandte Lexikonbegriffe: findet Begriffe, die im Artikeltext tatsaechlich vorkommen.
    eleventyConfig.addFilter("relatedTerms", (body, lexicon, limit) => {
        const text = Array.isArray(body) ? body.join(" ") : String(body || "");
        const stems = new Set(
            (text.toLowerCase().match(/[a-zäöüß]{4,}/g) || []).map(w => w.slice(0, 6))
        );
        return (lexicon || [])
            .filter(e => stems.has(e.term.toLowerCase().slice(0, 6)))
            .slice(0, limit || 5);
    });

    // ------------------------------------------------------------------
    // Sitemap: eine Index-Datei plus fuenf thematische Teil-Sitemaps.
    //
    // Warum als Collection und nicht im Template: die Zuordnung Seite ->
    // Abschnitt, der Ausschluss und das lastmod sind Logik, und Logik in einer
    // XML-Vorlage ist die Stelle, an der eine Seite lautlos verschwindet. Genau
    // das ist vorher passiert: die alte Vorlage schloss alles aus, dessen URL
    // die Zeichenkette "verwaltung" enthielt, und hat damit den voellig
    // legitimen Lexikoneintrag /lexikon/verwaltungskosten/ mitentfernt (F-323).
    // Ausgeschlossen wird deshalb nur noch nach exakter URL oder Praefix.
    // ------------------------------------------------------------------
    const SITEMAP_EXCLUDE_EXACT = new Set(["/404.html"]);
    const SITEMAP_EXCLUDE_PREFIX = ["/admin/"];
    const SITEMAP_SECTIONS = [
        { key: "seiten",    title: "Kern- und Serviceseiten" },
        { key: "angebote",  title: "Objektangebote",   prefix: "/angebote/" },
        { key: "lexikon",   title: "Immobilienlexikon", prefix: "/lexikon/" },
        { key: "wissen",    title: "Wissensartikel",    prefix: "/wissen/" },
        { key: "standorte", title: "Standortanalysen",  prefix: "/standorte/" }
    ];

    // lastmod aus den Inhaltsdaten, nicht aus der Dateizeit: die JSON-Eintraege
    // tragen ein eigenes `updated`, und das ist die Angabe, die stimmt. Nur wo
    // es keine gibt, faellt es auf das Datum der Quelldatei zurueck.
    const sitemapLastmod = (item) => {
        const d = item.data || {};
        const stated = (d.entry && d.entry.updated)
            || (d.article && d.article.updated)
            || (d.location && d.location.updated);
        if (stated && /^\d{4}-\d{2}-\d{2}$/.test(stated)) return stated;
        return (item.date instanceof Date ? item.date : new Date())
            .toISOString().slice(0, 10);
    };

    eleventyConfig.addCollection("sitemapSections", (api) => {
        const pages = api.getAll().filter((item) => {
            const u = item.url;
            if (!u) return false;
            // Nur echte HTML-Seiten. XML, TXT und Assets gehoeren nicht hinein.
            if (!(u.endsWith("/") || u.endsWith(".html"))) return false;
            if (SITEMAP_EXCLUDE_EXACT.has(u)) return false;
            if (SITEMAP_EXCLUDE_PREFIX.some((p) => u.startsWith(p))) return false;
            return true;
        });

        const seen = new Set();
        return SITEMAP_SECTIONS.map((section) => {
            const urls = pages
                .filter((item) => section.prefix
                    ? item.url.startsWith(section.prefix)
                    : !SITEMAP_SECTIONS.some((s) => s.prefix && item.url.startsWith(s.prefix)))
                .map((item) => ({ loc: item.url, lastmod: sitemapLastmod(item) }))
                .filter((u) => (seen.has(u.loc) ? false : seen.add(u.loc)))
                .sort((a, b) => a.loc.localeCompare(b.loc));
            return {
                key: section.key,
                title: section.title,
                count: urls.length,
                lastmod: urls.reduce((m, u) => (u.lastmod > m ? u.lastmod : m), "0000-00-00"),
                urls
            };
        }).filter((section) => section.count > 0);
    });

    // 1. Passthrough Kopieren:
    // Stellt sicher, dass Assets und Verifizierungsdateien in den _site-Ordner kopiert werden.
    eleventyConfig.addPassthroughCopy("style.css");
    eleventyConfig.addPassthroughCopy("fg-design.css");
    eleventyConfig.addPassthroughCopy("script.js");
    eleventyConfig.addPassthroughCopy("fg-assistant.css");
    eleventyConfig.addPassthroughCopy("fg-assistant.js");
    eleventyConfig.addPassthroughCopy("fg-knowledge.js");
    eleventyConfig.addPassthroughCopy("investment-lab.js");
    eleventyConfig.addPassthroughCopy("consent-manager.js");
    eleventyConfig.addPassthroughCopy("consent-manager.css");
    eleventyConfig.addPassthroughCopy("analytics.js");
    eleventyConfig.addPassthroughCopy("vendor");
    eleventyConfig.addPassthroughCopy("images");
    eleventyConfig.addPassthroughCopy("favicon.ico");
    eleventyConfig.addPassthroughCopy("robots.txt");
    // Ohne diese Zeile landet `_redirects` nicht im Publish-Verzeichnis und
    // saemtliche Weiterleitungen sind auf dem Deploy wirkungslos.
    eleventyConfig.addPassthroughCopy("_redirects");

    // Bing-Webmaster-Verifizierung:
    // Kopiert BingSiteAuth.xml direkt in das Root-Verzeichnis der veröffentlichten Website.
    eleventyConfig.addPassthroughCopy({
        "BingSiteAuth.xml": "BingSiteAuth.xml"
    });

    eleventyConfig.addPassthroughCopy("videos");

    // 2. Konfiguration der Ordnerstruktur
    return {
        dir: {
            input: ".",
            output: "_site",
            includes: "_includes",
            layouts: "_includes"
        },

        // Liquid als Template-Engine für Markdown und HTML
        markdownTemplateEngine: "liquid",
        htmlTemplateEngine: "liquid"
    };
};
