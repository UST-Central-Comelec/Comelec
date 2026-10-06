/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/lib/notifications/inbox-rules.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', source)(compiled.exports);
const { canAnnounce, canBroadcast, announcementRecipients } = compiled.exports;
const local = { kind: 'official', affiliation: 'local', college: 'CICS', position: 'executive-board', readOnly: false, builtIn: false };
const central = { ...local, affiliation: 'central', college: null };
const personal = { ...local, kind: 'personal' };
const accounts = [
  { id: 'own', active: true, kind: 'personal', affiliation: 'local', college: 'CICS', position: 'deputy' },
  { id: 'other', active: true, kind: 'personal', affiliation: 'local', college: 'Science', position: 'executive-associate' },
  { id: 'central', active: true, kind: 'personal', affiliation: 'central', college: null, position: 'executive-board' },
  { id: 'unit', active: true, kind: 'official', affiliation: 'local', college: 'CICS', position: 'executive-board' },
  { id: 'inactive', active: false, kind: 'personal', affiliation: 'local', college: 'CICS', position: 'deputy' },
  { id: 'adviser', active: true, kind: 'personal', affiliation: 'local', college: 'CICS', position: 'adviser' },
  { id: 'admin', active: true, kind: 'personal', affiliation: 'osa', college: null, position: 'admin' },
];
assert.equal(canAnnounce(local), true);
assert.equal(canBroadcast(local), false);
assert.equal(canAnnounce(personal), false);
assert.equal(canBroadcast(central), true);
assert.equal(canAnnounce({ ...central, readOnly: true }), false);
assert.deepEqual(announcementRecipients(local, 'unit', accounts), ['own', 'unit']);
assert.deepEqual(announcementRecipients(local, 'all', accounts), []);
assert.deepEqual(announcementRecipients(personal, 'unit', accounts), []);
assert.deepEqual(announcementRecipients({ ...local, college: null }, 'unit', accounts), []);
assert.deepEqual(announcementRecipients(central, 'unit', accounts), ['central']);
assert.deepEqual(announcementRecipients(central, 'all', accounts), ['own', 'other', 'central', 'unit']);
console.log('Inbox sender authorization and recipient isolation checks passed.');

// A forged message ID must never create a read receipt for another account's message.
const storageModule = { exports: {} };
const storageSource = ts.transpileModule(fs.readFileSync('src/lib/notifications/inbox-store.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let allowed = false;
let writes = 0;
const dependencies = {
  'server-only': {},
  '@/lib/auth/session': { BUILT_IN_ID: 'built-in' },
  '@/lib/data/accounts': { toSummary: (row) => row },
  '@/lib/data/store': { store: {} },
  '@/lib/supabase/config': { isSupabaseConfigured: () => true },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: (table) => {
    if (table === 'portal_message_reads') return { upsert: async (row) => {
      assert.equal(row.account_id, 'own'); writes++; return { error: null };
    } };
    const query = {
      select: () => query,
      eq: () => query,
      contains: (column, ids) => { assert.equal(column, 'recipient_ids'); assert.deepEqual(ids, ['own']); return query; },
      maybeSingle: async () => ({ data: allowed ? { id: 'message' } : null, error: null }),
    };
    return query;
  } }) },
};
new Function('require', 'module', 'exports', storageSource)((name) => {
  if (Object.hasOwn(dependencies, name)) return dependencies[name];
  throw new Error(`Unexpected dependency: ${name}`);
}, storageModule, storageModule.exports);
(async () => {
  await assert.rejects(storageModule.exports.markMessageRead({ id: 'own' }, 'message'), /unavailable/);
  assert.equal(writes, 0);
  allowed = true;
  await storageModule.exports.markMessageRead({ id: 'own' }, 'message');
  assert.equal(writes, 1);
  console.log('Notification read ownership checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
