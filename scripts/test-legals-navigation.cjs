/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable -- Standalone CommonJS test runner. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { match, compile } = require("next/dist/compiled/path-to-regexp");
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const access = load("src/lib/portal/access.ts");
let rows = [{ level: "central-board", overrides: { "apps/approvals": false, documents: false, "codes/constitution": false, "petitions/settings": false }, updated_at: "unchanged", updated_by: "commissioner" },
  { level: "local-board", overrides: { "codes/magna-carta": true, "petitions/submissions": false }, updated_at: "unchanged", updated_by: "commissioner" }];
let write;
const store = load("src/lib/portal/access-store.ts", {
  "server-only": {}, "./access": access,
  "@/lib/supabase/config": { isSupabaseConfigured: () => true },
  "@/lib/supabase/server": { createAdminClient: () => ({ from: () => ({ select: async () => ({ data: rows, error: null }), upsert: async row => { write = row; return { error: null }; } }) }) },
});
(async () => {
  const legalGroups = access.tabGroups.filter(group => group.parent === "Legals");
  assert.deepEqual(legalGroups.map(group => group.label), ["Documents", "Charters", "Petitions and Cases"]);
  assert.ok(access.tabGroups.indexOf(legalGroups[0]) < access.tabGroups.findIndex(group => group.section === "Registrations"));
  assert.deepEqual(legalGroups.map(group => group.tabs.filter(tab => access.navigationTabKeys.includes(tab.key)).map(tab => tab.label)), [["Archive", "Onboarding"], ["Constitution", "Elections Code", "Magna Carta"], ["Case Docket", "Guidelines", "Setting"]]);
  assert.ok(access.isTabKey("documents/approval"), "Existing approval links retain their permission key");
  assert.ok(!access.navigationTabKeys.includes("documents/approval"), "Approval is removed from navigation");
  assert.equal(access.homeOf(["documents/approval", "legals/onboarding"]), "/portal/legals/onboarding");
  assert.equal(access.homeOf(["documents/approval"]), "/portal/account");
  assert.equal(access.tabName("legals/onboarding"), "Legals → Documents → Onboarding");
  assert.ok(access.levelTabs("central-board").includes("legals/onboarding"));
  assert.ok(!access.tabsFor({ kind: "personal", affiliation: "local", position: "executive-board" }).includes("legals/onboarding"));
  assert.deepEqual(access.accessTabGroups.filter(group => group.section === "Committee").map(group => group.label), ["Secretariat", "Legals"]);
  assert.deepEqual(access.normalizeTabOverrides({ "apps/calendar": false, "apps/secretariat": false }), { "secretariat/calendar": false, "secretariat/letters-tracker": false, "secretariat/minutes": false });
  assert.deepEqual(access.normalizeTabOverrides({ "apps/calendar": false, "secretariat/calendar": true, "secretariat/letters-tracker": false, "secretariat/minutes": true }), { "secretariat/calendar": true, "secretariat/letters-tracker": false, "secretariat/minutes": true });
  const before = await store.getSavedAccess();
  const board = access.levelTabs("central-board", before.overrides);
  for (const key of ["documents/approval", "documents/archive", "charters/constitution", "petitions/settings", "petitions/guidelines"]) assert.ok(!board.includes(key), `${key}: saved denials survive renaming`);
  const local = access.tabsFor({ kind: "personal", affiliation: "local", position: "executive-board" }, before.overrides);
  assert.ok(local.includes("charters/magna-carta"), "Explicit Local grant survives renaming");
  assert.ok(!local.includes("petitions/case-docket"));
  rows = rows.map(row => ({ ...row, overrides: access.normalizeTabOverrides(row.overrides) }));
  assert.deepEqual(await store.getSavedAccess(), before, "Reads are identical before and after DB migration");
  assert.deepEqual(access.normalizeTabOverrides({ "documents/archive": false, documents: true, "petitions/settings": false, "petitions/guidelines": true }), { "documents/archive": false, "petitions/settings": false, "petitions/guidelines": true }, "Canonical overrides win, including explicit Guidelines permissions");
  assert.deepEqual(access.normalizeTabOverrides({ toString: true, nonexistent: true, documents: "true" }), {});
  await store.saveAccess("central-board", before.overrides["central-board"], "editor");
  assert.ok(!Object.keys(write.overrides).some(key => Object.hasOwn(access.legacyTabKeys, key)));

  const config = load("next.config.ts").default;
  const redirects = await config.redirects();
  function destination(path) {
    for (const rule of redirects) {
      const result = match(rule.source)(path);
      if (result) return compile(rule.destination)(result.params);
    }
    return null;
  }
  assert.equal(destination("/portal/codes/constitution/revisions/test-id"), "/portal/charters/constitution/revisions/test-id");
  assert.equal(destination("/portal/apps/approvals/test-id"), "/portal/documents/approval/test-id");
  assert.equal(destination("/portal/apps/calendar"), "/portal/secretariat/calendar");
  assert.equal(destination("/portal/apps/secretariat"), "/portal/secretariat/letters-tracker");
  assert.equal(destination("/portal/documents"), "/portal/documents/archive");
  assert.equal(destination("/portal/documents/new"), "/portal/documents/archive/new");
  assert.equal(destination("/portal/petitions/submissions"), "/portal/petitions/case-docket");
  for (const group of legalGroups) for (const tab of group.tabs) assert.equal(destination(access.tabHref(tab.key)), null, "Canonical routes do not redirect or loop");
  const legacy = load("src/app/(portal)/portal/(dashboard)/documents/[id]/page.tsx", { "next/navigation": { redirect: url => { throw new Error(url); } } }).default;
  await assert.rejects(legacy({ params: Promise.resolve({ id: "old-id" }), searchParams: Promise.resolve({ notice: "updated", show: ["a", "b"] }) }), error => error.message === "/portal/documents/archive/old-id?notice=updated&show=a&show=b");
  console.log("Legals checks passed: sidebar map, preserved grants/denials, canonical-key precedence, access saves, and legacy redirects.");
})();
