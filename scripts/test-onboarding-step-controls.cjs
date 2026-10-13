/* eslint-disable @typescript-eslint/no-require-imports -- Standalone migration and flow checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => dependencies[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}
const documents = load("src/lib/onboarding/documents.ts");
(async () => {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  const migration = fs.readFileSync("supabase/migrations/0084_onboarding_step_controls.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration); // Re-runs don't reset the flow.
  // Upgrading the original 0074 table preserves saved texts and widens its key constraint.
  const existing = new PGlite();
  await existing.exec("create role anon; create role authenticated; create role service_role; create table access_requests (id text); create table portal_accounts (id text);");
  await existing.exec(fs.readFileSync("supabase/migrations/0074_onboarding_declarations.sql", "utf8"));
  await existing.exec("insert into onboarding_documents (key, version, title, statement, body, saved_by) values ('recusal', 2, 'Saved agreement', 'I agree', 'Existing text', 'editor@ust.edu.ph');");
  await existing.exec(migration);
  assert.equal((await existing.query("select body from onboarding_documents where key = 'recusal'")).rows[0].body, "Existing text");
  await existing.query("select change_onboarding_step('add', 'custom-12345678-1234-1234-1234-123456789abc', 'editor@ust.edu.ph', 0, true, $1)", [JSON.stringify({ title: "New agreement", statement: "I agree", body: "Text" })]);
  await existing.close();
  const layout = async () => (await db.query("select steps from onboarding_layout")).rows[0].steps;
  const change = (operation, key, direction = 0, visible = true, text = null) => db.query("select change_onboarding_step($1,$2,$3,$4,$5,$6)", [operation, key, "editor@ust.edu.ph", direction, visible, text && JSON.stringify(text)]);
  for (const key of ["privacy-notice", "profile"]) for (const operation of ["move", "visibility", "delete"]) await assert.rejects(change(operation, key, 1, false), /locked/);
  await assert.rejects(change("move", "membership-agreement", -1), /locked/);
  await change("move", "code-of-conduct", -1);
  assert.deepEqual((await layout()).slice(0, 4).map(step => step.key), ["privacy-notice", "profile", "code-of-conduct", "membership-agreement"]);
  await change("visibility", "code-of-conduct", 0, false);
  assert.equal((await layout())[2].hidden, true);
  const custom = "custom-12345678-1234-1234-1234-123456789abc";
  await assert.rejects(change("add", custom, 0, true, { title: "", statement: "I agree", body: "Text" }));
  assert.equal((await layout()).some(step => step.key === custom), false, "Failed creation leaves no step");
  await change("add", custom, 0, true, { title: "New agreement", statement: "I agree", body: "Text" });
  assert.equal((await layout()).at(-1).key, custom);
  assert.equal(documents.isOnboardingDocumentKey(custom), true);

  const store = load("src/lib/onboarding/store.ts", {
    "server-only": {}, "./documents": documents,
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createAdminClient: () => ({ from: table => ({ select: () => table === "onboarding_layout" ? { eq: () => ({ maybeSingle: async () => ({ data: { steps: await layout() }, error: null }) }) } : { order: async () => ({ data: (await db.query("select * from onboarding_documents order by version desc")).rows, error: null }) } }) }) },
  });
  const visible = await store.getOnboardingDocuments();
  assert.equal(visible.some(document => document.key === "code-of-conduct"), false);
  assert.equal(visible.at(-1).key, custom);
  const requestSteps = documents.requestOnboardingSteps(visible);
  assert.deepEqual(requestSteps.slice(0, 2).map(step => step.id), ["privacy-notice", "profile"]);
  assert.equal(requestSteps.at(-1).id, "submit");
  assert.equal(requestSteps.at(-2).id, custom);
  assert.equal((await store.getOnboardingDocuments(true)).some(document => document.key === "code-of-conduct"), true);
  await change("visibility", "code-of-conduct", 0, true);
  assert.equal((await store.getOnboardingDocuments())[1].key, "code-of-conduct");
  await change("delete", custom);
  assert.equal(await store.getOnboardingDocument(custom), undefined);
  assert.equal((await db.query("select count(*)::integer as count from onboarding_documents where key=$1", [custom])).rows[0].count, 1, "Deletion retains version history");
  const accepted = { key: custom, title: "New agreement", version: 2, acceptedAt: new Date().toISOString() };
  assert.deepEqual(documents.readDeclarations([accepted]), [accepted], "Deleted custom declarations remain readable");
  await assert.rejects(change("move", custom, -1), /no longer exists/);
  await assert.rejects(change("move", "officer-acceptance", 1), /locked/);
  const role = await db.query("select has_function_privilege('anon', 'change_onboarding_step(text,text,text,integer,boolean,jsonb)', 'execute') as allowed");
  assert.equal(role.rows[0].allowed, false, "Public callers cannot mutate onboarding");
  await db.close();
  console.log("Onboarding step controls passed: migration, fixed steps, ordering, visibility, atomic creation, deletion, history, live flow, and RPC permissions.");
})().catch(error => { console.error(error); process.exitCode = 1; });
