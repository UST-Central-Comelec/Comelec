/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test harness. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const moduleUnderTest = { exports: {} };
let calls = [];
let failedInbox = false;
let failedCommissionRequests = false;
const codes = { constitution: { tab: 'charters/constitution' }, 'magna-carta': { tab: 'charters/magna-carta' } };
const revisions = [
  { status: 'pending', approvals: {}, code: 'constitution' },
  { status: 'pending', approvals: { Chairperson: {} }, code: 'magna-carta' },
  { status: 'draft', returned: {}, code: 'constitution' },
  { status: 'draft', returned: null, code: 'magna-carta' },
];
const imports = {
  'server-only': {},
  '@/lib/auth/session': { canOpen: (user, tab) => user.tabs.includes(tab) },
  '@/lib/applications/views': { getUnseenApplicantCount: async () => { calls.push('applicants'); return 3; } },
  '@/lib/notifications/inbox-store': { getInboxUnreadCount: async () => { calls.push('inbox'); if (failedInbox) throw Error('Unavailable'); return 2; } },
  '@/lib/access-requests/admin': { listPendingAccessRequests: async () => [{ college: 'CICS' }, { college: 'COS' }] },
  '@/lib/codes/options': { codes, approverRoleOf: user => user.office, canEditCodes: user => user.editor },
  '@/lib/codes/store': { listRevisions: async filter => revisions.filter(row => row.status === filter.status) },
  '@/lib/events/queries': { getEvents: async () => [{ id: 'own', college: 'CICS', changeRequest: 'Fix' }, { id: 'other', college: 'COS', changeRequest: 'Fix' }] },
  '@/lib/events/access': { canManageEvent: (user, event) => user.affiliation !== 'local' || user.college === event.college },
  '@/lib/events/options': { requestKinds: { venue: {} } },
  '@/lib/supabase/config': { isSupabaseConfigured: () => true },
  './account-scope': { canDecideRequest: (user, request) => user.affiliation !== 'local' || user.college === request.college },
  '@/lib/supabase/server': { createAdminClient: () => ({ rpc: async (name, args) => { calls.push({ rpc: name, args }); return { data: [{ event_id: 'own', pending: 1 }] }; }, from(table) {
    const filters = {};
    const query = { select() { return this; }, is() { return this; }, eq(key, value) { filters[key] = value; return this; }, in(key, value) { filters[key] = value; return this; }, order() { return this; }, range() { return this; }, then(resolve) {
      calls.push({ table, filters });
      if (table === 'commission_requests' && failedCommissionRequests) return Promise.resolve({ error: { message: 'Not migrated yet' } }).then(resolve);
      if (table === 'filing_requests' || table === 'commission_requests') return Promise.resolve({ count: table === 'filing_requests' ? 2 : 3 }).then(resolve);
      return Promise.resolve(table === 'party_registrations' ? { count: filters.college ? 1 : 2 } : { data: [{ requests: { venue: { status: 'pending' }, bogus: { status: 'pending' } } }, { requests: { venue: { status: 'approved' } } }] }).then(resolve);
    } }; return query;
  } }) },
};
const source = ts.transpileModule(fs.readFileSync('src/lib/portal/attention.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', source)(name => { if (!(name in imports)) throw Error(name); return imports[name]; }, moduleUnderTest, moduleUnderTest.exports);
(async () => {
  const get = moduleUnderTest.exports.getPortalAttention;
  const user = { tabs: ['recruitment/applications', 'apps/inbox', 'accounts', 'polpar/registrations', 'documents/approval', 'charters/constitution', 'charters/magna-carta', 'events'], affiliation: 'central', college: null, office: 'Chairperson', editor: true };
  assert.deepEqual(await get(user), { 'recruitment/applications': 3, 'apps/inbox': 2, accounts: 2, 'polpar/registrations': 2, 'documents/approval': 1, 'charters/constitution': 1, 'charters/magna-carta': 0, events: 3 });
  calls = [];
  const local = await get({ ...user, affiliation: 'local', college: 'CICS', editor: false, office: null });
  assert.equal(local.accounts, 1);
  assert.equal(local.events, 2);
  assert.equal(local['polpar/registrations'], 1);
  assert.deepEqual(calls.find(call => call.rpc === 'event_pending_request_counts').args, { p_kinds: ['venue'] });
  assert.equal(local['documents/approval'], undefined);
  calls = [];
  assert.deepEqual(await get({ ...user, tabs: [] }), {});
  assert.equal(calls.length, 0, 'Hidden tabs never query their data');
  assert.deepEqual(await get({ ...user, readOnly: true }), { 'recruitment/applications': 3, 'apps/inbox': 2 }, 'Viewers receive unread counts without action queues');
  failedInbox = true;
  const partial = await get(user);
  assert.equal(partial['apps/inbox'], undefined);
  assert.equal(partial.accounts, 2, 'One failed queue cannot hide other badges');
  const requestsUser = { ...user, tabs: ['request'] };
  assert.equal((await get(requestsUser)).request, 5);
  calls = [];
  assert.equal((await get({ ...requestsUser, affiliation: 'local', college: 'CICS' })).request, 5);
  assert.ok(calls.filter(call => call.table === 'filing_requests' || call.table === 'commission_requests').every(call => call.filters.college === 'CICS'));
  failedCommissionRequests = true;
  assert.equal((await get(requestsUser)).request, 2, 'An unapplied internal-request migration preserves existing filing approval badges');
  console.log('Portal attention checks passed: access, unit scope, signing roles, read-only accounts, and independent queue failures.');
})().catch(error => { console.error(error); process.exitCode = 1; });
