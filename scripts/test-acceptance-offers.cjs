// Run with: node scripts/test-acceptance-offers.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Test the acceptance offer rules without a Next.js runtime. */
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

const DAY = 86_400_000;

async function main() {
  const load = loader();
  const { offerStateOf, OFFER_DAYS, REAPPLY_DAYS, offerExpiry, reapplyFrom } = load("src/lib/applications/offer.ts");
  assert.equal(OFFER_DAYS, 14);
  assert.equal(REAPPLY_DAYS, 60);
  const now = Date.now();
  assert.equal(offerStateOf("accepted", null, null), "open", "An acceptance sent before deadlines has none");
  assert.equal(offerStateOf("accepted", null, new Date(now + DAY).toISOString()), "open");
  assert.equal(offerStateOf("accepted", null, new Date(now - 1000).toISOString()), "lapsed", "Past its 14 days, it lapses before the hourly job runs");
  assert.equal(offerStateOf("declined", "declined", null), "declined");
  assert.equal(offerStateOf("declined", null, null), "none", "A rejection isn't an offer");
  assert.equal(offerStateOf("pending", null, null), "none");
  assert.ok(Math.abs(new Date(offerExpiry(now)).getTime() - now - 14 * DAY) < 5);
  assert.ok(Math.abs(new Date(reapplyFrom(now)).getTime() - now - 60 * DAY) < 5);

  // The Apply form and the server both refuse the unit while its wait lasts, and only that unit.
  const { existingCommissionAccount, hasUnitAccount } = load("src/lib/applications/account-eligibility.ts");
  const until = new Date(now + 30 * DAY).toISOString();
  const accounts = { central: false, colleges: [], holds: [{ body: "central", college: "", reason: "declined", until }, { body: "local", college: "College of Science", reason: "lapsed", until: new Date(now - DAY).toISOString() }] };
  assert.match(existingCommissionAccount(accounts, "central", "College of Science"), /You declined this unit’s offer, so you can apply to it again from .*contact the commission/);
  assert.equal(existingCommissionAccount(accounts, "local", "College of Science"), null, "A finished wait no longer blocks");
  assert.equal(existingCommissionAccount(accounts, "local", "Faculty of Arts and Letters"), null);
  assert.match(existingCommissionAccount({ ...accounts, holds: [{ body: "local", college: "College of Science", reason: "lapsed", until }] }, "local", "College of Science"), /Your offer from this unit lapsed/);
  assert.match(existingCommissionAccount({ central: true, colleges: [] }, "central", ""), /already have a Central/);
  assert.equal(hasUnitAccount({ central: false, colleges: ["College of Science"] }, "local", "College of Science"), true);
  assert.equal(hasUnitAccount({ central: false, colleges: ["College of Science"] }, "central", ""), false);

  // Declining from the tracker.
  let row;
  const queries = [];
  const fakeClient = {
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      const builder = new Proxy({}, {
        get(_target, method) {
          if (method === "then") return (resolve) => resolve({ data: row && query.filters.every(([key, value]) => key === "created_at" || row[key] === undefined || String(row[key]).toUpperCase() === String(value).toUpperCase()) ? row : null, error: null });
          return (...args) => {
            if (["eq", "ilike", "gte"].includes(method)) query.filters.push([args[0], args[1]]);
            if (method === "select") query.columns = args[0];
            return builder;
          };
        },
      });
      return builder;
    },
  };
  const declines = [];
  const unitEmails = [];
  let accountsFor = { central: false, colleges: [] };
  let limited = false;
  let declineResult = "declined";
  const actions = loader({
    "next/headers": { headers: async () => new Headers() },
    "next/cache": { revalidatePath() {} },
    "next/server": { after: (task) => task() },
    "@/lib/reference/store": { ensureReferenceData: async () => {} },
    "@/lib/events/queries": {},
    "@/lib/events/edit-requests": {},
    "@/lib/events/rsvp-store": {},
    "@/lib/events/rsvp": {},
    "@/lib/events/registrations": {},
    "@/lib/events/format": {},
    "@/lib/events/options": { ...load("src/lib/events/options.ts"), requestKinds: {}, requestStatuses: {} },
    "@/lib/access-requests/admin": {},
    "@/lib/security/rate-limit": { clientIp: () => "1.2.3.4", limits: { track: { limit: 10, windowMs: 1000 }, apply: { limit: 1, windowMs: 1 } }, rateLimit: () => (limited ? { ok: false, retryAfter: 120 } : { ok: true }) },
    "@/lib/notifications/notify": { emailUnit: (key, concern, build) => unitEmails.push({ key, concern, email: build(["board@ust.edu.ph"]) }) },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/periods/store": {},
    "@/lib/periods/summary": {},
    "@/lib/supabase/server": { createAdminClient: () => fakeClient },
    "./edit-requests": { pendingSubmissionEditRequest: async () => null },
    "./answers": {},
    "./apply-cache": { clearApplyPageCache() {} },
    "./email-log": {},
    "./interviews": {},
    "./schema": { applicationFields: { shape: {} } },
    "./slots": {},
    "./account-lookup": { getCommissionAccounts: async () => accountsFor },
    "./verification": {},
    "./offer-store": { declineOffer: async (application) => { declines.push(application); if (declineResult === "declined") row = { ...row, status: "declined", offer_response: "declined", offer_responded_at: new Date().toISOString() }; return declineResult; } },
  })("src/lib/applications/actions.ts");

  const accepted = {
    id: "app-1", reference_code: "CC-7K3M-9QXA", first_name: "JUAN", middle_initial: "R", middle_name: "REYES", last_name: "DELA CRUZ", email: "juan@ust.edu.ph", student_number: "2023123456",
    status: "accepted", created_at: new Date(now - 10 * DAY).toISOString(), preferred_body: "central", division: "", position: "Executive Associate to the Chairperson", position_id: "chairperson",
    college: "College of Science", program: "BS Biology", year_level: "2", interview_slots: null, offer_response: null, offer_expires_at: new Date(now + 4 * DAY).toISOString(), offer_responded_at: null,
  };
  const form = (reference, identity) => { const data = new FormData(); data.set("reference", reference); data.set("identity", identity); return data; };

  // Found by reference code and last name, as the email's link fills them in.
  row = { ...accepted };
  const tracked = await actions.trackApplication(undefined, form("CC-7K3M-9QXA", "DELA CRUZ"));
  assert.equal(tracked.application.offer.state, "open");
  assert.match(tracked.application.offer.joinUrl, /portal\/login\?join=CC-7K3M-9QXA/);
  assert.ok(queries.at(-1).columns.includes("offer_expires_at"));

  const declined = await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "dela cruz"));
  assert.equal(declined.error, undefined);
  assert.equal(declined.application.offer.state, "declined");
  assert.equal(declined.application.offer.joinUrl, null);
  assert.deepEqual(declines[0], { id: "app-1", email: "juan@ust.edu.ph", preferredBody: "central", college: "College of Science", referenceCode: "CC-7K3M-9QXA" });
  assert.equal(unitEmails.length, 1);
  assert.equal(unitEmails[0].key, "offer-declined");
  assert.match(unitEmails[0].email.subject, /Offer declined/);
  assert.match(unitEmails[0].email.text, /JUAN R\. DELA CRUZ declined|Juan .*declined/);

  // Nothing left to decline.
  const again = await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "DELA CRUZ"));
  assert.match(again.error, /no longer open/);
  assert.equal(declines.length, 1);

  // Past its 14 days it lapsed, even before the hourly job closes it.
  row = { ...accepted, offer_expires_at: new Date(now - 1000).toISOString() };
  assert.match((await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "DELA CRUZ"))).error, /no longer open/);

  // Already joined (an account in the unit): it can't be declined here.
  row = { ...accepted };
  accountsFor = { central: true, colleges: [] };
  const joined = await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "2023123456"));
  assert.match(joined.error, /already joined/);
  assert.equal(joined.application.offer.state, "joined");
  accountsFor = { central: false, colleges: [] };

  // Wrong surname, other codes, a busy network.
  assert.match((await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "SANTOS"))).error, /couldn’t match/);
  assert.match((await actions.declineAcceptance(undefined, form("PA-7K3M-9QXA", "DELA CRUZ"))).error, /Track your application again/);
  assert.match((await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "DELA CRUZ1"))).error, /Track your application again/);
  limited = true;
  assert.match((await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "DELA CRUZ"))).error, /Too many attempts/);
  limited = false;

  // Answered or changed in the moment between: the latest is shown.
  row = { ...accepted };
  declineResult = "closed";
  const raced = await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "DELA CRUZ"));
  assert.match(raced.error, /changed while you were deciding/);
  assert.ok(raced.application);
  declineResult = "unavailable";
  assert.match((await actions.declineAcceptance(undefined, form("CC-7K3M-9QXA", "DELA CRUZ"))).error, /isn’t available online yet/);
  assert.equal(unitEmails.length, 1, "Only a decline that went through tells the unit");

  console.log("Acceptance offers passed: offer states, the 60-day wait per unit, tracking with the email’s details, declining, lapsed and joined offers, mismatches, rate limits and races.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
