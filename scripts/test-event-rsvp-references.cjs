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
    if (name.startsWith('@/')) { const target = `src/${name.slice(2)}.ts`; return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}

const { PGlite } = require('@electric-sql/pglite');
const rsvp = load('src/lib/events/rsvp.ts');
const reference = load('src/lib/applications/reference.ts');
const definition = rsvp.defaultRsvpDefinition;
let row = { id: 'id', event_id: 'sample', reference_code: 'RS-7K3M-9QXA', created_at: '2026-10-13T00:00:00Z', answers: { version: 2, definition, values: { rsvp_first_name: 'ANA', rsvp_middle_name: 'MARIA', rsvp_last_name: 'DELA CRUZ', rsvp_logistics: ['I have dietary restrictions'] } } };
let databaseError = false;
const store = load('src/lib/events/rsvp-store.ts', {
  'server-only': {},
  '@/lib/supabase/config': { isSupabaseConfigured: () => true },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: (field, code) => ({ maybeSingle: async () => ({ data: row?.reference_code === code ? row : null, error: databaseError ? { message: 'Unavailable' } : null }) }) }) }) }) },
});
let limited = false;
let configured = true;
const dependencies = {
  "@/lib/events/edit-requests": { pendingEventEditRequest: async () => null },
  'next/headers': { headers: async () => new Headers() },
  '@/lib/forms/input': load('src/lib/forms/input.ts'),
  '@/lib/portal/form': { text: (form, key) => String(form.get(key) ?? '').trim() },
  '@/lib/security/rate-limit': { clientIp: () => 'test', limits: { track: { limit: 10, windowMs: 1000 } }, rateLimit: () => ({ ok: !limited, retryAfter: 60 }) },
  '@/lib/supabase/config': { isSupabaseConfigured: () => configured },
  '@/lib/events/rsvp-store': store,
  '@/lib/events/rsvp': rsvp,
  '@/lib/events/queries': { getEvent: async () => ({ id: 'sample', name: 'Sample event' }) },
  '@/lib/events/format': { formatEventDates: () => 'October 13, 2026' },
  '@/lib/events/options': load('src/lib/events/options.ts'),
  './reference': reference,
  './schema': { applicationFields: { shape: {} } },
};
// Other imported server capabilities aren't used by the RSVP tracking path.
const source = ts.transpileModule(fs.readFileSync('src/lib/applications/actions.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const compiled = { exports: {} };
new Function('require', 'module', 'exports', source)(name => dependencies[name] ?? {}, compiled, compiled.exports);
const track = async (code, surname) => { const form = new FormData(); form.set('reference', code); form.set('identity', surname); return compiled.exports.trackApplication(undefined, form); };
const emails = load('src/lib/events/rsvp-emails.ts', {
  'server-only': {},
  '@/lib/email/template': { siteUrl: () => 'https://example.com', escape: load("src/lib/email/template.ts", { "server-only": {} }).escape, paragraph: text => `<p>${text}</p>`, button: (label, href) => `<a href="${href}">${label}</a>`, shell: ({ blocks }) => blocks.join('') },
});
(async () => {
  assert.deepEqual(reference.parseReferenceCode('rs 7k3m 9qxa'), { prefix: 'RS', code: 'RS-7K3M-9QXA' });
  assert.equal(reference.parseReferenceCode('CC-7K3M-9QXA').prefix, 'CC');
  assert.equal(reference.parseReferenceCode('PA-7K3M-9QXA').prefix, 'PA');
  const receipt = emails.acknowledgementEmail('ana@example.com', rsvp.rsvpAcknowledgement, { id: 'sample', name: 'Sample event' }, 'ANA', 'Collaborator RSVP', row.reference_code);
  const responseReceipt = emails.acknowledgementEmail('ana@example.com', rsvp.rsvpAcknowledgement, { id: 'sample', name: 'Sample event' }, 'ANA', 'Collaborator RSVP', row.reference_code, [['Additional participants', '10-20'], ['Organization', '<Example & Co>']]);
  assert.match(responseReceipt.text, /Your response[\s\S]*Additional participants: 10-20/);
  assert.match(responseReceipt.html, /&lt;Example &amp; Co&gt;/, 'Response values are escaped in email HTML');
  assert.ok(!responseReceipt.html.includes('<Example & Co>'));

  assert.match(receipt.text, /RS-7K3M-9QXA/);
  assert.match(receipt.text, /https:\/\/example.com\/apply\/track\?ref=RS-7K3M-9QXA/);
  assert.match(receipt.html, /Track RSVP/);
  assert.equal(await store.findRsvpByReference(row.reference_code, 'wrong surname'), null);
  assert.equal(await store.findRsvpByReference(row.reference_code, ' dela   cruz '), row);
  assert.equal((await track(row.reference_code, 'wrong surname')).rsvp, undefined);
  assert.ok((await track('RS-AAAA-BBBB', 'DELA CRUZ')).error);
  assert.ok((await track(row.reference_code, '2026123456')).fieldErrors.identity);
  const result = await track(row.reference_code.toLowerCase(), 'dela cruz');
  assert.equal(result.rsvp.name, 'ANA MARIA DELA CRUZ');
  assert.deepEqual(result.rsvp.requests, ['I have dietary restrictions']);
  assert.equal('answers' in result.rsvp, false, 'Private answers never reach the tracking client');
  assert.equal('email' in result.rsvp, false);
  limited = true;
  assert.match((await track(row.reference_code, 'DELA CRUZ')).error, /Too many/);
  limited = false;
  configured = false;
  assert.ok((await track(row.reference_code, 'DELA CRUZ')).error);
  configured = true;
  databaseError = true;
  await assert.rejects(store.findRsvpByReference(row.reference_code, 'DELA CRUZ'), /RSVP is unavailable/);
  databaseError = false;
  row = { ...row, answers: { profile: { lastName: 'DELA CRUZ', firstName: 'ANA', middleName: '', email: '' }, affiliationKind: 'invited-guest', logisticalNeeds: { requests: ['parking'] } } };
  assert.deepEqual((await track(row.reference_code, 'DELA CRUZ')).rsvp.requests, ['Car parking']);

  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role; create table event_rsvp_responses (id uuid primary key default gen_random_uuid(), email text unique); insert into event_rsvp_responses(email) values ('old@example.com');");
    const migration = fs.readFileSync('supabase/migrations/0078_event_rsvp_references.sql', 'utf8');
    await db.exec(migration);
    const existing = await db.query('select reference_code from event_rsvp_responses');
    assert.match(existing.rows[0].reference_code, /^RS-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    await db.exec(migration);
    assert.equal((await db.query('select reference_code from event_rsvp_responses')).rows[0].reference_code, existing.rows[0].reference_code, 'Repeated migration preserves references');
    const inserted = await db.query("insert into event_rsvp_responses(email) select 'new-' || i || '@example.com' from generate_series(1, 100) i returning reference_code");
    assert.equal(new Set(inserted.rows.map(row => row.reference_code)).size, 100);
    await assert.rejects(db.query("insert into event_rsvp_responses(email,reference_code) values ('invalid@example.com','INVALID')"), /check constraint/);
    await assert.rejects(db.query("insert into event_rsvp_responses(email,reference_code) values ('duplicate@example.com',$1)", [existing.rows[0].reference_code]), /unique constraint/);
    const permissions = await db.query("select has_function_privilege('anon','public.new_event_rsvp_reference()','execute') as anon, has_function_privilege('service_role','public.new_event_rsvp_reference()','execute') as service");
    assert.deepEqual(permissions.rows[0], { anon: false, service: true });
  } finally { await db.close(); }
  console.log('RSVP references passed: receipt, exact-surname tracking, privacy, throttling, legacy responses, migration backfill/idempotence, unique allocation and permissions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
