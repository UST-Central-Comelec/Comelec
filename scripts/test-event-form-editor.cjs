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
    if (name.startsWith('@/')) { const target = path.resolve(`src/${name.slice(2)}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
const { editorDefinitionSchema } = load('src/lib/events/form-editor.ts');
const { defaultEvaluation, evaluationDefinition, evaluationFromDefinition, evaluationSettingsSchema } = load('src/lib/events/evaluation.ts');
const { defaultRsvpDefinition } = load('src/lib/events/rsvp.ts');
const flow = load('src/lib/events/form-flow.ts');

// The Evaluation keeps added steps (before its Acknowledgement) and their questions through storage.
const field = { id: 'q_choices', label: 'Choose equipment', prompt: '', kind: 'checkbox', required: true, options: ['Camera', 'Radio'], min: 1, max: 2 };
let evalDefinition = evaluationDefinition(defaultEvaluation);
evalDefinition = { steps: [...evalDefinition.steps.slice(0, -1), { id: 'extra', title: 'Follow-up', description: 'Additional feedback', fields: [{ ...field, kind: 'dropdown' }] }, evalDefinition.steps.at(-1)] };
const settings = evaluationFromDefinition(evalDefinition, defaultEvaluation);
assert.equal(evaluationSettingsSchema.safeParse(settings).success, true);
assert.equal(evaluationDefinition(settings).steps.at(-2).fields[0].kind, 'dropdown');

// The editor, rendered without a browser.
const React = require('react');
const slots = {}; let counts = {};
const sortable = { attributes: {}, listeners: {}, setNodeRef: () => {}, setActivatorNodeRef: () => {}, transform: null, transition: undefined, isDragging: false, isOver: false, active: null };
const builder = load('src/components/portal/event-form-editor.tsx', {
  // State is kept per calling component and call order within it, so a component appearing mid-tree doesn't take another's state.
  react: { ...React, useState: initial => { const caller = (new Error().stack.split('\n')[2].match(/at (\S+)/) ?? [])[1] ?? '?'; const slot = `${caller}#${(counts[caller] = (counts[caller] ?? 0) + 1)}`; if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial; return [slots[slot], next => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next; }]; }, useSyncExternalStore: (_subscribe, _client, server) => server(), useEffect: () => {}, useRef: value => ({ current: value }), useId: () => 'editor' },
  '@dnd-kit/core': { DndContext: props => ({ type: 'dnd', props }), KeyboardSensor: {}, PointerSensor: {}, MeasuringStrategy: {}, closestCenter: () => [], useSensor: () => ({}), useSensors: () => [] },
  '@dnd-kit/sortable': { SortableContext: props => ({ type: 'sortable', props }), sortableKeyboardCoordinates: () => {}, useSortable: () => sortable, verticalListSortingStrategy: {} },
  '@dnd-kit/utilities': { CSS: { Translate: { toString: () => undefined } } },
  './event-form-editor.css': {},
  // The view toggle's icons animate; its sliding control is what's checked here.
  './form-editor-view-toggle': { FormEditorViewToggle: ({ mode, onChange }) => ({ type: 'view-switch', props: { label: 'Editor view', active: mode, onChange, items: [{ key: 'forms', label: 'Forms editor' }, { key: 'preview', label: 'Preview form' }] } }) },
  './dropdown': { Dropdown: props => ({ type: 'dropdown', props }) },
  './multi-dropdown': { MultiDropdown: props => ({ type: 'multi', props }) },
  './sliding-filters': { SlidingFilterButtons: props => ({ type: 'view-switch', props }) },
  './photo-input': { compress: async file => file },
  '@/lib/portal/form-image-actions': { uploadFormImage: async () => ({ url: 'https://abc.supabase.co/storage/v1/object/public/uploads/event-forms/x.jpg' }) },
});
function walk(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(walk);
  if (typeof node.type === 'function') return walk(node.type(node.props));
  return [node, ...walk(node.props?.children)];
}
let draft = structuredClone(defaultRsvpDefinition);
let previewed = null;
let editorProps = { defaultValue: defaultRsvpDefinition };
function render() { counts = {}; return walk(builder.EventFormEditor({ title: 'RSVP Form', value: draft, onChange: value => { draft = value; }, allowRating: false, renderPreview: definition => { previewed = definition; return { type: 'preview-marker', props: {} }; }, ...editorProps })); }
const text = node => JSON.stringify(node.props?.children ?? '');
const findButton = label => render().find(node => node.type === 'button' && (node.props['aria-label'] === label || text(node).includes(label)));

// The two views: the Forms editor first, and a Preview of the public form from the draft.
const viewSwitch = render().find(node => node.type === 'view-switch');
assert.deepEqual(viewSwitch.props.items.map(item => item.key), ['forms', 'preview']);
assert.equal(viewSwitch.props.active, 'forms');
viewSwitch.props.onChange('preview');
assert.ok(render().some(node => node.type === 'preview-marker'));
assert.equal(previewed, draft, 'The preview shows the unsaved draft');
render().find(node => node.type === 'view-switch').props.onChange('forms');

// Steps: new ones go before the Acknowledgement; the consent and acknowledgement can't be moved or deleted.
findButton('Add step').props.onClick();
assert.equal(draft.steps.at(-2).title, 'New step');
assert.equal(draft.steps.at(-1).kind, 'acknowledgement');
assert.equal(render().some(node => node.props?.['aria-label'] === 'Delete step'), true, 'An added step can be deleted');

// Questions: added, retyped (keeping only what the type uses), checkbox limits, Conditional.
findButton('Add question').props.onClick();
const added = () => draft.steps.at(-2).fields.at(-1);
assert.equal(added().kind, 'text');
const typeOptions = render().find(node => node.type === 'dropdown' && node.props.labelledBy?.endsWith('-kind')).props.options.map(option => option.value);
assert.deepEqual(typeOptions, ['text', 'textarea', 'email', 'link', 'radio', 'checkbox', 'dropdown', 'confirm'], 'Answer types only: Text and Image are added on their own, and the RSVP has no ratings');
const tickNamed = label => render().find(node => node.type === 'label' && node.props.className?.startsWith('form-builder-tick') && text(node).includes(label));
walk(tickNamed('Auto-uppercase')).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
walk(tickNamed('Letters only')).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
assert.deepEqual(added().rules, { uppercase: true, letters: true });
assert.equal(walk(tickNamed('Numbers only')).find(node => node.type === 'input').props.disabled, true, 'Letters only and Numbers only don’t go together');
render().find(node => node.type === 'dropdown' && node.props.labelledBy?.endsWith('-kind')).props.onChange('checkbox');
assert.deepEqual([added().kind, added().options, added().min, added().max, 'rules' in added()], ['checkbox', ['Option 1', 'Option 2'], 1, 1, false], 'New checkboxes start at one tick, minimum and maximum');
render().find(node => node.type === 'button' && node.props['aria-label'] === 'More: Maximum ticks').props.onClick();
assert.equal(added().max, 2);
walk(tickNamed('Conditional')).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
assert.deepEqual(draft.steps.at(-2).fields.map(item => item.label), ['Untitled question', 'Follow-up: Option 1', 'Follow-up: Option 2']);
assert.equal(editorDefinitionSchema.safeParse(draft).success, true);
assert.equal(findButton('Move down').props.disabled, true, 'A question can’t move below a question it leads to');
const leads = render().find(node => node.type === 'multi');
assert.ok(leads.props.options.some(option => option.value === '__new'), 'A choice can lead to a new question');
leads.props.onChange([draft.steps.at(-2).fields[1].id, draft.steps.at(-2).fields[2].id]);
assert.equal(draft.steps.at(-2).fields[0].branches[0].length, 2, 'A choice can lead to several questions');
render().find(node => node.type === 'dropdown' && node.props.labelledBy?.endsWith('-kind')).props.onChange('text');
assert.equal('branches' in draft.steps.at(-2).fields[0] || 'min' in draft.steps.at(-2).fields[0], false, 'Retyping drops what the old type used');
findButton('Add Text').props.onClick();
assert.equal(added().kind, 'content');
findButton('Add Image').props.onClick();
assert.equal(added().kind, 'image');
assert.ok(render().some(node => node.type === 'button' && text(node).includes('Upload image')));

// The consent step takes confirmation boxes only, and keeps at least one.
const stepButton = title => render().find(node => node.type === 'button' && node.props.onClick && text(node).includes(`"${title}"`));
stepButton('Data Privacy Consent').props.onClick();
assert.ok(findButton('Add consent box'));
assert.equal(render().some(node => node.type === 'button' && text(node).includes('Add question')), false);
draft = flow.removeField(draft, 'rsvp_consent_share');
render().find(node => node.props?.['aria-expanded'] === false).props.onClick();
assert.equal(render().find(node => node.props?.['aria-label'] === 'The consent step needs at least one box').props.disabled, true);

// The acknowledgement: its page and its email, which can be turned off.
stepButton('Acknowledgement').props.onClick();
const emailSwitch = render().find(node => node.type === 'input' && node.props.role === 'switch');
emailSwitch.props.onChange({ target: { checked: false } });
assert.equal(draft.steps.at(-1).acknowledgement.email, false);
assert.ok(render().some(node => text(node).includes('Off: no email')), 'The switch says the email is off');

// Reset puts the starting form back.
findButton('Reset to default').props.onClick();
findButton('Reset form').props.onClick();
assert.deepEqual(draft, defaultRsvpDefinition);
editorProps = {};

// Public questions: controlled, named for plain submission, and ticks in order travel as hidden inputs.
// Questions are revealed with an animation; here they render straight away.
const motionStub = { AnimatePresence: ({ children }) => ({ type: 'presence', props: { children } }), motion: { div: props => ({ type: 'div', props }) }, useIsPresent: () => true, useReducedMotion: () => false };
const publicFields = load('src/components/events/editor-fields.tsx', { './student-verification': { StudentVerification: props => ({ type: 'verify', props }) }, 'motion/react': motionStub, react: { ...React, useState: initial => [initial, () => {}], useRef: value => ({ current: value }), useLayoutEffect: () => {} } });
const values = { q_rank: ['Radio', 'Camera'] };
const controls = walk(publicFields.EditorFields({ fields: [{ ...field, id: 'q_drop', kind: 'dropdown' }, { ...field, id: 'q_rank', ranked: true }, { id: 'q_mail', label: 'Email', prompt: '', kind: 'email', required: true, options: [], verifyUst: true }, { id: 'q_ok', label: 'I agree', prompt: '', kind: 'confirm', required: true, options: [] }], values, onChange: () => {}, verify: { eventId: 'sample', target: 'rsvp-form' } }));
assert.ok(controls.some(node => node.type === 'select' && node.props.name === 'q_drop' && node.props.required));
assert.deepEqual(controls.filter(node => node.type === 'input' && node.props.type === 'hidden' && node.props.name === 'q_rank').map(node => node.props.value), ['Radio', 'Camera']);
assert.ok(controls.some(node => node.type === 'verify'), 'A verified Email question offers UST Google sign-in');
assert.ok(controls.some(node => node.type === 'input' && node.props.name === 'q_mail' && node.props.readOnly), 'It’s filled by the verification, not typed');
assert.ok(controls.some(node => node.type === 'input' && node.props.name === 'q_ok' && node.props.value === 'yes'), 'A confirmation box sends “yes”');
const writes = [];
const store = load('src/lib/events/evaluation-store.ts', {
  'server-only': {}, '@/lib/supabase/config': { isSupabaseConfigured: () => true },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { enabled: true, require_google: true, allow_anonymous: false, questions: defaultEvaluation.questions, steps: null }, error: null }) }) }), upsert: async row => { writes.push(row); return { error: null }; } }) }) },
});
(async () => {
  await store.writeEvaluationContent('sample', { ...settings, enabled: false, allowAnonymous: true });
  assert.equal(writes[0].enabled, true, 'Editing content preserves the deployed open/closed state');
  assert.equal(writes[0].allow_anonymous, false);
  assert.equal(writes[0].require_google, true, "Editing questions preserves authentication settings");
  assert.equal(writes[0].steps.at(-2).title, 'Follow-up', 'Added steps sit before the Acknowledgement');
  assert.equal(writes[0].steps.at(-1).kind, 'acknowledgement');
  console.log('Form editor checks passed: Forms editor and Preview, steps before the Acknowledgement, retyping, checkbox limits, Conditional follow-ups, consent and acknowledgement steps, reset, public questions, dynamic definitions, required answer validation, and deployment preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
