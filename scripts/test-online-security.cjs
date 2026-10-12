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
const { isSameSiteRequest } = load('src/lib/portal/online-security.ts');
const request = headers => new Request('https://portal.example/portal/online', { method: 'POST', headers });
assert.equal(isSameSiteRequest(request({ origin: 'https://evil.example' })), false);
assert.equal(isSameSiteRequest(request({ origin: 'https://portal.example', 'sec-fetch-site': 'cross-site' })), false);
assert.equal(isSameSiteRequest(request({ origin: 'https://portal.example' })), true);
assert.equal(isSameSiteRequest(request({ 'sec-fetch-site': 'same-origin' })), true);
assert.equal(isSameSiteRequest(request({})), false);
let presence = { account_id: 'local-account', email: 'person@ust.edu.ph', avatar_url: 'https://lh3.googleusercontent.com/avatar' };
let account = { id: 'local-account', email: presence.email, name: 'Person', active: true, college: 'Science', affiliation: 'local', position: 'deputy', role: 'Deputy', privateNotes: 'Never return this' };
const query = { select() { return this; }, eq() { return this; }, gte() { return this; }, async maybeSingle() { return { data: presence, error: null }; } };
const { presenceProfile, findOnline } = load('src/lib/portal/presence-store.ts', {
  'server-only': {},
  '@/lib/applications/options': { unitAbbreviations: {} },
  '@/lib/data/accounts': { toSummary: value => value, describeRole: value => value.role },
  '@/lib/auth/session': { isLocal: value => value.affiliation === 'local', isBuiltInEmail: () => false, canSeeCollege: (viewer, college) => viewer.affiliation !== 'local' || viewer.college === college },
  '@/lib/data/store': { store: { get: async () => account } },
  '@/lib/data/types': { accountPositions: { deputy: 'Deputy' }, accountAffiliations: { local: 'Local Comelec' } },
  '@/lib/security/signed-token': { signature: async () => 'opaque' },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: () => query }) },
  './presence': load('src/lib/portal/presence.ts'),
});
(async () => {
  const central = { affiliation: 'central', email: 'viewer@ust.edu.ph' };
  const profile = await presenceProfile(central, account.id);
  assert.deepEqual(Object.keys(profile).sort(), ['avatarUrl', 'college', 'email', 'name', 'position', 'role', 'unit']);
  assert.equal(profile.avatarUrl, presence.avatar_url);
  assert.equal(profile.unit, 'Local Comelec');
  account.kind = 'official';
  assert.equal((await presenceProfile(central, account.id)).role, 'Official Account');
  account.affiliation = 'central';
  assert.equal((await presenceProfile(central, account.id)).college, 'University of Santo Tomas');
  account.kind = 'personal';
  account.affiliation = 'local';
  assert.ok(await presenceProfile({ email: central.email, affiliation: 'local', college: 'Science' }, account.id));
  assert.equal(await presenceProfile({ email: central.email, affiliation: 'local', college: 'Arts' }, account.id), null);
  assert.equal(await presenceProfile({ email: central.email, affiliation: 'local', college: null }, account.id), null);
  account.active = false;
  assert.equal(await presenceProfile(central, account.id), null);
  assert.equal(await findOnline(account.id), null);
  account.active = true;
  assert.ok(await findOnline(account.id));
  account.email = 'different@ust.edu.ph';
  assert.equal(await presenceProfile(central, presence.account_id), null);
  assert.equal(await findOnline(presence.account_id), null);
  presence = null;
  assert.equal(await presenceProfile(central, 'local-account'), null);
  console.log('Online security: origin checks, college scope, field allowlist, revoked accounts and stale membership checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
