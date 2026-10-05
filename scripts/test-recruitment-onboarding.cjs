// Run with: node scripts/test-recruitment-onboarding.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise server actions without a Next.js runtime. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)(
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : require(name), compiled, compiled.exports,
  );
  return compiled.exports;
}

const options = load("src/lib/applications/options.ts");
const types = load("src/lib/data/types.ts");
const accounts = load("src/lib/data/accounts.ts", { "@/lib/applications/options": options, "./types": types });
const scope = load("src/lib/portal/account-scope.ts", { "@/lib/data/accounts": accounts, "@/lib/data/types": types });
const rows = [];
let manager = { email: "manager@ust.edu.ph", kind: "personal", affiliation: "central", position: "executive-board", college: null };
let missingAccess = false;
let notifications = 0;
let application = {
  status: "accepted", email: "applicant@ust.edu.ph", firstName: "Juan", lastName: "Dela Cruz", middleName: "Pedro",
  studentNumber: "2026000001", yearLevel: "3rd year", preferredBodyId: "central", positionId: "ea-chairperson",
  college: options.colleges[0], program: options.programsByCollege[options.colleges[0]][0], facebookUrl: "https://facebook.com/juan",
};
const store = {
  list: async () => rows,
  create: async (_table, fields) => {
    const row = { ...fields, id: `account-${rows.length}`, createdAt: new Date().toISOString() };
    rows.push(row);
    return row;
  },
};
const actions = load("src/lib/portal/account-actions.ts", {
  "next/cache": { revalidatePath: () => {} },
  "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
  "@/lib/auth/session": {
    isAllowedEmail: (email) => email.endsWith("@ust.edu.ph"), isBuiltInEmail: () => false,
    canSeeCollege: (user, college) => user.affiliation !== "local" || user.college === college,
    requireEditor: async () => { if (missingAccess) throw new Error("Access denied"); return manager; },
  },
  "@/lib/data/accounts": accounts,
  "@/lib/data/store": { store, isMissingColumn: () => false },
  "@/lib/applications/options": options,
  "@/lib/applications/admin": { getApplication: async () => application },
  "@/lib/data/types": types,
  "@/lib/data/uploads": { hasFile: () => false },
  "@/lib/notifications/account-emails": {},
  "@/lib/notifications/notify": { later: () => { notifications++; } },
  "@/lib/supabase/config": { ALLOWED_EMAIL_DOMAIN: "ust.edu.ph" },
  "./account-scope": scope,
  "./form": load("src/lib/portal/form.ts"),
});
const queries = load("src/lib/data/queries.ts", { "server-only": {}, "./accounts": accounts, "./store": { store }, "./types": types });

async function main() {
  assert.equal(await actions.onboardApplication("applicant"), undefined);
  assert.equal(rows[0].role, "Office of the Chairperson");
  assert.equal(rows[0].position, "executive-associate");
  assert.equal(rows[0].middleName, "PEDRO");
  assert.equal(rows[0].middleInitial, null);
  assert.equal(rows[0].yearLevel, "3");
  assert.equal(rows[0].name, "JUAN PEDRO DELA CRUZ");
  assert.equal(rows[0].active, true);
  assert.equal((await queries.getDirectory()).central[0].email, application.email);

  assert.ok((await actions.onboardApplication("applicant")).fieldErrors.email, "Repeated onboarding must not duplicate accounts");
  assert.equal(rows.length, 1);
  application = { ...application, email: "second@ust.edu.ph", status: "pending" };
  assert.match((await actions.onboardApplication("applicant")).error, /Accept/);
  application.status = "accepted";
  manager = { ...manager, position: "deputy" };
  assert.ok((await actions.onboardApplication("applicant")).error, "A deputy cannot create an associate account");
  manager = { ...manager, position: "executive-board", affiliation: "local", college: application.college };
  assert.ok((await actions.onboardApplication("applicant")).error, "Local managers cannot onboard into Central Comelec");
  application.preferredBodyId = "local";
  assert.equal(await actions.onboardApplication("applicant"), undefined);
  assert.equal((await queries.getDirectory()).local[0].email, application.email);
  application = { ...application, email: "third@ust.edu.ph", college: options.colleges[1] };
  assert.match((await actions.onboardApplication("applicant")).error, /no longer available/);
  missingAccess = true;
  await assert.rejects(actions.onboardApplication("applicant"), /Access denied/);
  assert.equal(rows.length, 2);

  missingAccess = false;
  manager = { ...manager, affiliation: "central", college: null };
  application = { ...application, email: "applicant@ust.edu.ph", college: options.colleges[0], program: options.programsByCollege[options.colleges[0]][0] };
  assert.equal(await actions.onboardApplication("applicant"), undefined, "A Central commissioner can be onboarded into Local with the same email");
  assert.equal(rows.length, 3);
  assert.ok((await actions.onboardApplication("applicant")).fieldErrors.email, "A second account in the same Local unit must be blocked");
  assert.equal(rows.length, 3);
  const eligibility = load("src/lib/applications/account-eligibility.ts");
  const lookup = load("src/lib/applications/account-lookup.ts", {
    "server-only": {}, "@/lib/data/accounts": accounts, "@/lib/data/store": { store },
  });
  const localOnly = await lookup.getCommissionAccounts(" SECOND@UST.EDU.PH ");
  assert.equal(eligibility.existingCommissionAccount(localOnly, "central", application.college), null);
  assert.match(eligibility.existingCommissionAccount(localOnly, "local", application.college), /Local Commission Account/);
  const centralOnly = { central: true, colleges: [] };
  assert.match(eligibility.existingCommissionAccount(centralOnly, "central", application.college), /Central Commission Account/);
  assert.equal(eligibility.existingCommissionAccount(centralOnly, "local", application.college), null, "Central membership must leave Local eligible");
  const both = await lookup.getCommissionAccounts("applicant@ust.edu.ph");
  assert.match(eligibility.existingCommissionAccount(both, "central", application.college), /Central Commission Account/);
  assert.match(eligibility.existingCommissionAccount(both, "local", application.college), /Local Commission Account/);
  assert.equal(eligibility.existingCommissionAccount(both, "local", options.colleges[1]), null);
  rows[0].active = false;
  assert.equal((await lookup.getCommissionAccounts("applicant@ust.edu.ph")).central, true, "Revoked accounts still prevent duplicates");

  assert.deepEqual(accounts.positionsFor("central"), ["executive-board", "executive-associate", "adviser"]);
  assert.deepEqual(accounts.positionsFor("local"), ["executive-board", "executive-associate", "deputy", "adviser"]);
  assert.deepEqual(accounts.positionsFor("osa"), ["admin"]);
  assert.equal(accounts.listName(accounts.toSummary(rows[1])), "DELA CRUZ, JUAN PEDRO");
  assert.equal(accounts.fullName({ firstName: "JUAN", lastName: "CRUZ", middleInitial: "P" }), "JUAN P. CRUZ");

  const manual = (overrides = {}) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ kind: "personal", email: "manual@ust.edu.ph", firstName: "Juan", lastName: "Cruz", middleName: "Pedro Santos", studentNumber: "2026000002", affiliation: "local", position: "executive-board", role: types.CENTRAL_REPRESENTATIVE, college: "Faculty of Pharmacy", program: options.programsByCollege["Faculty of Pharmacy"][0], yearLevel: "4", facebookUrl: "", ...overrides })) data.set(key, value);
    return data;
  };
  const beforeSilent = notifications;
  await assert.rejects(actions.createAccount(undefined, manual()), /Unexpected redirect/);
  assert.equal(notifications, beforeSilent, "An unchecked notification checkbox must not send email");
  const added = rows.at(-1);
  assert.equal(added.affiliation, "local");
  assert.equal(added.college, "Faculty of Pharmacy");
  assert.equal(added.middleName, "PEDRO SANTOS");
  assert.equal(added.yearLevel, "4");
  assert.equal(accounts.isCentralRepresentative(added), true);
  assert.ok((await actions.createAccount(undefined, manual({ email: "duplicate-rep@ust.edu.ph" }))).fieldErrors.role);
  assert.ok((await actions.createAccount(undefined, manual({ yearLevel: "invalid" }))).fieldErrors.yearLevel);
  assert.ok((await actions.createAccount(undefined, manual({ middleName: "" }))).fieldErrors.middleName);
  assert.ok((await actions.createAccount(undefined, manual({ email: "manual@gmail.com" }))).fieldErrors.email);
  assert.ok((await actions.createAccount(undefined, manual({ email: "manual@ust.edu.ph.evil.example" }))).fieldErrors.email);
  assert.ok((await actions.createAccount(undefined, manual({ studentNumber: "202600000A" }))).fieldErrors.studentNumber);
  assert.ok((await actions.createAccount(undefined, manual({ affiliation: "central", position: "deputy", role: types.DEPUTY }))).fieldErrors.position);
  assert.ok((await actions.createAccount(undefined, manual({ college: "" }))).fieldErrors.college);
  await assert.rejects(actions.createAccount(undefined, manual({ email: "admin@ust.edu.ph", affiliation: "osa", position: "admin" })), /Unexpected redirect/);
  assert.equal(rows.at(-1).college, null);
  assert.equal(rows.at(-1).yearLevel, null);
  const beforeNotify = notifications;
  await assert.rejects(actions.createAccount(undefined, manual({ email: "notify@ust.edu.ph", position: "executive-associate", role: "Office of the Chairperson", notifyEmail: "on" })), /Unexpected redirect/);
  assert.equal(notifications, beforeNotify + 1);
  assert.equal(rows.at(-1).emailVerifiedAt, null, "Manually added accounts must stay unverified until Google sign-in");
  for (const [college, yearLevel, program] of [["Junior High School", "7", ""], ["Senior High School", "11", options.programsByCollege["Senior High School"][0]], ["Education High School", "1", ""]]) {
    await assert.rejects(actions.createAccount(undefined, manual({ email: `${yearLevel}${college.split(" ")[0]}@ust.edu.ph`, college, yearLevel, program, position: "executive-associate", role: "Office of the Chairperson" })), /Unexpected redirect/);
    assert.equal(rows.at(-1).yearLevel, yearLevel);
    assert.equal(rows.at(-1).program, program || null);
  }
  assert.ok((await actions.createAccount(undefined, manual({ college: "Junior High School", yearLevel: "11", program: "" }))).fieldErrors.yearLevel);

  const { renderToStaticMarkup } = require("react-dom/server");
  const now = Date.parse("2026-10-05T00:00:00Z");
  const { ApplicationRetentionCountdown } = load("src/components/portal/application-retention-countdown.tsx", {
    react: { useState: () => [now], useEffect: () => {} }, "@/lib/applications/options": options,
  });
  const countdown = (elapsed) => renderToStaticMarkup(ApplicationRetentionCountdown({ submittedAt: new Date(now - elapsed).toISOString() }));
  assert.match(countdown(0), /60d 0h 0m 0s/);
  assert.match(countdown(86_400_000 + 3_661_000), /58d 22h 58m 59s/);
  assert.match(countdown(60 * 86_400_000), /Deletion due/);
  assert.match(countdown(61 * 86_400_000), /Deletion due/);
  console.log("Onboarding permissions, duplicate prevention, directory membership, and retention countdown checks passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
