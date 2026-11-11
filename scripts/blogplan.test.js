// Update 42 §2: Tests für die Selbst-Veröffentlichung der Blogartikel. Aufruf: npm test (node --test scripts/*.test.js).
// Update 55 §1.3 (11.11.2026): Nachrücken statt Ende der Reihe; Abendprüfung mit nächstem Artikel und Fehlliste.
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

test("der echte Plan: Dienstag oder Freitag, nie zwei an einem Termin, Nr. 19 am 13.11., letzter Termin 12.03.2027", () => {
  const ab = echt.artikel.filter((a) => a.datum >= echt.automatikSeit);
  for (const a of ab) assert.ok(bp.istTermin(a.datum), `Nr. ${a.nr} am ${a.datum}`);
  assert.equal(new Set(ab.map((a) => a.datum)).size, ab.length);
  assert.equal(new Set(echt.artikel.map((a) => a.slug)).size, echt.artikel.length);
  assert.equal(new Set(echt.artikel.map((a) => a.nr)).size, 40);
  assert.equal(ab.map((a) => a.datum).sort().at(-1), "2027-03-12");
  // Update 55 §1.2: Nr. 19 am Fr 13.11., danach jeder Artikel einen Termin später, ohne Lücke
  const sortiert = [...ab].sort((a, b) => a.datum.localeCompare(b.datum));
  assert.equal(sortiert[0].nr, 19);
  assert.equal(sortiert[0].datum, "2026-11-13");
  for (let i = 1; i < sortiert.length; i++) assert.equal(sortiert[i].datum, bp.naechsterFreierTermin(sortiert[i - 1].datum), `Lücke vor Nr. ${sortiert[i].nr}`);
  for (const slug of Object.keys(echt.offen || {})) assert.ok(echt.artikel.some((a) => a.slug === slug), `offen: ${slug} nicht im Plan`);
});

test("der echte Plan: sind alle bereit, erscheint jeder an seinem Datum", () => {
  const alle = { ...echt, artikel: echt.artikel.map((a) => (a.datum >= echt.automatikSeit ? { ...a, bereit: "2026-11-01T12:00+01:00" } : a)) };
  for (const a of bp.zeitplan(alle, { jetzt: zeit("2027-04-01T12:00+02:00") })) assert.equal(a.termin, a.datum, `Nr. ${a.nr}`);
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

test("Update 55 §1.3: nicht bereit → der nächste bereite nimmt den Termin, der späte den nächsten danach", () => {
  // c (geplant Di 10.11.) wird erst Mo 09.11. 18:01 bereit, d und e sind früh bereit
  const p = plan({ c: "2026-11-09T18:01+01:00", d: "2026-11-08T12:00+01:00", e: "2026-11-08T12:00+01:00" });
  const z = bp.zeitplan(p, { jetzt: zeit("2026-11-10T06:00+01:00") });
  const termin = (slug) => z.find((a) => a.slug === slug).termin;
  assert.equal(termin("d"), "2026-11-10"); // rückt vor
  assert.equal(termin("c"), "2026-11-13"); // nächster Termin, nachdem c bereit ist; nicht ans Ende
  assert.equal(termin("e"), "2026-11-17"); // bleibt an seinem Datum
  assert.deepEqual(z.find((a) => a.slug === "d").verschoben, [{ von: "2026-11-13", nach: "2026-11-10" }]);
  assert.deepEqual(live(p, "2026-11-10T06:00+01:00"), ["a", "b", "d"]);
  assert.deepEqual(live(p, "2026-11-13T06:00+01:00"), ["a", "b", "d", "c"]);
  assert.deepEqual(live(p, "2026-11-17T06:00+01:00"), ["a", "b", "d", "c", "e"]);
});

test("Update 55 §1.3: der späte Artikel kommt am ersten Termin nach seinem bereit, nie ans Ende", () => {
  // c erst Mi 18.11. bereit: 10.11. d, 13.11. e (beide früh bereit), 17.11. leer (nichts mehr bereit), 20.11. c
  const p = plan({ c: "2026-11-18T09:00+01:00", d: "2026-11-08T12:00+01:00", e: "2026-11-08T12:00+01:00" });
  const r = bp.rechne(p, { jetzt: zeit("2026-11-20T06:00+01:00") });
  const termin = (slug) => r.artikel.find((a) => a.slug === slug).termin;
  assert.equal(termin("d"), "2026-11-10");
  assert.equal(termin("e"), "2026-11-13");
  assert.equal(termin("c"), "2026-11-20");
  const leer = r.termine.filter((t) => t.entschieden && t.nr === null).map((t) => t.termin);
  assert.deepEqual(leer, ["2026-11-17"]); // leer nur, weil kein Artikel bereit war
});

test("Update 55 §1.3: ein leerer Termin nur, wenn gar kein Artikel bereit war", () => {
  const p = plan({ c: "2026-11-09T18:01+01:00" });
  const r = bp.rechne(p, { jetzt: zeit("2026-11-10T06:00+01:00") });
  assert.deepEqual(r.termine[0], { termin: "2026-11-10", nr: null, slug: null, entschieden: true, uebersprungen: [{ nr: 19, slug: "c" }, { nr: 3, slug: "d" }, { nr: 4, slug: "e" }] });
  assert.deepEqual(live(p, "2026-11-10T06:00+01:00"), ["a", "b"]);
  // c ist zur Frist des 13.11. bereit und nimmt ihn; d und e folgen in der Reihenfolge des Plans
  const z = bp.zeitplan(p, { jetzt: zeit("2026-11-13T06:00+01:00") });
  assert.deepEqual(z.filter((a) => a.datum >= p.automatikSeit).map((a) => [a.slug, a.termin, a.status]),
    [["c", "2026-11-13", "live"], ["d", "2026-11-17", "offen"], ["e", "2026-11-20", "offen"]]);
});

test("nie bereit: die Vorschau beginnt am ersten Termin, dessen Frist noch läuft", () => {
  const z = bp.zeitplan(plan(), { jetzt: zeit("2026-11-21T12:00+01:00") });
  const c = z.find((a) => a.slug === "c");
  assert.equal(c.status, "offen");
  assert.equal(c.termin, "2026-11-24");
  assert.deepEqual(c.verschoben, [{ von: "2026-11-10", nach: "2026-11-24" }]);
});

test("zwei verschobene Artikel landen nie auf demselben Termin", () => {
  const z = bp.zeitplan(plan(), { jetzt: zeit("2026-11-14T12:00+01:00") });
  assert.equal(z.find((a) => a.slug === "c").termin, "2026-11-17");
  assert.equal(z.find((a) => a.slug === "d").termin, "2026-11-20");
  const termine = z.filter((a) => a.datum >= "2026-11-07").map((a) => a.termin);
  assert.equal(new Set(termine).size, termine.length);
});

test("ein bereiter Artikel ohne Seite im Repo nimmt keinen Termin", () => {
  const p = plan({ c: "2026-11-08T12:00+01:00", d: "2026-11-08T12:00+01:00" });
  const z = bp.zeitplan(p, { jetzt: zeit("2026-11-10T06:00+01:00"), vorhanden: (s) => s !== "c" });
  assert.equal(z.find((a) => a.slug === "d").termin, "2026-11-10");
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

test("Abendprüfung Mo 18 Uhr: geplanter Artikel nicht bereit, ein anderer nimmt den Termin; Mail für den nächsten", () => {
  const p = { ...plan({ d: "2026-11-08T12:00+01:00" }), offen: { c: "bild1 zeigt Menschen" } };
  const r = bp.abendpruefung(p, { jetzt: zeit("2026-11-09T18:00+01:00") });
  assert.equal(r.morgen.termin, "2026-11-10");
  assert.equal(r.morgen.slug, "d");
  assert.match(r.morgen.text, /^Send this to Jesu: Nr\. 19 \(c\) \(now planned: Fr 13\.11\.2026\) was not ready by 18:00 on Mo 09\.11\.2026\. Nr\. 3 \(d\) takes Di 10\.11\.2026 instead/);
  assert.equal(r.naechster.slug, "c");
  assert.equal(r.naechster.termin, "2026-11-13");
  assert.equal(r.naechster.bereit, false);
  assert.equal(r.naechster.frist, "2026-11-12T17:00:00.000Z");
  assert.equal(r.mail, true);
  assert.match(r.naechster.fehlt[0], /--bereit c/);
  assert.equal(r.naechster.fehlt[1], "bild1 zeigt Menschen");
  assert.match(r.naechster.text, /^Next: Nr\. 19 \(c\) on Fr 13\.11\.2026 is not ready yet; deadline Do 12\.11\.2026, 18:00\.$/);
});

test("Abendprüfung: alles bereit → keine Mail; leerer Termin wird gemeldet", () => {
  const ok = bp.abendpruefung(plan({ c: "2026-11-09T10:00+01:00", d: "2026-11-09T10:00+01:00" }), { jetzt: zeit("2026-11-09T18:00+01:00") });
  assert.equal(ok.morgen.text, "Nr. 19 (c) is ready and goes live with the 06:00 build on Di 10.11.2026.");
  assert.equal(ok.naechster.slug, "d");
  assert.equal(ok.naechster.bereit, true);
  assert.equal(ok.mail, false);
  const leer = bp.abendpruefung(plan(), { jetzt: zeit("2026-11-09T18:00+01:00") });
  assert.match(leer.morgen.text, /^Send this to Jesu: .* and no other article was ready, so Di 10\.11\.2026 has no article\.$/);
  assert.equal(leer.mail, true);
  assert.equal(bp.abendpruefung(plan(), { jetzt: zeit("2026-11-07T18:05+01:00") }).morgen, null);
});

test("Abendprüfung vor 18 Uhr: Frist läuft noch", () => {
  const r = bp.abendpruefung(plan(), { jetzt: zeit("2026-11-09T12:00+01:00") });
  assert.equal(r.morgen.text, "Nr. 19 (c) is due on Di 10.11.2026 and not ready yet; deadline 18:00 today.");
  assert.equal(r.naechster.slug, "d");
});

test("fehlt: bereit, aber ohne Seite im Repo", () => {
  const a = { nr: 3, slug: "d", datum: "2026-11-13", bereit: "2026-11-08T12:00+01:00" };
  assert.match(bp.fehlt({}, a, () => false)[0], /Seite fehlt im Repo/);
  assert.deepEqual(bp.fehlt({}, a, () => true), []);
});

test("die nächsten sechs Termine", () => {
  const n = bp.naechsteTermine(echt, { jetzt: zeit("2026-11-11T12:00+01:00"), anzahl: 6 });
  assert.equal(n.length, 6);
  assert.deepEqual(n.map((a) => a.termin), ["2026-11-13", "2026-11-17", "2026-11-20", "2026-11-24", "2026-11-27", "2026-12-01"]);
});
