/*
 * Update 49 §2 (09.11.2026): Netlify-Build-Cache für die aufbereiteten Propstack-Fotos (scripts/propstack-bilder.js).
 * Vor dem Build zurückholen, nach dem Build sichern; Schlüssel je Foto ist die Propstack-Adresse (manifest.json im Ordner).
 * So bearbeitet der tägliche Build um 06:00 nur neue Fotos. Ein Fehler bricht den Build nie ab.
 */
const { CACHE } = require("../../../scripts/propstack-bilder.js");

module.exports = {
  async onPreBuild({ utils }) {
    try {
      const da = await utils.cache.restore(CACHE);
      console.log(da ? "Propstack-Fotos: Cache zurückgeholt." : "Propstack-Fotos: noch kein Cache, alle Fotos werden aufbereitet.");
    } catch (error) {
      console.log("Propstack-Fotos: Cache nicht lesbar:", error.message);
    }
  },
  async onPostBuild({ utils }) {
    try {
      const ok = await utils.cache.save(CACHE);
      console.log(ok ? "Propstack-Fotos: Cache gesichert." : "Propstack-Fotos: nichts zu sichern.");
    } catch (error) {
      console.log("Propstack-Fotos: Cache nicht gesichert:", error.message);
    }
  }
};
