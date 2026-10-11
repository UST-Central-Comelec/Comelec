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
const response = (id, email) => ({ id, created_at: '2026-10-08T00:00:00Z', answers: { profile: { firstName: 'Ana', middleName: 'Maria', lastName: 'Cruz', email, studentNumber: '' }, affiliation: 'ust', affiliationKind: 'commission-central', organization: '', college: '', school: '', role: 'head', attendance: 'confirmed', delegation: 'no', additionalParticipants: '', accurate: true, authorized: true, committees: ['programs'], resources: ['audio'], resourceOther: '' } });
const evaluation = (id, registration_id, anonymous) => ({ id, registration_id, anonymous, created_at: '2026-10-08T00:00:00Z', questions: [], answers: {} });
const rows = mergeParticipantRows([person], [response('matched', 'ana@example.com'), response('only', 'other@example.com')], [evaluation('named', 'person', false), evaluation('anonymous', 'person', true), evaluation('orphan', 'removed', false)]);
assert.equal(rows.length, 4);
assert.equal(rows[0].rsvp.id, 'matched', 'Email matching ignores case');
assert.equal(rows[0].evaluation.id, 'named');
assert.equal(rows[1].registered, false, 'RSVP-only people appear in All');
assert.equal(rows[2].name, 'Anonymous response');
assert.equal(rows[2].email, '', 'Anonymous evaluations never disclose the associated registrant');
assert.equal(person.rsvp, undefined, 'Joining does not mutate the input');
const React = require('react');
let slots = [], cursor = 0;
const marker = () => null;
const table = load('src/components/portal/registrants-table.tsx', {
  react: { ...React, useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; }, useRef: () => ({ current: null }), useId: () => 'id', useTransition: () => [false, () => {}] },
  './sliding-filters': { SlidingFilterButtons: marker },
  './review-modal-ui': { ReviewModalDetailsGroup: marker, ReviewModalHeader: marker, ReviewModalToolbar: marker },
  '@/components/portal/event-evaluation-editor': { EvaluationResponseDetails: marker },
  'next/navigation': { unstable_rethrow: () => {} },
});
assert.equal(rows.filter(row => table.matchesResponseFilter(row, 'all')).length, 4);
assert.equal(rows.filter(row => table.matchesResponseFilter(row, 'registrants')).length, 1);
assert.equal(rows.filter(row => table.matchesResponseFilter(row, 'rsvp')).length, 2);
assert.equal(rows.filter(row => table.matchesResponseFilter(row, 'evaluation')).length, 3);
function walk(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(walk); return [node, ...walk(node.props?.children)]; }
function render() { cursor = 0; return walk(table.RegistrantsTable({ rows, remove: () => {}, save: () => {}, resend: () => {} })); }
const toggle = () => render().find(node => node.props?.label === 'Participant response type');
assert.equal(toggle().props.active, 'all');
assert.deepEqual(toggle().props.items.map(item => item.label), ['All', 'Registrants', 'RSVP Responses', 'Evaluation Responses']);
const renderedRows = () => render().filter(node => node.props?.row);
assert.equal(renderedRows().length, 4);
toggle().props.onChange('rsvp');
assert.equal(renderedRows().length, 2);
assert.equal(renderedRows()[1].props.remove, undefined, 'Response-only entries cannot remove registrations');
const rowElement = renderedRows()[0];
assert.equal(rowElement.props.preferredView, 'rsvp');
slots = []; cursor = 0;
const details = walk(rowElement.type(rowElement.props));
assert.ok(details.some(node => node.type === 'i' && node.props.className === 'is-rsvp'), 'RSVP answers display a red status dot');
assert.ok(details.some(node => node.props?.label === 'Participant details view' && node.props.active === 'rsvp'), 'RSVP filter opens the matching response');
console.log('Participant checks passed: merged identities, RSVP-only entries, anonymous evaluations, four filters, default All, response details, and RSVP status dot.');
