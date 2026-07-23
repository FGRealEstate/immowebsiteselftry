module.exports = function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("script.js");
  eleventyConfig.addPassthroughCopy("investment-lab.js");
  eleventyConfig.addPassthroughCopy("consent-manager.js");
  eleventyConfig.addPassthroughCopy("analytics.js");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("videos");
  eleventyConfig.addPassthroughCopy("admin");
  eleventyConfig.addPassthroughCopy("vendor");
  eleventyConfig.addPassthroughCopy("_redirects");
  eleventyConfig.addFilter("json", value => JSON.stringify(value).replace(/</g,"\u003c"));
  eleventyConfig.addFilter("dateDe", value => { try { return new Intl.DateTimeFormat('de-DE').format(new Date(value)); } catch { return value; } });
  return {dir:{input:".",output:"_site",includes:"_includes",layouts:"_includes"},markdownTemplateEngine:"liquid",htmlTemplateEngine:"liquid"};
};
