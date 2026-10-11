const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
function load(file, imports) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => imports[name] ?? require(name), module, module.exports);
  return module.exports;
}
let seen = new Set();
const rows = [{ id: "one", college: "CICS" }, { id: "two", college: "AB" }];
let reads = 0;
const store = load("src/lib/applications/views.ts", {
  "server-only": {},
  "@/lib/auth/session": { canOpen: user => user.allowed, isLocal: user => user.local },
  "@/lib/supabase/config": { isSupabaseConfigured: () => true },
  "./options": { retentionCutoff: () => "cutoff" },
  "@/lib/supabase/server": { createAdminClient: () => ({ from: table => {
    const filters = {}; let ids; let account; let range = [0, 999];
    const query = { select() { reads++; return this; }, gte() { return this; }, eq(key, value) { if (key.includes("account_id")) account = value; else filters[key] = value; return this; }, order() { return this; }, range(from, to) { range = [from, to]; return this; }, in(key, value) { ids = value; return this; }, then(resolve) { const selected = rows.filter(row => (!filters.college || filters.college === row.college) && (!ids || ids.includes(row.id))).slice(range[0], range[1] + 1).map(row => ({ ...row, portal_application_views: seen.has(`${account}:${row.id}`) ? [{ account_id: account }] : [] })); return Promise.resolve({ data: selected, error: null }).then(resolve); }, async upsert(records, options) { assert.equal(table, "portal_application_views"); assert.equal(options.ignoreDuplicates, true); records.forEach(record => seen.add(`${record.account_id}:${record.application_id}`)); return { error: null }; } };
    return query;
  } }) },
});
(async () => {
  const first = { id: "reviewer-one", allowed: true, local: false };
  const second = { ...first, id: "reviewer-two" };
  assert.equal(await store.getUnseenApplicantCount(first), 2);
  await store.markApplicantsViewed(first, ["one"]);
  assert.equal(await store.getUnseenApplicantCount(first), 1, "Only viewed applicants clear");
  assert.equal(await store.getUnseenApplicantCount(second), 2, "Reviewers have independent counts");
  await store.markApplicantsViewed(first, ["one"]);
  assert.equal(await store.getUnseenApplicantCount(first), 1, "Repeated views are idempotent");
  const local = { ...second, local: true, college: "CICS" };
  assert.equal(await store.getUnseenApplicantCount(local), 1);
  await store.markApplicantsViewed(local, ["two"]);
  assert.equal(await store.getUnseenApplicantCount(local), 1, "Local accounts cannot mark another college's applicant");
  await store.markApplicantsViewed(local, ["one"]);
  assert.equal(await store.getUnseenApplicantCount(local), 0);
  const before = reads;
  assert.equal(await store.getUnseenApplicantCount({ ...first, allowed: false }), 0);
  assert.equal(reads, before, "No tab access means no applicant query");
  await assert.rejects(store.markApplicantsViewed({ ...first, allowed: false }, ["one"]), /Access denied/);
  assert.equal(await store.getUnseenApplicantCount({ ...local, college: null }), 0);
  console.log("Applicant unread checks passed: per-account counts, viewed-only updates, duplicate views, college scope, and access denial.");
})();
