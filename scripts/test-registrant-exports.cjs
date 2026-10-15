/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PDFDocument } = require('pdf-lib');
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const compiled = { exports: {} };
  cache.set(file, compiled);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const resolve = name => name.startsWith('@/') ? load(`src/${name.slice(2)}.ts`) : name.startsWith('.') ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name);
  new Function('require', 'module', 'exports', code)(resolve, compiled, compiled.exports);
  return compiled.exports;
}
function zipParts(bytes) {
  const data = Buffer.from(bytes), parts = {};
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const length = data.readUInt32LE(offset + 18), nameLength = data.readUInt16LE(offset + 26), extra = data.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extra;
    parts[data.toString('utf8', offset + 30, offset + 30 + nameLength)] = data.toString('utf8', start, start + length);
    offset = start + length;
  }
  return parts;
}
(async () => {
  const { createTableExport } = load('src/lib/portal/table-export.ts');
  const columns = ['Name', 'Student number', 'Email'];
  const rows = [['DELA CRUZ, MARIA Ñ', '0012345678', 'maria@example.com'], ['=FORMULA()', '0098765432', 'line\n"quoted"']];
  const csv = await createTableExport(columns, rows, 'csv');
  assert.ok(csv.body.startsWith('\ufeff'));
  assert.ok(csv.body.includes('"\'=FORMULA()"'));
  assert.ok(csv.body.includes('"line\n""quoted"""'));
  const json = await createTableExport(columns, rows, 'json');
  assert.deepEqual(JSON.parse(json.body)[0], { Name: rows[0][0], 'Student number': '0012345678', Email: rows[0][2] });
  const workbook = zipParts((await createTableExport(columns, rows, 'xlsx')).body);
  assert.ok(workbook['xl/workbook.xml'].includes('name="Registrants"'));
  assert.ok(workbook['xl/worksheets/sheet1.xml'].includes('autoFilter ref="A1:C3"'));
  assert.ok(workbook['xl/worksheets/sheet1.xml'].includes('0012345678'));
  assert.ok(!workbook['xl/worksheets/sheet1.xml'].includes('<f>'), 'Values stay text rather than formulas');
  const { directoryXlsx, tableXlsx } = load('src/lib/portal/directory-export.ts');
  const directory = zipParts(directoryXlsx([]));
  assert.ok(directory['xl/workbook.xml'].includes('name="Directory"'));
  assert.ok(directory['xl/worksheets/sheet1.xml'].includes('autoFilter ref="A1:N1"'));
  const wide = zipParts(tableXlsx(Array.from({ length: 30 }, (_, i) => String(i)), [Array(30).fill('value')]));
  assert.ok(wide['xl/worksheets/sheet1.xml'].includes('r="AD2"'));
  const pdf = await PDFDocument.load((await createTableExport(columns, Array.from({ length: 90 }, () => rows[0]), 'pdf')).body);
  assert.ok(pdf.getPageCount() > 1, 'PDF paginates');
  const tall = await PDFDocument.load((await createTableExport(columns, [['MARIA '.repeat(1200), '0012345678', 'maria@example.com']], 'pdf')).body);
  assert.ok(tall.getPageCount() > 1, 'Oversized rows continue on another page');
  const empty = await PDFDocument.load((await createTableExport(columns, [], 'pdf')).body);
  assert.equal(empty.getPageCount(), 1);
  console.log('Registrant exports passed: CSV escaping and formula protection, JSON data, XLSX text values and columns, directory compatibility, PDF pagination and oversized rows.');
})().catch(error => { console.error(error); process.exitCode = 1; });
