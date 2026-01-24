module.exports = function(eleventyConfig) {

    // 1. Passthrough Kopieren: Stellt sicher, dass Assets in den _site Ordner kopiert werden
    eleventyConfig.addPassthroughCopy("style.css");
    eleventyConfig.addPassthroughCopy("script.js");
    eleventyConfig.addPassthroughCopy("images");
    eleventyConfig.addPassthroughCopy("videos");
    eleventyConfig.addPassthroughCopy("admin");

    // 2. Wichtig: Erzwingt die korrekte Verarbeitung von Markdown und HTML/Liquid
    // Wir nutzen hier die einfachen globalen Konfigurationsoptionen, um den Engine-Konflikt zu vermeiden.
    // 'liquid' kann nun Variablen im Markdown und HTML verarbeiten.

    // 3. Konfiguration der Ordnerstruktur (Standard Eleventy-Setup)
    return {
        dir: {
            input: ".",
            output: "_site",
            includes: "_includes",
            layouts: "_includes"
        },
        // FIX: Erzwingt, dass Markdown- und HTML-Dateien die Liquid-Engine verwenden.
        // Dies ist die robusteste Methode für die Liquid-Schleife in angebote.liquid.
        markdownTemplateEngine: "liquid",
        htmlTemplateEngine: "liquid"
    };
};