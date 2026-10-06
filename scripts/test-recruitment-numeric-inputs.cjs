// Run with: node scripts/test-recruitment-numeric-inputs.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Load shared validation without a Next.js runtime. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)(
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/data/types" ? load("src/lib/data/types.ts") : name === "@/lib/data/local-roles" ? load("src/lib/data/local-roles.ts", { "./types": load("src/lib/data/types.ts") }) : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : require(name), compiled, compiled.exports,
  );
  return compiled.exports;
}

const options = load("src/lib/applications/options.ts");
const schema = load("src/lib/applications/schema.ts", {
  "./options": options,
  "@/lib/events/options": { comelecUnit: () => "Local Comelec" },
  "@/lib/periods/summary": { isBodyOpen: () => true },
});
const numeric = load("src/lib/applications/numeric-input.ts");
assert.equal(numeric.digitsOnly("20a26-001234", 10), "2026001234");
assert.equal(numeric.digitsOnly("012345678901", 10), "0123456789");
for (const [input, expected] of [
  ["", ""], ["09", "09"], ["0917", "0917"], ["09171", "0917-1"],
  ["09171234", "0917-123-4"], ["0917 123 4567", "0917-123-4567"],
  ["09a17-123!4567", "0917-123-4567"], ["091712345678", "0917-123-4567"],
]) assert.equal(numeric.formatMobileNumber(input), expected);
const phone = schema.applicationFields.shape.contactNumber;
for (const value of ["", "09171234567", "0917-123-4567"]) assert.equal(phone.safeParse(value).success, true);
for (const value of ["0917-123-456", "0917-123-45678", "+639171234567", "0917 123 4567", "0817-123-4567", "0917-abc-4567"]) assert.equal(phone.safeParse(value).success, false, value);
const student = schema.applicationFields.shape.studentNumber;
assert.equal(student.safeParse("0123456789").success, true);
for (const value of ["2026a12345", "2026-12345", "123456789", "12345678901", "1e12345678"]) assert.equal(student.safeParse(value).success, false, value);
const input = { value: "09179-123-456", selectionStart: 5, setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
numeric.formatNumericInput(input, numeric.formatMobileNumber);
assert.equal(input.value, "0917-912-3456");
assert.equal(input.selectionStart, 6);
console.log("Numeric input filtering, mobile formatting, cursor preservation, and server validation checks passed.");
