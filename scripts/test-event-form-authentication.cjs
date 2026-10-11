/* eslint-disable @typescript-eslint/no-require-imports -- Exercise RSVP validation and permissions without Next.js. */
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
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, dependencies, cache);
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}

const jar = new Map();
const cookieStore = { get: name => jar.has(name) ? { value: jar.get(name) } : undefined, has: name => jar.has(name), set: (name, value) => jar.set(name, value), delete: ({ name }) => jar.delete(name) };
const tokens = load('src/lib/security/signed-token.ts');
const verification = load('src/lib/events/verification.ts', { 'server-only': {}, 'next/headers': { cookies: async () => cookieStore } });
let settings = { enabled: true, requireGoogle: true, allowAnonymous: true, questions: [] };
let registration = { id: 'registration', eventId: 'sample', email: 'ana@ust.edu.ph', affiliation: 'ust-student' };
const writes = [];
const evaluation = load('src/lib/events/evaluation-actions.ts', {
  'next/headers': { headers: async () => new Headers() }, 'next/cache': { revalidatePath: () => {} }, 'next/navigation': { unstable_rethrow: () => {} },
  '@/lib/auth/session': {}, '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({ insert: async row => { writes.push(row); return {}; } }) }) },
  '@/lib/security/rate-limit': { clientIp: () => 'test', limits: { eventRegister: {} }, rateLimit: () => ({ ok: true }) },
  './queries': { getEventForSite: async () => ({ id: 'sample' }) },
  './registrations': { findEventRegistrationByReference: async () => registration, getRegistration: async () => registration },
  './evaluation-store': { getEvaluationSettings: async () => settings, hasEvaluationResponse: async () => false },
  './verification': verification,
  './rsvp-emails': { acknowledgementEmail: () => ({}) }, '@/lib/notifications/notify': { sendAutomatic: async () => 'sent' },
});
(async () => {
  const validPass = await verification.createEventPass({ eventId: 'sample', email: 'ana@ust.edu.ph', firstName: 'Ana', lastName: 'Cruz' });
  jar.set(verification.EVENT_PASS_COOKIE, validPass);
  assert.equal((await verification.readEventPass('sample')).email, 'ana@ust.edu.ph');
  assert.equal(await verification.readEventPass('another-event'), null, 'A pass is bound to one event');
  jar.set(verification.EVENT_PASS_COOKIE, validPass + 'tampered');
  assert.equal(await verification.readEventPass('sample'), null, 'Forged passes are rejected');
  jar.set(verification.EVENT_PASS_COOKIE, await tokens.signJson('event-pass', { eventId: 'sample', email: 'ana@ust.edu.ph', expiresAt: Date.now() - 1 }));
  assert.equal(await verification.readEventPass('sample'), null, 'Expired verification is rejected');
  for (const target of ['register', 'rsvp-form', 'evaluate']) {
    await verification.startEventFlow('sample', target);
    assert.deepEqual(await verification.takeEventFlow(), { eventId: 'sample', target });
    assert.equal(await verification.takeEventFlow(), null, 'A callback consumes its flow');
  }
  jar.clear();
  const named = new FormData(); named.set('referenceCode', 'ABCDE'); named.set('evaluation_consent', 'yes');
  assert.match((await evaluation.checkEvaluationProfile('sample', named)).error, /Verify/);
  assert.match((await evaluation.submitEvaluation('sample', {}, named)).error, /Verify/);
  jar.set(verification.EVENT_PASS_COOKIE, await verification.createEventPass({ eventId: 'sample', email: 'other@ust.edu.ph', firstName: '', lastName: '' }));
  assert.match((await evaluation.submitEvaluation('sample', {}, named)).error, /Verify/);
  assert.equal(writes.length, 0, 'Mismatched verification cannot submit');
  jar.set(verification.EVENT_PASS_COOKIE, validPass);
  assert.equal((await evaluation.checkEvaluationProfile('sample', named)).alreadySubmitted, false);
  assert.equal((await evaluation.submitEvaluation('sample', {}, named)).success, true);
  const anonymous = new FormData(); anonymous.set('anonymous', 'on'); anonymous.set('evaluation_consent', 'yes');
  jar.clear();
  assert.match((await evaluation.submitEvaluation('sample', {}, anonymous)).error, /Verify/);
  jar.set(verification.EVENT_PASS_COOKIE, validPass);
  assert.equal((await evaluation.submitEvaluation('sample', {}, anonymous)).success, true);
  assert.equal(writes.at(-1).registration_id, null);
  assert.equal(writes.at(-1).anonymous, true);
  assert.equal('email' in writes.at(-1), false, 'Verification identity stays out of anonymous feedback');
  jar.clear(); registration = { ...registration, email: 'guest@example.com', affiliation: 'external' };
  assert.equal((await evaluation.submitEvaluation('sample', {}, named)).success, true, 'External participants can respond without a UST account');
  settings.requireGoogle = false;
  assert.equal((await evaluation.submitEvaluation('sample', {}, anonymous)).success, true, 'Disabling verification restores ordinary anonymous responses');
  console.log('Form authentication checks passed: signed passes, expiry, event isolation, callback targets, server enforcement, external access, and anonymous privacy.');
})().catch(error => { console.error(error); process.exitCode = 1; });
