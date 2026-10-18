/* eslint-disable @typescript-eslint/no-require-imports -- Isolated commission request action and database checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, dependencies);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`), dependencies);
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const rules = load('src/lib/portal/commission-requests.ts');
const typeId = '11111111-1111-4111-8111-111111111111';
let user = { name: 'COMMISSIONER', email: 'commissioner@ust.edu.ph', affiliation: 'central', college: null, readOnly: false, tabs: ['request', 'request/create', 'request/settings'] };
const units = ['Arts', 'Science'];
let types = [{ id: typeId, name: 'Consultation', enabled: true }], writes = [], notices = [], duplicate = false, typeSaved = true, answerSaved = true;
let request = { id: 'request', sender_email: user.email, college: 'Arts', status: 'requested', updated_at: 'original' };
const actions = load('src/lib/portal/commission-request-actions.ts', {
  'next/cache': { revalidatePath: () => {} }, 'next/navigation': { unstable_rethrow: () => {} },
  '@/lib/auth/session': { requireEditor: async tab => { if (user.readOnly || !user.tabs.includes(tab)) throw Error('Access denied'); return user; } },
  '@/lib/applications/options': { comelecUnits: units }, '@/lib/reference/store': { ensureReferenceData: async () => {} },
  '@/lib/filing-portal/services': { manilaInstant: (date, time) => Date.parse(`${date}T${time}:00+08:00`), MAX_ACTIVITY_HOURS: 12 },
  './commission-requests-store': {
    listCommissionRequestTypes: async () => types,
    writeCommissionRequests: async rows => { writes.push(rows); return duplicate ? { duplicate: true } : { requests: rows.map((row, index) => ({ ...row, id: String(index) })) }; },
    writeCommissionRequestType: async (...args) => { writes.push(args); return typeSaved; },
    getCommissionRequest: async () => request,
    answerCommissionRequest: async (...args) => { writes.push(args); return answerSaved ? { ...request, status: args[2] } : null; },
  },
  './commission-request-notify': { notifyCommissionRequest: (...args) => notices.push(args) },
});
function form(changes = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ type: typeId, recipient: 'all', subject: 'Election briefing', details: 'Please send a commissioner.', mode: 'online', venue: 'Commission meeting link', date: '2099-01-05', start: '09:00', end: '10:00', submission: '22222222-2222-4222-8222-222222222222', ...changes })) data.set(key, value);
  return data;
}
(async () => {
  assert.ok((await actions.createCommissionRequest({}, form())).sent);
  assert.deepEqual(writes.at(-1).map(row => row.college), units);
  assert.ok(writes.at(-1).every(row => row.sender_email === user.email && row.type_name === 'Consultation'));
  assert.equal(notices.length, 2);
  assert.ok((await actions.createCommissionRequest({}, form({ recipient: 'Arts', sender_email: 'forged@ust.edu.ph' }))).sent);
  assert.equal(writes.at(-1).length, 1); assert.equal(writes.at(-1)[0].sender_email, user.email);
  units.push('Commerce'); await actions.createCommissionRequest({}, form()); assert.equal(writes.at(-1).length, 3, 'All units follows the live reference list');
  let before = writes.length;
  for (const change of [{ recipient: 'Unknown' }, { end: '08:00' }, { date: '2000-01-05' }, { date: '2099-02-30' }, { subject: '' }, { submission: 'forged' }, { type: 'forged' }]) assert.ok((await actions.createCommissionRequest({}, form(change))).error);
  types[0].enabled = false; assert.ok((await actions.createCommissionRequest({}, form())).error); types[0].enabled = true;
  assert.equal(writes.length, before, 'Invalid and disabled request types never write');
  duplicate = true; before = notices.length; assert.ok((await actions.createCommissionRequest({}, form())).sent); assert.equal(notices.length, before, 'Retries do not email twice'); duplicate = false;
  user.readOnly = true; await assert.rejects(actions.createCommissionRequest({}, form()), /Access denied/); user.readOnly = false;
  user.tabs = ['request']; await assert.rejects(actions.createCommissionRequest({}, form()), /Access denied/); user.tabs.push('request/create', 'request/settings');
  const settings = new FormData(); settings.set('name', 'Document review'); settings.set('description', 'Review a document'); settings.set('enabled', 'on');
  assert.ok((await actions.saveCommissionRequestType(null, '', {}, settings)).sent);
  typeSaved = false; assert.match((await actions.saveCommissionRequestType(typeId, 'old', {}, settings)).error, /Someone changed/); typeSaved = true;
  user.affiliation = 'local'; user.college = 'Science'; before = writes.length;
  assert.ok((await actions.saveCommissionRequestType(null, '', {}, settings)).error); assert.equal(writes.length, before, 'Local accounts cannot manage shared types');
  const decision = new FormData(); decision.set('decision', 'confirmed');
  assert.ok((await actions.answerCommissionRequestAction('request', 'original', {}, decision)).error); assert.equal(writes.length, before, 'One Local unit cannot answer another unit’s request');
  assert.ok(rules.canReadCommissionRequest(user, request), 'The sender can read a request sent to another unit');
  assert.equal(rules.canReadCommissionRequest({ ...user, email: 'other@ust.edu.ph' }, request), false);
  user.college = 'Arts'; assert.ok((await actions.answerCommissionRequestAction('request', 'original', {}, decision)).sent);
  answerSaved = false; assert.match((await actions.answerCommissionRequestAction('request', 'old', {}, decision)).error, /changed/); answerSaved = true;
  decision.set('decision', 'declined'); assert.ok((await actions.answerCommissionRequestAction('request', 'original', {}, decision)).fieldErrors.response);
  decision.set('response', 'No commissioner is available.'); assert.ok((await actions.answerCommissionRequestAction('request', 'original', {}, decision)).sent);
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const migration = fs.readFileSync('supabase/migrations/20261018155022_commission_requests.sql', 'utf8');
    await db.exec(migration); await db.exec(migration);
    assert.equal((await db.query('select * from commission_request_types')).rows.length, 2, 'Seed is idempotent');
    const type = (await db.query('select id from commission_request_types limit 1')).rows[0].id;
    const batch = '33333333-3333-4333-8333-333333333333';
    const insert = college => `('${batch}','${type}','Consultation','sender@ust.edu.ph','COMMISSIONER','${college}','Test','Please attend','2099-01-05 09:00+08','2099-01-05 10:00+08','online','Meeting link')`;
    const prefix = 'insert into commission_requests(batch_id,type_id,type_name,sender_email,sender_name,college,subject,details,starts_at,ends_at,mode,venue) values ';
    await db.exec(prefix + [insert('Arts'), insert('Science')].join(','));
    assert.equal((await db.query('select count(distinct reference)::int as count from commission_requests')).rows[0].count, 2);
    await assert.rejects(db.exec(prefix + [insert('Commerce'), insert('Arts')].join(',')), /unique constraint/);
    assert.equal((await db.query('select count(*)::int as count from commission_requests')).rows[0].count, 2, 'Batch insert rolls back entirely on conflict');
    const first = (await db.query('select id,updated_at from commission_requests limit 1')).rows[0];
    assert.equal((await db.query("update commission_requests set status='confirmed',updated_at=now() where id=$1 and updated_at=$2 returning id", [first.id, first.updated_at])).rows.length, 1);
    assert.equal((await db.query("update commission_requests set status='declined' where id=$1 and updated_at=$2 returning id", [first.id, first.updated_at])).rows.length, 0, 'Stale decisions cannot overwrite');
    await assert.rejects(db.exec("update commission_requests set ends_at=starts_at"), /check constraint/);
    await db.exec("update commission_request_types set name='Renamed' where id='" + type + "'");
    assert.ok((await db.query('select type_name from commission_requests')).rows.every(row => row.type_name === 'Consultation'), 'Type labels preserve historical requests');
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of ['commission_requests', 'commission_request_types']) {
        await assert.rejects(db.exec(`select * from ${table}`), /permission denied/);
        await assert.rejects(db.exec(`update ${table} set updated_at=now()`), /permission denied/);
      }
      await db.exec('reset role');
    }
    assert.ok((await db.query("select relrowsecurity from pg_class where relname in ('commission_requests','commission_request_types')")).rows.every(row => row.relrowsecurity));
  } finally { await db.close(); }
  console.log('Commission requests passed: live units, single/all recipients, trusted sender, validation, disabled types, duplicate sends, permissions, scoped replies, conflicts, historical types, migration idempotence, atomic batches, and private RLS.');
})().catch(error => { console.error(error); process.exitCode = 1; });
