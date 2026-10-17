/* eslint-disable @typescript-eslint/no-require-imports -- Verify participant joins and local filters without Next.js. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, dependencies);
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies); }
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const { mergeParticipantRows } = load('src/lib/events/participant-rows.ts');
const person = { id: 'person', name: 'Ana Cruz', email: 'ANA@example.com', status: 'registered', referenceCode: 'REF', studentNumber: null, affiliation: 'UST', affiliationSummary: 'UST', affiliationFacts: [], attending: { label: 'Participant', facts: [] }, requests: [], attendanceConfirmedAt: null, evaluation: null };
const response = (id, email) => ({ id, reference_code: 'RS-7K3M-9QXA', created_at: '2026-10-08T00:00:00Z', answers: { profile: { firstName: 'Ana', middleName: 'Maria', lastName: 'Cruz', email, studentNumber: '' }, affiliation: 'ust', affiliationKind: 'commission-central', organization: '', college: '', school: '', role: 'head', attendance: 'confirmed', delegation: 'no', additionalParticipants: '', accurate: true, authorized: true, committees: ['programs'], resources: ['audio'], resourceOther: '' } });
const evaluation = (id, registration_id, anonymous) => ({ id, registration_id, anonymous, created_at: '2026-10-08T00:00:00Z', questions: [], answers: {} });
const editRequests = [{ id: 'edit', registration_id: null, rsvp_response_id: 'matched', requested_changes: 'Change arrival time.', status: 'pending', created_at: '2026-10-13T00:00:00Z' }];
const rows = mergeParticipantRows([person], [response('matched', 'ana@example.com'), response('only', 'other@example.com')], [evaluation('named', 'person', false), evaluation('anonymous', 'person', true), evaluation('orphan', 'removed', false)], editRequests);
assert.equal(rows.length, 4);
assert.equal(rows[0].rsvp.id, 'matched', 'Email matching ignores case');
assert.equal(rows[0].evaluation.id, 'named');
assert.equal(rows[0].referenceCode, 'REF', 'A matched registration keeps its own reference');
assert.equal(rows[1].referenceCode, 'RS-7K3M-9QXA', 'RSVP-only rows show their trackable reference');
assert.equal(rows[1].registered, false, 'RSVP-only people stay out of public registrations');
assert.deepEqual(rows[0].editRequests, editRequests, 'A matched RSVP edit request follows its participant');
assert.equal(rows[2].name, 'Anonymous response');
assert.equal(rows[2].email, '', 'Anonymous evaluations never disclose the associated registrant');
assert.equal(person.rsvp, undefined, 'Joining does not mutate the input');
const React = require('react');
let slots = [], cursor = 0;
const marker = () => null;
const table = load('src/components/portal/event-responses-table.tsx', {
  '@/components/action-icons': new Proxy({}, { get: () => marker }),
  './review-action-icon': { ReviewActionIcon: marker },
  './registrants-export': { RegistrantsExport: marker },
  '@/components/animate-ui/icons/arrow-up-down': { ArrowUpDown: marker },
  '@/components/lucide-animated/rotate-ccw': { RotateCCWIcon: marker },
  '@/components/lucide-animated/user-plus': { UserPlusIcon: marker },
  '@/components/lucide-animated/user-round-cog': { UserRoundCogIcon: marker },
  react: { ...React, useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useRef: () => ({ current: null }), useId: () => 'id', useTransition: () => [false, () => {}] },
  './rsvp-response-review': { RsvpResponseReview: marker },
  './sliding-filters': { SlidingFilterButtons: marker },
  './review-modal-ui': { ReviewModalDetailsGroup: marker, ReviewModalHeader: marker, ReviewModalToolbar: marker },
  '@/components/portal/event-evaluation-editor': { EvaluationResponseDetails: marker },
  'next/navigation': { unstable_rethrow: () => {} },
});
assert.equal(rows.filter(row => table.matchesResponseFilter(row, 'registrants')).length, 1);
assert.equal(rows.filter(row => table.matchesResponseFilter(row, 'rsvp')).length, 2);
function walk(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(walk); return [node, ...walk(node.props?.children)]; }
function render() { cursor = 0; return walk(table.EventResponsesTable({ rows, remove: () => {}, save: () => {}, resend: () => {} })); }
const toggle = () => render().find(node => node.props?.label === 'Participant response type');
assert.equal(toggle().props.active, 'registrants');
assert.deepEqual(toggle().props.items.map(item => item.label.props.children[1]), ['Registrants', 'RSVP Responses']);
const renderedRows = () => render().filter(node => node.props?.row);
assert.equal(renderedRows().length, 1);
toggle().props.onChange('rsvp');
assert.equal(renderedRows().length, 2);
assert.equal(renderedRows()[1].props.remove, undefined, 'Response-only entries cannot remove registrations');
const rowElement = renderedRows()[0];
assert.equal(rowElement.props.preferredView, 'rsvp');
slots = []; cursor = 0;
const details = walk(rowElement.type(rowElement.props));
assert.ok(details.some(node => node.props?.response?.reference_code === 'RS-7K3M-9QXA'), 'The RSVP review header shows its own reference');
assert.ok(details.some(node => node.type === 'i' && node.props.className === 'is-edit-request'), 'Pending edit requests display a yellow status dot');
assert.ok(details.some(node => node.props?.response?.id === 'matched'), 'RSVP filter opens the step-based response review');
// Footer capacity counts stay event-wide and exclude RSVP-only and anonymous response rows.
function label(node) {
  if (Array.isArray(node)) return node.map(label).join('');
  if (node && typeof node === 'object') return label(node.props?.children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}
const capacityRows = [...rows, { ...person, id: 'waiting', status: 'waitlisted' }];
function capacity(maximumRegistrants, items = capacityRows) {
  cursor = 0;
  return walk(table.EventResponsesTable({ rows: items, maximumRegistrants }));
}
slots = [];
const capacityText = nodes => label(nodes.find(node => node.props?.className === 'portal-participant-capacity'));
assert.equal(capacityText(capacity(1)), 'Registrants: 1 / 1 · Waitlisted: 1', 'Full slots show a separate waitlist count');
capacity(1).find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'no-match' } });
assert.equal(capacityText(capacity(1)), 'Registrants: 1 / 1 · Waitlisted: 1', 'Search does not change event totals');
assert.equal(capacityText(capacity(10)), 'Registrants: 1 / 10', 'Waitlist count appears only when slots are full');
assert.equal(capacityText(capacity(null)), 'Registrants: 1 / Unlimited');
assert.equal(capacityText(capacity(10, [])), 'Registrants: 0 / 10', 'Empty tables still show capacity');
console.log('Participant checks passed: merged identities, RSVP-only entries, anonymous evaluations, two views, default public registrants, response details, and pending edit request markers.');
