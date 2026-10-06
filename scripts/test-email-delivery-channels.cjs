/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { z } = require('zod');
function load(file, dependencies) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', source)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const documentBody = load('src/lib/data/document-body.ts', { zod: { z } });
const emailBody = load('src/lib/email/body.ts', {
  zod: { z },
  '@/lib/data/document-body': documentBody,
  './template': load('src/lib/email/template.ts', {}),
});
const richMessage = documentBody.serializeDocumentBody([
  { type: 'text', runs: [{ text: 'Formatted message', bold: true, underline: true }] },
  { type: 'grid', header: [[{ text: 'Unit' }]], rows: [[[{ text: 'CICS <script>unsafe</script>' }]]] },
]);
assert.equal(emailBody.bodySchema.safeParse(richMessage).success, true);
assert.equal(emailBody.bodySchema.safeParse('::document-body:v1::\n[{"type":"script"}]').success, false);
assert.equal(emailBody.isEmptyBody(documentBody.serializeDocumentBody([{ type: 'divider' }])), true);
assert.equal(emailBody.bodySchema.safeParse([{ type: 'paragraph', runs: [{ text: 'Legacy', bold: true }] }]).success, true);
assert.match(emailBody.bodyDocument([{ type: 'paragraph', runs: [{ text: 'Legacy', bold: true }] }]), /"bold":true/);
const audience = load('src/lib/email/audience.ts', {
  zod: { z },
  '@/lib/data/accounts': { boardRolesFor: () => [], isCentralRepresentative: () => false, isLocalChairperson: () => false, officeOf: (role) => role },
  '@/lib/data/types': { accountAffiliations: {}, directoryGroups: {}, isCommissionerPosition: (position) => ['executive-board', 'executive-associate', 'deputy'].includes(position) },
});
const people = [
  { id: 'own', name: 'Deputy', email: 'shared@ust.edu.ph', active: true, kind: 'personal', affiliation: 'local', college: 'CICS', position: 'deputy', role: '' },
  { id: 'same-unit-membership', name: 'Associate', email: 'shared@ust.edu.ph', active: true, kind: 'personal', affiliation: 'local', college: 'CICS', position: 'executive-associate', role: '' },
  { id: 'other-unit-membership', name: 'Other', email: 'shared@ust.edu.ph', active: true, kind: 'personal', affiliation: 'local', college: 'Science', position: 'deputy', role: '' },
  { id: 'inactive', name: 'Inactive', email: 'inactive@ust.edu.ph', active: false, kind: 'personal', affiliation: 'local', college: 'CICS', position: 'deputy', role: '' },
];
const reach = { affiliation: 'local', college: 'CICS' };
const filter = { ...audience.defaultAudience };
assert.deepEqual(audience.inboxRecipientsOf(filter, people.filter((person) => person.active), reach).map((person) => person.id), ['own', 'same-unit-membership']);
assert.equal(audience.recipientsOf(filter, people.filter((person) => person.active), reach).length, 1);
assert.deepEqual(audience.inboxRecipientsOf({ ...filter, only: ['other@ust.edu.ph'] }, people, reach), []);
let row;
let configured = true;
let emailSuccess = true;
let inboxFailure = false;
let emails;
let inboxes;
let queued;
function query() {
  let update;
  let insert;
  const builder = {
    update: (fields) => { update = fields; return builder; },
    insert: (fields) => { insert = fields; queued = fields; return builder; },
    eq: () => builder,
    select: () => builder,
    single: async () => ({ data: { id: 'queued' }, error: null }),
    maybeSingle: async () => {
      if (update && row.status === 'scheduled') {
        Object.assign(row, update);
        return { data: { ...row }, error: null };
      }
      return { data: null, error: null };
    },
    then: (resolve, reject) => {
      if (update) Object.assign(row, update);
      return Promise.resolve({ data: insert ? { id: 'queued' } : null, error: null }).then(resolve, reject);
    },
  };
  return builder;
}
const outbox = load('src/lib/email/outbox.ts', {
  'server-only': {},
  '@/lib/data/accounts': { toSummary: (person) => person },
  '@/lib/data/store': { store: { list: async () => people } },
  '@/lib/supabase/config': { isSupabaseConfigured: () => true },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: () => query() }) },
  './audience': audience,
  './body': emailBody,
  './send': { isEmailConfigured: () => configured, sendEmail: async (email) => { emails.push(email); return emailSuccess; } },
  '@/lib/notifications/inbox-store': { publishMessage: async (message, ids) => {
    inboxes.push({ message, ids });
    if (inboxFailure) throw new Error('Inbox unavailable');
  } },
});
async function send(channels) {
  row = { id: 'message', status: 'scheduled', subject: 'Announcement', title: '', body: [{ type: 'paragraph', runs: [{ text: 'Full message' }] }], audience: filter, audience_label: 'All commissioners', sender_name: 'Official', sender_email: 'official@ust.edu.ph', sender_unit: 'CICS', sender_affiliation: 'local', sender_college: 'CICS', ...channels };
  emails = []; inboxes = [];
  await outbox.deliver('message');
}
const actions = load('src/lib/portal/email-actions.ts', {
  'next/cache': {}, 'next/navigation': {}, 'next/server': {}, zod: { z },
  '@/lib/applications/period': {},
  '@/lib/auth/session': { requireEditor: async () => ({ id: 'own' }) },
  '@/lib/data/accounts': {}, '@/lib/data/store': {}, '@/lib/data/types': {},
  '@/lib/data/document-body': load('src/lib/data/document-body.ts', { zod: { z } }),
  '@/lib/email/audience': audience,
  '@/lib/email/body': emailBody, '@/lib/email/outbox': outbox, '@/lib/email/send': {},
  '@/lib/events/options': {}, '@/lib/notifications/inbox-store': {}, './form': {},
});
(async () => {
  const rejected = await actions.sendMessage(undefined, new FormData());
  assert.match(rejected.fieldErrors.delivery, /email address, portal inbox, or both/);
  assert.match((await actions.sendTestMessage(undefined, new FormData())).error, /at least one/);
  await outbox.queueEmail({ subject: 'Test', sendToEmail: false, sendToInbox: true });
  assert.equal(queued.send_to_email, false);
  assert.equal(queued.send_to_inbox, true);

  await send({ send_to_email: true, send_to_inbox: true });
  assert.equal(emails.length, 1);
  assert.equal(inboxes.length, 1);
  assert.deepEqual(inboxes[0].ids, ['own', 'same-unit-membership']);
  assert.equal(documentBody.documentBodyText(documentBody.parseDocumentBody(inboxes[0].message.body)), 'Full message');
  assert.equal(row.status, 'sent');
  assert.equal(row.deliveries[0].emailSent, true);
  assert.equal(row.deliveries[0].inboxSent, true);

  await send({ send_to_email: true, send_to_inbox: true, body: richMessage });
  assert.equal(inboxes[0].message.body, richMessage);
  assert.match(emails[0].html, /<table border="1"/);
  assert.match(emails[0].html, /<strong>Formatted message<\/strong>/);
  assert.match(emails[0].html, /&lt;script&gt;unsafe&lt;\/script&gt;/);
  assert.doesNotMatch(emails[0].html, /<script>/);
  assert.doesNotMatch(emails[0].text, /::document-body/);

  configured = false;
  await send({ send_to_email: false, send_to_inbox: true });
  assert.equal(emails.length, 0);
  assert.equal(inboxes.length, 1);
  assert.equal(row.status, 'sent');
  assert.equal(row.error, null);

  await send({ send_to_email: true, send_to_inbox: true });
  assert.equal(row.status, 'sent');
  assert.equal(row.deliveries[0].emailSent, false);
  assert.equal(row.deliveries[0].inboxSent, true);
  assert.match(row.error, /SMTP/);

  configured = true;
  await send({ send_to_email: true, send_to_inbox: false });
  assert.equal(emails.length, 1);
  assert.equal(inboxes.length, 0);

  // Historical outbox rows remain email-only.
  await send({});
  assert.equal(emails.length, 1);
  assert.equal(inboxes.length, 0);

  inboxFailure = true;
  await send({ send_to_email: true, send_to_inbox: true });
  assert.equal(emails.length, 1);
  assert.equal(row.status, 'sent');
  assert.match(row.error, /Inbox unavailable/);
  assert.equal(row.deliveries[0].inboxSent, false);

  inboxFailure = false;
  emailSuccess = false;
  await send({ send_to_email: true, send_to_inbox: false });
  assert.equal(row.status, 'failed');
  assert.equal(row.sent_count, 0);

  await send({ send_to_email: false, send_to_inbox: false });
  assert.equal(row.status, 'failed');
  assert.equal(emails.length + inboxes.length, 0);
  console.log('Email/inbox delivery, partial failures, historical defaults, and membership isolation checks passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
