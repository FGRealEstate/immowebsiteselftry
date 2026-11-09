// Update 52 §1: Kurzlink /qr/flyer (netlify/functions/qr-flyer.js).
const test = require("node:test");
const assert = require("node:assert");
const { _qrAufruf: qrAufruf, ZIEL } = require("../netlify/functions/qr-flyer.js");

const ZIEL_LAUT_BRIEF = "https://fg-realestate.de/immobilienbewertung/?utm_source=flyer&utm_medium=print&utm_campaign=flyer-dezember-2026#anfrage";

function falscherStore() {
  const daten = new Map();
  return { daten, set: async (k, v) => { daten.set(k, v); } };
}

test("GET: 302 auf die Bewertungsseite mit #anfrage, noindex, kein Cache", async () => {
  assert.strictEqual(ZIEL, ZIEL_LAUT_BRIEF);
  const r = await qrAufruf({ methode: "GET", store: falscherStore() });
  assert.strictEqual(r.statusCode, 302);
  assert.strictEqual(r.headers.Location, ZIEL_LAUT_BRIEF);
  assert.match(r.headers["X-Robots-Tag"], /noindex/);
  assert.strictEqual(r.headers["Cache-Control"], "no-store");
});

test("GET zählt: ein Schlüssel je Aufruf, gespeichert nur die Uhrzeit", async () => {
  const s = falscherStore();
  const jetzt = new Date("2026-12-01T09:30:00.000Z");
  await qrAufruf({ methode: "GET", jetzt, store: s });
  await qrAufruf({ methode: "GET", jetzt, store: s });
  assert.strictEqual(s.daten.size, 2);
  for (const [k, v] of s.daten) {
    assert.match(k, /^flyer\/2026-12-01T09:30:00\.000Z-[0-9a-f]{6}$/);
    assert.strictEqual(v, "2026-12-01T09:30:00.000Z");
  }
});

test("HEAD leitet weiter, zählt aber nicht; POST ist nicht erlaubt", async () => {
  const s = falscherStore();
  const kopf = await qrAufruf({ methode: "HEAD", store: s });
  assert.strictEqual(kopf.statusCode, 302);
  assert.strictEqual(s.daten.size, 0);
  const post = await qrAufruf({ methode: "POST", store: s });
  assert.strictEqual(post.statusCode, 405);
  assert.strictEqual(s.daten.size, 0);
});

test("Zählfehler oder hängender Speicher halten die Weiterleitung nicht auf", async () => {
  const kaputt = await qrAufruf({ methode: "GET", store: () => { throw new Error("kein Blobs-Kontext"); } });
  assert.strictEqual(kaputt.statusCode, 302);
  const start = Date.now();
  const haengt = await qrAufruf({ methode: "GET", store: { set: () => new Promise(() => {}) }, warten: 50 });
  assert.strictEqual(haengt.statusCode, 302);
  assert.ok(Date.now() - start < 1000);
});
