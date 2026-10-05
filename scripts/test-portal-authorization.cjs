// Run with: node scripts/test-portal-authorization.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise portal authorization without Next.js. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, compiled, compiled.exports);
  return compiled.exports;
}

const access = load("src/lib/portal/access.ts");
const options = load("src/lib/codes/options.ts", {
  "@/lib/data/accounts": { officeOf: (role) => `Office of the ${role}` },
  "@/lib/data/types": { CHAIRPERSON: "Chairperson" },
});
const account = {
  id: "account", name: "Commissioner", firstName: "Commissioner", email: "commissioner@ust.edu.ph",
  kind: "personal", affiliation: "local", position: "deputy", role: "Deputy", college: "CICS", active: true,
};
let accounts = [account];
let configured = false;
const cookieValues = new Map();
const cookieWrites = [];
const cookieStore = {
  get: (name) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined,
  set: (name, value, options) => { cookieValues.set(name, value); cookieWrites.push({ name, value, options }); },
  delete: ({ name }) => cookieValues.delete(name),
};
const selection = load("src/lib/portal/account-selection.ts");
const identity = { email: account.email, amr: [{ method: "oauth" }], app_metadata: { providers: ["google"] } };
const authClient = { auth: { getClaims: async () => ({ data: { claims: identity } }), signOut: async () => {} } };
const session = load("src/lib/auth/session.ts", {
  "server-only": {},
  "next/headers": { cookies: async () => cookieStore },
  "@/lib/portal/account-selection": selection,
  "next/navigation": { redirect: (href) => { throw new Error(`redirect:${href}`); } },
  "next/server": { connection: async () => {} },
  react: { cache: (fn) => fn },
  "@/lib/data/accounts": { toSummary: (row) => row },
  "@/lib/data/store": { store: { list: async () => accounts } },
  "@/lib/portal/access": access,
  "@/lib/portal/access-store": { getAccessOverrides: async () => ({}) },
  "@/lib/portal/expiry-store": { sweepExpiredAccounts: async () => {} },
  "@/lib/supabase/config": { ALLOWED_EMAIL_DOMAIN: "ust.edu.ph", isSupabaseConfigured: () => configured },
  "@/lib/supabase/server": { createAuthClient: async () => authClient },
});

async function main() {
  const executiveEmail = process.env.PORTAL_EXECUTIVE_EMAIL;
  process.env.PORTAL_EXECUTIVE_EMAIL = "comelec@ust.edu.ph";
  try {
    const { user } = await session.checkAccess(account.email);
    assert.equal(user.affiliation, "local");
    assert.equal(user.position, "deputy");
    assert.equal(user.level, "deputy");
    assert.deepEqual(user.tabs, access.tabsFor(account));
    assert.equal(session.canSeeCollege(user, "Other college"), false);
    assert.equal(session.canOpen(user, "apps/approvals"), false);
    assert.equal(options.canEditCodes(user), false);
    assert.equal(options.approverRoleOf(user), null);

    accounts = [{ ...account, position: "adviser", role: "" }];
    assert.equal((await session.checkAccess(account.email)).user.readOnly, true);
    accounts = [{ ...account, active: false }];
    assert.deepEqual(await session.checkAccess(account.email), { denied: "revoked" });
    accounts = [];
    assert.deepEqual(await session.checkAccess(account.email), { denied: "not-registered" });

    const central = { ...account, id: "central-account", affiliation: "central", position: "executive-board", college: null };
    const other = { ...central, id: "someone-else", email: "other@ust.edu.ph" };
    accounts = [account, central, other];
    assert.equal((await session.checkAccess(account.email)).user.id, central.id);
    const switched = (await session.checkAccess(account.email, undefined, account.id)).user;
    assert.equal(switched.id, account.id);
    assert.equal(switched.affiliation, "local");
    assert.equal(switched.level, "deputy");
    assert.equal(session.canSeeCollege(switched, "Other college"), false);
    assert.equal(session.canOpen(switched, "apps/approvals"), false);
    assert.equal((await session.checkAccess(account.email, undefined, other.id)).user.id, central.id, "A forged selection cannot use someone else’s account");
    assert.equal((await session.checkAccess(account.email, undefined, "missing")).user.id, central.id);
    accounts = [{ ...account, active: false }, central];
    assert.equal((await session.checkAccess(account.email, undefined, account.id)).user.id, central.id, "A revoked selection falls back to an enabled account");
    accounts = [account, central, other];
    configured = true;
    cookieValues.set(selection.ACCOUNT_COOKIE, account.id);
    assert.equal((await session.getPortalUser()).id, account.id, "Every request must honor the membership cookie");
    const memberships = await session.getPortalMemberships();
    assert.deepEqual(memberships.map(item => item.id), [central.id, account.id]);
    const actions = load("src/lib/portal/auth-actions.ts", {
      "next/headers": { cookies: async () => cookieStore },
      "next/navigation": { redirect: href => { throw new Error(`redirect:${href}`); } },
      "next/cache": { revalidatePath: () => {} },
      "@/lib/access-requests/verification": {},
      "./account-selection": selection,
      "@/lib/auth/session": session,
      "@/lib/security/portal-session": { ACTIVITY_COOKIE: "portal_activity", activityCookieOptions: { path: "/portal" } },
      "@/lib/security/rate-limit": {},
      "@/lib/supabase/config": { ALLOWED_EMAIL_DOMAIN: "ust.edu.ph" },
      "@/lib/supabase/server": { createAuthClient: async () => authClient },
    });
    const switchForm = id => { const data = new FormData(); data.set("accountId", id); return data; };
    await assert.rejects(actions.switchPortalAccount(undefined, switchForm(central.id)), /redirect:/);
    assert.equal((await session.getPortalUser()).id, central.id);
    assert.equal(cookieWrites.at(-1).options.httpOnly, true);
    await assert.rejects(actions.switchPortalAccount(undefined, switchForm(account.id)), /redirect:/);
    assert.equal((await session.getPortalUser()).id, account.id);
    const writesBeforeInvalid = cookieWrites.length;
    assert.ok((await actions.switchPortalAccount(undefined, switchForm(other.id))).error);
    accounts = [{ ...account, active: false }, central];
    assert.ok((await actions.switchPortalAccount(undefined, switchForm(account.id))).error);
    assert.equal(cookieWrites.length, writesBeforeInvalid, "Invalid and revoked switches must not change the selection");
    accounts = [account, central];
    await assert.rejects(actions.logout(), /redirect:\/portal\/login/);
    assert.equal(cookieValues.has(selection.ACCOUNT_COOKIE), false);
    const builtInLocal = { ...account, id: "executive-local", email: "comelec@ust.edu.ph" };
    accounts = [builtInLocal];
    assert.equal((await session.checkAccess(builtInLocal.email)).user.builtIn, true);
    const limitedExecutive = (await session.checkAccess(builtInLocal.email, undefined, builtInLocal.id)).user;
    assert.equal(limitedExecutive.builtIn, false);
    assert.equal(limitedExecutive.affiliation, "local");
    assert.equal(session.canOpen(limitedExecutive, "apps/approvals"), false);
    assert.equal((await session.checkAccess(builtInLocal.email, undefined, session.BUILT_IN_ID)).user.builtIn, true);

    const officer = { ...account, affiliation: "central", position: "executive-board" };
    for (const role of options.approverRoles) {
      assert.equal(options.approverRoleOf({ ...officer, role }), role);
      assert.equal(options.canEditCodes({ ...officer, role }), false);
      assert.equal(options.approverRoleOf({ ...officer, role, affiliation: "local" }), null);
      assert.equal(options.approverRoleOf({ ...officer, role, kind: "official" }), null);
      assert.equal(options.approverRoleOf({ ...officer, role, position: "executive-associate" }), null);
    }
    for (const role of options.editorRoles) {
      assert.equal(options.canEditCodes({ ...officer, role }), true);
      assert.equal(options.canEditCodes({ ...officer, role: `Office of the ${role}`, position: "executive-associate" }), true);
      assert.equal(options.canEditCodes({ ...officer, role, affiliation: "local" }), false);
      assert.equal(options.approverRoleOf({ ...officer, role }), null);
    }
    console.log("Portal authorization checks passed.");
  } finally {
    if (executiveEmail === undefined) delete process.env.PORTAL_EXECUTIVE_EMAIL;
    else process.env.PORTAL_EXECUTIVE_EMAIL = executiveEmail;
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
