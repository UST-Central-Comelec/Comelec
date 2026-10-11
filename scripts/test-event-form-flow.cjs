// Run with: node scripts/test-event-form-flow.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise form rules without Next.js. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  cache.set(file, compiled.exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const flow = load('src/lib/events/form-flow.ts');
const editor = load('src/lib/events/form-editor.ts');
const rsvp = load('src/lib/events/rsvp.ts');
const evaluation = load('src/lib/events/evaluation.ts');
const { editorDefinitionSchema: schema, validateEditorAnswers, keptAnswers, answerProblem, normalizeAnswer } = editor;
let counter = 0;
const newId = () => `q_new${++counter}`;
const question = (id, extra = {}) => ({ id, label: id, prompt: '', kind: 'text', required: false, options: [], ...extra });
const ack = { title: 'Done', message: '', link: false, email: false, subject: '', body: '' };
const wrap = steps => ({ steps: [editor.defaultPrivacyStep([editor.privacyConsent('consent', 'test')]), ...steps, editor.defaultAcknowledgementStep(ack)] });
const ok = definition => { const result = schema.safeParse(definition); if (!result.success) console.log(result.error.issues.map(issue => issue.message)); return result.success; };
const messages = definition => schema.safeParse(definition).error?.issues.map(issue => issue.message).join(' ') ?? '';

// Every form: the Data Privacy Consent first (confirmation boxes only), the Acknowledgement last.
let form = wrap([{ id: 'a', title: 'A', description: '', fields: [question('q_size', { kind: 'radio', required: true, options: ['Small', 'Large'] }), question('q_after')] }, { id: 'b', title: 'B', description: '', fields: [question('q_last', { required: true })] }]);
assert.ok(ok(form));
assert.match(messages({ steps: form.steps.slice(1) }), /Data Privacy Consent/);
assert.match(messages({ steps: form.steps.slice(0, -1) }), /Acknowledgement/);
assert.match(messages(flow.insertFields(form, 'privacy', [question('q_text')])), /confirmation boxes only/);
assert.match(messages(flow.patchStep(form, 'acknowledgement', { acknowledgement: { ...ack, email: true } })), /subject/);

// Conditional on: each choice gets a question of its own, linked; a choice can lead to several.
form = flow.setConditional(form, 'q_size', true, newId);
assert.deepEqual(form.steps[1].fields.map(field => field.id), ['q_size', 'q_new1', 'q_new2', 'q_after']);
assert.deepEqual(form.steps[1].fields[0].branches, [['q_new1'], ['q_new2']]);
form = flow.setBranch(form, 'q_size', 1, ['q_new2', 'q_last']);
assert.ok(ok(form));
form = flow.patchField(form, 'q_new1', { required: true });
const shown = answers => [...flow.resolveFlow(form, answers).visible].filter(id => id !== 'consent');
assert.deepEqual(shown({}), ['q_size', 'q_after']);
assert.deepEqual(shown({ q_size: 'Small' }), ['q_size', 'q_new1', 'q_after']);
assert.deepEqual(shown({ q_size: 'Large' }), ['q_size', 'q_new2', 'q_after', 'q_last'], 'One choice can lead to several questions');
assert.deepEqual(flow.resolveFlow(form, { q_size: 'Small' }).steps.map(step => step.id), ['privacy', 'a'], 'A step with only hidden branches is skipped; the Acknowledgement is never a step to fill');
assert.match(validateEditorAnswers(form, { consent: 'yes', q_size: 'Large' }), /q_last/, 'A question a picked choice leads to is asked');
assert.equal(validateEditorAnswers(form, { consent: 'yes', q_size: 'Large', q_last: 'x' }), null);
assert.match(validateEditorAnswers(form, { consent: 'yes', q_size: 'Small' }), /Follow-up: Small/);
assert.match(validateEditorAnswers(form, { q_size: 'Large' }), /Tick to confirm/, 'The consent must be ticked');
assert.equal(validateEditorAnswers(form, { q_size: 'Small', q_new1: 'ok' }, { scope: ['a'] }), null, 'Scope checks only the step being left');
assert.deepEqual(keptAnswers(form, { consent: 'yes', q_size: 'Small', q_new1: ' ok  then ', q_new2: 'hidden', q_last: 'hidden' }), { consent: 'yes', q_size: 'Small', q_new1: 'ok then' }, 'Hidden answers are dropped and kept ones tidied');

// Saved forms with one question per choice still read.
assert.deepEqual(schema.parse(flow.patchField(form, 'q_size', { branches: ['q_new1', null] })).steps[1].fields[0].branches, [['q_new1'], []]);

// Email questions branch on the kind of address.
let mail = wrap([{ id: 's', title: 'S', description: '', fields: [question('q_mail', { kind: 'email', required: true }), question('q_number', { required: true, rules: { studentNumber: true } })] }]);
mail = flow.setBranch(flow.patchField(mail, 'q_mail', { branches: [[], []] }), 'q_mail', 0, ['q_number']);
assert.ok(ok(mail));
assert.equal(flow.resolveFlow(mail, { q_mail: 'ana@ust.edu.ph' }).visible.has('q_number'), true);
assert.equal(flow.resolveFlow(mail, { q_mail: 'ana@gmail.com' }).visible.has('q_number'), false);
assert.equal(validateEditorAnswers(mail, { consent: 'yes', q_mail: 'ana@gmail.com' }), null);
assert.match(validateEditorAnswers(mail, { consent: 'yes', q_mail: 'ana@ust.edu.ph', q_number: '12345' }), /10-digit/);

// Answer rules.
const rule = (rules, value, kind = 'text') => answerProblem({ ...question('q', { kind, rules }), label: 'Name' }, normalizeAnswer({ ...question('q', { kind, rules }) }, value));
assert.equal(rule({ studentNumber: true }, '2026123456'), null);
assert.match(rule({ studentNumber: true }, '2026-12345'), /10-digit/);
assert.equal(rule({ letters: true }, "Ma. O'Neil-Cruz"), null, 'Names keep their periods, apostrophes and hyphens');
assert.match(rule({ letters: true }, 'Juan 3'), /letters only/);
assert.equal(rule({ digits: true }, '42'), null);
assert.match(rule({ digits: true }, '4 2'), /numbers only/);
assert.equal(rule({ digits: true }, '4\n2', 'textarea'), null, 'A paragraph of numbers may have lines');
assert.equal(rule({ noSpecial: true }, 'Hello, world! (Room 3) — ok?'), null);
assert.match(rule({ noSpecial: true }, 'a@b #1'), /special characters/);
assert.equal(normalizeAnswer(question('q', { rules: { uppercase: true } }), ' juan  dela cruz '), 'JUAN DELA CRUZ');
assert.equal(normalizeAnswer(question('q', { kind: 'email' }), ' Ana@UST.edu.ph '), 'ana@ust.edu.ph');
const link = (links, value) => answerProblem(question('q', { kind: 'link', links, label: 'Link' }), value);
assert.equal(link([], 'https://example.com/a'), null);
assert.match(link([], 'example.com'), /full web address/);
assert.equal(link(['drive'], 'https://drive.google.com/file/d/1'), null);
assert.match(link(['drive'], 'https://example.com'), /Google Drive/);
assert.equal(link(['drive', 'facebook'], 'https://www.facebook.com/ust'), null);
assert.match(answerProblem(question('q', { kind: 'email', verifyUst: true, label: 'Email' }), 'ana@gmail.com'), /UST Google/);
const boxes = question('q', { kind: 'checkbox', options: ['A', 'B', 'C'], min: 2, max: 2, label: 'Pick' });
assert.match(answerProblem(boxes, ['A']), /at least 2/);
assert.match(answerProblem(boxes, ['A', 'B', 'C']), /no more than 2/);
assert.equal(answerProblem(boxes, ['A', 'C']), null);
assert.equal(answerProblem(boxes, []), null, 'An optional question may be left blank, whatever its minimum');
assert.match(messages(wrap([{ id: 's', title: 'S', description: '', fields: [{ ...boxes, max: 4 }] }])), /more ticks than it has choices/);
assert.match(messages(wrap([{ id: 's', title: 'S', description: '', fields: [question('q_x', { rules: { letters: true, digits: true } })] }])), /letters only and numbers only/);
assert.match(messages(wrap([{ id: 's', title: 'S', description: '', fields: [question('q_img', { kind: 'image', label: 'Map', image: { url: 'https://evil.example/x.png', size: 'full' } })] }])), /Upload the image|Invalid/i, 'Images come only from the form uploads folder');
assert.ok(ok(wrap([{ id: 's', title: 'S', description: '', fields: [question('q_img', { kind: 'image', label: 'Map', image: { url: 'https://abc.supabase.co/storage/v1/object/public/uploads/event-forms/x.jpg', size: 'medium' } })] }])));

// Links only lead forward; reordering that would break one is refused.
const backwards = flow.moveField(form, 'q_new2', -1);
assert.equal(flow.keepsOrder(form, flow.placeField(form, 'q_size', 'a', 3)), false, 'A question can’t move below a question it leads to');
assert.equal(flow.keepsOrder(form, backwards), true, 'Swapping two follow-ups is fine');
assert.match(messages(flow.placeField(form, 'q_new1', 'privacy', 0)), /comes before|confirmation boxes only/);

// Steps keep their ends: the consent first, the acknowledgement last.
const three = wrap([{ id: 'x', title: 'X', description: '', fields: [] }, { id: 'y', title: 'Y', description: '', fields: [] }, { id: 'z', title: 'Z', description: '', fields: [] }]);
assert.deepEqual(flow.placeStep(three, 'z', 0).steps.map(step => step.id), ['privacy', 'z', 'x', 'y', 'acknowledgement']);
assert.deepEqual(flow.placeStep(three, 'x', 99).steps.map(step => step.id), ['privacy', 'y', 'z', 'x', 'acknowledgement']);
assert.equal(flow.placeStep(three, 'privacy', 2), three, 'The consent stays first');
assert.equal(flow.placeStep(three, 'acknowledgement', 1), three, 'The acknowledgement stays last');

// Choices and links stay matched; removing a question unlinks it.
form = flow.addChoice(form, 'q_size', 1, newId);
assert.equal(form.steps[1].fields[0].branches.length, 3);
assert.ok(ok(form));
form = flow.removeField(form, 'q_new2');
assert.deepEqual(form.steps[1].fields[0].branches[1], ['q_last']);
form = flow.setConditional(form, 'q_size', false, newId);
assert.equal('branches' in form.steps[1].fields[0], false);

// The RSVP starts as ordinary questions; its old rules live in its conditional choices.
const r = rsvp.defaultRsvpDefinition;
assert.ok(ok(r));
const rsvpShows = answers => flow.resolveFlow(r, answers);
const steps = answers => rsvpShows(answers).steps.map(step => step.id);
const ust = { rsvp_email: 'ana@ust.edu.ph', rsvp_affiliation: 'University of Santo Tomas', rsvp_ust_type: 'Council — Local' };
assert.equal(rsvpShows(ust).visible.has('rsvp_student_number'), true, 'A UST email asks for a student number');
assert.equal(rsvpShows({ rsvp_email: 'a@gmail.com' }).visible.has('rsvp_student_number'), false);
assert.equal(rsvpShows(ust).visible.has('rsvp_college'), true, 'Local councils pick their college');
assert.equal(rsvpShows(ust).visible.has('rsvp_org_name'), false);
assert.deepEqual(steps(ust), ['privacy', 'rsvp_profile', 'rsvp_affiliation', 'rsvp_role', 'rsvp_attendance', 'rsvp_delegation', 'rsvp_committees', 'rsvp_conforme']);
const guest = { rsvp_affiliation: 'External', rsvp_external_type: 'Invited Guest (Delegates)' };
assert.deepEqual(steps(guest), ['privacy', 'rsvp_profile', 'rsvp_affiliation', 'rsvp_attendance', 'rsvp_delegation', 'rsvp_logistics', 'rsvp_conforme'], 'Guests skip Attending as and committees, and see logistical needs');
const rep = { rsvp_affiliation: 'External', rsvp_external_type: 'Organization / Institution Representative' };
assert.ok(steps(rep).includes('rsvp_role'), 'External representatives say how they attend');
assert.ok(['rsvp_external_org', 'rsvp_external_school'].every(id => rsvpShows(rep).visible.has(id)));
assert.ok(['rsvp_proxy_last_name', 'rsvp_proxy_email'].every(id => rsvpShows({ rsvp_attendance: 'Sending a Proxy' }).visible.has(id)), 'A proxy gets a profile of their own');
assert.equal(rsvpShows({ rsvp_delegation: 'To be confirmed' }).visible.has('rsvp_additional'), true);
assert.equal(rsvpShows({ ...guest, rsvp_logistics: ['I would like to request for a car parking reservation'] }).visible.has('rsvp_car_plate'), true);
const committees = r.steps.find(step => step.id === 'rsvp_committees').fields[0];
assert.deepEqual([committees.max, committees.ranked], [2, true], 'Committees are ranked, two at most');
assert.ok(r.steps.flatMap(step => step.fields).every(field => !('standard' in field)), 'No question is locked');

// Old RSVP forms (locked steps, fixed questions) open as the editable default, keeping added questions.
const legacy = { steps: [{ id: 'rsvp_0', title: 'Profile', description: '', builtin: 0, fields: [] }, { id: 'rsvp_6', title: 'Conforme', description: '', builtin: 6, fields: [question('q_extra', { label: 'Anything else?' })] }] };
const upgraded = rsvp.normalizeRsvpDefinition(legacy);
assert.ok(ok(upgraded));
assert.equal(upgraded.steps.at(-3).id, 'rsvp_more');
assert.equal(upgraded.steps.at(-3).fields[0].id, 'q_extra');
assert.equal(rsvp.normalizeRsvpDefinition({ steps: [{ id: 's', title: 'S', description: '', fields: [{ ...question('rsvp_attendance'), standard: 'attendance' }] }] }), rsvp.defaultRsvpDefinition);
assert.equal(rsvp.normalizeRsvpDefinition(r), r, 'A current form is left as it is');

// Old responses still read; new ones read from their own form.
const facts = rsvp.rsvpResponseFacts({ version: 2, definition: r, values: { rsvp_first_name: 'ANA', rsvp_committees: ['Programs & Module Training (Pre-Event & During)', 'Food & Refreshment Logistics (Pre-Event & During)'], rsvp_accurate: 'yes' } });
assert.deepEqual(facts.find(([label]) => label === 'Preferred committee assignments')[1].split('\n'), ['1. Programs & Module Training (Pre-Event & During)', '2. Food & Refreshment Logistics (Pre-Event & During)']);
assert.equal(facts.find(([label]) => label.startsWith('I confirm that the information'))[1], 'Confirmed');
const person = rsvp.rsvpRespondent({ version: 2, definition: r, values: { rsvp_first_name: 'ANA', rsvp_last_name: 'CRUZ', rsvp_email: 'ana@ust.edu.ph', rsvp_org_name: 'UST Debate' } });
assert.deepEqual([person.name, person.email, person.organization], ['ANA CRUZ', 'ana@ust.edu.ph', 'UST Debate']);
const old = { profile: { lastName: 'Cruz', firstName: 'Ana', middleName: 'M', email: 'ana@example.com', studentNumber: '' }, affiliation: 'external', affiliationKind: 'invited-guest', organization: '', college: '', school: '', role: '', attendance: 'confirmed', delegation: 'no', additionalParticipants: '', accurate: true, authorized: true };
assert.equal(rsvp.rsvpRespondent(old).email, 'ana@example.com');
assert.ok(rsvp.rsvpResponseFacts(old).some(([label, value]) => label === 'Affiliation type' && value.startsWith('Invited Guest')));

// The Evaluation gains the consent and acknowledgement; its questions move along a step.
const e = evaluation.evaluationDefinition(evaluation.defaultEvaluation);
assert.ok(ok(e));
assert.deepEqual(e.steps.map(step => step.kind ?? step.builtin ?? ''), ['privacy', 0, '', '', '', 'acknowledgement']);
const legacyEvaluation = { enabled: false, allowAnonymous: false, steps: [{ id: 'evaluation_0', title: 'Profile', description: '' }, { id: 'evaluation_1', title: 'Feedback', description: '' }], questions: [{ id: 'objectives', section: 1, label: 'Objectives', prompt: '', kind: 'rating', required: true }, { id: 'learning', section: 1, label: 'Key takeaway', prompt: '', kind: 'text', required: true }] };
const moved = evaluation.evaluationDefinition(legacyEvaluation);
assert.ok(ok(moved));
assert.deepEqual(moved.steps.map(step => step.title), ['Data Privacy Consent', 'Profile', 'Feedback', 'Acknowledgement']);
assert.equal(moved.steps[1].builtin, 0, 'The old first step stays the profile lookup');
assert.deepEqual(moved.steps[2].fields.map(field => [field.id, field.kind]), [['objectives', 'rating'], ['learning', 'textarea']], 'Old “text” questions were paragraphs and stay so');
const saved = evaluation.evaluationSettingsSchema.parse(evaluation.evaluationFromDefinition(e, evaluation.defaultEvaluation));
assert.equal(saved.steps.at(-1).kind, 'acknowledgement');
assert.equal(evaluation.evaluationSettingsSchema.safeParse({ ...saved, steps: saved.steps.filter(step => step.builtin !== 0), questions: saved.questions.map(question => ({ ...question, section: question.section > 1 ? question.section - 1 : question.section })) }).success, false, 'The profile step can’t be removed');
console.log('Form flow checks passed: fixed first and last steps, multi-question branches, email branching, answer rules, forward-only reordering, the editable RSVP default and its branching, legacy RSVP and evaluation upgrades, and response reading.');
