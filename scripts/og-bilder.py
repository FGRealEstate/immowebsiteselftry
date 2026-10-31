#!/usr/bin/env python3
"""Vorschaubilder fürs Teilen (og:image, twitter:image), Update 23 B6.

Liest je Seite der Sitemap das Hero-Foto (bei 1440 px, Startseite: erstes Bild der Slideshow) samt object-position.
Seiten ohne Hero-Foto nehmen das Foto ihres Abschlussbands. Daraus wird ein JPG mit 1200 × 630 px, gleicher Bildpunkt
im Fokus wie im Hero, unter 300 KB, in images/og/. Die Zuordnung Seite → Bild steht in _data/ogBilder.json; base.njk
liest sie. Seiten mit eigenem ogImage (Blogartikel, Blog-Übersicht, Angebote, Projekte) bleiben, wie sie sind.

Neu laufen lassen, wenn sich ein Hero-Foto ändert oder Seiten dazukommen (neue Seiten ohne Eintrag bekommen „standard“):
  npx @11ty/eleventy && python3 -m http.server 8090 -d _site   (zweites Terminal)
  python3 scripts/og-bilder.py http://127.0.0.1:8090
Braucht Playwright (Python) mit Chromium und Pillow mit AVIF.
"""
import asyncio, io, json, os, re, sys
from PIL import Image
from playwright.async_api import async_playwright

BASIS = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090"
SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIEL = "images/og"
LOGO = {"/impressum.html", "/datenschutz.html", "/agb.html"}            # Rechtstexte: Logo (Brief B6)
EIGENES = ("/blog/", "/angebote/", "/projekte/", "/referenzen/")     # Vorlagen setzen ogImage selbst
EXE = os.environ.get("CHROME")  # optional: Pfad zu einem Chromium
# Das Foto im Abschlussband ist dort Schmuck (alt=""); fürs Teilen braucht es eine Beschreibung (Motive laut image-sources.md)
ALT_ABSCHLUSS = {"abschluss-tiergarten": "Berliner Skyline über der Straße des 17. Juni",
                 "abschluss": "Das Humboldt Forum mit Fernsehturm in Berlin-Mitte, davor gespiegelt im Wasser"}

JS = r"""() => {
  const pick = (img, art) => {
    if (!img) return null;
    const pic = img.closest('picture');
    const quellen = pic ? [...pic.querySelectorAll('source')].filter((s) => !s.media || matchMedia(s.media).matches) : [];
    let cur = img.currentSrc;
    if (!cur) cur = quellen.length ? quellen[0].srcset.split(',')[0].trim().split(/\s+/)[0] : img.getAttribute('src');
    const cands = [];
    const add = (ss) => (ss || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => { const [u, w] = s.split(/\s+/); cands.push({ u, w: parseInt(w) || 0 }); });
    quellen.forEach((s) => add(s.srcset)); add(img.getAttribute('srcset'));
    if (img.getAttribute('src')) cands.push({ u: img.getAttribute('src'), w: 0 });
    return { art, cur, cands, pos: getComputedStyle(img).objectPosition, alt: img.alt };
  };
  const vis = (el) => el && el.getBoundingClientRect().width > 50;
  const main = document.querySelector('main') || document.body;
  const slide = main.querySelector('.fgs-slides img');
  if (slide) return pick(slide, 'slide1');
  const hero = [...main.querySelectorAll('.fgs-hero-media img, .fgs-hero img, [class*="-hero"] picture img, .fgd-hero img')].find(vis);
  if (hero && !hero.closest('.fgs-hero-sentence, .fgs-hero-text')) return pick(hero, 'hero');
  const clos = [...document.querySelectorAll('.fgs-closing img')].find(vis);
  return clos ? pick(clos, 'abschluss') : null;
}"""

def familie(u):
    return re.sub(r"-\d+\.(avif|webp|jpe?g|png)$", "", u.split("?")[0].split("/")[-1])

def quelle(fund):
    fam = familie(fund["cur"])
    rang = {"webp": 0, "jpg": 1, "jpeg": 1, "png": 2, "avif": 3}
    cands = [c for c in fund["cands"] if familie(c["u"]) == fam and os.path.exists(SITE + c["u"].split("?")[0])]
    cands.sort(key=lambda c: (-c["w"], rang.get(c["u"].rsplit(".", 1)[-1].lower(), 9)))
    return (cands[0]["u"].split("?")[0] if cands else None), fam

def prozent(pos):
    teile = (pos or "50% 50%").split()
    werte = [float(t[:-1]) / 100 if t.endswith("%") else 0.5 for t in teile] + [0.5]
    return werte[0], werte[1]

def bild(pfad, pos):
    px, py = prozent(pos)
    im = Image.open(SITE + pfad); im.load()
    if im.mode != "RGB":
        grund = Image.new("RGB", im.size, (247, 244, 236)); grund.paste(im, mask=im.convert("RGBA").split()[-1]); im = grund
    w, h = im.size; r = 1200 / 630
    if w / h > r:
        cw = round(h * r); links = round((w - cw) * px); kasten = (links, 0, links + cw, h)
    else:
        ch = round(w / r); oben = round((h - ch) * py); kasten = (0, oben, w, oben + ch)
    im = im.crop(kasten).resize((1200, 630), Image.LANCZOS)
    for q in (84, 80, 76, 72, 68, 64, 60):  # unter 300 KB
        puffer = io.BytesIO(); im.save(puffer, "JPEG", quality=q, optimize=True, progressive=True)
        if puffer.tell() < 300 * 1024: return puffer.getvalue(), q
    return puffer.getvalue(), q

async def main():
    lies = lambda name: re.findall(r"<loc>([^<]+)</loc>", open(os.path.join(SITE, "_site", name), encoding="utf-8").read())
    locs = [u for teil in lies("sitemap.xml") for u in (lies(teil.rsplit("/", 1)[-1]) if teil.endswith(".xml") else [teil])]
    seiten = sorted({re.sub(r"^https?://[^/]+", "", u) for u in locs})
    funde = {}
    async with async_playwright() as p:
        br = await p.chromium.launch(**({"executable_path": EXE} if EXE else {}))
        ctx = await br.new_context(viewport={"width": 1440, "height": 900})
        # Angebotsfotos von Propstack braucht kein Vorschaubild; bei langsamem Netz würde „load“ sonst nie fertig
        await ctx.route(re.compile(r"googletagmanager|google-analytics|baufi-partnerportal|facebook|images\.propstack\.de"), lambda r: r.abort())
        pg = await ctx.new_page()
        for u in seiten:
            if u in LOGO or u.startswith(EIGENES): continue
            await pg.goto(BASIS + u, wait_until="load"); await pg.wait_for_timeout(150)
            funde[u] = await pg.evaluate(JS)
        await br.close()
    os.makedirs(os.path.join(SITE, ZIEL), exist_ok=True)
    zuordnung, erzeugt = {u: "logo" for u in sorted(LOGO)}, {}
    for u, f in funde.items():
        if not f: continue
        pfad, fam = quelle(f)
        if not pfad: print("ohne Quelle:", u, f.get("cur")); continue
        px, py = prozent(f["pos"])
        name = f"{fam}.jpg" if (px, py) == (0.5, 0.5) else f"{fam}-x{round(px*100)}-y{round(py*100)}.jpg"
        if name not in erzeugt:
            daten, q = bild(pfad, f["pos"])
            ziel = os.path.join(SITE, ZIEL, name); open(ziel + ".tmp", "wb").write(daten); os.replace(ziel + ".tmp", ziel)
            erzeugt[name] = {"quelle": pfad, "pos": f["pos"], "kb": len(daten) // 1024, "q": q}
        alt = f.get("alt") or next((a for k, a in ALT_ABSCHLUSS.items() if fam.startswith(k + "-")), "")
        zuordnung[u] = {"bild": f"/{ZIEL}/{name}", "alt": alt}
    standard = next((v for u, v in zuordnung.items() if u.startswith("/lexikon/") and u != "/lexikon/" and isinstance(v, dict)), None)
    daten = {"_hinweis": "Erzeugt von scripts/og-bilder.py (Update 23 B6). Nicht von Hand pflegen.", "standard": standard, "seiten": zuordnung}
    ziel = os.path.join(SITE, "_data/ogBilder.json"); open(ziel + ".tmp", "w", encoding="utf-8").write(json.dumps(daten, ensure_ascii=False, indent=1)); os.replace(ziel + ".tmp", ziel)
    for n, e in sorted(erzeugt.items()): print(f"{e['kb']:>4} KB q{e['q']}  {n:<60} ← {e['quelle']} @ {e['pos']}")
    print(len(zuordnung), "Seiten,", len(erzeugt), "Bilder")

asyncio.run(main())
