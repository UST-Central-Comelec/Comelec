// Run with: node scripts/test-record-conflicts.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise letters, minutes and calendar conflicts without Next.js or Supabase. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  file = path.resolve(file);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    if (!base) return require(name);
    return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx', mocks);
  }, mod, mod.exports);
  return mod.exports;
}

// A database of single rows, queried the way supabase-js builds queries: filters, then one row back.
const tables = {};
let clock = 0;
const tick = () => new Date(Date.UTC(2026, 9, 12, 3, 0, clock++)).toISOString();
function from(name) {
  const filters = [];
  let action = { kind: 'select' };
  const builder = {
    select() { return builder; },
    update(values) { action = { kind: 'update', values }; return builder; },
    insert(values) { action = { kind: 'insert', values }; return builder; },
    eq(column, value) { filters.push(row => row[column] === value); return builder; },
    is(column, value) { filters.push(row => (row[column] ?? null) === value); return builder; },
    order() { return builder; },
    range() { return builder; },
    async maybeSingle() {
      const rows = tables[name] ?? [];
      if (action.kind === 'insert') { const row = { id: `id-${rows.length}`, ...action.values }; rows.push(row); tables[name] = rows; return { data: row, error: null }; }
      const row = rows.find(item => filters.every(test => test(item)));
      if (!row) return { data: null, error: null };
      if (action.kind === 'update') Object.assign(row, action.values);
      return { data: { ...row }, error: null };
    },
  };
  return builder;
}
const supabase = { createAdminClient: () => ({ from }) };
const mocks = { 'server-only': {}, '@/lib/supabase/server': supabase, '@/lib/supabase/config': { isSupabaseConfigured: () => true } };

const conflict = load('src/lib/letters/conflict.ts', mocks);
const letters = load('src/lib/letters/store.ts', mocks);
const calendar = load('src/lib/calendar/store.ts', mocks);
const { defaultSecretariatSettings: settings } = load('src/lib/letters/settings.ts', mocks);

const base = { title: 'Invitation', label: null, type: settings.letters.types[0].name, status: settings.statuses[0].name, controlNumber: '', destinationOffice: 'Office of the Rector', workingDocuments: [{ type: 'docs', url: 'https://docs.google.com/a' }], remarks: '', notifyStatusUpdates: false, remarkPresets: [] };
const actor = { email: 'jo@ust.edu.ph', name: 'Jo', local: false, college: null };

(async () => {
  // Who changed what: different fields put together, the same field changed differently a clash.
  assert.deepEqual(conflict.compareEdits(base, { ...base, title: 'Mine' }, { ...base, status: 'Sent' }), { theirs: ['status'], clash: [] });
  assert.deepEqual(conflict.compareEdits(base, { ...base, title: 'Mine' }, { ...base, title: 'Theirs' }), { theirs: [], clash: ['title'] });
  assert.deepEqual(conflict.compareEdits(base, { ...base, title: 'Same' }, { ...base, title: 'Same' }), { theirs: [], clash: [] });
  // Their fields go into the form's data as the form itself would send them.
  const data = new FormData();
  data.set('title', 'Mine');
  data.set('notifyStatusUpdates', 'on');
  conflict.setField(data, 'remarkPresets', ['Received', 'Signed']);
  conflict.setField(data, 'notifyStatusUpdates', false);
  conflict.setField(data, 'label', null);
  conflict.setField(data, 'controlNumber', 'X-1');
  assert.deepEqual(data.getAll('remarkPresets'), ['Received', 'Signed']);
  assert.equal(data.has('notifyStatusUpdates'), false);
  assert.equal(data.get('label'), '');
  assert.equal(data.has('controlNumber'), false, 'a number made on the server isn’t sent');

  // A letter saved by someone else after it was opened: refused, with theirs and who saved it.
  tables.secretariat_letters = [{ id: 'l1', control_number: 'UST-001', control_format: settings.letters.types[0].format, title: 'Invitation', label: null, type: base.type, status: base.status, destination_office: base.destinationOffice, working_document: '', working_documents: base.workingDocuments, remarks: '', notify_status_updates: false, remark_presets: [], college: null, prepared_by: 'Jo', created_by: 'jo@ust.edu.ph', created_at: tick(), updated_at: tick(), updated_by: 'jo@ust.edu.ph' }];
  const opened = tables.secretariat_letters[0].updated_at;
  Object.assign(tables.secretariat_letters[0], { status: 'Sent', updated_at: tick(), updated_by: 'maria@ust.edu.ph' });
  await assert.rejects(letters.writeLetter('l1', { ...base, title: 'Renamed' }, actor, settings, 'letters', opened), error => error instanceof letters.RecordConflict && error.by === 'maria@ust.edu.ph' && error.letter.status === 'Sent');
  assert.equal(tables.secretariat_letters[0].title, 'Invitation', 'nothing saved on a conflict');
  // Saved over the version it now names: goes through.
  const saved = await letters.writeLetter('l1', { ...base, title: 'Renamed', status: 'Sent' }, actor, settings, 'letters', tables.secretariat_letters[0].updated_at);
  assert.equal(saved.title, 'Renamed');
  // Without a version (an older page), saved as before.
  await letters.writeLetter('l1', { ...base, title: 'Plain' }, actor, settings, 'letters');
  assert.equal(tables.secretariat_letters[0].title, 'Plain');

  // A calendar note edited by someone else meanwhile: refused, with theirs.
  const who = { college: null, email: 'jo@ust.edu.ph', name: 'Jo' };
  tables.calendar_notes = [{ id: 'n1', college: null, note_date: '2026-10-12', body: 'Bring the ballots', author_name: 'Jo', created_by: 'jo@ust.edu.ph', created_at: tick(), updated_at: tick(), updated_by: 'jo@ust.edu.ph' }];
  const noteOpened = tables.calendar_notes[0].updated_at;
  Object.assign(tables.calendar_notes[0], { body: 'Bring the ballots and pens', updated_at: tick(), updated_by: 'maria@ust.edu.ph' });
  await assert.rejects(calendar.updateNote(who, 'n1', 'Bring ballots', noteOpened), error => error instanceof calendar.CalendarConflict && error.latest.body === 'Bring the ballots and pens');
  // Saving again names their version: replaces it.
  assert.equal((await calendar.updateNote(who, 'n1', 'Bring ballots', tables.calendar_notes[0].updated_at)).body, 'Bring ballots');

  // A to-do ticked done by someone else doesn't block renaming it; a renamed one does.
  tables.calendar_todos = [{ id: 't1', college: null, title: 'Print forms', due_date: null, done: false, author_name: 'Jo', created_by: 'jo@ust.edu.ph', created_at: tick(), updated_at: tick() }];
  Object.assign(tables.calendar_todos[0], { done: true, updated_at: tick() });
  assert.equal((await calendar.updateTodo(who, 't1', { title: 'Print 200 forms', dueDate: null }, 'Print forms')).title, 'Print 200 forms');
  assert.equal(tables.calendar_todos[0].done, true);
  Object.assign(tables.calendar_todos[0], { title: 'Print 300 forms', updated_by: 'maria@ust.edu.ph' });
  await assert.rejects(calendar.updateTodo(who, 't1', { title: 'Print 250 forms', dueDate: null }, 'Print 200 forms'), error => error instanceof calendar.CalendarConflict && error.latest.title === 'Print 300 forms');

  // Another unit's row is still "gone", not a conflict.
  await assert.rejects(calendar.updateNote({ ...who, college: 'College of Science' }, 'n1', 'x', 'any'), error => !(error instanceof calendar.CalendarConflict) && /removed/.test(error.message));

  // An event's RSVP and evaluation forms: left untouched on the editor, they aren't saved over anyone's.
  const calls = [];
  const events = load('src/lib/portal/event-actions.ts', {
    ...mocks,
    'next/cache': { revalidatePath: () => {} },
    'next/navigation': { redirect: path => { throw Error(`Redirect: ${path}`); }, unstable_rethrow: () => {} },
    '@/lib/auth/session': { requireEditor: async () => ({ email: 'jo@ust.edu.ph', affiliation: 'central', college: null }), isLocal: () => false },
    '@/lib/data/edit-guard': { readGuard: () => ({ stamp: null, overwrite: null }), mergePlan: () => ({ write: [], clash: [], theirs: [] }), conflictState: async () => ({}), saveGuarded: async () => ({ saved: true, merged: false }) },
    '@/lib/data/store': { store: {} },
    '@/lib/events/access': { canManageEvent: () => true, canRequestChanges: () => true, unitOfAccount: () => ({ organizer: 'central', college: null }) },
    '@/lib/events/queries': { getEvent: async () => ({ updatedAt: 'v1', updatedBy: 'jo@ust.edu.ph', changeRequest: null }), setChangeRequest: async () => {} },
    '@/lib/events/registrations': {}, '@/lib/events/emails': {}, '@/lib/notifications/notify': {}, '@/lib/events/qr-codes': { ensureQrCodes: async () => ({}) },
    '@/lib/events/evaluation-store': { getEvaluationSettings: async () => ({}), writeEvaluationContent: async () => { calls.push('evaluation'); }, writeEvaluationSettings: async () => {} },
    '@/lib/events/rsvp-store': { getRsvpSettings: async () => null, writeRsvpDefinition: async () => { calls.push('rsvp'); }, writeRsvpSettings: async () => {} },
  });
  const eventForm = (flags) => {
    const sent = new FormData();
    for (const [key, value] of Object.entries({ name: 'Sample event', summary: 'An event for collaborators.', background: '', eventDate: '2026-10-08', endDate: '2026-10-08', ingressTime: '', startsTime: '09:00', endsTime: '10:00', egressTime: '', venueMode: 'onsite', venueDetails: 'UST campus', openToStudents: 'on', ...flags })) sent.set(key, value);
    sent.set('evaluationSettings', JSON.stringify(load('src/lib/events/evaluation.ts').defaultEvaluation));
    sent.set('rsvpDefinition', JSON.stringify(load('src/lib/events/rsvp.ts', mocks).defaultRsvpDefinition));
    return sent;
  };
  const saveEvent = async (flags) => { calls.length = 0; await assert.rejects(events.updateEvent('sample', {}, eventForm(flags)), /Redirect/); return [...calls].sort(); };
  assert.deepEqual(await saveEvent({ rsvpTouched: '', evaluationTouched: '' }), [], 'untouched forms aren’t written');
  assert.deepEqual(await saveEvent({ rsvpTouched: 'on', evaluationTouched: '' }), ['rsvp']);
  assert.deepEqual(await saveEvent({ rsvpTouched: '', evaluationTouched: 'on' }), ['evaluation']);
  assert.deepEqual(await saveEvent({}), ['evaluation', 'rsvp'], 'a page from before the flags saves both, as it did');

  console.log('record conflicts: all checks passed');
})().catch(error => { console.error(error); process.exit(1); });
