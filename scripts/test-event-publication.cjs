/* eslint-disable @typescript-eslint/no-require-imports -- Check publication reads and the migration without a live app. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { PGlite } = require("@electric-sql/pglite");
const records = [
  { id: "legacy", name: "Legacy", eventDate: "2026-11-01", startsTime: "09:00" },
  { id: "public", name: "Public", eventDate: "2026-11-02", startsTime: "09:00", published: true },
  { id: "private", name: "Private", eventDate: "2026-11-03", startsTime: "09:00", published: false },
];
const dependencies = {
  "server-only": {},
  "@/lib/data/store": { store: { list: async () => records, get: async (_, id) => records.find(event => event.id === id) ?? null } },
  "@/lib/periods/store": { listUnitPeriodsForSite: async () => [] },
  "@/lib/supabase/server": {},
};
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = { exports: {} };
  cache.set(file, compiled);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}

(async () => {
  const queries = load("src/lib/events/queries.ts");
  assert.deepEqual((await queries.getEvents()).map(event => event.id), ["legacy", "public", "private"]);
  assert.deepEqual((await queries.getEventsForSite()).map(event => event.id), ["legacy", "public"]);
  assert.deepEqual((await queries.getListingsForSite()).map(event => event.id), ["legacy", "public"]);
  assert.equal((await queries.getEvent("private")).published, false, "Portal reads retain unpublished events");
  assert.equal(await queries.getEventForSite("private"), null);
  assert.equal(await queries.getListingForSite("private"), null);
  assert.equal((await queries.getEventForSite("legacy")).published, true);
  records[2].published = true;
  assert.equal((await queries.getEventForSite("private")).id, "private", "Republishing restores the public page");
  const db = new PGlite();
  try {
    await db.exec("create table public.events (id text primary key); insert into public.events values ('existing'); alter table public.events enable row level security;");
    const migration = fs.readFileSync("supabase/migrations/20261014045918_event_publication.sql", "utf8");
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await db.query("select published from public.events where id = 'existing'")).rows[0].published, true);
    await db.exec("insert into public.events (id, published) values ('hidden', false); update public.events set published = true where id = 'hidden';");
    await assert.rejects(db.exec("insert into public.events (id, published) values ('invalid', null)"), /not-null/);
    assert.equal((await db.query("select relrowsecurity from pg_class where oid = 'public.events'::regclass")).rows[0].relrowsecurity, true);
  } finally { await db.close(); }
  console.log("Event publication passed: public lists and direct links hide unpublished events, portal reads retain them, republishing restores them, and the migration preserves existing visibility and RLS.");
})().catch(error => { console.error(error); process.exitCode = 1; });
