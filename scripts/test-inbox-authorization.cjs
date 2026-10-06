/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = { exports: {} };
const source = ts.transpileModule(fs.readFileSync('src/lib/notifications/inbox-rules.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', source)(compiled.exports);
const { canAnnounce, canBroadcast, announcementRecipients } = compiled.exports;
const presentationModule = { exports: {} };
const presentationSource = ts.transpileModule(fs.readFileSync('src/lib/notifications/inbox-presentation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const optionsModule = { exports: {} };
const optionsSource = ts.transpileModule(fs.readFileSync('src/lib/applications/options.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const typesModule = { exports: {} };
const typesSource = ts.transpileModule(fs.readFileSync('src/lib/data/types.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('exports', typesSource)(typesModule.exports);
const rolesModule = { exports: {} };
const rolesSource = ts.transpileModule(fs.readFileSync('src/lib/data/local-roles.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function('require', 'exports', rolesSource)((name) => {
  assert.equal(name, './types');
  return typesModule.exports;
}, rolesModule.exports);
new Function('require', 'exports', optionsSource)((name) => {
  if (name === '@/lib/data/types') return typesModule.exports;
  assert.equal(name, '@/lib/data/local-roles');
  return rolesModule.exports;
}, optionsModule.exports);
new Function('require', 'exports', presentationSource)((name) => {
  assert.equal(name, '@/lib/applications/options');
  return optionsModule.exports;
}, presentationModule.exports);
const { announcementLogo, recipientMention, senderLabel } = presentationModule.exports;
assert.equal(senderLabel({ senderAffiliation: 'central', senderName: 'Official account' }), 'CENTRAL');
assert.equal(senderLabel({ senderAffiliation: 'local', senderCollege: 'College of Information and Computing Sciences', senderName: 'Official account' }), 'CICS');
assert.equal(senderLabel({ senderAffiliation: 'local', senderCollege: 'Faculty of Pharmacy', senderName: 'Official account' }), 'PHARMA');
assert.equal(senderLabel({ senderAffiliation: 'local', senderCollege: 'CICS', senderName: 'Central Representative' }), 'CICS');
assert.equal(senderLabel({ senderName: 'Local Comelec · CICS' }), 'CICS');
assert.equal(senderLabel({ senderName: 'Central Comelec COMET' }), 'CENTRAL');
assert.equal(announcementLogo({ senderAffiliation: 'central', senderName: 'Official account' }), '/images/central-comelec-logo.png');
assert.equal(announcementLogo({ senderAffiliation: 'local', senderCollege: 'CICS', senderName: 'Central Representative' }), null);
assert.equal(announcementLogo({ senderName: 'Central Comelec' }), '/images/central-comelec-logo.png');
assert.equal(announcementLogo({ senderName: 'Local Comelec · CICS' }), null);
assert.equal(recipientMention({ audienceLabel: 'All units and commissioners' }), '@everyone');
assert.equal(recipientMention({ audienceLabel: 'Central Comelec commissioners' }), '@Central Comelec');
assert.equal(recipientMention({ audienceLabel: 'All units', recipientMention: '@Deputies' }), '@Deputies');
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
let unreadScoped = false;
let selectedKind;
let selectedStatus;
let deletionAllowed = false;
const dependencies = {
  'server-only': {},
  '@/lib/auth/session': { BUILT_IN_ID: 'built-in' },
  '@/lib/data/accounts': { toSummary: (row) => row },
  '@/lib/data/store': { store: {} },
  '@/lib/supabase/config': { isSupabaseConfigured: () => true },
  '@/lib/supabase/server': { createAdminClient: () => ({ rpc: async (name, parameters) => {
    assert.equal(name, 'delete_inbox_announcement');
    assert.deepEqual(parameters, { message_id: 'message', recipient_id: 'own' });
    return { data: deletionAllowed, error: null };
  }, from: (table) => {
    if (table === 'portal_message_reads') return { upsert: async (row) => {
      assert.equal(row.account_id, 'own'); writes++; return { error: null };
    } };
    const query = {
      select: () => query,
      eq: (column, value) => {
        if (column === 'portal_message_reads.account_id') { assert.equal(value, 'own'); unreadScoped = true; }
        if (column === 'kind') selectedKind = value;
        return query;
      },
      contains: (column, ids) => { assert.equal(column, 'recipient_ids'); assert.deepEqual(ids, ['own']); return query; },
      is: (column, value) => { assert.equal(column, 'portal_message_reads'); assert.equal(value, null); assert.equal(unreadScoped, true); selectedStatus = 'unread'; return query; },
      not: (column, operator, value) => { assert.equal(column, 'portal_message_reads'); assert.equal(operator, 'is'); assert.equal(value, null); assert.equal(unreadScoped, true); selectedStatus = 'read'; return query; },
      then: (resolve) => resolve({ count: 47, error: null }),
      order: () => query,
      range: async (from, to) => { assert.equal(from, 60); assert.equal(to, 89); return { data: [], error: null }; },
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
  assert.equal(await storageModule.exports.getInboxUnreadCount({ id: 'own' }), 47);
  await storageModule.exports.getInbox({ id: 'own' }, 'announcement', 2);
  assert.equal(selectedKind, 'announcement');
  selectedKind = undefined;
  await storageModule.exports.getInbox({ id: 'own' }, undefined, 2);
  assert.equal(selectedKind, undefined);
  unreadScoped = false;
  await storageModule.exports.getInbox({ id: 'own' }, undefined, 2, 'read');
  assert.equal(selectedStatus, 'read');
  assert.equal(selectedKind, undefined);
  unreadScoped = false;
  await storageModule.exports.getInbox({ id: 'own' }, undefined, 2, 'unread');
  assert.equal(selectedStatus, 'unread');
  assert.equal(selectedKind, undefined);
  console.log('Full-history unread scoping and paginated Inbox filter checks passed.');
  await assert.rejects(storageModule.exports.deleteInboxAnnouncement({ id: 'own' }, 'message'), /unavailable/);
  deletionAllowed = true;
  await storageModule.exports.deleteInboxAnnouncement({ id: 'own' }, 'message');
  console.log('Announcement deletion uses the authenticated recipient and rejects unavailable copies.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
