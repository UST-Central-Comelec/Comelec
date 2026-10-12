// Run with: node scripts/test-edit-guard.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the edit guard without Next.js or Supabase. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Two people editing one record: the store is a single in-memory row whose version is its updated_at.
let row;
let clock = 0;
const tick = () => new Date(Date.UTC(2026, 9, 12, 3, 0, clock++)).toISOString();
const store = {
  async update(_collection, _id, data, author) { if (!row) return null; row = { ...row, ...data, updatedAt: tick(), updatedBy: author }; return row; },
  async updateIf(_collection, _id, data, author, expected) { if (!row || row.updatedAt !== expected) return null; row = { ...row, ...data, updatedAt: tick(), updatedBy: author }; return row; },
  async list() { return [{ email: 'maria@ust.edu.ph', name: 'MARIA SANTOS' }]; },
};
const file = path.resolve('src/lib/data/edit-guard.ts');
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const guardModule = { exports: {} };
new Function('require', 'module', 'exports', source)(name => ({
  'server-only': {},
  'node:crypto': require('node:crypto'),
  '@/lib/portal/edit-conflict': { STAMP_FIELD: '_editStamp', OVERWRITE_FIELD: '_editOverwrite' },
  './accounts': { toSummary: account => ({ name: 'Maria Santos', email: account.email }) },
  './store': { store },
})[name], guardModule, guardModule.exports);
const { stampFor, readGuard, mergePlan, saveGuarded, conflictState } = guardModule.exports;

const form = (stamp, overwrite) => { const data = new FormData(); data.set('_editStamp', stamp); if (overwrite) data.set('_editOverwrite', overwrite); return data; };
const load = async () => row && { ...row };
const open = () => form(stampFor(row.updatedAt, row));
const fresh = () => { row = { id: 'e', name: 'Election day', venue: 'Plaza', startsTime: '08:00', endsTime: '17:00', collaborators: ['central'], note: null, updatedAt: tick(), updatedBy: 'jo@ust.edu.ph' }; };

(async () => {
  // Read the same however it's read: "", null and missing are one; object keys in any order.
  const base = JSON.parse(stampFor('v', { a: '', b: { y: 1, x: 2 } })).fields;
  assert.deepEqual(mergePlan(base, { a: null, b: { x: 2, y: 1 } }, { a: undefined, b: { y: 1, x: 2 } }), { write: [], clash: [], theirs: [] });
  assert.equal(JSON.parse(stampFor('v', { id: 'x', updatedAt: 'v', title: 't' })).fields.updatedAt, undefined, 'bookkeeping is not stamped');

  // Nobody else saved: the whole form is written over the version that was opened.
  fresh();
  let result = await saveGuarded('events', 'e', { name: 'Election day 2026', venue: 'Plaza' }, 'jo@ust.edu.ph', readGuard(open()), { load });
  assert.equal(result.saved.name, 'Election day 2026');
  assert.equal(result.merged, false);

  // Different fields: Maria changes the venue, Jo (from the older copy) changes the name. Both survive.
  fresh();
  let jo = open();
  await store.update('events', 'e', { venue: 'Quadricentennial Pavilion' }, 'maria@ust.edu.ph');
  result = await saveGuarded('events', 'e', { name: 'Renamed', venue: 'Plaza', startsTime: '08:00' }, 'jo@ust.edu.ph', readGuard(jo), { load });
  assert.equal(result.merged, true);
  assert.equal(row.name, 'Renamed');
  assert.equal(row.venue, 'Quadricentennial Pavilion', 'the other person’s venue is kept');

  // The same field, changed differently: a conflict, and nothing is written.
  fresh();
  jo = open();
  await store.update('events', 'e', { venue: 'Pavilion' }, 'maria@ust.edu.ph');
  const before = { ...row };
  result = await saveGuarded('events', 'e', { name: 'Election day', venue: 'Gym' }, 'jo@ust.edu.ph', readGuard(jo), { load });
  assert.deepEqual(result.conflict.fields, ['venue']);
  assert.equal(result.conflict.version, before.updatedAt);
  assert.deepEqual(row, before, 'nothing saved on a conflict');

  // Both made the same change: not a conflict.
  fresh();
  jo = open();
  await store.update('events', 'e', { venue: 'Gym' }, 'maria@ust.edu.ph');
  result = await saveGuarded('events', 'e', { venue: 'Gym', name: 'X' }, 'jo@ust.edu.ph', readGuard(jo), { load });
  assert.ok(result.saved);
  assert.equal(row.name, 'X');

  // Chose "Save mine over theirs": written over the version the conflict named.
  const overwrite = before.updatedAt;
  row = { ...before };
  result = await saveGuarded('events', 'e', { name: 'Election day', venue: 'Gym' }, 'jo@ust.edu.ph', readGuard(form(JSON.stringify({ version: 'old', fields: {} }), overwrite)), { load });
  assert.equal(row.venue, 'Gym');
  // And if someone saved yet again in between, it asks again rather than overwriting that too.
  row = { ...before };
  await store.update('events', 'e', { note: 'later' }, 'maria@ust.edu.ph');
  result = await saveGuarded('events', 'e', { venue: 'Gym' }, 'jo@ust.edu.ph', readGuard(form('{}', overwrite)), { load });
  assert.ok(result.conflict);
  assert.equal(row.venue, 'Pavilion');

  // A merge that doesn't hold together is a conflict: Maria moved the start late, Jo moved the end early.
  fresh();
  jo = open();
  await store.update('events', 'e', { startsTime: '16:00' }, 'maria@ust.edu.ph');
  const ordered = merged => merged.startsTime < merged.endsTime;
  result = await saveGuarded('events', 'e', { startsTime: '08:00', endsTime: '12:00' }, 'jo@ust.edu.ph', readGuard(jo), { load, check: ordered });
  assert.deepEqual(result.conflict.fields, ['startsTime']);
  assert.equal(row.endsTime, '17:00');

  // Grouped fields count as one: columns and rows of a table.
  const plan = mergePlan(JSON.parse(stampFor('v', { columns: ['A'], rows: [['1']], title: 't' })).fields, { columns: ['A'], rows: [['2']], title: 't' }, { columns: ['A', 'B'], rows: [['1', '0']], title: 't' }, [['columns', 'rows']]);
  assert.deepEqual(plan.clash, ['columns', 'rows']);

  // No merging: anything the other save changed is a conflict, even a field this person didn't touch.
  fresh();
  jo = open();
  await store.update('accounts', 'e', { venue: 'Elsewhere' }, 'maria@ust.edu.ph');
  result = await saveGuarded('accounts', 'e', { name: 'New name', venue: 'Plaza' }, 'jo@ust.edu.ph', readGuard(jo), { load, merge: false });
  assert.deepEqual(result.conflict.fields, ['venue']);
  // …but a save that only touched what this form doesn't hold goes through whole.
  fresh();
  jo = open();
  await store.update('accounts', 'e', { note: 'internal' }, 'maria@ust.edu.ph');
  result = await saveGuarded('accounts', 'e', { name: 'New name', venue: 'Plaza' }, 'jo@ust.edu.ph', readGuard(jo), { load, merge: false });
  assert.equal(row.name, 'New name');
  assert.equal(row.note, 'internal');

  // Gone while editing.
  fresh();
  jo = open();
  row = null;
  assert.deepEqual(await saveGuarded('events', 'e', { name: 'X' }, 'jo@ust.edu.ph', readGuard(jo), { load }), { missing: true });

  // A form without a stamp saves as before.
  fresh();
  result = await saveGuarded('events', 'e', { name: 'Plain' }, 'jo@ust.edu.ph', readGuard(new FormData()), { load });
  assert.equal(row.name, 'Plain');
  assert.deepEqual(readGuard(form('not json')), { stamp: null, overwrite: null });

  // The message names the person and the fields as the form labels them, once each.
  const state = await conflictState({ by: 'maria@ust.edu.ph', at: 'v2', version: 'v2', fields: ['openToStudents', 'openToAdmins', 'venue'] }, { openToStudents: 'Who can take part', openToAdmins: 'Who can take part', venue: 'Venue' }, 'event', 'jo@ust.edu.ph');
  assert.match(state.error, /^Maria Santos saved this event while you were editing/);
  assert.deepEqual(state.conflict.fields, ['Who can take part', 'Venue']);
  const own = await conflictState({ by: 'JO@ust.edu.ph', at: 'v2', version: 'v2', fields: [] }, {}, 'post', 'jo@ust.edu.ph');
  assert.equal(own.conflict.by, 'You');
  assert.match(own.error, /in another tab/);

  console.log('edit guard: all checks passed');
})().catch(error => { console.error(error); process.exit(1); });
