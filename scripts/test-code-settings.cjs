/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(path, imports) {
  const output = ts.transpileModule(fs.readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: (name) => {
    if (name in imports) return imports[name];
    throw new Error(`Unexpected import: ${name}`);
  }, console: { error() {} }, Date });
  return exports;
}

(async () => {
  let response = { data: { visibility: "hidden", updated_at: "now", updated_by: "editor" }, error: null };
  let saved;
  const settings = load("src/lib/codes/settings.ts", {
    "server-only": {},
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createAdminClient: () => ({ from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => response }) }),
      upsert: async (row) => { saved = row; return { error: null }; },
    }) }) },
  });
  assert.equal(await settings.isCodePublic("constitution"), false, "Hidden documents cannot be opened publicly");
  response.data.visibility = "published";
  assert.equal(await settings.isCodePublic("magna-carta"), true, "Publishing opens Magna Carta publicly");
  response = { data: null, error: { message: "Could not find the table 'public.code_settings' in the schema cache" } };
  assert.equal(await settings.isCodePublic("constitution"), true);
  assert.equal(await settings.isCodePublic("magna-carta"), false);
  response.error.message = "Connection failed";
  assert.equal(await settings.isCodePublic("constitution"), false, "An outage must not expose hidden content");
  await settings.saveCodeVisibility("constitution", "hidden", "editor@example.com");
  assert.equal(saved.code, "constitution");
  assert.equal(saved.visibility, "hidden");
  assert.equal(saved.updated_by, "editor@example.com");

  let authorized = true;
  let writes = 0;
  const refreshed = [];
  let menuRefreshes = 0;
  const codes = Object.fromEntries(["constitution", "elections-code", "magna-carta"].map(code => [code, { tab: `charters/${code}` }]));
  const actions = load("src/lib/portal/code-settings-actions.ts", {
    "next/cache": { revalidatePath: (...args) => refreshed.push(args) },
    "next/navigation": { redirect: (path) => { throw new Error(`redirect:${path}`); } },
    "@/lib/site-menu": { refreshSiteMenu: () => { menuRefreshes++; } },
    "@/lib/auth/session": { requireEditor: async (tab) => { assert.equal(tab, "charters/magna-carta"); if (!authorized) throw new Error("Forbidden"); return { email: "editor@example.com" }; } },
    "@/lib/codes/options": { codes, isCodeKey: code => Object.hasOwn(codes, code) },
    "@/lib/codes/settings": { saveCodeVisibility: async (...args) => { writes++; assert.deepEqual(args, ["magna-carta", "published", "editor@example.com"]); } },
    "./access": { tabHref: tab => `/portal/${tab}` },
    "./form": { text: (form, name) => form.get(name) },
  });
  const form = new FormData(); form.set("visibility", "published");
  authorized = false;
  await assert.rejects(actions.updateCodeVisibility("magna-carta", undefined, form), /Forbidden/);
  assert.equal(writes, 0);
  authorized = true;
  form.set("visibility", "invalid");
  assert.ok((await actions.updateCodeVisibility("magna-carta", undefined, form)).error);
  assert.equal(writes, 0);
  assert.ok((await actions.updateCodeVisibility("other", undefined, form)).error);
  form.set("visibility", "published");
  await assert.rejects(actions.updateCodeVisibility("magna-carta", undefined, form), /redirect:\/portal\/charters\/magna-carta\?show=settings/);
  assert.equal(writes, 1);
  assert.deepEqual(refreshed, [["/", "layout"]]);
  assert.equal(menuRefreshes, 1, "Publishing or hiding a document refreshes the website menu");
  console.log("Document visibility and settings authorization checks passed.");
})();
