// Run with: node scripts/test-input-rules.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the shared input rules without Next.js. */
// The strict input rules (AGENTS.md, "Names, numbers and emails"): names in capitals with letters only,
// 10-digit student numbers, 11-digit mobile numbers, and emails whose domain takes mail.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, mocks = {}) {
  file = path.resolve(file);
  const mod = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", source)((name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(file), name) : null;
    if (!base) return require(name);
    return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : `${base}.tsx`, mocks);
  }, mod, mod.exports);
  return mod.exports;
}

const input = load("src/lib/forms/input.ts");
const fields = load("src/lib/forms/fields.ts");

// 1. Names: letters only, in capitals, single spaces.
assert.equal(input.cleanPersonName("dela cruz"), "DELA CRUZ");
assert.equal(input.cleanPersonName("  maría  clara "), "MARÍA CLARA ", "a space can trail while the next word is typed");
assert.equal(input.cleanPersonName("o'neil-smith jr. 3rd"), "ONEILSMITH JR RD");
assert.equal(input.cleanPersonName("peña"), "PEÑA");
assert.equal(input.tidyPersonName(" juan   pedro "), "JUAN PEDRO");
const name = fields.personName("Add your last name.");
assert.equal(name.parse("  dela   cruz "), "DELA CRUZ", "saved in capitals, single spaces");
assert.equal(name.parse("Peña"), "PEÑA");
for (const bad of ["O'Neil", "Smith-Jones", "Juan2", "Jr.", "J@ne", ""]) assert.equal(name.safeParse(bad).success, false, `“${bad}” is refused, not quietly cleaned`);
assert.ok(input.personNamePattern.test("MARIA CLARA"));
assert.ok(!input.personNamePattern.test("Maria Clara"), "saved names are in capitals");
assert.ok(!input.personNamePattern.test("MARIA  CLARA"), "one space between words");

// 2. Student numbers: exactly 10 digits.
assert.equal(input.cleanStudentNumber("2023-12a3456789"), "2023123456");
const student = fields.studentNumber();
assert.ok(student.safeParse("2023123456").success);
for (const bad of ["202312345", "20231234567", "2023-123456", "202312345a"]) assert.equal(student.safeParse(bad).success, false, bad);

// 4. Mobile numbers: 11 digits from 09, digits only, typed and saved.
assert.equal(input.cleanMobileNumber("+63 917-123-4567"), "63917123456");
assert.equal(input.cleanMobileNumber("0917-123-4567"), "09171234567");
const mobile = fields.mobileNumber();
assert.ok(mobile.safeParse("09171234567").success);
for (const bad of ["0917-123-4567", "0917 123 4567", "+639171234567", "9171234567", "08171234567", "091712345678"]) assert.equal(mobile.safeParse(bad).success, false, bad);
assert.ok(fields.optionalMobileNumber().safeParse("").success);

// 3. Emails: well formed here, and the domain takes mail (below).
const email = fields.email();
assert.equal(email.parse(" Juan@Example.COM "), "juan@example.com");
for (const bad of ["juan", "juan@", "juan@example", "juan@example.c", "juan@-example.com", "ju an@example.com", "juan@exa_mple.com"]) assert.equal(email.safeParse(bad).success, false, bad);
assert.equal(input.cleanEmail(" juan @ust.edu.ph "), "juan@ust.edu.ph");

// The guard: by field name. An event's or party's name isn't a person's.
assert.equal(input.sanitizeFormInput("dela cruz", "lastName"), "DELA CRUZ");
assert.equal(input.sanitizeFormInput("juan p.", "officers.0.fullName"), "JUAN P");
assert.equal(input.sanitizeFormInput("Election Day 2026", "name"), "Election Day 2026");
assert.equal(input.sanitizeFormInput("Partido 2026", "partyName"), "Partido 2026");
assert.equal(input.sanitizeFormInput("0917-123-4567", "contactNumber"), "09171234567");
assert.equal(input.sanitizeFormInput("0917 123 4567", "affiliates.2.contactNumber"), "09171234567");
assert.equal(input.sanitizeFormInput("2023 123 456 789", "studentNumber"), "2023123456");
assert.equal(input.sanitizeFormInput("a b@x.com", "email"), "ab@x.com");

(async () => {
  // The domain check, with DNS answered here: real, made up, no mail, null MX, and DNS down.
  const answers = {
    "example.com": { records: [{ exchange: "mail.example.com", priority: 10 }] },
    "gmial.con": { code: "ENOTFOUND" },
    "nomail.com": { code: "ENODATA" },
    "nullmx.com": { records: [{ exchange: "", priority: 0 }] },
    "down.com": { code: "ETIMEOUT" },
  };
  let lookups = 0;
  const dns = { promises: { resolveMx: async (domain) => { lookups++; const answer = answers[domain]; if (answer.records) return answer.records; const error = new Error(answer.code); error.code = answer.code; throw error; } } };
  const quiet = console.error;
  console.error = () => {};
  try {
    const domains = load("src/lib/forms/email-domain.ts", { "server-only": {}, "node:dns": dns, "@/lib/supabase/config": { ALLOWED_EMAIL_DOMAIN: "ust.edu.ph" } });
    assert.equal(await domains.emailDomainProblem("juan@example.com"), null);
    assert.match(await domains.emailDomainProblem("juan@gmial.con"), /gmial\.con can’t receive email/);
    assert.match(await domains.emailDomainProblem("juan@nomail.com"), /can’t receive email/);
    assert.match(await domains.emailDomainProblem("juan@nullmx.com"), /can’t receive email/);
    assert.equal(await domains.emailDomainProblem("juan@down.com"), null, "DNS being down doesn’t block the form");
    const before = lookups;
    assert.equal(await domains.emailDomainProblem("juan.delacruz@ust.edu.ph"), null);
    assert.equal(lookups, before, "UST addresses aren’t looked up");
    await domains.emailDomainProblem("ana@example.com");
    assert.equal(lookups, before, "a domain's answer is remembered");
    assert.deepEqual(await domains.emailDomainProblems({ email: "a@example.com", "officers.0.email": "b@gmial.con", "officers.1.email": "" }), { "officers.0.email": "gmial.con can’t receive email. Check the spelling of the address." });
  } finally {
    console.error = quiet;
  }

  // The form builder: a name or student-number question follows the rules whatever was ticked; mobile is a rule.
  const editor = load("src/lib/events/form-editor.ts");
  const question = (extra) => ({ id: "q", label: "Last name", prompt: "", kind: "text", required: true, options: [], ...extra });
  const last = question({ identity: "lastName" });
  assert.equal(editor.cleanAnswer(last, "dela cruz-2"), "DELA CRUZ");
  assert.equal(editor.normalizeAnswer(last, " dela  cruz "), "DELA CRUZ");
  assert.equal(editor.answerProblem(last, editor.normalizeAnswer(last, "dela cruz")), null);
  assert.match(editor.answerProblem(last, editor.normalizeAnswer(last, "O'Neil")), /letters only/);
  const number = question({ label: "Student number", identity: "studentNumber" });
  assert.equal(editor.cleanAnswer(number, "2023-123456789"), "2023123456");
  assert.match(editor.answerProblem(number, "202312345"), /10-digit/);
  const phone = question({ label: "Mobile number", rules: { mobile: true } });
  assert.equal(editor.cleanAnswer(phone, "0917-123-4567"), "09171234567");
  assert.equal(editor.answerProblem(phone, "09171234567"), null);
  assert.match(editor.answerProblem(phone, "9171234567"), /11-digit mobile number/);
  const mail = question({ label: "Email", kind: "email" });
  assert.match(editor.answerProblem(mail, "juan@example"), /valid email/);
  assert.equal(editor.answerProblem(mail, "juan@example.com"), null);
  assert.ok(!editor.editorFieldSchema.safeParse(question({ kind: "textarea", rules: { mobile: true } })).success, "only a short answer can be a mobile number");

  console.log("Input rules passed: capital letter-only names, 10-digit student numbers, digit-only 11-digit mobile numbers, and emails whose domain takes mail.");
})().catch((error) => { console.error(error); process.exit(1); });
