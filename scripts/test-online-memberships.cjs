/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable -- Standalone CommonJS test runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => deps[name] ?? require(name), module, module.exports);
  return module.exports;
}
const email = 'dual@ust.edu.ph';
const central = { id: 'central-eb', email, name: 'Dual Member', affiliation: 'central', college: null, position: 'executive-board', kind: 'personal', role: 'Secretary', active: true };
const local = { ...central, id: 'local-rep', affiliation: 'local', college: 'Faculty of Pharmacy', role: 'Central Representative' };
const accounts = [central, local];
const rows = new Map();
const db = { from: () => {
  let filters = [];
  const query = {
    async upsert(row, options) { assert.equal(options.onConflict, 'account_id'); rows.set(row.account_id, row); return { error: null }; },
    select() { return this; }, eq(key, value) { filters.push(row => row[key] === value); return this; },
    gte(key, value) { filters.push(row => row[key] >= value); return this; }, order() { return this; }, limit() { return this; },
    then(resolve) { resolve({ data: [...rows.values()].filter(row => filters.every(filter => filter(row))), error: null }); },
    async maybeSingle() { return { data: [...rows.values()].find(row => filters.every(filter => filter(row))) ?? null, error: null }; },
  };
  return query;
} };
const presence = load('src/lib/portal/presence.ts');
const api = load('src/lib/portal/presence-store.ts', {
  'server-only': {}, '@/lib/applications/options': { unitAbbreviations: { 'Faculty of Pharmacy': 'PHARMA' } },
  '@/lib/data/accounts': { toSummary: account => account, describeRole: account => account.role },
  '@/lib/auth/session': { isBuiltInEmail: () => false, isLocal: account => account.affiliation === 'local', canSeeCollege: (viewer, college) => viewer.affiliation === 'central' || viewer.college === college },
  '@/lib/data/store': { store: { list: async () => accounts, get: async (_, id) => accounts.find(account => account.id === id) ?? null } },
  '@/lib/data/types': { accountAffiliations: { central: 'Central Comelec', local: 'Local Comelec' }, accountPositions: { 'executive-board': 'Executive Board' } },
  '@/lib/security/signed-token': { signature: async (_, payload) => payload + '-secret' },
  '@/lib/supabase/server': { createAdminClient: () => db }, './presence': presence,
});
(async () => {
  const first = await api.checkIn(central);
  const second = await api.checkIn(local);
  assert.equal(rows.size, 2, 'Checking in Local must not overwrite Central');
  assert.equal(second.people.length, 2);
  assert.deepEqual(second.people.filter(person => person.you).map(person => person.accountId), ['local-rep']);
  assert.notEqual(first.realtime.inbox, second.realtime.inbox);
  assert.notEqual(first.realtime.me, second.realtime.me);
  assert.equal(second.people.find(person => person.accountId === 'central-eb').role, 'Secretary');
  assert.equal(second.people.find(person => person.accountId === 'local-rep').collegeAbbreviation, 'PHARMA');
  assert.equal((await api.presenceProfile(central, 'central-eb')).role, 'Secretary');
  assert.equal((await api.presenceProfile(central, 'local-rep')).role, 'Central Representative');
  assert.equal((await api.presenceProfile(local, 'central-eb')).role, 'Secretary', 'A person can view their own other membership');
  assert.deepEqual(await api.unitRecipients(central), ['central-eb']);
  assert.deepEqual(await api.unitRecipients(local), ['local-rep']);
  assert.equal((await api.findOnline('central-eb')).account_id, 'central-eb');
  local.active = false;
  assert.equal(await api.findOnline('local-rep'), null);
  assert.ok(await api.findOnline('central-eb'), 'Revoking Local must not revoke Central');
  console.log('Dual memberships: distinct rows, profiles, presence IDs, inboxes, unit delivery and independent revocation passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
