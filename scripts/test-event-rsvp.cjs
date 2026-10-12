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
const rsvp = load('src/lib/events/rsvp.ts');
const definition = rsvp.defaultRsvpDefinition;
const editor = load('src/lib/events/form-editor.ts');
const committees = definition.steps.find(step => step.id === 'rsvp_committees');
const resources = definition.steps.find(step => step.id === 'rsvp_resources_step');
assert.ok(committees && resources && committees !== resources, 'Committees and resources have separate steps');
assert.deepEqual(committees.fields.map(field => field.id), ['rsvp_committees']);
assert.deepEqual(resources.fields.map(field => field.id), ['rsvp_resources', 'rsvp_resource_other']);
const combined = structuredClone(definition);
combined.steps = combined.steps.filter(step => step.id !== resources.id);
combined.steps.find(step => step.id === committees.id).fields.push(...resources.fields);
combined.steps.find(step => step.id === committees.id).title = 'Committee Involvement & Functional Roles';
const split = rsvp.normalizeRsvpDefinition(combined);
assert.ok(editor.editorDefinitionSchema.safeParse(split).success, 'Saved combined forms split without breaking conditional links');
assert.deepEqual(split.steps.find(step => step.id === resources.id).fields.map(field => field.id), resources.fields.map(field => field.id));
assert.deepEqual(rsvp.normalizeRsvpDefinition(split), split, 'Normalizing an updated form is stable');
const participantCount = definition.steps.flatMap(step => step.fields).find(field => field.id === 'rsvp_additional');
assert.equal(editor.answerProblem(participantCount, '10-20'), null, 'Ranges allow a hyphen');
assert.match(editor.answerProblem(participantCount, '10/20'), /hyphens/, 'Other special characters are rejected');
const legacyRules = structuredClone(definition);
legacyRules.steps.flatMap(step => step.fields).find(field => field.id === 'rsvp_additional').rules = { noSpecial: true };
assert.equal(rsvp.normalizeRsvpDefinition(legacyRules).steps.flatMap(step => step.fields).find(field => field.id === 'rsvp_additional').rules.hyphenOnly, true, 'Saved RSVP rules allow only hyphens as special characters');

// The public form: ordinary questions; a conditional choice shows its follow-ups while it's picked.
const React = require('react');
const uiSlots = []; let uiCursor = 0;
const previousFrame = global.requestAnimationFrame;
global.requestAnimationFrame = callback => callback();
const formUi = load('src/components/events/rsvp-form.tsx', {
  react: { ...React, useState: initial => { const slot = uiCursor++; if (!(slot in uiSlots)) uiSlots[slot] = typeof initial === 'function' ? initial() : initial; return [uiSlots[slot], next => { uiSlots[slot] = typeof next === 'function' ? next(uiSlots[slot]) : next; }]; }, useActionState: () => [{}, () => {}, false], useRef: () => ({ current: null }), useEffect: () => {}, useLayoutEffect: () => {} },
  '@/lib/events/rsvp-actions': { submitRsvp: () => {} },
  '@/lib/events/rsvp': rsvp,
  'next/link': { default: props => ({ type: 'a', props }) },
  './student-verification': { StudentVerification: props => ({ type: 'verify', props }) },
  'motion/react': { AnimatePresence: ({ children }) => children, motion: { div: 'div' }, useReducedMotion: () => true, useIsPresent: () => true },
  './editor-fields.css': {},
  '@/components/portal/toast': { toast: () => {} },
});
function walk(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(walk);
  return [node, ...walk(typeof node.type === 'function' ? node.type(node.props) : node.props?.children)];
}
const renderUi = (props = {}) => { uiCursor = 0; return walk(formUi.RsvpForm({ eventId: 'sample', eventName: 'Sample event', token: '', preview: true, registrationUrl: '/events/sample/register', ...props })); };
const inputUi = name => renderUi().find(node => node.type === 'input' && node.props.name === name);
const choiceUi = (name, value) => renderUi().find(node => node.type === 'input' && node.props.name === name && node.props.value === value);
const stepIds = () => renderUi().find(node => node.type === 'ol' && node.props['aria-label'] === 'RSVP steps').props.children[0].map(item => item.key);
const openStep = id => renderUi().find(node => node.type === 'ol' && node.props['aria-label'] === 'RSVP steps').props.children[0].find(item => item.key === id).props.children.props.onClick();
const answers = () => JSON.parse(inputUi('answers').props.value);
assert.equal(stepIds()[0], 'privacy', 'The Data Privacy Consent comes first');
assert.ok(renderUi().some(node => node.type === 'a' && node.props.href === '/privacy'), 'It links to the Data Privacy Statement');
inputUi('rsvp_consent').props.onChange({ target: { checked: true } });
assert.equal(answers().rsvp_consent, 'yes');
openStep('rsvp_profile');
inputUi('rsvp_last_name').props.onChange({ target: { value: 'dela cruz' } });
assert.equal(answers().rsvp_last_name, 'DELA CRUZ', 'Names are kept in capitals as they’re typed');
assert.equal(inputUi('rsvp_student_number'), undefined);
inputUi('rsvp_email').props.onChange({ target: { value: 'person@ust.edu.ph' } });
assert.ok(inputUi('rsvp_student_number'), 'A UST email asks for a student number, without Google sign-in');
openStep('rsvp_affiliation');
choiceUi('rsvp_affiliation', 'External').props.onChange();
choiceUi('rsvp_external_type', 'Resource Person (Speakers, Facilitators, Panelists)').props.onChange();
assert.equal(stepIds().includes('rsvp_role'), false, 'Resource persons skip Attending as');
assert.equal(stepIds().includes('rsvp_committees'), false, 'Externals never see committees');
assert.ok(stepIds().includes('rsvp_logistics'), 'Externals get the logistical needs');
choiceUi('rsvp_external_type', 'Organization / Institution Representative').props.onChange();
assert.ok(stepIds().includes('rsvp_role'));
assert.ok(inputUi('rsvp_external_school'));
choiceUi('rsvp_affiliation', 'University of Santo Tomas').props.onChange();
renderUi().find(node => node.type === 'select' && node.props.name === 'rsvp_ust_type').props.onChange({ target: { value: 'Commission — Local Comelec' } });
assert.ok(renderUi().some(node => node.type === 'select' && node.props.name === 'rsvp_college'), 'Local units pick their college');
assert.ok(stepIds().includes('rsvp_committees') && !stepIds().includes('rsvp_logistics'));
assert.ok(stepIds().includes('rsvp_resources_step'), 'UST respondents also get the separate resources step');
openStep('rsvp_committees');
const tick = option => renderUi().find(node => node.type === 'input' && node.props.type === 'checkbox' && node.props.value === option).props.onChange({ target: { checked: true } });
const committee = index => definition.steps.find(step => step.id === 'rsvp_committees').fields[0].options[index];
tick(committee(5)); tick(committee(0));
assert.deepEqual(answers().rsvp_committees, [committee(5), committee(0)], 'Ticks keep the order they were made');
assert.deepEqual(renderUi().filter(node => node.props?.className === 'ev-rsvp-rank').map(node => node.props.children), [2, 1], 'Badges follow tick order');
assert.equal(renderUi().find(node => node.type === 'input' && node.props.value === committee(1)).props.disabled, true, 'The rest lock at the maximum');
assert.deepEqual(renderUi().filter(node => node.type === 'input' && node.props.type === 'hidden' && node.props.name === 'rsvp_committees').map(node => node.props.value), [committee(5), committee(0)], 'A plain submission carries them in order too');
openStep('rsvp_attendance');
choiceUi('rsvp_attendance', 'Sending a Proxy').props.onChange();
assert.ok(inputUi('rsvp_proxy_email'), 'Sending a proxy asks for their profile');
const last = stepIds().at(-1);
openStep(last);
const seeAcknowledgement = renderUi().find(node => node.type === 'button' && JSON.stringify(node.props.children).includes('See the acknowledgement'));
seeAcknowledgement.props.onClick();
const page = renderUi();
assert.ok(page.some(node => node.type === 'h2' && node.props.children === 'Your RSVP has been recorded.'), 'Preview shows the acknowledgement page');
assert.ok(page.some(node => node.type === 'a' && node.props.href === '/events/sample/register'), 'With the registration link button');
assert.ok(page.some(node => node.type === 'button' && node.props['aria-label'] === 'Copy registration link'), 'The acknowledgement offers a copy button');
assert.ok(page.some(node => node.type === 'p' && node.props.children === 'Share this link or QR code with your participants. Each participant must register individually.'), 'The acknowledgement explains participant sharing');
if (previousFrame === undefined) delete global.requestAnimationFrame; else global.requestAnimationFrame = previousFrame;

let user = { kind: 'personal', affiliation: 'local', college: 'CICS', position: 'executive-board', email: 'officer@ust.edu.ph', readOnly: false };
let settings = { enabled: true, committee_limit: 2, invitation_token: '11111111-1111-4111-8111-111111111111' };
const event = { id: 'sample', name: 'Sample event', organizer: 'local', college: 'CICS' };
const writes = [], emails = [], refreshed = [];
let duplicate = false;
let verifiedPass = null;
const actions = load('src/lib/events/rsvp-actions.ts', {
  '@/lib/forms/email-domain': { emailDomainProblem: async email => email.endsWith('@nomail.test') ? 'nomail.test can’t receive email. Check the spelling of the address.' : null },
  './verification': { readEventPass: async () => verifiedPass },
  'next/headers': { headers: async () => new Headers() },
  'next/cache': { revalidatePath: value => refreshed.push(value) },
  'next/navigation': { unstable_rethrow: () => {} },
  '@/lib/auth/session': { requireEditor: async () => { if (user.readOnly) throw Error('Denied'); return user; } },
  '@/lib/supabase/server': { createAdminClient: () => ({ from(table) { return { insert: async row => { writes.push({ table, row }); return { error: duplicate ? { code: '23505' } : null }; }, update: row => ({ eq: async () => { writes.push({ table, row }); return { error: null }; } }) }; } }) },
  '@/lib/notifications/notify': { sendAutomatic: async (key, build) => { assert.equal(key, 'event-rsvp'); emails.push(build()); return 'sent'; } },
  '@/lib/forms/input': load('src/lib/forms/input.ts'),
  '@/lib/security/rate-limit': { clientIp: () => 'local', limits: { eventRegister: { limit: 10, windowMs: 1000 } }, rateLimit: () => ({ ok: true }) },
  '@/lib/email/template': { siteUrl: () => 'https://example.com' },
  './queries': { getEvent: async () => event },
  './rsvp-store': { getRsvpSettings: async () => settings, validRsvpToken: token => /^[0-9a-f-]{36}$/.test(token) },
  './rsvp': rsvp,
  './rsvp-emails': { acknowledgementEmail: (to, acknowledgement, event, name) => ({ to, subject: acknowledgement.subject, name }) },
});
const FormMarker = () => null;
const publicPage = load('src/app/(site)/events/[id]/rsvp-form/page.tsx', {
  'next/navigation': { notFound: () => { throw Error('Not found'); } },
  '@/components/events/rsvp-form': { RsvpForm: FormMarker },
  '@/lib/events/queries': { getEventForSite: async id => id === event.id ? event : null },
  '@/lib/events/rsvp-store': { getRsvpSettings: async () => settings },
  '../../events.css': {}, '@/components/events/rsvp.css': {},
});
const oldPage = load('src/app/(site)/events/[id]/rsvp/page.tsx', {
  'next/navigation': { redirect: url => { throw Error(`Redirect: ${url}`); } },
  '@/lib/events/rsvp': rsvp,
});
(async () => {
  assert.equal(rsvp.rsvpFormPath('test-event'), '/events/test-event/rsvp-form');
  assert.deepEqual(publicPage.metadata.robots, { index: false, follow: false });
  const opened = walk(await publicPage.default({ params: Promise.resolve({ id: 'sample' }) }));
  assert.equal(opened.find(node => node.type === FormMarker).props.token, settings.invitation_token, 'Clean URL opens without an invite query');
  settings.enabled = false;
  assert.equal(walk(await publicPage.default({ params: Promise.resolve({ id: 'sample' }) })).some(node => node.type === FormMarker), false, 'Closed forms do not expose submission controls');
  settings.enabled = true;
  await assert.rejects(publicPage.default({ params: Promise.resolve({ id: 'unknown' }) }), /Not found/);
  await assert.rejects(oldPage.default({ params: Promise.resolve({ id: 'sample' }) }), /Redirect: \/events\/sample\/rsvp-form/);

  const filled = { rsvp_consent: 'yes', rsvp_consent_share: 'yes', rsvp_last_name: 'Cruz', rsvp_first_name: 'Ana', rsvp_middle_name: 'Maria', rsvp_email: 'ana@example.com', rsvp_affiliation: 'External', rsvp_external_type: 'Invited Guest (Delegates)', rsvp_attendance: 'Confirmed Attendance', rsvp_delegation: 'No', rsvp_accurate: 'yes', rsvp_authorized: 'yes' };
  const submit = async values => { const form = new FormData(); form.set('answers', JSON.stringify(values)); return actions.submitRsvp('sample', settings.invitation_token, {}, form); };
  const form = new FormData(); form.set('answers', JSON.stringify(filled));
  assert.ok((await actions.submitRsvp('sample', '', {}, form)).error);
  assert.ok((await actions.submitRsvp('sample', '22222222-2222-4222-8222-222222222222', {}, form)).error);
  settings.enabled = false;
  assert.ok((await submit(filled)).error);
  settings.enabled = true;
  assert.equal(writes.length, 0, 'An invalid or closed invitation cannot submit');
  assert.match((await submit({ ...filled, rsvp_consent: '' })).error, /Tick to confirm/, 'The privacy consent is required');
  assert.match((await submit({ ...filled, rsvp_external_type: '' })).error, /External affiliation/, 'A question a picked choice leads to is required');
  assert.match((await submit({ ...filled, rsvp_last_name: 'Cruz 3' })).error, /letters only/);
  assert.match((await submit({ ...filled, rsvp_email: 'ana@ust.edu.ph' })).error, /Student number/, 'A UST email needs its student number');
  assert.match((await submit({ ...filled, rsvp_first_name: 'Ana 🙂' })).error, /letters only|Emoji/);
  assert.equal(writes.length, 0);

  const saved = await submit({ ...filled, rsvp_ust_type: 'Admin', rsvp_committees: ['stale'] });
  assert.equal(saved.success, true);
  assert.equal(saved.registrationUrl, 'https://example.com/events/sample/register');
  const row = writes.at(-1).row;
  assert.equal(row.email, 'ana@example.com');
  assert.equal(row.answers.version, 2);
  assert.equal(row.answers.values.rsvp_last_name, 'CRUZ', 'Answers are tidied by their rules');
  assert.equal('rsvp_ust_type' in row.answers.values || 'rsvp_committees' in row.answers.values, false, 'Answers to questions not shown are dropped');
  assert.ok(row.answers.definition.steps.length > 5, 'The response keeps the form as it was answered');
  assert.deepEqual([emails.length, emails.at(-1).to, emails.at(-1).name], [1, 'ana@example.com', 'ANA'], 'The acknowledgement email goes to the respondent, by the name they gave');
  duplicate = true;
  assert.ok((await submit(filled)).error);
  assert.equal(emails.length, 1, 'Duplicates do not send a second email');
  duplicate = false;

  // Acknowledgement email off: none sent. A form without an Email question still saves.
  const quiet = structuredClone(definition);
  quiet.steps.at(-1).acknowledgement.email = false;
  settings.definition = quiet;
  assert.equal((await submit(filled)).success, true);
  assert.equal(emails.length, 1, 'With the email off, none is sent');
  const noEmail = structuredClone(definition);
  noEmail.steps[1].fields = noEmail.steps[1].fields.filter(field => field.kind !== 'email' && field.id !== 'rsvp_student_number');
  settings.definition = noEmail;
  const withoutEmail = Object.fromEntries(Object.entries(filled).filter(([id]) => id !== 'rsvp_email'));
  assert.equal((await submit(withoutEmail)).success, true);
  assert.match(writes.at(-1).row.email, /^response:/, 'Without an email, each response stays separate');
  delete settings.definition;

  // UST Google verification: an Email question that asks for it must match the verified account.
  const verified = structuredClone(definition);
  verified.steps[1].fields.find(field => field.id === 'rsvp_email').verifyUst = true;
  settings.definition = verified;
  const ustAnswers = { ...filled, rsvp_email: 'ana@ust.edu.ph', rsvp_student_number: '2026123456' };
  const beforeVerify = writes.length;
  assert.match((await submit(ustAnswers)).error, /Verify/);
  verifiedPass = { email: 'other@ust.edu.ph' };
  assert.match((await submit(ustAnswers)).error, /Verify/);
  assert.equal(writes.length, beforeVerify, 'Unverified and mismatched accounts cannot submit');
  verifiedPass = { email: 'ana@ust.edu.ph' };
  assert.equal((await submit(ustAnswers)).success, true);
  delete settings.definition;
  verifiedPass = null;
  settings.require_google = true;
  assert.match((await submit(ustAnswers)).error, /Verify/, 'With the form’s Google setting on, any UST email given must be verified');
  assert.equal((await submit(filled)).success, true, 'External emails need no UST account');
  settings.require_google = false;

  // Old responses still read in the inbox.
  const legacyAnswers = { profile: { lastName: 'Cruz', firstName: 'Ana', middleName: 'M', email: 'ana@example.com', studentNumber: '' }, affiliation: 'external', affiliationKind: 'invited-guest', organization: '', college: '', school: '', role: '', attendance: 'confirmed', delegation: 'no', additionalParticipants: '', accurate: true, authorized: true };
  assert.ok(rsvp.rsvpResponseFacts(legacyAnswers).some(([label]) => label === 'Attendance'));
  const settingsForm = new FormData(); settingsForm.set('enabled', 'on'); settingsForm.set('committeeLimit', '2');
  user.college = 'COS';
  const before = writes.length;
  assert.ok((await actions.saveRsvpSettings('sample', {}, settingsForm)).error);
  assert.equal(writes.length, before, 'Other units cannot modify RSVP');
  user.college = 'CICS'; user.readOnly = true;
  await assert.rejects(actions.saveRsvpSettings('sample', {}, settingsForm), /Denied/);
  user.readOnly = false;
  for (const limit of ['0', '9', '1.5', 'invalid']) {
    settingsForm.set('committeeLimit', limit);
    const count = writes.length;
    assert.ok((await actions.saveRsvpSettings('sample', {}, settingsForm)).error);
    assert.equal(writes.length, count, 'Invalid limits never persist');
  }
  settingsForm.set('committeeLimit', '3');
  assert.equal((await actions.saveRsvpSettings('sample', {}, settingsForm)).success, true);
  assert.equal(writes.at(-1).row.committee_limit, 3);
  assert.equal(writes.at(-1).table, 'event_rsvp_forms');
  assert.equal('invitation_token' in writes.at(-1).row, false, 'Opening or closing does not rotate the invitation');
  console.log('RSVP checks passed: privacy consent, editable default form and its branching, ranked ticks, answer rules, dropped hidden answers, UST verification, invitation access, duplicates, acknowledgement emails, legacy responses, settings and permissions.');
})().catch(error => { console.error(error); process.exitCode = 1; });
