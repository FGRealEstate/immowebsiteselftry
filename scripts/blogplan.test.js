// Update 42 §2: Tests für die Selbst-Veröffentlichung der Blogartikel. Aufruf: npm test (node --test scripts/*.test.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const bp = require("./blogplan.js");

const echt = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "_data", "blogplan.json"), "utf8"));

// Kleiner Plan: zwei Artikel vor der Automatik, drei danach (Di 10.11., Fr 13.11., Di 17.11.)
const plan = (extra = {}) => ({
  automatikSeit: "2026-11-07",
  artikel: [
    { nr: 1, slug: "a", datum: "2026-10-22" },
    { nr: 2, slug: "b", datum: "2026-10-22" },
    { nr: 19, slug: "c", datum: "2026-11-10", bereit: extra.c ?? null },
    { nr: 3, slug: "d", datum: "2026-11-13", bereit: extra.d ?? null },
    { nr: 4, slug: "e", datum: "2026-11-17", bereit: extra.e ?? null }
  ]
});
const karten = ["a", "b", "c", "d", "e"].map((slug) => ({ slug, url: `/blog/${slug}/`, kategorie: "Finanzierung", titel: slug.toUpperCase(), kurz: "…" }));
const zeit = (s) => new Date(s);
const live = (p, jetzt) => bp.veroeffentlicht(p, karten, { jetzt: zeit(jetzt) }).map((a) => a.slug);

test("der echte Plan: Dienstag oder Freitag, nie zwei an einem Termin, letzter Termin 09.03.2027", () => {
  const ab = echt.artikel.filter((a) => a.datum >= echt.automatikSeit);
  for (const a of ab) assert.ok(bp.istTermin(a.datum), `Nr. ${a.nr} am ${a.datum}`);
  assert.equal(new Set(ab.map((a) => a.datum)).size, ab.length);
  assert.equal(new Set(echt.artikel.map((a) => a.slug)).size, echt.artikel.length);
  assert.equal(new Set(echt.artikel.map((a) => a.nr)).size, 40);
  assert.equal(ab.map((a) => a.datum).sort().at(-1), "2027-03-09");
});

test("Tag und Frist in deutscher Zeit, auch über die Zeitumstellung", () => {
  assert.equal(bp.tag(zeit("2026-11-09T23:30:00Z")), "2026-11-10"); // 00:30 MEZ
  assert.equal(bp.frist("2026-11-10").toISOString(), "2026-11-09T17:00:00.000Z"); // 18:00 MEZ
  assert.equal(bp.frist("2027-03-30").toISOString(), "2027-03-29T16:00:00.000Z"); // 18:00 MESZ
});

test("vor dem Datum fehlt der Artikel, ab dem Datum ist er da", () => {
  const p = plan({ c: "2026-11-08T12:00+01:00" });
  assert.deepEqual(live(p, "2026-11-09T23:59+01:00"), ["a", "b"]);
  assert.deepEqual(live(p, "2026-11-10T00:00+01:00"), ["a", "b", "c"]);
  assert.deepEqual(live(p, "2026-11-10T06:00+01:00"), ["a", "b", "c"]);
  const c = bp.veroeffentlicht(p, karten, { jetzt: zeit("2026-11-10T06:00+01:00") }).find((a) => a.slug === "c");
  assert.equal(c.datePublished, "2026-11-10");
  assert.equal(c.dateModified, "2026-11-10");
});

test("bereit nach 18 Uhr am Vorabend: übersprungen, nächster freier Termin, nie zwei an einem", () => {
  const p = plan({ c: "2026-11-09T18:01+01:00" });
  const z = bp.zeitplan(p, { jetzt: zeit("2026-11-10T06:00+01:00") });
  const c = z.find((a) => a.slug === "c");
  // 13.11. und 17.11. sind belegt; nächster freier Dienstag oder Freitag ist Fr 20.11.
  assert.equal(c.termin, "2026-11-20");
  assert.deepEqual(c.verschoben, [{ von: "2026-11-10", nach: "2026-11-20" }]);
  assert.deepEqual(live(p, "2026-11-10T06:00+01:00"), ["a", "b"]);
  assert.deepEqual(live(p, "2026-11-20T06:00+01:00"), ["a", "b", "c"]);
  const termine = z.filter((a) => a.datum >= p.automatikSeit).map((a) => a.termin);
  assert.equal(new Set(termine).size, termine.length);
});

test("nie bereit: rückt weiter, bis die Frist noch läuft", () => {
  const z = bp.zeitplan(plan(), { jetzt: zeit("2026-11-21T12:00+01:00") });
  const c = z.find((a) => a.slug === "c");
  assert.equal(c.status, "offen");
  assert.deepEqual(c.verschoben.map((v) => v.nach), ["2026-11-20", "2026-11-24"]);
});

test("zwei verschobene Artikel landen nie auf demselben Termin", () => {
  const z = bp.zeitplan(plan(), { jetzt: zeit("2026-11-14T12:00+01:00") });
  assert.equal(z.find((a) => a.slug === "c").termin, "2026-11-20");
  assert.equal(z.find((a) => a.slug === "d").termin, "2026-11-24");
  const termine = z.filter((a) => a.datum >= "2026-11-07").map((a) => a.termin);
  assert.equal(new Set(termine).size, termine.length);
});

test("ohne Seite im Repo erscheint ein bereiter Artikel nicht", () => {
  const p = plan({ c: "2026-11-08T12:00+01:00" });
  const ohne = bp.veroeffentlicht(p, karten.filter((k) => k.slug !== "c"), { jetzt: zeit("2026-11-10T06:00+01:00") });
  assert.deepEqual(ohne.map((a) => a.slug), ["a", "b"]);
});

test("Artikel vor der Automatik bleiben live, auch zwei am selben Tag", () => {
  assert.deepEqual(live(plan(), "2026-11-07T12:00+01:00"), ["a", "b"]);
  assert.throws(() => bp.zeitplan(plan(), { jetzt: zeit("2026-11-07T12:00+01:00"), vorhanden: (s) => s !== "a" }), /die Seite fehlt/);
});

test("zwei Artikel am selben Termin nach der Automatik: Abbruch", () => {
  const p = plan();
  p.artikel[3].datum = "2026-11-10";
  assert.throws(() => bp.zeitplan(p, { jetzt: zeit("2026-11-07T12:00+01:00") }), /zwei Artikel/);
});

test("Weiterleitungen: 301 erst ab dem Datum, sonst mit Raute; andere Zeilen unverändert", () => {
  const p = plan();
  const quelle = [
    "/wissen/alt-a /blog/a/ 301",
    "# /wissen/alt-c /blog/c/ 301",
    "#   /wissen/alt-c2 /blog/c/ 301",
    "# Kommentar /blog/c/",
    "/wissen/x /lexikon/y/ 301",
    "/wissen/* /blog/ 302"
  ].join("\n");
  assert.equal(bp.weiterleitungen(quelle, p, ["a", "b"]), [
    "/wissen/alt-a /blog/a/ 301",
    "# /wissen/alt-c /blog/c/ 301",
    "# /wissen/alt-c2 /blog/c/ 301",
    "# Kommentar /blog/c/",
    "/wissen/x /lexikon/y/ 301",
    "/wissen/* /blog/ 302"
  ].join("\n"));
  const danach = bp.weiterleitungen(quelle, p, ["a", "b", "c"]).split("\n");
  assert.equal(danach[1], "/wissen/alt-c /blog/c/ 301");
  assert.equal(danach[2], "/wissen/alt-c2 /blog/c/ 301");
  assert.equal(danach[5], "/wissen/* /blog/ 302");
});

test("echte _redirects: heute genau die Zeilen der Datei, alle 301 vor dem 302", () => {
  const quelle = fs.readFileSync(path.join(__dirname, "..", "_redirects"), "utf8");
  const heute = echt.artikel.filter((a) => a.datum < echt.automatikSeit).map((a) => a.slug);
  assert.equal(bp.weiterleitungen(quelle, echt, heute), quelle);
  const alle = bp.weiterleitungen(quelle, echt, echt.artikel.map((a) => a.slug)).split("\n");
  const fang = alle.indexOf("/wissen/* /blog/ 302");
  assert.ok(fang > 0);
  alle.forEach((z, i) => { if (/^\/wissen\/\S+ \/blog\/[a-z0-9-]+\/ 301$/.test(z)) assert.ok(i < fang, z); });
  assert.ok(alle.includes("/wissen/due-diligence-fur-einsteiger /blog/due-diligence-und-spekulationsfrist/ 301"));
});

test("Abendprüfung: nicht bereit um 18 Uhr → Meldung „Send this to Jesu“ mit neuem Termin", () => {
  const r = bp.abendpruefung(plan(), { jetzt: zeit("2026-11-09T18:05+01:00") });
  assert.equal(r.length, 1);
  assert.equal(r[0].slug, "c");
  assert.equal(r[0].bereit, false);
  assert.equal(r[0].neuerTermin, "2026-11-20");
  assert.match(r[0].text, /^Send this to Jesu: Nr\. 19 \(c\) was not ready by 18:00 on Mo 09\.11\.2026\. The build skips it on Di 10\.11\.2026; it moves to the next free date, Fr 20\.11\.2026\.$/);
  const ok = bp.abendpruefung(plan({ c: "2026-11-09T10:00+01:00" }), { jetzt: zeit("2026-11-09T18:05+01:00") });
  assert.equal(ok[0].bereit, true);
  assert.deepEqual(bp.abendpruefung(plan(), { jetzt: zeit("2026-11-07T18:05+01:00") }), []);
});
