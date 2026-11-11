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

// Update 53 §1.1: Flyer-Version A und B, je ein eigener Kurzlink.
const VERSIONEN = {
  a: require("../netlify/functions/qr-flyer-a.js"),
  b: require("../netlify/functions/qr-flyer-b.js"),
};

for (const [v, modul] of Object.entries(VERSIONEN)) {
  test(`Version ${v.toUpperCase()}: gleiches Ziel wie /qr/flyer, dazu utm_content=${v}, eigener Präfix`, async () => {
    const erwartet = ZIEL_LAUT_BRIEF.replace("#anfrage", `&utm_content=${v}#anfrage`);
    assert.strictEqual(modul.ZIEL, erwartet);
    assert.strictEqual(modul.STORE, "qr-aufrufe");
    const s = falscherStore();
    const jetzt = new Date("2026-12-01T09:30:00.000Z");
    const r = await modul._qrAufruf({ methode: "GET", jetzt, store: s });
    assert.strictEqual(r.statusCode, 302);
    assert.strictEqual(r.headers.Location, erwartet);
    assert.match(r.headers["X-Robots-Tag"], /noindex/);
    assert.strictEqual(r.headers["Cache-Control"], "no-store");
    assert.strictEqual(s.daten.size, 1);
    const [k] = s.daten.keys();
    assert.match(k, new RegExp(`^flyer-${v}/2026-12-01T09:30:00\\.000Z-[0-9a-f]{6}$`));
    // Der Zähler für /qr/flyer listet Präfix „flyer/“: Version A und B dürfen dort nie mitgezählt werden.
    assert.ok(!k.startsWith("flyer/"));
  });
}

test("Version A und B: HEAD zählt nicht, POST 405, Zählfehler hält nicht auf", async () => {
  for (const modul of Object.values(VERSIONEN)) {
    const s = falscherStore();
    assert.strictEqual((await modul._qrAufruf({ methode: "HEAD", store: s })).statusCode, 302);
    assert.strictEqual((await modul._qrAufruf({ methode: "POST", store: s })).statusCode, 405);
    assert.strictEqual(s.daten.size, 0);
    const kaputt = await modul._qrAufruf({ methode: "GET", store: () => { throw new Error("kein Blobs-Kontext"); } });
    assert.strictEqual(kaputt.statusCode, 302);
  }
});

test("netlify.toml: je eine Route für /qr/flyer, /qr/flyer-a, /qr/flyer-b auf die passende Funktion", () => {
  const toml = require("fs").readFileSync(require("path").join(__dirname, "..", "netlify.toml"), "utf8");
  for (const name of ["flyer", "flyer-a", "flyer-b"]) {
    const regel = new RegExp(`from = "/qr/${name}"\\n\\s*to = "/\\.netlify/functions/qr-${name}"\\n\\s*status = 200`);
    assert.match(toml, regel, name);
  }
});

test("?test=1: gleiche Weiterleitung, zählt aber unter test/ und nie in den Flyer-Zahlen", async () => {
  for (const modul of [require("../netlify/functions/qr-flyer.js"), ...Object.values(VERSIONEN)]) {
    const s = falscherStore();
    const r = await modul._qrAufruf({ methode: "GET", store: s, test: true });
    assert.strictEqual(r.statusCode, 302);
    assert.strictEqual(r.headers.Location, modul.ZIEL);
    const [k] = s.daten.keys();
    assert.match(k, /^test\/flyer(-a|-b)?\//);
  }
});

// Cockpit-Schnittstelle qr-stand.js
const { _qrStand: qrStand, _auswerten: auswerten } = require("../netlify/functions/qr-stand.js");

test("qr-stand: zählt je Flyer getrennt, Zählstart beim ersten Druck, test/ nie, Tage in deutscher Zeit", () => {
  const r = auswerten([
    "flyer/2026-11-09T14:30:00.000Z-aaaaaa",       // vor Zählstart (Test aus Update 52)
    "flyer/2026-11-09T15:00:00.000Z-bbbbbb",
    "flyer/2026-11-10T10:34:27.927Z-cccccc",
    "flyer-a/2026-11-12T23:30:00.000Z-dddddd",     // 00:30 Uhr deutscher Zeit am 13.11.
    "flyer-b/2026-11-12T08:00:00.000Z-eeeeee",
    "flyer-b/2026-11-12T09:00:00.000Z-ffffff",
    "test/flyer-a/2026-11-12T08:00:00.000Z-111111",
    "test/flyer/2026-11-12T08:00:00.000Z-222222",
  ], new Date("2026-11-13T12:00:00Z"));
  const n = Object.fromEntries(r.flyer.map((f) => [f.name, f]));
  assert.deepStrictEqual(r.flyer.map((f) => f.name), ["flyer", "flyer-a", "flyer-b"]);
  assert.strictEqual(n.flyer.gezaehlt, 2);
  assert.strictEqual(n.flyer.letzter, "2026-11-10T10:34:27.927Z");
  assert.strictEqual(n["flyer-a"].gezaehlt, 1);
  assert.deepStrictEqual(n["flyer-a"].je_tag, { "2026-11-13": 1 });
  assert.strictEqual(n["flyer-b"].gezaehlt, 2);
  assert.deepStrictEqual(n["flyer-b"].je_tag, { "2026-11-12": 2 });
  assert.strictEqual(r.stand, "2026-11-13T12:00:00.000Z");
});

test("qr-stand: CORS nur für Cockpit-Adressen, kein Cache, Lesefehler → 503", async () => {
  const store = { list: async () => ({ blobs: [{ key: "flyer-b/2026-11-12T08:00:00.000Z-eeeeee" }] }) };
  const ok = await qrStand({ methode: "GET", herkunft: "https://fg-cockpit.pages.dev", store });
  assert.strictEqual(ok.statusCode, 200);
  assert.strictEqual(ok.headers["Access-Control-Allow-Origin"], "https://fg-cockpit.pages.dev");
  assert.strictEqual(ok.headers["Cache-Control"], "no-store");
  assert.match(ok.headers["X-Robots-Tag"], /noindex/);
  assert.strictEqual(JSON.parse(ok.body).flyer[2].gezaehlt, 1);
  for (const h of ["https://zqe1yzqy-gpb4a-phec3p.pages.dev", "https://abc123.fg-cockpit.pages.dev", "http://localhost:5173"]) {
    assert.strictEqual((await qrStand({ methode: "GET", herkunft: h, store })).headers["Access-Control-Allow-Origin"], h);
  }
  for (const h of ["https://boese.example", "https://fg-cockpit.pages.dev.boese.example", undefined]) {
    assert.strictEqual((await qrStand({ methode: "GET", herkunft: h, store })).headers["Access-Control-Allow-Origin"], undefined);
  }
  assert.strictEqual((await qrStand({ methode: "POST", store })).statusCode, 405);
  const kaputt = await qrStand({ methode: "GET", store: () => { throw new Error("kein Blobs-Kontext"); } });
  assert.strictEqual(kaputt.statusCode, 503);
});

test("Handler: Netlify-Aufruf ohne Blobs-Kontext leitet trotzdem weiter", async () => {
  for (const modul of [require("../netlify/functions/qr-flyer.js"), ...Object.values(VERSIONEN)]) {
    const r = await modul.handler({ httpMethod: "GET", headers: {} });
    assert.strictEqual(r.statusCode, 302);
    assert.strictEqual(r.headers.Location, modul.ZIEL);
  }
});
