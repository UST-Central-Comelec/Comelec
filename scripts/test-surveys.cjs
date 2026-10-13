/* eslint-disable @typescript-eslint/no-require-imports -- Isolated survey validation and PostgreSQL checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const loaded = new Map();
function load(file) {
  if (loaded.has(file)) return loaded.get(file);
  const compiled = { exports: {} };
  loaded.set(file, compiled.exports);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => name.startsWith("@/") ? load(path.resolve(`src/${name.slice(2)}.ts`)) : name.startsWith(".") ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name), compiled, compiled.exports);
  return compiled.exports;
}
async function main() {
  const { surveySchema, defaultSurveyDefinition, surveyNumber } = load(path.resolve("src/lib/surveys/types.ts"));
  const { validateEditorAnswers, keptAnswers } = load(path.resolve("src/lib/events/form-editor.ts"));
  const value = surveySchema.parse({ title: "Commissioner feedback", description: "", status: "open", definition: defaultSurveyDefinition });
  assert.equal(surveyNumber({ number: 1, createdAt: "2026-12-31T16:00:00Z" }), "UST:CC-027-SVY-001");
  assert.ok(validateEditorAnswers(value.definition, { feedback: "Answer" }), "Privacy consent is required");
  assert.ok(validateEditorAnswers(value.definition, { survey_consent: "yes" }), "The survey answer is required");
  assert.equal(validateEditorAnswers(value.definition, { survey_consent: "yes", feedback: "Answer" }), null);
  assert.deepEqual(keptAnswers(value.definition, { survey_consent: "yes", feedback: " Answer ", injected: "discard" }), { survey_consent: "yes", feedback: "Answer" });
  const duplicates = structuredClone(value);
  duplicates.definition.steps[1].fields.push(duplicates.definition.steps[1].fields[0]);
  assert.equal(surveySchema.safeParse(duplicates).success, false, "Duplicate question IDs are refused");
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    await db.exec(fs.readFileSync("supabase/migrations/0085_secretariat_surveys.sql", "utf8"));
    const save = async (id, payload, expected, local = false, college = null) => (await db.query("select save_secretariat_survey($1::uuid, $2::jsonb, $3::timestamptz, 'commissioner@ust.edu.ph', $4::boolean, $5::text) as result", [id, JSON.stringify(payload), expected, local, college])).rows[0].result;
    const submit = async (id, expected, actor = "respondent@ust.edu.ph", local = false, college = null) => (await db.query("select submit_secretariat_survey($1::uuid, $2::jsonb, $3::timestamptz, $4::text, $5::boolean, $6::text) as result", [id, JSON.stringify({ survey_consent: "yes", feedback: "Answer" }), expected, actor, local, college])).rows[0].result;
    const row = async id => (await db.query("select * from secretariat_surveys where id = $1", [id])).rows[0];
    const first = await save(null, value, null, true, "Engineering");
    const original = await row(first.id);
    assert.equal(original.college, "Engineering");
    assert.equal(Number(original.number), 1);
    assert.ok((await save(first.id, value, original.updated_at, true, "Science")).error, "Another local unit cannot edit");
    assert.ok((await submit(first.id, original.updated_at, "other@ust.edu.ph", true, "Science")).error, "Another local unit cannot respond");
    assert.deepEqual(await submit(first.id, original.updated_at), { success: true });
    assert.ok((await submit(first.id, original.updated_at)).error, "Duplicate responses are refused");
    assert.equal((await db.query("select count(*) as count from secretariat_survey_responses")).rows[0].count, 1);
    const changed = structuredClone(value);
    changed.definition.steps[1].fields[0].label = "Changed question";
    assert.ok((await save(first.id, changed, original.updated_at)).error, "Questions with responses are locked");
    assert.ok((await save(first.id, value, "2000-01-01T00:00:00Z")).conflict, "A stale save cannot overwrite the record");
    assert.ok((await save(first.id, { ...value, status: "closed" }, original.updated_at)).id);
    const closed = await row(first.id);
    assert.ok((await submit(first.id, closed.updated_at, "new@ust.edu.ph")).error, "Closed surveys cannot accept answers");
    await save(first.id, value, closed.updated_at);
    assert.ok((await submit(first.id, original.updated_at, "new@ust.edu.ph")).error, "A response to an old version is refused");
    const permissions = (await db.query("select has_table_privilege('anon', 'secretariat_surveys', 'SELECT') as anon_read, has_table_privilege('authenticated', 'secretariat_survey_responses', 'SELECT') as auth_read, has_function_privilege('authenticated', 'save_secretariat_survey(uuid,jsonb,timestamp with time zone,text,boolean,text)', 'EXECUTE') as auth_write")).rows[0];
    assert.deepEqual(permissions, { anon_read: false, auth_read: false, auth_write: false }, "Private records and RPCs require the server service role");
  } finally { await db.close(); }
  console.log("Survey schema, required answers, numbering, unit scope, duplicates, closing, question locks, conflicts and permissions passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
