// Update 55 §1.4: Abendprüfung Mo und Do 18:00 deutscher Zeit (netlify/functions/blog-abendpruefung.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const f = require("../netlify/functions/blog-abendpruefung.js");

const plan = {
  automatikSeit: "2026-11-07",
  offen: { e: "Bilder mit Menschen oder Händen ersetzen" },
  artikel: [
    { nr: 19, slug: "c", datum: "2026-11-13", bereit: "2026-11-11T12:00+01:00" },
    { nr: 3, slug: "d", datum: "2026-11-17", bereit: null },
    { nr: 4, slug: "e", datum: "2026-11-20", bereit: null }
  ]
};
const karten = [{ slug: "c" }];

test("Zeitplan in netlify.toml: Mo und Do 16 und 17 Uhr UTC", () => {
  const toml = fs.readFileSync(path.join(__dirname, "..", "netlify.toml"), "utf8");
  assert.match(toml, /\[functions\."blog-abendpruefung"\]\n  schedule = "0 16,17 \* \* 1,4"/);
});

test("18 Uhr in Berlin: Winter 17:00 UTC, Sommer 16:00 UTC", () => {
  assert.equal(f.stundeInBerlin(new Date("2026-11-12T17:00:00Z")), 18);
  assert.equal(f.stundeInBerlin(new Date("2026-11-12T16:00:00Z")), 17);
  assert.equal(f.stundeInBerlin(new Date("2027-06-03T16:00:00Z")), 18);
});

test("nicht 18 Uhr: keine Prüfung, keine Mail", async () => {
  const r = await f._lauf({ jetzt: new Date("2026-11-12T16:00:00Z"), plan, karten, senden: async () => { throw new Error("darf nicht"); }, log: () => {} });
  assert.equal(r.geprueft, false);
});

test("Do 18 Uhr: morgen Nr. 19, der nächste (Nr. 3) ist nicht bereit → Mail an Peer mit dem, was fehlt", async () => {
  const mails = [];
  const logs = [];
  const r = await f._lauf({
    jetzt: new Date("2026-11-12T17:00:00Z"), plan, karten, env: { MARKTBERICHTE_EMPFAENGER: "peer@beispiel.invalid" },
    senden: async (m) => { mails.push(m); return { sent: true }; }, log: (x) => logs.push(x)
  });
  assert.equal(r.mail, true);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, "peer@beispiel.invalid");
  assert.equal(mails[0].subject, "Blog: Nr. 3 am Di 17.11.2026 ist noch nicht bereit");
  assert.match(mails[0].text, /Frist: Mo 16\.11\.2026, 18:00 Uhr\./);
  assert.match(mails[0].text, /- nicht als bereit eingetragen: .*--bereit d/);
  assert.match(mails[0].text, /Nr\. 19 \(c\) is ready and goes live with the 06:00 build on Fr 13\.11\.2026\./);
  // keine Adresse im Log
  assert.ok(logs.every((l) => !String(l).includes("@")), logs.join(" | "));
  assert.deepEqual(logs, ["blog-abend morgen=19 naechster=3 bereit=false", "blog-abend mail sent"]);
});

test("Mo 18 Uhr: alles bereit → keine Mail", async () => {
  const fertig = { ...plan, artikel: plan.artikel.map((a) => ({ ...a, bereit: "2026-11-11T12:00+01:00" })) };
  const r = await f._lauf({ jetzt: new Date("2026-11-16T17:00:00Z"), plan: fertig, karten: [{ slug: "c" }, { slug: "d" }, { slug: "e" }], senden: async () => { throw new Error("darf nicht"); }, log: () => {} });
  assert.equal(r.geprueft, true);
  assert.equal(r.mail, false);
});

test("Empfänger: BLOG_PRUEFUNG_EMPFAENGER vor MARKTBERICHTE_EMPFAENGER; ohne beide keine Mail", async () => {
  assert.equal(f._empfaenger({ BLOG_PRUEFUNG_EMPFAENGER: " a@x.invalid , b@x.invalid ", MARKTBERICHTE_EMPFAENGER: "c@x.invalid" }), "a@x.invalid, b@x.invalid");
  assert.equal(f._empfaenger({ MARKTBERICHTE_EMPFAENGER: "c@x.invalid" }), "c@x.invalid");
  const r = await f._lauf({ jetzt: new Date("2026-11-12T17:00:00Z"), plan, karten, env: {}, senden: async () => { throw new Error("darf nicht"); }, log: () => {} });
  assert.equal(r.mail, false);
  assert.equal(r.grund, "kein Empfänger");
});

test("echte Daten: die Funktion lädt Plan und Karten ohne Fehler", async () => {
  const r = await f._lauf({ jetzt: new Date("2026-11-12T17:00:00Z"), senden: async () => ({ sent: false }), log: () => {}, env: {} });
  assert.equal(r.geprueft, true);
});
