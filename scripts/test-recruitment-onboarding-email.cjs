// Run with: node scripts/test-recruitment-onboarding-email.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Test server authorization without a Next.js runtime. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const compiled = { exports: {} };
    cache.set(file, compiled);
    const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", source)(name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`));
      return require(name);
    }, compiled, compiled.exports);
    return compiled.exports;
  }
  return load;
}

async function main() {
  const load = loader();
  const { acceptanceEmail, defaultOnboarding, onboardingSchema } = load("src/lib/applications/onboarding.ts");
  const { colleges } = load("src/lib/applications/options.ts");
  const applicant = { email: "juan@ust.edu.ph", firstName: "JUAN", position: "Executive Assistant to the Chairperson", positionId: "ea-chairperson", division: "", referenceCode: "TEST-001", concern: { unit: "central" } };
  const defaults = acceptanceEmail(applicant, defaultOnboarding());
  assert.match(defaults.html, /Join the Commission/);
  assert.match(defaults.text, /portal\/login\?join=/);
  assert.doesNotMatch(defaults.html, /Join Messenger Group Chat/);
  const settings = { messengerUrl: "https://m.me/j/invite", buttons: [{ title: "Read <script>bad()</script>", url: "https://example.com/guide" }, { title: "Orientation", url: "https://example.com/orientation" }] };
  const email = acceptanceEmail(applicant, settings);
  assert.match(email.text, /Hi Juan/);
  assert.match(email.html, /<strong[^>]*>Executive Assistant to the Chairperson<\/strong>/);
  assert.match(email.html, /<strong[^>]*>Chairperson<\/strong>/);
  assert.ok(email.html.indexOf("Join the Commission") < email.html.indexOf("Join Messenger Group Chat"));
  assert.ok(email.html.indexOf("Join Messenger Group Chat") < email.html.indexOf("Read &lt;script&gt;"));
  assert.ok(email.html.indexOf("Read &lt;script&gt;") < email.html.indexOf("Orientation"));
  assert.match(email.html, /Join Messenger Group Chat/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.doesNotMatch(email.text, /\{position\}/);
  assert.match(acceptanceEmail({ ...applicant, concern: { unit: "local", college: colleges[0] } }, settings).text, new RegExp(colleges[0]));
  for (const messengerUrl of ["javascript:alert(1)", "http://m.me/j/invite", "https://user:pass@example.com", "https://", "not-a-link"]) assert.equal(onboardingSchema.safeParse({ ...settings, messengerUrl }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...settings, buttons: [{ title: "", url: "https://example.com" }] }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...settings, buttons: [{ title: "Unsafe", url: "javascript:alert(1)" }] }).success, false);
  assert.equal(onboardingSchema.safeParse({ ...settings, buttons: Array(11).fill(settings.buttons[0]) }).success, false);

  let user = { email: "board@ust.edu.ph", affiliation: "central", position: "executive-board", readOnly: false, college: null };
  const saved = [];
  let tab;
  const actions = loader({
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect(url) { throw new Error(`REDIRECT:${url}`); } },
    "@/lib/auth/session": { requireEditor: async key => { tab = key; if (user.readOnly) throw new Error("View only"); return user; } },
    "@/lib/applications/onboarding-store": { saveOnboarding: async (...args) => saved.push(args) },
    "@/lib/applications/apply-cache": {},
    "@/lib/applications/slots": {},
    "@/lib/notifications/notify": {},
    "@/lib/notifications/settings-emails": {},
  })("src/lib/portal/recruitment-actions.ts");
  const form = (unit = "", overrides = {}) => {
    const data = new FormData();
    for (const [key, value] of Object.entries({ unit, messengerUrl: settings.messengerUrl, buttons: JSON.stringify(settings.buttons), ...overrides })) data.set(key, value);
    return data;
  };
  await assert.rejects(actions.updateRecruitmentOnboarding(undefined, form()), /REDIRECT:.*onboarding-saved/);
  assert.equal(tab, "recruitment/applications");
  assert.equal(saved[0][0], "");
  assert.equal(saved[0][2], user.email);
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form("", { buttons: JSON.stringify([{ title: "", url: "bad" }]) }))).fieldErrors["buttons.0.title"]);
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form("", { buttons: "invalid JSON" }))).error);
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form("", { messengerUrl: "javascript:alert(1)" }))).fieldErrors.messengerUrl);
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form("unknown-unit"))).error);
  user = { ...user, affiliation: "local", college: colleges[0] };
  await assert.rejects(actions.updateRecruitmentOnboarding(undefined, form(colleges[0])), /REDIRECT:.*unit=/);
  assert.equal(saved[1][0], colleges[0]);
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form(colleges[1]))).error);
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form())).error);
  user = { ...user, affiliation: "central", position: "executive-associate", college: null };
  assert.ok((await actions.updateRecruitmentOnboarding(undefined, form(colleges[0]))).error);
  user.readOnly = true;
  await assert.rejects(actions.updateRecruitmentOnboarding(undefined, form()), /View only/);
  assert.equal(saved.length, 2);
  let application = { ...applicant, preferredBodyId: "central", college: colleges[0] };
  const loadedUnits = [];
  const delivered = [];
  const deliveryActions = loader({
    "next/cache": { revalidatePath() {} },
    "next/navigation": { redirect() { throw new Error("Unexpected redirect"); } },
    "@/lib/auth/session": { requireEditor: async () => ({ name: "Board" }), canSeeCollege: () => true },
    "@/lib/applications/admin": { getApplication: async () => application, isApplicationStatus: status => ["accepted", "declined", "pending"].includes(status), setApplicationStatus: async () => true },
    "@/lib/applications/apply-cache": { clearApplyPageCache() {} },
    "@/lib/applications/onboarding-store": { getOnboarding: async unit => { loadedUnits.push(unit); return settings; } },
    "@/lib/applications/email-log": { sendApplicationEmail: async (_id, kind, build) => { delivered.push({ kind, email: await build() }); return "sent"; } },
  })("src/lib/portal/application-actions.ts");
  const decision = (status, notify = "on") => { const data = new FormData(); data.set("status", status); data.set("notify", notify); return data; };
  assert.equal(await deliveryActions.updateApplicationStatus("applicant", decision("accepted")), "application-accepted-emailed");
  assert.equal(loadedUnits[0], "");
  assert.match(delivered[0].email.text, /Hi Juan/);
  assert.match(delivered[0].email.text, /https:\/\/example.com\/guide/);
  application = { ...application, preferredBodyId: "local" };
  await deliveryActions.updateApplicationStatus("applicant", decision("accepted"));
  assert.equal(loadedUnits[1], colleges[0]);
  await deliveryActions.updateApplicationStatus("applicant", decision("declined"));
  assert.equal(delivered[2].kind, "rejected");
  assert.doesNotMatch(delivered[2].email.html, /Join Messenger Group Chat/);
  await deliveryActions.updateApplicationStatus("applicant", decision("accepted", "off"));
  assert.equal(delivered.length, 3, "An unticked notification must not send email");
  assert.equal(loadedUnits.length, 2, "Rejection must not read acceptance settings");
  console.log("Acceptance button order, bold position and role, escaping, validation, delivery and unit permissions passed.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
