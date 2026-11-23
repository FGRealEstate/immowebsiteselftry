/* Peers Review T6/T16 (24.11.2026): Die Fotos der Blogartikel (lead.jpg, bild1.jpg …) lagen als JPEG bis 1,1 MB vor und wurden
   so ausgeliefert, auch als kleine Karte im Menü und auf der Startseite. Dieses Skript legt daneben WebP in 480, 960 und 1536 px
   Breite an (<name>-480.webp …), nie breiter als das Original; vorhandene, neuere Dateien bleiben. Der Build schreibt die <img>
   darauf um (.eleventy.js, Filter blogBild und Transform „blog-bilder“). Ohne sharp bleibt alles wie bisher. */
const fs = require("fs");
const path = require("path");

const BREITEN = [480, 960, 1536];
const wurzel = path.join(__dirname, "..", "blog");

async function main() {
  let sharp;
  try { sharp = require("sharp"); } catch (error) { console.log("Blog-Bilder: sharp fehlt, JPEG bleiben:", error.message); return; }
  let neu = 0;
  for (const slug of fs.readdirSync(wurzel)) {
    const dir = path.join(wurzel, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const datei of fs.readdirSync(dir)) {
      const m = /^(lead|bild\d+)\.jpe?g$/i.exec(datei);
      if (!m) continue;
      const quelle = path.join(dir, datei);
      const zeit = fs.statSync(quelle).mtimeMs;
      const { width } = await sharp(quelle).metadata();
      for (const b of BREITEN) {
        const w = Math.min(b, width);
        const ziel = path.join(dir, `${m[1]}-${b}.webp`);
        if (fs.existsSync(ziel) && fs.statSync(ziel).mtimeMs >= zeit) continue;
        await sharp(quelle).resize({ width: w, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toFile(ziel);
        neu += 1;
      }
    }
  }
  console.log(`Blog-Bilder: ${neu} WebP-Dateien neu`);
}

main().catch((error) => { console.log("Blog-Bilder: Fehler, JPEG bleiben:", error.message); });
