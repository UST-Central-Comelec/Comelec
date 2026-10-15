/* eslint-disable @typescript-eslint/no-require-imports -- Check venue serialization and the database constraint without a running app. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = { exports: {} };
  cache.set(file, compiled);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}

(async () => {
  const { readDetails, detailsSchema } = load("src/lib/events/details.ts");
  const values = { name: "Filing of Candidacy", summary: "Submit your candidacy during the filing period.", background: "", eventDate: "2026-11-02", endDate: "2026-11-03", ingressTime: "", startsTime: "09:00", endsTime: "17:00", egressTime: "", venueMode: "both", openToStudents: true, openToExternals: false, openToAdmins: false };
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) if (typeof value !== "boolean") form.set(name, value);
  form.set("openToStudents", "on");
  form.append("venueDetails", " Main Building, Room 101 ");
  form.append("venueDetails", " Zoom, link emailed to applicants ");
  const parsed = detailsSchema.parse(readDetails(form));
  assert.equal(parsed.venueMode, "both");
  assert.equal(parsed.venueDetails, "Main Building, Room 101\nZoom, link emailed to applicants");
  assert.deepEqual(parsed.venueDetails.split("\n"), ["Main Building, Room 101", "Zoom, link emailed to applicants"]);
  assert.ok(detailsSchema.safeParse({ ...values, venueDetails: "Main Building" }).success, "Single-venue records remain valid");
  assert.ok(!detailsSchema.safeParse({ ...values, venueDetails: "Main Building\n" }).success, "An empty added venue cannot be silently lost");
  assert.ok(!detailsSchema.safeParse({ ...values, venueDetails: "Main Building\n\nZoom" }).success);
  assert.ok(!detailsSchema.safeParse({ ...values, venueDetails: "a".repeat(301) }).success);
  assert.ok(detailsSchema.safeParse({ ...values, venueDetails: Array(10).fill("a".repeat(300)).join("\n") }).success);
  assert.ok(!detailsSchema.safeParse({ ...values, venueDetails: Array(11).fill("Main Building").join("\n") }).success);

  const db = new PGlite();
  try {
    await db.exec("create table public.unit_periods (kind text, venue_mode text, constraint unit_periods_venue_mode_check check (venue_mode in ('onsite', 'online') or (venue_mode = 'both' and kind = 'recruitment'))); insert into public.unit_periods values ('recruitment', 'both'), ('candidacy', 'online'), ('party-registration', 'onsite');");
    const migration = fs.readFileSync("supabase/migrations/0087_candidacy_both_venues.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration);
    await db.exec("insert into public.unit_periods values ('candidacy', 'both');");
    await assert.rejects(db.exec("insert into public.unit_periods values ('party-registration', 'both');"), /check constraint/);
    await assert.rejects(db.exec("insert into public.unit_periods values ('candidacy', 'unknown');"), /check constraint/);
    assert.equal((await db.query("select count(*)::int as count from public.unit_periods")).rows[0].count, 4);
  } finally { await db.close(); }
  console.log("Candidacy venues passed: all rows round-trip, empty/oversized rows are rejected, and the idempotent migration permits Both only for Recruitment and Candidacy.");
})().catch(error => { console.error(error); process.exitCode = 1; });
