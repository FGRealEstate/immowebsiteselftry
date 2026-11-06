// Update 40 §1.2: täglicher Build um 06:00 deutscher Zeit (netlify/functions/taeglicher-build.js).
const test = require("node:test");
const assert = require("node:assert");
const { taeglicherBuild, stundeInBerlin } = require("../netlify/functions/taeglicher-build.js");

test("Winter: 05:00 UTC ist 06:00 in Berlin, 04:00 UTC nicht", () => {
  assert.strictEqual(stundeInBerlin(new Date("2026-11-07T05:00:00Z")), 6);
  assert.strictEqual(stundeInBerlin(new Date("2026-11-07T04:00:00Z")), 5);
});

test("Sommer: 04:00 UTC ist 06:00 in Berlin, 05:00 UTC nicht", () => {
  assert.strictEqual(stundeInBerlin(new Date("2027-07-01T04:00:00Z")), 6);
  assert.strictEqual(stundeInBerlin(new Date("2027-07-01T05:00:00Z")), 7);
});

test("baut genau im 06-Uhr-Lauf und loggt nur Auslösung und Status", async () => {
  const aufrufe = [];
  const logs = [];
  const abruf = async (url, opt) => { aufrufe.push({ url, opt }); return { status: 200 }; };
  const log = (...a) => logs.push(a);
  const hookUrl = "https://api.netlify.com/build_hooks/beispiel";
  const nichts = await taeglicherBuild({ jetzt: new Date("2026-11-07T04:00:00Z"), hookUrl, abruf, log });
  assert.strictEqual(nichts.gebaut, false);
  assert.strictEqual(aufrufe.length, 0);
  assert.strictEqual(logs.length, 0);
  const ja = await taeglicherBuild({ jetzt: new Date("2026-11-07T05:00:00Z"), hookUrl, abruf, log });
  assert.strictEqual(ja.gebaut, true);
  assert.strictEqual(aufrufe.length, 1);
  assert.strictEqual(aufrufe[0].opt.method, "POST");
  assert.ok(aufrufe[0].url.startsWith(hookUrl));
  assert.deepStrictEqual(logs, [["build triggered", 200]]);
});

test("ohne Build-Hook: kein Abruf, keine Adresse im Log", async () => {
  const logs = [];
  const r = await taeglicherBuild({ jetzt: new Date("2026-11-07T05:00:00Z"), hookUrl: "", abruf: async () => { throw new Error("darf nicht"); }, log: (...a) => logs.push(a) });
  assert.strictEqual(r.gebaut, false);
  assert.strictEqual(logs.length, 1);
});
