const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, deps = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => deps[name] ?? require(name), module, module.exports);
  return module.exports;
}
const presence = load('src/lib/portal/presence.ts');
const user = { id: 'sender-account', email: 'sender@ust.edu.ph', affiliation: 'local', college: 'College of Science' };
const unit = presence.presenceUnit(user);
assert.notEqual(unit.key, presence.presenceUnit({ ...user, college: 'Arts' }).key);
assert.notEqual(unit.key, presence.presenceUnit({ ...user, affiliation: 'central' }).key);
const accounts = [
  { ...user, id: 'same', email: 'same@ust.edu.ph', active: true },
  { ...user, id: 'other', email: 'other@ust.edu.ph', active: true, college: 'Arts' },
  { ...user, id: 'revoked', email: 'revoked@ust.edu.ph', active: false },
  { ...user, id: 'central', email: 'central@ust.edu.ph', active: true, affiliation: 'central' },
];
const rows = accounts.map(account => ({ email: account.email, account_id: account.id }));
rows.push({ email: 'deleted@ust.edu.ph', account_id: 'missing' }, { email: 'spoofed@ust.edu.ph', account_id: 'same' });
let cutoff;
const query = { select() { return this; }, gte(column, value) { cutoff = value; return this; }, then(resolve) { resolve({ data: rows, error: null }); } };
const { unitRecipients } = load('src/lib/portal/presence-store.ts', {
  '@/lib/applications/options': { unitAbbreviations: {} },
  'server-only': {}, '@/lib/data/accounts': { toSummary: account => account },
  '@/lib/auth/session': { isBuiltInEmail: () => false },
  '@/lib/data/store': { store: { list: async () => accounts } }, '@/lib/data/types': {},
  '@/lib/security/signed-token': {}, '@/lib/supabase/server': { createAdminClient: () => ({ from: () => query }) }, './presence': presence,
});
let signedIn = user;
let delivered = [];
const { POST } = load('src/app/(portal)/portal/(dashboard)/online/relay/route.ts', {
  'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
  '@/lib/auth/session': { getPortalUser: async () => signedIn },
  '@/lib/portal/presence': presence,
  '@/lib/portal/presence-store': { senderOf: async value => ({ ...value, accountId: value.id, id: 'sender', name: 'Sender' }), inboxTopic: async email => `private:${email}`, unitRecipients },
  '@/lib/portal/realtime-relay': { broadcast: async (topics, event) => delivered.push({ topics, event }) },
  '@/lib/security/rate-limit': { rateLimit: () => ({ ok: true }) },
  '@/lib/portal/online-security': load('src/lib/portal/online-security.ts'),
});
const send = body => POST(new Request('https://portal.example/portal/online/relay', { method: 'POST', headers: { origin: 'https://portal.example', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
(async () => {
  assert.deepEqual(await unitRecipients(user), ['sender-account', 'same']);
  assert.ok(Date.now() - Date.parse(cutoff) <= presence.ONLINE_WINDOW_MS + 1000, 'Only recent online members are selected');
  const body = { kind: 'unit-chat', to: unit.key, text: 'Hello unit', messageId: 'message-123' };
  assert.equal((await send({ ...body, to: 'unit:central' })).status, 403);
  assert.equal(delivered.length, 0);
  assert.equal((await send({ ...body, text: '' })).status, 400);
  assert.equal((await send(body)).status, 200);
  assert.deepEqual(delivered[0].topics, ['private:sender-account', 'private:same']);
  assert.equal(delivered[0].event.from.email, user.email);
  assert.equal(delivered[0].event.to, unit.key);
  signedIn = null;
  assert.equal((await send(body)).status, 401);
  console.log('Unit chat: college isolation, active memberships, inbox delivery, authenticated sender, and foreign-group rejection passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
