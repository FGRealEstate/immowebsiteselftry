module.exports = function(eleventyConfig) {
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

    // 1. Passthrough Kopieren:
    // Stellt sicher, dass Assets und Verifizierungsdateien in den _site-Ordner kopiert werden.
    eleventyConfig.addPassthroughCopy("style.css");
    eleventyConfig.addPassthroughCopy("script.js");
    eleventyConfig.addPassthroughCopy("fg-assistant.js");
  eleventyConfig.addPassthroughCopy("fg-knowledge.js");
    eleventyConfig.addPassthroughCopy("fg-assistant.css");
    eleventyConfig.addPassthroughCopy("investment-lab.js");
    eleventyConfig.addPassthroughCopy("consent-manager.js");
    eleventyConfig.addPassthroughCopy("consent-manager.css");
    eleventyConfig.addPassthroughCopy("analytics.js");
    eleventyConfig.addPassthroughCopy("vendor");
    eleventyConfig.addPassthroughCopy("images");
    eleventyConfig.addPassthroughCopy("favicon.ico");

    // Bing-Webmaster-Verifizierung:
    // Kopiert BingSiteAuth.xml direkt in das Root-Verzeichnis der veröffentlichten Website.
    eleventyConfig.addPassthroughCopy({
        "BingSiteAuth.xml": "BingSiteAuth.xml"
    });

    eleventyConfig.addPassthroughCopy("videos");
    eleventyConfig.addPassthroughCopy("admin");

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
