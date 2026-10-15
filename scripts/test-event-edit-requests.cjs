/* eslint-disable @typescript-eslint/no-require-imports -- Verify event edit request ownership, permissions and database constraints. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies = {}, cache = new Map()) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/')) { const target = `src/${name.slice(2)}.ts`; return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}

const { PGlite } = require('@electric-sql/pglite');
const reference = 'RS-7K3M-9QXA';
const rsvpId = '11111111-1111-4111-8111-111111111111';
const registrationId = '22222222-2222-4222-8222-222222222222';
let existing = null, limited = false, fail = false, collision = false;
let user = { kind: 'commissioner', affiliation: 'local', college: 'Arts', readOnly: false, email: 'officer@ust.edu.ph' };
let event = { id: 'event', organizer: 'local', college: 'Arts' };
const writes = [], refreshed = [];
const dbClient = { from(table) { return {
  insert(row) { writes.push({ table, row }); return { select: () => ({ single: async () => { if (collision) existing = { id: 'concurrent', ...row }; return { data: { id: 'new', ...row }, error: fail ? { code: 'error' } : collision ? { code: '23505' } : null }; } }) }; },
  update(row) { const filters = {}; const query = { eq(key, value) { filters[key] = value; return query; }, async select() { writes.push({ table, row, filters }); return { data: [{ id: filters.id }], error: fail ? {} : null }; } }; return query; },
}; } };
const actions = load('src/lib/events/edit-request-actions.ts', {
  'server-only': {},
  'next/headers': { headers: async () => new Headers() },
  'next/cache': { revalidatePath: value => refreshed.push(value) },
  'next/navigation': { unstable_rethrow: () => {} },
  '@/lib/auth/session': { requireEditor: async () => user },
  '@/lib/supabase/server': { createAdminClient: () => dbClient },
  '@/lib/security/rate-limit': { clientIp: () => 'local', limits: { track: { limit: 10, windowMs: 1000 } }, rateLimit: () => ({ ok: !limited }) },
  './registrations': { findRegistrationByReference: async (code, surname) => code === 'ABCDE' && surname === 'DELA CRUZ' ? { id: registrationId, eventId: 'event' } : null },
  './rsvp-store': { findRsvpByReference: async (code, surname) => code === reference && surname === 'DELA CRUZ' ? { id: rsvpId, event_id: 'event' } : null },
  './edit-requests': { pendingEventEditRequest: async () => existing },
  './queries': { getEvent: async () => event },
});
function form(code = reference, surname = 'DELA CRUZ', changes = 'Change arrival time to 9 AM.') {
  const data = new FormData();data.set('reference', code);data.set('identity', surname);data.set('changes', changes);
  data.set('eventId', 'forged-event');data.set('registration_id', 'forged-id');return data;
}
(async () => {
  assert.ok((await actions.requestResponseEdit({}, form(reference, 'OTHER'))).error);
  assert.ok((await actions.requestResponseEdit({}, form(reference, 'DELA_CRUZ'))).error);
  assert.ok((await actions.requestResponseEdit({}, form('CC-7K3M-9QXA'))).error);
  assert.ok((await actions.requestResponseEdit({}, form(reference, 'DELA CRUZ', ' '))).fieldErrors.changes);
  assert.ok((await actions.requestResponseEdit({}, form(reference, 'DELA CRUZ', 'x'.repeat(4001)))).fieldErrors.changes);
  limited = true;assert.ok((await actions.requestResponseEdit({}, form())).error);limited = false;
  assert.equal(writes.length, 0, 'Invalid identity, wrong kind, invalid changes and throttled requests never write');
  let result = await actions.requestResponseEdit({}, form());assert.equal(result.request.id, 'new');
  assert.deepEqual(writes.at(-1).row, { event_id: 'event', registration_id: null, rsvp_response_id: rsvpId, requested_changes: 'Change arrival time to 9 AM.' }, 'Targets are derived from the verified record');
  assert.ok(refreshed.includes('/portal/events/event/responses'));
  result = await actions.requestResponseEdit({}, form('ABCDE'));assert.equal(result.request.registration_id, registrationId);
  existing = result.request;const count = writes.length;
  assert.equal((await actions.requestResponseEdit({}, form('ABCDE'))).request.id, existing.id);
  assert.equal(writes.length, count, 'An existing pending request is reused');existing = null;
  collision = true;assert.equal((await actions.requestResponseEdit({}, form())).request.id, 'concurrent', 'Concurrent requests reuse the winning pending request');collision = false;existing = null;
  fail = true;assert.ok((await actions.requestResponseEdit({}, form())).error);fail = false;
  user.college = 'Science';const before = writes.length;
  assert.ok((await actions.addressResponseEdit('event', 'edit')).error);
  user.college = 'Arts';user.readOnly = true;assert.ok((await actions.addressResponseEdit('event', 'edit')).error);
  assert.equal(writes.length, before, 'Other units and read-only users cannot resolve requests');user.readOnly = false;
  assert.equal((await actions.addressResponseEdit('event', 'edit')).saved, true);
  assert.deepEqual(writes.at(-1).filters, { event_id: 'event', id: 'edit', status: 'pending' }, 'Addressing is scoped to this event and a pending request');
  assert.equal(writes.at(-1).row.addressed_by, user.email);
  for (const decision of ['accepted', 'declined']) {
    assert.equal((await actions.addressResponseEdit('event', 'edit', decision)).saved, true);
    assert.equal(writes.at(-1).row.status, decision, 'The chosen decision is persisted');
    assert.deepEqual(writes.at(-1).filters, { event_id: 'event', id: 'edit', status: 'pending' });
  }
  const beforeInvalid = writes.length;
  assert.ok((await actions.addressResponseEdit('event', 'edit', 'invalid')).error);
  assert.equal(writes.length, beforeInvalid, 'Invalid decisions never write');
  fail = true;assert.ok((await actions.addressResponseEdit('event', 'edit')).error);
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create table events(id text primary key); create table event_registrations(id uuid primary key); create table event_rsvp_responses(id uuid primary key); insert into events values ('event'); insert into event_rsvp_responses values ('${rsvpId}'); insert into event_registrations values ('${registrationId}');`);
    const migration = fs.readFileSync('supabase/migrations/0079_event_response_edit_requests.sql', 'utf8');
    await db.exec(migration);await db.exec(migration);
    const insert = `insert into event_response_edit_requests(event_id,rsvp_response_id,requested_changes) values ('event','${rsvpId}','Change arrival time')`;
    const decisionMigration = fs.readFileSync('supabase/migrations/0083_event_edit_request_decisions.sql', 'utf8');
    await db.exec(decisionMigration);await db.exec(decisionMigration);
    await db.exec(insert);await assert.rejects(db.exec(insert), /unique constraint/);
    await assert.rejects(db.exec("insert into event_response_edit_requests(event_id,requested_changes) values ('event','Change')"), /check constraint/);
    await assert.rejects(db.exec(`insert into event_response_edit_requests(event_id,rsvp_response_id,registration_id,requested_changes) values ('event','${rsvpId}','${registrationId}','Change')`), /check constraint/);
    await db.exec("update event_response_edit_requests set status='accepted';");await db.exec(insert);
    await db.exec("update event_response_edit_requests set status='declined' where status='pending';");await db.exec(insert);
    assert.deepEqual((await db.query('select status from event_response_edit_requests order by status')).rows.map(row => row.status), ['accepted', 'declined', 'pending']);
    await assert.rejects(db.exec("update event_response_edit_requests set status='invalid';"), /check constraint/);
    await db.exec('grant select on event_response_edit_requests to authenticated; set role authenticated;');
    assert.equal((await db.query('select * from event_response_edit_requests')).rows.length, 0, 'RLS prevents direct client access');
    await db.exec('reset role;');await db.exec(`delete from event_rsvp_responses where id='${rsvpId}';`);
    assert.equal((await db.query('select * from event_response_edit_requests')).rows.length, 0, 'Deleting a response cleans up its edit requests');
  } finally { await db.close(); }
  console.log('Event edit requests passed: tracked ownership, input validation, throttling, duplicate/concurrent requests, organizer permissions, scoped resolution, migration idempotence, private RLS and cascading cleanup.');
})().catch(error => { console.error(error);process.exitCode = 1; });
