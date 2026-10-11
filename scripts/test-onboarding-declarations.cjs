// Run with: node scripts/test-onboarding-declarations.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise server actions without a Next.js runtime. */
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Loads a TypeScript module, resolving "@/…" and "./…" to source files, except for `mocks`.
const cache = new Map();
function load(file, mocks = {}) {
  const key = path.resolve(file);
  if (!Object.keys(mocks).length && cache.has(key)) return cache.get(key);
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  const resolve = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    const base = name.startsWith("@/") ? path.join("src", name.slice(2)) : name.startsWith(".") ? path.join(path.dirname(file), name) : null;
    if (!base) return require(name);
    const found = [".ts", ".tsx", "/index.ts"].map((ext) => base + ext).find((candidate) => existsSync(candidate));
    if (!found) throw new Error(`Cannot resolve ${name} from ${file}`);
    return load(found);
  };
  new Function("require", "module", "exports", source)(resolve, compiled, compiled.exports);
  if (!Object.keys(mocks).length) cache.set(key, compiled.exports);
  return compiled.exports;
}

const documents = load("src/lib/onboarding/documents.ts");
const options = load("src/lib/applications/options.ts");

// The text format: headings, paragraphs, bullets and numbered items.
const blocks = documents.parseText("Intro line one\nline two\n\n## Heading\n- a\n- b\n1. one\n2) two\n\nEnd");
assert.deepEqual(blocks, [
  { kind: "paragraph", text: "Intro line one line two" },
  { kind: "heading", text: "Heading" },
  { kind: "bullets", items: ["a", "b"] },
  { kind: "numbers", items: ["one", "two"] },
  { kind: "paragraph", text: "End" },
]);

// Every step's document has a drafted text, and the steps run 0–12 as asked.
assert.equal(documents.onboardingSteps.length, 13);
assert.equal(documents.onboardingSteps[0].id, "privacy-notice");
assert.equal(documents.onboardingSteps[1].id, "profile");
assert.equal(documents.onboardingSteps[12].id, "submit");
for (const key of documents.onboardingDocumentKeys) {
  const text = documents.defaultDocuments[key];
  assert.ok(text.title && text.statement && text.body.length > 400, `${key} has a full draft`);
  assert.ok(documents.stepOf(key) >= 0, `${key} has a step`);
  assert.doesNotMatch(text.body, /'/, `${key} uses curly apostrophes`);
}

// Stored declarations are read defensively.
assert.deepEqual(documents.readDeclarations([{ key: "recusal", title: "Recusal Undertaking", version: 2, acceptedAt: "2026-10-11T03:00:00.000Z" }, { key: "nope", acceptedAt: "2026-10-11T03:00:00.000Z" }, { key: "neutrality", acceptedAt: "not a date" }, null]), [{ key: "recusal", title: "Recusal Undertaking", version: 2, acceptedAt: "2026-10-11T03:00:00.000Z" }]);
assert.deepEqual(documents.readDeclarations(undefined), []);

// The acceptance email's first button opens the applicant's join flow.
const onboarding = load("src/lib/applications/onboarding.ts");
assert.match(onboarding.joinCommissionUrl("APP-ABCD-2345"), /\/portal\/login\?join=APP-ABCD-2345$/);
assert.match(onboarding.joinCommissionUrl(), /\/portal\/login\?request=1$/);

// Submitting: a mock database, Google pass and email senders.
const college = options.colleges[0];
const program = options.programsByCollege[college][0];
let inserted = [];
let updates = [];
let created = [];
let emails = [];
let createFails = false;
let joinProfile = null;
const db = {
  from: () => ({
    insert: (fields) => ({ select: () => ({ single: async () => { inserted.push(fields); return { data: { id: `request-${inserted.length}`, created_at: "2026-10-11T03:00:00.000Z" }, error: null }; } }) }),
    update: (fields) => ({ eq: async () => { updates.push(fields); return { error: null }; } }),
  }),
};
const actions = load("src/lib/access-requests/actions.ts", {
  "next/cache": { revalidatePath: () => {} },
  "next/headers": { headers: async () => new Headers() },
  "next/server": { after: (task) => task() },
  "@/lib/applications/reference": { newReferenceCode: () => "PA-ABCD-2345" },
  "@/lib/auth/session": { checkAccess: async () => ({ denied: "not-registered" }) },
  "@/lib/onboarding/store": { getOnboardingDocuments: async () => documents.onboardingDocumentKeys.map((key) => ({ ...documents.defaultDocument(key), version: key === "recusal" ? 3 : 1 })) },
  "@/lib/notifications/concern": { concernOf: (affiliation, unit) => ({ unit: affiliation === "local" ? "local" : "central", college: unit }) },
  "@/lib/notifications/notify": { sendAutomatic: async (id) => { emails.push(id); }, emailUnit: async (id) => { emails.push(id); } },
  "@/lib/security/rate-limit": { clientIp: () => "1.1.1.1", limits: { apply: { limit: 99, windowMs: 1000 } }, rateLimit: () => ({ ok: true }) },
  "@/lib/supabase/config": { isSupabaseConfigured: () => true },
  "@/lib/supabase/server": { createAdminClient: () => db },
  "./approve": { addRequestedAccount: async (account, author) => { if (createFails) throw new Error("boom"); created.push({ account, author }); } },
  "./emails": { accessDecisionEmail: () => ({}), accessReceivedEmail: () => ({}), accessRequestNoticeEmail: () => ({}) },
  "./join": { findJoinProfile: async (ref, email) => (joinProfile && ref === joinProfile.referenceCode && email === "juan@ust.edu.ph" ? joinProfile : null) },
  "./verification": { readAccessPass: async () => ({ id: "pass", email: "juan@ust.edu.ph", firstName: "Juan", lastName: "Dela Cruz", expiresAt: Date.now() + 60_000 }), isConfirmed: async () => true, clearAccessVerification: async () => {} },
});

const tickedAt = new Date(Date.now() - 5 * 60_000).toISOString();
function form({ join, skip, version = {}, time = tickedAt } = {}) {
  const data = new FormData();
  const fields = { lastName: "DELA CRUZ", firstName: "JUAN", middleName: "PEDRO", studentNumber: "2023123456", contactNumber: "0917-123-4567", facebookUrl: "", college, program, yearLevel: Object.keys(options.yearLevelsFor(college))[0], affiliation: "central", position: "executive-associate", role: "Office of the Chairperson" };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  for (const key of documents.onboardingDocumentKeys) if (key !== skip) data.set(`declaration.${key}`, `${version[key] ?? 1}|${time}`);
  if (join) data.set("join", join);
  return data;
}
const reset = () => { inserted = []; updates = []; created = []; emails = []; createFails = false; joinProfile = null; };

(async () => {
  // Every document has to be agreed to, at a version that exists.
  reset();
  assert.match((await actions.submitAccessRequest(undefined, form({ skip: "confidentiality" }))).error, /every onboarding document/);
  assert.match((await actions.submitAccessRequest(undefined, form({ version: { recusal: 4 } }))).error, /every onboarding document/);
  assert.equal(inserted.length, 0);

  // A full middle name is required on both the form and the server.
  const missingMiddleName = form();
  missingMiddleName.set("middleName", " ");
  assert.equal((await actions.submitAccessRequest(undefined, missingMiddleName)).fieldErrors.middleName, "Add your middle name.");
  assert.equal(inserted.length, 0);

  // A request typed in by hand waits for review, with what was agreed to and when.
  reset();
  let state = await actions.submitAccessRequest(undefined, form({ version: { recusal: 3 } }));
  assert.equal(state.submitted, true, JSON.stringify(state));
  assert.ok(!state.result.approved);
  assert.equal(inserted[0].status, undefined, "manual requests stay pending");
  assert.equal(inserted[0].middle_name, "PEDRO");
  assert.equal(inserted[0].middle_initial, "P");
  assert.equal(state.result.name, "JUAN PEDRO DELA CRUZ");
  assert.equal(state.result.answers[0].rows[0][1], "DELA CRUZ, JUAN PEDRO");
  assert.equal(inserted[0].declarations.length, documents.onboardingDocumentKeys.length);
  assert.equal(inserted[0].declarations.find((item) => item.key === "recusal").version, 3);
  assert.equal(inserted[0].declarations[0].acceptedAt, tickedAt);
  assert.equal(created.length, 0);
  assert.deepEqual(emails.sort(), ["access-notice", "access-received"]);
  assert.ok(state.result.answers.some((section) => section.title === "Declarations"));

  // A time from long ago, or the future, becomes the time it was sent.
  reset();
  await actions.submitAccessRequest(undefined, form({ time: "2020-01-01T00:00:00.000Z" }));
  assert.ok(Date.parse(inserted[0].declarations[0].acceptedAt) > Date.now() - 60_000);

  // Join the Commission: approved straight away, placed where the application says, whatever the form says.
  reset();
  joinProfile = { referenceCode: "APP-1", lastName: "DELA CRUZ", firstName: "JUAN", middleInitial: "P", middleName: "PEDRO", studentNumber: "2023123456", contactNumber: "", facebookUrl: "", college, program, yearLevel: "1", affiliation: "local", position: "executive-associate", role: "Office of the Chairperson", appliedFor: "Executive Assistant to the Chairperson" };
  state = await actions.submitAccessRequest(undefined, form({ join: "APP-1" }));
  assert.equal(state.result.approved, true);
  assert.equal(inserted[0].status, "approved");
  assert.equal(inserted[0].decided_by, "Join the Commission");
  assert.equal(inserted[0].application_reference, "APP-1");
  assert.equal(inserted[0].affiliation, "local");
  assert.equal(created.length, 1);
  assert.equal(created[0].account.affiliation, "local");
  assert.equal(created[0].account.middleName, "PEDRO");
  assert.equal(created[0].account.declarations.length, documents.onboardingDocumentKeys.length);
  assert.deepEqual(emails, ["access-approved"]);

  // If an accepted applicant corrects their middle name, retain what they entered.
  const correctedName = form({ join: "APP-1" });
  correctedName.set("middleName", "Pablo Miguel");
  state = await actions.submitAccessRequest(undefined, correctedName);
  assert.equal(state.result.name, "JUAN PABLO MIGUEL DELA CRUZ");
  assert.equal(created.at(-1).account.middleName, "PABLO MIGUEL");
  assert.equal(inserted.at(-1).middle_name, "PABLO MIGUEL");

  // A join link for someone else's application is an ordinary request.
  reset();
  state = await actions.submitAccessRequest(undefined, form({ join: "APP-OTHER" }));
  assert.ok(!state.result.approved);
  assert.equal(inserted[0].status, undefined);

  // If the account can't be added, the request goes back to waiting for review.
  reset();
  joinProfile = { referenceCode: "APP-1", lastName: "DELA CRUZ", firstName: "JUAN", middleInitial: "P", middleName: "PEDRO", studentNumber: "2023123456", contactNumber: "", facebookUrl: "", college, program, yearLevel: "1", affiliation: "central", position: "executive-associate", role: "Office of the Chairperson", appliedFor: "" };
  createFails = true;
  state = await actions.submitAccessRequest(undefined, form({ join: "APP-1" }));
  assert.ok(!state.result.approved);
  assert.deepEqual(updates, [{ status: "pending", decided_at: null, decided_by: null }]);
  assert.deepEqual(emails.sort(), ["access-notice", "access-received"]);

  console.log("Onboarding declarations passed: text format, drafts for every step, stored declarations, join link, required acceptances, versions and times, manual review, Join the Commission auto-approval and its fallback.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
