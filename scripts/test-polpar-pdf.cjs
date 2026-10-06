// Run: node scripts/test-polpar-pdf.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS tests with a small TypeScript module loader. */
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, mkdtempSync } = require("node:fs");
const { resolve, join } = require("node:path");
const { tmpdir } = require("node:os");
const ts = require("typescript");
const { PDFDocument } = require("pdf-lib");
function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const content = load("src/lib/polpar/content.ts");
const types = load("src/lib/data/types.ts");
const options = load("src/lib/applications/options.ts", {
  "@/lib/data/types": types,
  "@/lib/data/local-roles": load("src/lib/data/local-roles.ts", { "./types": types }),
});
const schema = load("src/lib/polpar/schema.ts", { "@/lib/applications/options": options });
const pdfData = load("src/lib/polpar/pdf-data.ts", { "./schema": schema });
const { generatePartyPdf } = load("src/lib/polpar/pdf.ts", { "./content": content, "./pdf-data": pdfData });
const signatory = { fullName: "José Niño Dela Peña", position: "President" };
const officer = { ...signatory, college: "Faculty of Arts and Letters", studentNumber: "2026000001", contactNumber: "09170000000", email: "party@example.com", recruitedAt: "2026-01-01" };
const conforme = { fullName: officer.fullName, college: officer.college, studentNumber: officer.studentNumber, signedOn: "2026-10-04", witness1Name: "María Santos", witness1Date: "2026-10-04", witness2Name: "Andrés Cruz", witness2Date: "2026-10-04" };
const data = { unit: "central", partyName: "Partido ng mga Tomasino", establishedAt: "2025-06-01", headquarters: "Room 101, UST", contactPerson: signatory.fullName, contactNumber: officer.contactNumber, email: officer.email, petitionDate: "2026-10-04", petitionSignatory: signatory, officers: [officer], members: [officer], alumni: [], affiliates: [], conformes: [conforme], certifications: Object.fromEntries(content.rosterSections.map(({ id }) => [id, signatory])), submittedBy: signatory.fullName, submittedPosition: "President" };
const asset = (name) => new Uint8Array(readFileSync(resolve("public/documents/polpar/assets", name)));
const assets = { regular: asset("DejaVuSerif.ttf"), bold: asset("DejaVuSerif-Bold.ttf"), ust: asset("ust.jpg"), comelec: asset("comelec.png") };

(async () => {
  assert(pdfData.validatePdf(data, "all").success, "PDF export does not need uploads or signature confirmations");
  assert(pdfData.validatePdf({ ...data, submittedBy: "", conformes: [] }, "01").success, "Individual export only validates its fields");
  assert(!pdfData.validatePdf({ ...data, submittedBy: "" }, "07").success);
  assert(!pdfData.validatePdf({ ...data, conformes: [] }, "06").success);
  assert(!pdfData.validatePdf({ ...data, conformes: [{ ...conforme, witness2Name: "" }] }, "all").success);
  assert(!pdfData.validatePdf({ ...data, headquarters: "" }, "all").success);
  const dir = mkdtempSync(join(tmpdir(), "polpar-pdf-"));
  let totalPages = 0;
  for (const form of pdfData.pdfForms) {
    const bytes = await generatePartyPdf(data, form.id, assets);
    const doc = await PDFDocument.load(bytes);
    assert(doc.getPageCount() > 0);
    totalPages += doc.getPageCount();
    const dimensions = doc.getPage(0).getSize();
    assert.deepEqual(dimensions, { width: ["02", "05"].includes(form.id) ? 936 : 612, height: ["02", "05"].includes(form.id) ? 612 : ["06", "07"].includes(form.id) ? 792 : 936 });
    writeFileSync(join(dir, `form-${form.id}.pdf`), bytes);
  }
  const packet = await generatePartyPdf(data, "all", assets);
  assert.equal((await PDFDocument.load(packet)).getPageCount(), totalPages);
  writeFileSync(join(dir, "all-forms.pdf"), packet);
  const longRoster = { ...data, members: Array.from({ length: 90 }, (_, i) => ({ ...officer, fullName: `Member ${String.fromCharCode(65 + Math.floor(i / 26), 65 + i % 26)} José Niño Dela Peña`, studentNumber: String(2026000000 + i) })) };
  const roster = await generatePartyPdf(longRoster, "03", assets);
  assert((await PDFDocument.load(roster)).getPageCount() > 2, "Long rosters must paginate");
  writeFileSync(join(dir, "long-roster.pdf"), roster);
  const twoConformes = await generatePartyPdf({ ...data, conformes: [conforme, { ...conforme, fullName: "Second Applicant" }] }, "06", assets);
  assert.equal((await PDFDocument.load(twoConformes)).getPageCount(), 2, "Each applicant gets their own conforme");
  const longCell = await generatePartyPdf({ ...data, officers: [{ ...officer, email: `${"a".repeat(180)}@example.com`, college: "LongAcademicUnit".repeat(15) }] }, "02", assets);
  writeFileSync(join(dir, "long-cells.pdf"), longCell);
  assert.equal(pdfData.validatePdf({ ...data, partyName: "Test 🐈" }, "01").success, false, "Emoji must be rejected before PDF generation");
  await assert.rejects(generatePartyPdf({ ...data, partyName: "Test 🐈" }, "01", assets), /Complete the fields/, "Emoji must not reach PDF generation");
  console.log(`PDF checks passed: all seven forms, independent export validation, accented names, page dimensions, combined packet, long rosters/cells, individual conformes, and unsupported glyph handling. Samples: ${dir}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
