/*
 * Update 44 §2.6 (07.11.2026): lokales Build-Plugin für scripts/marktberichte.js.
 * Als Plugin, weil Netlify Blobs in Build-Plugins ohne Schlüssel verfügbar sind (im reinen Build-Befehl nicht sicher).
 * Läuft nach dem Build, nur im Produktions-Build, höchstens 60 s; ein Fehler bricht den Build nie ab.
 */
module.exports = {
  async onPostBuild() {
    if (process.env.CONTEXT !== "production") return;
    try {
      const { imBuild } = require("../../../scripts/marktberichte.js");
      await Promise.race([imBuild(), new Promise((fertig) => setTimeout(() => fertig(console.log("Marktberichte: nach 60 s abgebrochen.")), 60000).unref())]);
    } catch (error) {
      console.log("Marktberichte: Fehler:", error.message);
    }
  }
};
