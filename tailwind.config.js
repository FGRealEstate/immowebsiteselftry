// Ersetzt den Tailwind-Play-CDN (cdn.tailwindcss.com) aus base.njk.
// Gleiche Theme-Erweiterung wie vorher inline; die Klassen werden beim Build
// aus allen Vorlagen, Daten und Skripten gesammelt (npm run css).
module.exports = {
  content: [
    "./*.{njk,html,liquid,md,js}",
    "./_includes/**/*.{njk,liquid,html}",
    "./_data/**/*.{js,json}",
    "./content/**/*.{json,md}",
    "./immobilien/**/*.{njk,json}",
    "./blog/**/*.html",
    "./netlify/functions/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#08082F",
        secondary: "#91DCFF",
        accent: "#D1B464",
        "page-bg": "#CDD2D4"
      },
      fontFamily: {
        sans: ['"Times New Roman"', "Times", "serif"]
      }
    }
  }
};
