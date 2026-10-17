// Run with: node scripts/test-directory-export.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise exports and route authorization without Next.js. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');
const cache = new Map();
function load(file, mocks = {}) {
  file = path.resolve(file);
  if (!Object.keys(mocks).length && cache.has(file)) return cache.get(file);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const base = name.startsWith('@/') ? path.resolve('src', name.slice(2)) : name.startsWith('.') ? path.resolve(path.dirname(file), name) : null;
    if (!base) return require(name);
    return load(base + '.ts');
  }, mod, mod.exports);
  if (!Object.keys(mocks).length) cache.set(file, mod.exports);
  return mod.exports;
}
const exportsModule = load('src/lib/portal/directory-export.ts');
const row = { id: 'one', name: 'Peña, María “Ana”', position: 'executive-board', positionName: 'Executive Board', unit: 'Central Comelec', role: 'Chairperson', college: '', program: '', yearLevel: '', email: 'maria@ust.edu.ph', facebookUrl: '', photoUrl: null, studentNumber: '001234', contactNumber: null, chamberRole: null, declarations: [], manageable: false };
(async () => {
  const csv = exportsModule.directoryCsv([{ ...row, name: '=HYPERLINK("unsafe")' }]);
  assert.ok(csv.startsWith('\ufeff"Position","Name"'));
  assert.match(csv, /"'=HYPERLINK\(""unsafe""\)"/, 'CSV neutralizes formulas and escapes quotation marks');
  const json = await exportsModule.createDirectoryExport([row], 'json');
  const record = JSON.parse(json.body)[0];
  assert.equal(record.Name, row.name);
  assert.equal(record['Student number'], '001234');
  assert.equal(record['Mobile number'], 'Restricted');
  assert.ok(!Object.hasOwn(record, 'manageable'));
  const workbook = exportsModule.directoryXlsx([row]);
  const inspected = spawnSync('python3', ['-c', `import sys,io,zipfile,xml.etree.ElementTree as ET
z=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
assert z.testzip() is None
for name in z.namelist(): ET.fromstring(z.read(name))
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
sheet=ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
assert sheet.find('.//s:pane',ns).get('xSplit') == '2'
assert sheet.find('.//s:c[@r="K2"]/s:is/s:t',ns).text == '001234'
assert sheet.find('.//s:c[@r="B2"]/s:is/s:t',ns).text == 'Peña, María “Ana”'
assert sheet.find('.//s:f',ns) is None
print('Valid XLSX package, XML, Unicode text and frozen columns')`], { input: workbook, encoding: 'utf8' });
  assert.equal(inspected.status, 0, inspected.stderr);
  const { PDFDocument } = require('pdf-lib');
  const pdf = await PDFDocument.load(await exportsModule.directoryPdf(Array.from({length: 20}, () => row)));
  assert.equal(pdf.getTitle(), 'UST Central Comelec Directory');
  assert.ok(pdf.getPageCount() > 1, 'Long PDF exports paginate');
  const emptyPdf = await PDFDocument.load(await exportsModule.directoryPdf([]));
  assert.equal(emptyPdf.getPageCount(), 1, 'Empty exports are still valid PDFs');

  let user = null;
  let mayRead = true;
  let loaded = 0;
  const account = { ...row, name: 'María Peña', lastName: 'Peña', firstName: 'María', middleName: '', middleInitial: '', affiliation: 'central', kind: 'personal', active: true, college: null };
  const local = { ...account, id: 'local', affiliation: 'local', college: 'College of Science' };
  const { GET } = load('src/app/(portal)/portal/(dashboard)/members/export/route.ts', {
    '@/lib/auth/session': { getPortalUser: async () => user, canOpen: (_user, tab) => tab === 'members' ? mayRead : false },
    '@/lib/data/queries': { getAccounts: async () => [account, local], getDirectory: async () => { loaded++; return { central: [account], local: [local] }; } },
  });
  const request = (query) => new Request(`https://example.test/portal/members/export?${query}`);
  assert.equal((await GET(request('format=json'))).status, 401);
  assert.equal(loaded, 0, 'Unauthenticated export loads no directory data');
  user = { ...account, readOnly: true };
  mayRead = false;
  assert.equal((await GET(request('format=json'))).status, 403);
  assert.equal(loaded, 0, 'Forbidden export loads no directory data');
  mayRead = true;
  assert.equal((await GET(request('format=invalid'))).status, 400);
  let response = await GET(request('format=json&q=science'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  let people = await response.json();
  assert.equal(people.length, 1);
  assert.equal(people[0]['Student number'], 'Restricted', 'Exports preserve private-field access');
  user = { ...local, readOnly: true };
  response = await GET(request('format=json'));
  people = await response.json();
  assert.equal(people.length, 1, 'Local exports contain only their unit');
  assert.match(people[0].Unit, /Science/);
  console.log('Passed: CSV/JSON content, valid XLSX ZIP/XML, Unicode PDF pagination, export authentication, filtering and private fields.');
})().catch(error => { console.error(error); process.exitCode = 1; });
