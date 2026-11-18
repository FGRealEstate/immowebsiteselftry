// Update 69 §1: jeder Build-Hook-Aufruf baut den Produktionszweig „live“, nie den Hook-Standard main.
const test = require("node:test");
const assert = require("node:assert");

test("sofortBauen hängt trigger_branch=live an, mit und ohne Titel", async () => {
  const alt = { fetch: global.fetch, hook: process.env.NETLIFY_BUILD_HOOK_URL, zweig: process.env.FG_LIVE_BRANCH };
  const aufrufe = [];
  global.fetch = async (url, opt) => { aufrufe.push({ url, opt }); return { ok: true, status: 200 }; };
  process.env.NETLIFY_BUILD_HOOK_URL = "https://api.netlify.com/build_hooks/beispiel";
  delete process.env.FG_LIVE_BRANCH;
  try {
    const { sofortBauen } = require("../netlify/functions/_shared/build-sammler.js");
    await sofortBauen("unit", "Propstack unit 1");
    await sofortBauen("unit");
    for (const a of aufrufe) {
      const u = new URL(a.url);
      assert.strictEqual(u.searchParams.get("trigger_branch"), "live");
      assert.strictEqual(a.opt.method, "POST");
    }
    assert.strictEqual(new URL(aufrufe[0].url).searchParams.get("trigger_title"), "Propstack unit 1");
  } finally {
    global.fetch = alt.fetch;
    if (alt.hook === undefined) delete process.env.NETLIFY_BUILD_HOOK_URL; else process.env.NETLIFY_BUILD_HOOK_URL = alt.hook;
    if (alt.zweig !== undefined) process.env.FG_LIVE_BRANCH = alt.zweig;
  }
});
