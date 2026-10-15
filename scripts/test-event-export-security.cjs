/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the route with isolated auth and export adapters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let user = { email: 'officer@ust.edu.ph' }, allowed = true, limited = false, exportsMade = 0;
const compiled = { exports: {} };
const dependencies = {
  zod: require('zod'),
  '@/lib/auth/session': { getPortalUser: async () => user, canOpen: () => allowed },
  '@/lib/security/rate-limit': { rateLimit: () => ({ ok: !limited, retryAfter: 60 }) },
  '@/lib/portal/table-export': { createTableExport: async () => { exportsMade++; return { body: 'export', type: 'text/csv' }; } },
};
const code = ts.transpileModule(fs.readFileSync('src/app/(portal)/portal/(dashboard)/events/export/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', code)(name => dependencies[name], compiled, compiled.exports);
const { POST } = compiled.exports;
const origin = 'https://comelec.test';
const payload = { format: 'csv', columns: ['Name'], rows: [['CRUZ, ANA']] };
const request = (body = JSON.stringify(payload), headers = {}) => new Request(`${origin}/portal/events/export`, { method: 'POST', headers: { origin, ...headers }, body, ...(typeof body === 'string' ? {} : { duplex: 'half' }) });
(async () => {
  user = null;
  assert.equal((await POST(request())).status, 401);
  user = { email: 'officer@ust.edu.ph' }; allowed = false;
  assert.equal((await POST(request())).status, 403);
  allowed = true;
  assert.equal((await POST(request(undefined, { origin: 'https://other.test' }))).status, 403);
  limited = true;
  const throttled = await POST(request());
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get('retry-after'), '60');
  limited = false;
  assert.equal((await POST(request('{'))).status, 400);
  assert.equal((await POST(request(JSON.stringify({ ...payload, rows: [['one', 'two']] })))).status, 400);
  assert.equal((await POST(request(undefined, { 'content-length': String(3 * 1024 * 1024) }))).status, 413);
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  assert.equal((await POST(request(stream, { 'content-length': '1' }))).status, 413);
  assert.equal(cancelled, true, 'Oversized streams are cancelled despite a forged length');
  const expensive = { format: 'pdf', columns: ['Name'], rows: Array.from({ length: 21 }, () => ['A'.repeat(10000)]) };
  assert.equal((await POST(request(JSON.stringify(expensive)))).status, 413);
  assert.equal(exportsMade, 0, 'Rejected requests never invoke export generation');
  const response = await POST(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(await response.text(), 'export');
  assert.equal(exportsMade, 1);
  console.log('Export security passed: authorization, origin, throttling, malformed data, declared and streamed size limits, PDF work limit, and private responses.');
})().catch(error => { console.error(error); process.exitCode = 1; });
