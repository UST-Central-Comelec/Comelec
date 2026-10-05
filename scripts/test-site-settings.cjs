// Run with: node scripts/test-site-settings.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Test the server store with controlled database responses and time. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function harness() {
  let now = 0;
  let response = { data: { cookie_notice: false }, error: null };
  let saveError = null;
  let signal;
  let reads = 0;
  const timers = new Map();
  const warnings = [];
  const source = ts.transpileModule(fs.readFileSync("src/lib/site-settings/store.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  vm.runInNewContext(source, {
    module: compiled, exports: compiled.exports, AbortController,
    Date: class extends Date { static now() { return now; } },
    setTimeout: (callback) => { const id = {}; timers.set(id, callback); return id; },
    clearTimeout: (id) => timers.delete(id),
    console: { warn: (message) => warnings.push(message), error: () => assert.fail("Fallback must not log a console error") },
    require: (name) => {
      if (name === "server-only") return {};
      if (name.endsWith("/config")) return { isSupabaseConfigured: () => true };
      if (name.endsWith("/server")) return {
        createAdminClient: () => ({ from: () => ({
          select: () => ({
            abortSignal(value) { signal = value; return this; },
            maybeSingle: () => {
            reads++;
            const current = response;
            return {
              then(resolve, reject) { return Promise.resolve(current).then(resolve, reject); },
            };
          } }),
          upsert: async () => ({ error: saveError }),
        }) }),
      };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return {
    store: compiled.exports, timers, warnings,
    setResponse: (value) => { response = value; },
    setSaveError: (value) => { saveError = value; },
    expire: () => { now += 15_001; },
    timeout: () => { for (const callback of timers.values()) callback(); },
    get reads() { return reads; },
    get signal() { return signal; },
  };
}

async function main() {
  const h = harness();
  const first = h.store.getSiteSettingsForSite();
  assert.equal(h.store.getSiteSettingsForSite(), first, "Concurrent reads share one request");
  const settings = await first;
  assert.equal(settings.cookieNotice, false);
  assert.equal(h.timers.size, 0, "Successful reads clear their timeout");
  assert.equal(h.reads, 1);

  h.expire();
  h.setResponse(new Promise(() => {}));
  const slow = h.store.getSiteSettingsForSite();
  h.timeout();
  assert.equal(await slow, settings, "A timeout retains the last known settings");
  assert.equal(h.signal.aborted, true, "The timed-out database request is cancelled");
  assert.equal(h.timers.size, 0);
  assert.match(h.warnings[0], /last known settings/);

  h.expire();
  h.setResponse({ data: null, error: { message: "Database unavailable" } });
  assert.equal(await h.store.getSiteSettingsForSite(), settings, "Database errors also retain settings");
  await assert.rejects(h.store.getSiteSettings(), /Database unavailable/, "Portal reads remain strict");

  h.setSaveError({ message: "Write failed" });
  await assert.rejects(h.store.saveSiteSettings({ cookieNotice: true }, "admin"), /Write failed/);
  assert.equal(await h.store.getSiteSettingsForSite(), settings, "Failed saves preserve cached settings");

  h.setSaveError(null);
  h.setResponse({ data: { cookie_notice: true }, error: null });
  await h.store.saveSiteSettings({ cookieNotice: true }, "admin");
  assert.equal((await h.store.getSiteSettingsForSite()).cookieNotice, true, "Successful saves invalidate the cache");

  const initial = harness();
  initial.setResponse(new Promise(() => {}));
  const unavailable = initial.store.getSiteSettingsForSite();
  initial.timeout();
  assert.equal(await unavailable, initial.store.defaultSettings, "The first unavailable read uses defaults");
  console.log("Site-settings timeouts, cancellation, cache fallback, and save invalidation passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
