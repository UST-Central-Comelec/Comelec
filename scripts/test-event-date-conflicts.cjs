/* eslint-disable @typescript-eslint/no-require-imports -- Check date conflicts and calendar scope without Next.js. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`), dependencies);
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const { orderedDateRange, dateConflicts } = load('src/lib/calendar/date-conflicts.ts');
const highlights = [
  { id: 'holiday', start: '2026-10-05', end: '2026-10-05', kind: 'holiday' },
  { id: 'moratorium', start: '2026-10-07', end: '2026-10-09', kind: 'moratorium' },
  { id: 'university', start: '2026-10-11', end: '2026-10-11', kind: 'university' },
  { id: 'custom', start: '2026-10-01', end: '2026-10-31', kind: 'custom' },
];
assert.deepEqual(orderedDateRange('2026-10-12', '2026-10-04'), { start: '2026-10-04', end: '2026-10-12' });
assert.deepEqual(orderedDateRange('2026-10-04', '2026-10-04'), { start: '2026-10-04', end: '2026-10-04' });
assert.deepEqual(dateConflicts(highlights, '2026-10-04', '2026-10-12').map(row => row.id), ['moratorium', 'holiday', 'university'], 'Interior conflicts are included and ordered by priority');
assert.deepEqual(dateConflicts(highlights, '2026-10-09', '2026-10-09').map(row => row.id), ['moratorium'], 'Last highlighted day is inclusive');
assert.deepEqual(dateConflicts(highlights, '2026-10-10', '2026-10-10'), [], 'Custom marks do not require an override');
assert.deepEqual(dateConflicts(highlights, '', ''), []);

const rows = [
  { id: 'central', college: null, start_date: '2026-10-07', end_date: '2026-10-09', kind: 'moratorium' },
  { id: 'cics', college: 'CICS', start_date: '2026-10-05', end_date: '2026-10-05', kind: 'holiday' },
  { id: 'other', college: 'Other college', start_date: '2026-10-11', end_date: '2026-10-11', kind: 'university' },
];
let configured = true;
const queries = [];
const store = load('src/lib/calendar/store.ts', {
  'server-only': {},
  '@/lib/supabase/config': { isSupabaseConfigured: () => configured },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: table => {
    const query = { table, college: undefined };
    queries.push(query);
    const builder = {
      select: () => builder,
      is: (_column, value) => { query.college = value; return builder; },
      eq: (_column, value) => { query.college = value; return builder; },
      order: () => builder,
      then: resolve => Promise.resolve({ data: table === 'calendar_highlights' ? rows.filter(row => row.college === query.college) : [], error: null }).then(resolve),
    };
    return builder;
  } }) },
});
(async () => {
  const local = await store.listCalendarHighlights({ college: 'CICS' });
  assert.deepEqual(local.map(row => row.id), ['cics', 'central'], 'Local units get their own and Central highlights');
  assert.equal(local.find(row => row.id === 'central').shared, true);
  assert.equal(local.find(row => row.id === 'cics').shared, false);
  assert.deepEqual(queries.map(query => query.college), ['CICS', null], 'No other Local unit is queried');
  queries.length = 0;
  assert.deepEqual((await store.listCalendarHighlights({ college: null })).map(row => row.id), ['central']);
  assert.equal(queries.length, 1);
  assert.deepEqual((await store.listCalendar({ college: 'CICS' })).highlights, local, 'Calendar tab and date pickers read identical highlights');
  configured = false;
  assert.deepEqual(await store.listCalendarHighlights({ college: null }), []);
  console.log('Event date checks passed: reverse ranges, inclusive and interior conflicts, priority, custom marks, and shared unit-scoped highlights.');
})().catch(error => { console.error(error); process.exitCode = 1; });
