module.exports = function(eleventyConfig) {
  // Existing helper used by the current website.
  eleventyConfig.addFilter("pad2", (value) => String(value).padStart(2, "0"));

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

  const labContent = require("./_data/labContent.js")();

  // Thematic sitemap index. Exact exclusions prevent valid URLs such as
  // /lexikon/verwaltungskosten/ from disappearing by an overly broad match.
  const SITEMAP_EXCLUDE_EXACT = new Set(["/404.html"]);
  const SITEMAP_EXCLUDE_PREFIX = ["/admin/"];
  const SITEMAP_SECTIONS = [
    { key: "seiten", title: "Kern- und Serviceseiten" },
    { key: "angebote", title: "Objektangebote", prefix: "/angebote/" },
    { key: "projekte", title: "Immobilienprojekte", prefix: "/projekte/" },
    { key: "lexikon", title: "Immobilienlexikon", prefix: "/lexikon/" },
    { key: "wissen", title: "Wissensartikel", prefix: "/wissen/" },
    { key: "standorte", title: "Standortanalysen", prefix: "/standorte/" }
  ];

  const sitemapLastmod = (item) => {
    const data = item.data || {};
    const stated = (data.entry && data.entry.updated)
      || (data.article && data.article.updated)
      || (data.location && data.location.updated);
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
      lexikon: (labContent.lexicon || []).map((entry) => ({
        loc: `/lexikon/${entry.slug}/`,
        lastmod: entry.updated || new Date().toISOString().slice(0, 10)
      })),
      wissen: (labContent.articles || []).map((article) => ({
        loc: `/wissen/${article.slug}/`,
        lastmod: article.updated || new Date().toISOString().slice(0, 10)
      })),
      standorte: (labContent.locations || []).map((location) => ({
        loc: `/standorte/${location.slug}/`,
        lastmod: location.updated || new Date().toISOString().slice(0, 10)
      }))
    };

    const seen = new Set();
    return SITEMAP_SECTIONS.map((section) => {
      let sourceUrls;

      if (dynamicBySection[section.key]) {
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
    "investment-lab.js", "consent-manager.js", "consent-manager.css", "analytics.js",
    "vendor", "images", "favicon.ico", "videos", "admin", "robots.txt", "_redirects"
  ].forEach((asset) => eleventyConfig.addPassthroughCopy(asset));

  eleventyConfig.addPassthroughCopy({ "BingSiteAuth.xml": "BingSiteAuth.xml" });

  return {
    dir: { input: ".", output: "_site", includes: "_includes", layouts: "_includes" },
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid"
  };
};
