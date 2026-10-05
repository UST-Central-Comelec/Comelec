// Run with: node scripts/test-recruitment-documents.cjs
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
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : require(name), compiled, compiled.exports,
  );
  return compiled.exports;
}

const options = load("src/lib/applications/options.ts");
const schema = load("src/lib/applications/schema.ts", {
  "./options": options,
  "@/lib/events/options": { comelecUnit: () => "Local Comelec" },
  "@/lib/periods/summary": { isBodyOpen: () => true },
});
const answers = load("src/lib/applications/answers.ts", {
  "./options": options,
  "./schema": schema,
  "./interview-format": load("src/lib/applications/interview-format.ts"),
});
const fields = ["cvUrl", "registrationFormUrl", "letterOfIntentUrl", "endorsementUrl", "portfolioUrl", "gradesUrl"];
const form = new FormData();
form.set("division", "operations");
form.set("cvUrl", "https://drive.google.com/file/d/cv/view");
form.set("registrationFormUrl", "https://drive.google.com/file/d/registration/view");
const read = () => schema.readApplication(form);
const check = () => schema.checkFields(read(), fields);

assert.ok(check().letterOfIntentUrl, "Letter of Intent must be required");
form.set("letterOfIntentUrl", "https://example.com/intent");
assert.ok(check().letterOfIntentUrl, "Letter of Intent must use Google Drive");
form.set("letterOfIntentUrl", "https://drive.google.com/file/d/intent/view");
assert.deepEqual(check(), {}, "Recommendation, portfolio and grades are optional outside Public Information");
form.set("division", "public-information");
assert.ok(check().portfolioUrl, "Public Information requires a portfolio");
form.set("portfolioUrl", "https://drive.google.com/file/d/portfolio/view");
assert.deepEqual(check(), {});
form.set("division", "operations");
form.set("gradesUrl", "https://example.com/grades");
assert.ok(check().gradesUrl, "Optional grades must be a valid Drive link when provided");
form.set("gradesUrl", "https://drive.google.com/file/d/grades/view");
form.set("endorsementUrl", "https://drive.google.com/file/d/recommendation/view");
assert.deepEqual(check(), {});
const rows = Object.fromEntries(answers.describeAnswers(read(), answers.interviewLater).find(({ id }) => id === "documents").rows);
assert.equal(rows["Letter of Intent"], form.get("letterOfIntentUrl"));
assert.equal(rows["Recommendation Letter"], form.get("endorsementUrl"));
assert.equal(rows.Portfolio, form.get("portfolioUrl"), "Retain optional portfolios outside Public Information");
assert.equal(rows["Latest Copy of Grades"], form.get("gradesUrl"));
console.log("Recruitment document validation and receipt checks passed.");
