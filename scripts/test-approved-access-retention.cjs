/* eslint-disable @typescript-eslint/no-require-imports -- Verify approved-record retention and versioned notices. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(name => name in dependencies ? dependencies[name] : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const defaults = load('src/lib/onboarding/documents.ts');
const cutoff = '2026-08-20T00:00:00.000Z';
let row = { id: 'approved', reference_code: 'PA-7K3M-9QXA', status: 'approved', created_at: '2026-01-01T00:00:00.000Z', first_name: 'JUAN', last_name: 'DELA CRUZ', middle_initial: '', email: 'juan@ust.edu.ph', student_number: '2026123456', contact_number: null, position: 'Chairperson', college: 'Arts', program: '', year_level: '', declarations: [] };
let retentionFilter;
const admin = load('src/lib/access-requests/admin.ts', {
  'server-only': {}, '@/lib/applications/options': { retentionCutoff: () => cutoff, yearLevels: {} },
  '@/lib/data/types': { isAffiliation: () => false, isCommissionerPosition: () => false },
  '@/lib/onboarding/documents': { readDeclarations: value => value }, '@/lib/data/accounts': { fullName: value => `${value.firstName} ${value.lastName}` },
  '@/lib/supabase/server': { createAdminClient: () => ({ from() {
    const filters = {};
    const query = { select() { return query; }, eq(key, value) { filters[key] = value; return query; }, or(value) { retentionFilter = value; return query; }, ilike(key, value) { filters[key] = value; return query; }, async maybeSingle() {
      const found = Object.entries(filters).every(([key, value]) => row[key] === value) && (row.status === 'approved' || row.created_at >= cutoff);
      return { data: found ? row : null, error: null };
    } }; return query;
  } }) },
});
(async () => {
  assert.equal((await admin.findAccessRequest(row.reference_code, row.student_number)).status, 'approved');
  assert.equal((await admin.findAccessRequest(row.reference_code, row.last_name, false)).id, 'approved');
  assert.equal(retentionFilter, `status.eq.approved,created_at.gte.${cutoff}`);
  assert.equal(await admin.findAccessRequest(row.reference_code, 'OTHER', false), null);
  for (const status of ['pending', 'declined']) { row = { ...row, status }; assert.equal(await admin.findAccessRequest(row.reference_code, row.student_number), null); }
  row = { ...row, status: 'pending', created_at: '2026-10-01T00:00:00.000Z' };
  assert.equal((await admin.findAccessRequest(row.reference_code, row.student_number)).status, 'pending');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create table access_requests(id text primary key,status text not null,created_at timestamptz not null);
      create table onboarding_documents(key text not null,version integer not null check(version>=2),title text not null,statement text not null,body text not null,saved_by text not null,saved_at timestamptz not null default now(),primary key(key,version));
      insert into access_requests values('old-approved','approved',now()-interval '90 days'),('old-pending','pending',now()-interval '90 days'),('old-declined','declined',now()-interval '90 days'),('recent-approved','approved',now()-interval '5 days'),('recent-pending','pending',now()-interval '5 days'),('recent-declined','declined',now()-interval '5 days');`);
    const original = defaults.defaultDocuments['privacy-notice'];
    const customized = original.body + '\n\nAdditional unit contact information.';
    await db.query('insert into onboarding_documents(key,version,title,statement,body,saved_by)values($1,5,$2,$3,$4,$5)', ['privacy-notice', original.title, original.statement, customized, 'officer@ust.edu.ph']);
    const migration = fs.readFileSync('supabase/migrations/20261018161735_approved_access_request_retention.sql', 'utf8');
    await db.exec(migration);
    assert.equal((await db.query('select delete_expired_access_requests() as deleted')).rows[0].deleted, 2);
    assert.deepEqual((await db.query('select id from access_requests order by id')).rows.map(row => row.id), ['old-approved', 'recent-approved', 'recent-declined', 'recent-pending']);
    assert.equal((await db.query('select delete_expired_access_requests() as deleted')).rows[0].deleted, 0);
    const history = (await db.query("select * from onboarding_documents where key='privacy-notice' order by version")).rows;
    assert.equal(history[0].version, 5); assert.equal(history[0].body, customized); assert.equal(history[0].saved_by, 'officer@ust.edu.ph');
    assert.equal(history[1].version, 6); assert.match(history[1].body, /official and legal records/); assert.ok(history[1].body.endsWith('Additional unit contact information.'));
    const policy = (await db.query("select * from onboarding_documents where key='privacy-policy'")).rows;
    assert.equal(policy.length, 1); assert.equal(policy[0].version, 2); assert.match(policy[0].body, /Approved access requests/);
    await db.exec(migration); assert.equal((await db.query('select count(*)::int as count from onboarding_documents')).rows[0].count, 3, 'Migration reruns create no additional versions');
    assert.ok(defaults.defaultDocuments['privacy-notice'].body.includes('A request for access is deleted sixty (60) days'), 'Implicit version 1 remains unchanged for historical acceptances');
    assert.equal((await db.query("select has_function_privilege('anon','public.delete_expired_access_requests()','execute') as allowed")).rows[0].allowed, false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.delete_expired_access_requests()','execute') as allowed")).rows[0].allowed, false);
  } finally { await db.close(); }
  console.log('Approved access retention passed: approved requests survive cleanup and remain trackable; other requests retain the 60-day limit; identities, historical agreements, custom text, migration reruns, and function permissions are preserved.');
})().catch(error => { console.error(error); process.exitCode = 1; });
