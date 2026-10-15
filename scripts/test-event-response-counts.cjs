/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let configured = true;
let fail = false;
const requests = [];
const moduleFile = { exports: {} };
const dependencies = {
  'server-only': {},
  '@/lib/supabase/config': { isSupabaseConfigured: () => configured },
  '@/lib/supabase/server': { createAdminClient: () => ({ from: table => ({ select: (columns, options) => ({ eq: async (column, value) => {
    requests.push({ table, columns, options, column, value });
    return { count: table === 'event_rsvp_responses' ? 1205 : 1500, error: fail ? { message: 'unavailable' } : null };
  } }) }) }) },
};
new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/events/response-counts.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => dependencies[name], moduleFile, moduleFile.exports);
(async () => {
  assert.deepEqual(await moduleFile.exports.getEventResponseCounts('sample'), { rsvp: 1205, evaluation: 1500 });
  assert.equal(requests.length, 2);
  for (const query of requests) {
    assert.deepEqual(query.options, { count: 'exact', head: true }, 'Count without loading answers or being capped at 1,000 rows');
    assert.equal(query.columns, 'id');
    assert.equal(query.column, 'event_id'); assert.equal(query.value, 'sample');
  }
  fail = true;
  await assert.rejects(moduleFile.exports.getEventResponseCounts('sample'), /Couldn’t load/);
  configured = false;
  assert.deepEqual(await moduleFile.exports.getEventResponseCounts('sample'), { rsvp: 0, evaluation: 0 });
  console.log('Event response totals passed: event-scoped exact counts, large totals, no identity retrieval, unavailable and unconfigured states.');
})().catch(error => { console.error(error); process.exitCode = 1; });
