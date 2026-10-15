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
    if (name.endsWith('.css')) return {};
    // Image uploads in the form editor are a server action; nothing here uploads.
    if (name === '@/lib/portal/form-image-actions') return { uploadFormImage: async () => ({ error: 'Not in this check.' }) };
    if (name.startsWith('@/')) { const target = path.resolve(`src/${name.slice(2)}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
let user = { affiliation: 'local', college: 'CICS', email: 'officer@ust.edu.ph', readOnly: false };
const calls = [], refreshed = [];
let storedEvaluation = load('src/lib/events/evaluation.ts').defaultEvaluation;
let failSettings = false;
const actions = load('src/lib/portal/event-actions.ts', {
  'next/cache': { revalidatePath: path => refreshed.push(path) },
  'next/navigation': { redirect: path => { throw Error(`Redirect: ${path}`); } },
  '@/lib/auth/session': { requireEditor: async () => { if (user.readOnly) throw Error('Denied'); return user; }, isLocal: user => user.affiliation === 'local' },
  '@/lib/data/edit-guard': { readGuard: () => ({ stamp: null, overwrite: null }), mergePlan: () => ({ write: [], clash: [], theirs: [] }), conflictState: async () => ({}), saveGuarded: async (_, id, row) => { calls.push(['update', id, row]); return { saved: true, merged: false }; } },
  '@/lib/data/store': { store: { create: async (_, row) => { calls.push(['create', row]); return { id: 'sample' }; }, update: async (_, id, row) => { calls.push(['update', id, row]); return true; }, remove: async (_, id) => { calls.push(['remove', id]); } } },
  '@/lib/events/queries': { getEvent: async () => ({ organizer: 'local', college: 'CICS' }) },
  '@/lib/events/registrations': {}, '@/lib/events/emails': {}, '@/lib/notifications/notify': {},
  '@/lib/events/checklist-documents': { addChecklistDocuments: async () => 0 }, '@/lib/events/qr-codes': { ensureQrCodes: async id => { calls.push(['qr', id]); return {}; } },
  '@/lib/events/evaluation-store': { getEvaluationSettings: async () => storedEvaluation, writeEvaluationContent: async (...args) => { calls.push(['evaluation', ...args]); }, writeEvaluationSettings: async (...args) => { calls.push(['evaluation', ...args]); } },
  '@/lib/events/rsvp-store': { getRsvpSettings: async () => null, writeRsvpDefinition: async (...args) => { calls.push(['definition', ...args]); }, writeRsvpSettings: async (...args) => { calls.push(['settings', ...args]); if (failSettings) throw Error('RSVP is unavailable'); } },
});
function form(limit = '2') {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: 'Sample event', summary: 'An event for collaborators.', background: '', eventDate: '2026-10-08', endDate: '2026-10-08', ingressTime: '', startsTime: '09:00', endsTime: '10:00', egressTime: '', venueMode: 'onsite', venueType: 'in-campus', natureOfActivity: 'Meeting', venueDetails: 'UST campus', openToStudents: 'on', registrationStatus: 'closed', rsvpEnabled: 'on', rsvpCommitteeLimit: limit })) data.set(key, value);
  data.set('evaluationSettings', JSON.stringify(load('src/lib/events/evaluation.ts').defaultEvaluation));
  return data;
}
// Tab switches preserve drafts; questionnaire previews stay outside the event form.
const React = require('react');
const slots = []; let cursor = 0;
const Details = () => null, Rsvp = () => null, Evaluation = () => null, Footer = () => null;
const FormLinks = () => null;
const eventUi = load('src/components/portal/event-form.tsx', {
  react: { ...React, useId: () => 'event-editor-form', useRef: value => ({ current: value }), useEffect: () => {}, useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; } },
  './sliding-filters': { SlidingFilterButtons: () => null },
  './event-rsvp-form': { EventRsvpForm: Rsvp },
  './event-evaluation-editor': { EventEvaluationEditor: Evaluation },
  './event-form-links': { EventFormLinks: FormLinks },
  './event-details-fields': { EventDetailsFields: Details },
  './info-tip': { InfoTip: () => null },
  './edit-guard': { EditPresence: () => null, EditConflict: () => null },
  // The Forms/Preview choice is remembered in the browser; this check starts on the Forms editor.
  './event-form-editor': { useFormEditorMode: () => ({ mode: 'forms', pickMode: () => {} }), FormEditorViewToggle: () => null },
  './portal-form': { usePortalForm: () => ({ state: undefined, pending: false, onSubmit: () => {}, errors: {} }), FormFooter: Footer },
});
function walk(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(walk); return [node, ...walk(node.props?.children)]; }
function render() { cursor = 0; return walk(eventUi.EventForm({ action: () => {}, initial: { requireGoogle: true, registrationStatus: 'closed' }, submitLabel: 'Add event', cancelHref: '/portal/events' })); }
const tabs = () => render().find(node => node.props?.label === 'Event editor tabs');
const panel = marker => render().find(node => node.type === 'div' && node.props.hidden !== undefined && walk(node.props.children).some(child => child.type === marker));
assert.deepEqual(tabs().props.items.map(item => item.label), ['Details', 'RSVP Form', 'Evaluation Form']);
assert.equal(tabs().props.active, 'details');
assert.equal(panel(Details).props.hidden, false);
assert.equal(panel(Rsvp).props.hidden, true);
tabs().props.onChange('rsvp');
assert.equal(panel(Details).props.hidden, true);
assert.equal(panel(Rsvp).props.hidden, false);
tabs().props.onChange('evaluation');
assert.equal(panel(Evaluation).props.hidden, false);
const changed = { ...load('src/lib/events/evaluation.ts').defaultEvaluation, enabled: true };
render().find(node => node.type === Evaluation).props.onChange(changed);
tabs().props.onChange('details');
assert.equal(JSON.parse(render().find(node => node.type === 'input' && node.props.name === 'evaluationSettings').props.value).enabled, true, 'Evaluation drafts survive tab changes');
const formNode = render().find(node => node.type === 'form');
assert.equal(walk(formNode.props.children).some(node => node.type === Rsvp), false, 'RSVP preview cannot nest a second form');
assert.equal(render().find(node => node.type === Footer).props.formId, formNode.props.id, 'Shared save button submits the event form from any tab');
assert.equal(render().some(node => node.type === FormLinks), false, 'A new event has no form links yet');
const linkFor = tab => { tabs().props.onChange(tab); cursor = 0; return walk(eventUi.EventForm({ action: () => {}, initial: { name: 'Sample', requireGoogle: true, registrationStatus: 'closed' }, submitLabel: 'Save', cancelHref: '/portal/events', eventId: 'sample', baseUrl: 'https://example.com' })).find(node => node.type === FormLinks).props; };
assert.equal(linkFor('details').form, 'registration', 'Details links to the public registration form');
assert.equal(linkFor('rsvp').form, 'rsvp');
assert.deepEqual([linkFor('evaluation').form, linkFor('evaluation').eventId], ['evaluation', 'sample']);
tabs().props.onChange('details');
const deploymentUi = load('src/components/portal/event-deployment.tsx', {
  react: { ...React, useId: () => 'deployment', useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useActionState: () => [{}, () => {}, false] },
  '@/lib/portal/event-actions': { saveEventDeployment: () => {} },
  './event-registration-link': { EventRegistrationLink: () => null },
  './toast': { useToast: () => {} },
});
const deploymentNodes = walk(deploymentUi.EventDeployment({ eventId: 'sample', baseUrl: 'https://example.com', registrationStatus: 'closed', rsvp: null, evaluation: storedEvaluation, editable: false }));
assert.deepEqual(deploymentNodes.filter(node => node.props?.href).map(node => node.props.href), ['https://example.com/events/sample/register', 'https://example.com/events/sample/rsvp-form', 'https://example.com/events/sample/evaluate']);
assert.equal(deploymentNodes.filter(node => node.type === 'fieldset').every(node => node.props.disabled), true, 'Read-only deployment controls are disabled');
assert.equal(deploymentNodes.some(node => node.type === 'button'), false, 'Read-only viewers cannot save deployment');
(async () => {
  assert.ok((await actions.createEvent({}, form('9'))).fieldErrors.rsvpCommitteeLimit);
  assert.equal(calls.length, 0, 'Invalid limits fail before creating the event');
  await assert.rejects(actions.createEvent({}, form('3')), /Redirect/);
  assert.deepEqual(calls.find(call => call[0] === 'settings'), ['settings', 'sample', true, 3]);
  assert.ok(calls.some(call => call[0] === 'evaluation'), 'Evaluation is saved when creating an event');
  assert.equal('evaluationSettings' in calls.find(call => call[0] === 'create')[1], false);
  assert.equal('rsvpEnabled' in calls.find(call => call[0] === 'create')[1], false, 'RSVP settings never enter the event row');
  assert.equal('rsvpCommitteeLimit' in calls.find(call => call[0] === 'create')[1], false);
  calls.length = 0;
  const contentOnly = form('4'); contentOnly.delete('rsvpEnabled'); contentOnly.set('rsvpDefinition', JSON.stringify(load('src/lib/events/rsvp.ts').defaultRsvpDefinition));
  await assert.rejects(actions.createEvent({}, contentOnly), /Redirect/);
  assert.equal(calls.some(call => call[0] === 'settings'), false, 'Editor limits never change RSVP opening state');
  assert.equal(calls.find(call => call[0] === 'definition')[3], 4, 'Committee limit saves with the editor definition');
  calls.length = 0;
  const invalid = form(); invalid.set('evaluationSettings', '{broken');
  assert.ok((await actions.createEvent({}, invalid)).fieldErrors.evaluationSettings);
  assert.equal(calls.length, 0, 'Invalid questionnaires fail before any mutation');
  user.college = 'COS';
  assert.ok((await actions.updateEvent('sample', {}, form())).error);
  assert.equal(calls.length, 0, 'Other units cannot change RSVP settings through edit');
  user.college = 'CICS';
  const closed = form('4'); closed.delete('rsvpEnabled'); closed.set('rsvpDefinition', JSON.stringify(load('src/lib/events/rsvp.ts').defaultRsvpDefinition));
  await assert.rejects(actions.updateEvent('sample', {}, closed), /Redirect/);
  assert.equal(calls.some(call => call[0] === 'settings'), false);
  assert.equal(calls.find(call => call[0] === 'definition')[3], 4);
  assert.ok(refreshed.includes('/events/sample/rsvp-form'));
  calls.length = 0; failSettings = true;
  const previousError = console.error; console.error = () => {};
  try { assert.ok((await actions.createEvent({}, form())).error); } finally { console.error = previousError; }
  assert.ok(calls.some(call => call[0] === 'remove'), 'Failed RSVP setup rolls back a newly created event');
  const writes = [];
  const store = load('src/lib/events/rsvp-store.ts', {
    'server-only': {}, '@/lib/supabase/config': { isSupabaseConfigured: () => true },
    '@/lib/supabase/server': { createAdminClient: () => ({ from: table => ({ upsert: async (row, options) => { writes.push({ table, row, options }); return { error: null }; } }) }) },
  });
  await store.writeRsvpSettings('sample', true, 3);
  assert.equal('invitation_token' in writes[0].row, false, 'Existing share tokens remain unchanged');
  assert.equal(writes[0].options.onConflict, 'event_id');
  await store.writeRsvpSettings('sample', false);
  assert.equal('committee_limit' in writes.at(-1).row, false, 'Deployment preserves the editor limit');
  writes.pop();
  await store.writeRsvpDefinition('sample', load('src/lib/events/rsvp.ts').defaultRsvpDefinition);
  for (const key of ['enabled', 'committee_limit', 'invitation_token', 'require_google']) assert.equal(key in writes[1].row, false, 'Content writes preserve all deployment settings');
  failSettings = false; calls.length = 0;
  const deployment = new FormData();
  deployment.set('registrationStatus', 'open'); deployment.set('committeeLimit', '3'); deployment.set('rsvpEnabled', 'on'); deployment.set('evaluationEnabled', 'on'); deployment.set('allowAnonymous', 'on');
  user.college = 'COS';
  assert.ok((await actions.saveEventDeployment('sample', {}, deployment)).error);
  assert.equal(calls.length, 0, 'Other units cannot deploy this event');
  user.college = 'CICS';
  const invalidDeployment = new FormData(); for (const [key, value] of deployment.entries()) invalidDeployment.set(key, value);
  invalidDeployment.set('registrationStatus', 'invalid');
  assert.ok((await actions.saveEventDeployment('sample', {}, invalidDeployment)).fieldErrors.registrationStatus);
  assert.equal(calls.length, 0);
  assert.equal((await actions.saveEventDeployment('sample', {}, deployment)).success, true);
  assert.deepEqual(calls.find(call => call[0] === 'update')[2], { registrationStatus: 'open' }, 'Deployment leaves event details unchanged');
  const evaluationWrite = calls.find(call => call[0] === 'evaluation')[2];
  assert.deepEqual(evaluationWrite.questions, storedEvaluation.questions, 'Deployment preserves all questions');
  assert.equal(evaluationWrite.enabled, true); assert.equal(evaluationWrite.allowAnonymous, true);
  assert.ok(refreshed.includes('/portal/events/sample/deployment'));
  calls.length = 0;
  deployment.set('minimumRegistrants', '2'); deployment.set('maximumRegistrants', '1');
  assert.ok((await actions.saveEventDeployment('sample', {}, deployment)).fieldErrors.maximumRegistrants);
  assert.equal(calls.length, 0, 'Invalid capacity never writes deployment settings');
  deployment.set('maximumRegistrants', '20');
  assert.equal((await actions.saveEventDeployment('sample', {}, deployment)).success, true);
  assert.equal(calls.find(call => call[0] === 'update')[2].minimumRegistrants, 2);
  assert.equal(calls.find(call => call[0] === 'update')[2].maximumRegistrants, 20);
  deployment.delete('minimumRegistrants'); deployment.delete('maximumRegistrants');
  calls.length = 0;
  deployment.set('publicationStatus', 'unpublished');
  assert.equal((await actions.saveEventDeployment('sample', {}, deployment)).success, true);
  assert.equal(calls.find(call => call[0] === 'update')[2].published, false, 'Unpublishing is saved independently of registration status');
  calls.length = 0;
  deployment.set('publicationStatus', 'published');
  assert.equal((await actions.saveEventDeployment('sample', {}, deployment)).success, true);
  assert.equal(calls.find(call => call[0] === 'update')[2].published, true);
  calls.length = 0;
  deployment.set('publicationStatus', 'invalid');
  assert.ok((await actions.saveEventDeployment('sample', {}, deployment)).fieldErrors.publicationStatus);
  assert.equal(calls.length, 0, 'An invalid publication choice cannot save any deployment settings');
  deployment.delete('publicationStatus');
  calls.length = 0;
  deployment.set('rsvpGoogleSetting', 'on'); deployment.set('rsvpGoogleEnabled', 'on');
  deployment.set('evaluationGoogleSetting', 'on'); deployment.set('evaluationGoogleEnabled', 'on');
  assert.equal((await actions.saveEventDeployment('sample', {}, deployment)).success, true);
  assert.equal(calls.find(call => call[0] === 'settings')[4], true, 'RSVP authentication saves independently');
  assert.equal(calls.find(call => call[0] === 'evaluation')[2].requireGoogle, true);
  calls.length = 0;
  deployment.delete('rsvpGoogleEnabled'); deployment.delete('evaluationGoogleEnabled');
  assert.equal((await actions.saveEventDeployment('sample', {}, deployment)).success, true);
  assert.equal(calls.find(call => call[0] === 'settings')[4], false, 'Unticking explicitly disables RSVP authentication');
  assert.equal(calls.find(call => call[0] === 'evaluation')[2].requireGoogle, false);
  calls.length = 0; storedEvaluation = { enabled: false, allowAnonymous: false, questions: [] };
  assert.ok((await actions.saveEventDeployment('sample', {}, deployment)).error);
  assert.equal(calls.length, 0, 'Empty evaluation forms cannot be opened');
  console.log('Event form settings checks passed: add, edit, limits, unit authorization, rollback, separate storage, and stable links.');
})().catch(error => { console.error(error); process.exitCode = 1; });
