// Run with: node scripts/test-polpar.cjs
// Exercise validation and the multipart endpoint with isolated Storage/database adapters.
/* eslint-disable @typescript-eslint/no-require-imports -- This standalone CommonJS runner loads transpiled modules with isolated test adapters. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { randomUUID } = require("node:crypto");
const ts = require("typescript");

function load(file, dependencies = {}) {
  const filename = resolve(file);
  const source = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : require(name), compiled, compiled.exports);
  return compiled.exports;
}

const types = load("src/lib/data/types.ts");
const options = load("src/lib/applications/options.ts", {
  "@/lib/data/types": types,
  "@/lib/data/local-roles": load("src/lib/data/local-roles.ts", { "./types": types }),
});
const content = load("src/lib/polpar/content.ts");
const schema = load("src/lib/polpar/schema.ts", { "@/lib/applications/options": options });
const period = load("src/lib/applications/period.ts");
const signatory = { fullName: "Test Representative", position: "President" };
const officer = { ...signatory, college: "Faculty of Arts and Letters", studentNumber: "2026000001", contactNumber: "09170000000", email: "example@ust.edu.ph", recruitedAt: "2026-01-01" };
const payload = { unit: "central", partyName: "Test Party", establishedAt: "2025-01-01", headquarters: "Test headquarters", contactPerson: "Test Representative", contactNumber: "09170000000", email: "example@ust.edu.ph", petitionDate: "2026-10-04", petitionSignatory: signatory, officers: [officer], members: [{ ...officer }], alumni: [], affiliates: [], certifications: Object.fromEntries(content.rosterSections.map(({ id }) => [id, signatory])), submittedBy: "Test Representative", submittedPosition: "President", petitionAccepted: true, recordsAccepted: true, conformeAccepted: true };

function endpoint({ closed = false, insertError = null, uploadFailureAt = -1, existing = null } = {}) {
  const uploaded = [], removed = [], rows = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }) }),
      insert: (row) => ({ select: () => ({ single: async () => { rows.push(row); return { error: insertError, data: insertError ? null : { ...row, created_at: "2026-10-04T10:00:00Z" } }; } }) }),
    }),
    storage: { from: () => ({
      upload: async (path) => {
        if (uploaded.length === uploadFailureAt) return { error: { message: "upload failure" } };
        uploaded.push(path); return { error: null };
      },
      remove: async (paths) => { removed.push(...paths); return { error: null }; },
    }) },
  };
  const route = load("src/app/api/polpar/route.ts", {
    "@/lib/applications/period": period,
    "@/lib/periods/store": { getUnitPeriod: async () => ({ mode: closed ? "closed" : "open", closesAt: null, graceEndsAt: null }) },
    "@/lib/periods/kinds": { unitFromKey: (college) => ({ organizer: college ? "local" : "central", college: college || null }) },
    "@/lib/security/rate-limit": { clientIp: () => "test", limits: { apply: { limit: 5, windowMs: 1 } }, rateLimit: () => ({ ok: true }) },
    "@/lib/supabase/config": { isSupabaseConfigured: () => true },
    "@/lib/supabase/server": { createAdminClient: () => client },
    "@/lib/polpar/content": content,
    "@/lib/polpar/schema": schema,
  });
  return { ...route, uploaded, removed, rows };
}
function request({ data = payload, missing = [], spoof = false, origin = "http://localhost:3000" } = {}) {
  const form = new FormData();
  form.set("submissionId", randomUUID());
  form.set("payload", typeof data === "string" ? data : JSON.stringify(data));
  for (const requirement of content.requirements) {
    if (missing.includes(requirement.id) || requirement.id === "alumniIds") continue;
    form.append(requirement.id, new Blob([spoof ? "not a PDF" : "%PDF-1.7\nTest file"], { type: "application/pdf" }), "test.pdf");
  }
  return new Request("http://localhost:3000/api/polpar", { method: "POST", headers: { origin }, body: form });
}

(async () => {
  assert(schema.partyRegistrationSchema.safeParse(payload).success);
  assert(!schema.partyRegistrationSchema.safeParse({ ...payload, headquarters: "" }).success);
  assert(schema.partyRegistrationSchema.safeParse({ ...payload, unit: options.comelecUnits[0], headquarters: "" }).success);
  assert(!schema.partyRegistrationSchema.safeParse({ ...payload, petitionDate: "2024-01-01" }).success);
  assert(!schema.partyRegistrationSchema.safeParse({ ...payload, recordsAccepted: false }).success);
  assert(!schema.partyRegistrationSchema.safeParse({ ...payload, officers: [{ ...officer, email: "invalid" }] }).success);

  const success = endpoint();
  const response = await success.POST(request());
  assert.equal(response.status, 200);
  assert.match((await response.json()).receipt.reference, /^PP-[A-F0-9]{12}$/);
  assert.equal(success.rows.length, 1);
  assert.equal(success.rows[0].documents.length, 11);
  assert.equal(success.removed.length, 0);

  const missing = endpoint();
  const missingResponse = await missing.POST(request({ missing: ["petition", "constitution"] }));
  assert.equal(missingResponse.status, 400);
  assert((await missingResponse.json()).fieldErrors.petition);
  assert.equal(missing.uploaded.length, 0);
  const alumni = endpoint();
  const alumniResponse = await alumni.POST(request({ data: { ...payload, alumni: [{ fullName: "Test Alumni", college: "Test College", yearGraduated: "2020", contactNumber: "09170000000" }] } }));
  assert.equal(alumniResponse.status, 400);
  assert((await alumniResponse.json()).fieldErrors.alumniIds);

  const spoofed = endpoint();
  assert.equal((await spoofed.POST(request({ spoof: true }))).status, 400);
  assert.equal(spoofed.uploaded.length, 0);
  const closed = endpoint({ closed: true });
  assert.equal((await closed.POST(request())).status, 409);
  assert.equal(closed.uploaded.length, 0);
  const closedDuringUpload = endpoint({ insertError: { message: "party_registration_closed" } });
  assert.equal((await closedDuringUpload.POST(request())).status, 409);
  assert.deepEqual(closedDuringUpload.removed, closedDuringUpload.uploaded);
  assert.equal(closedDuringUpload.uploaded.length, 11);

  const brokenUpload = endpoint({ uploadFailureAt: 2 });
  const originalError = console.error;
  console.error = () => {};
  try { assert.equal((await brokenUpload.POST(request())).status, 503); }
  finally { console.error = originalError; }
  assert.deepEqual(brokenUpload.removed, brokenUpload.uploaded);
  assert.equal(brokenUpload.rows.length, 0);
  const retry = endpoint({ existing: { reference: "PP-EXISTING", party_name: payload.partyName, created_at: "2026-10-04T10:00:00Z" } });
  assert.equal((await (await retry.POST(request())).json()).receipt.reference, "PP-EXISTING");
  assert.equal(retry.uploaded.length, 0);
  assert.equal((await endpoint().POST(request({ origin: "https://another-site.example" }))).status, 403);
  assert.equal((await endpoint().POST(request({ data: "{" }))).status, 400);
  const tooLarge = request();
  tooLarge.headers.set("content-length", String(content.MAX_REQUEST_BYTES + 1));
  assert.equal((await endpoint().POST(tooLarge)).status, 413);

  // Check both list and detail scope, not just the page’s visibility.
  const scopes = [];
  let viewer = { affiliation: "local", college: "Faculty of Arts and Letters" };
  const store = load("src/lib/polpar/store.ts", {
    "server-only": {},
    "next/navigation": { notFound: () => { throw new Error("not_found"); } },
    "@/lib/auth/session": { requireAccess: async () => viewer },
    "@/lib/supabase/server": { createAdminClient: () => ({ from: () => {
      const query = { select: () => query, order: () => query, limit: () => query, eq: (key, value) => { scopes.push([key, value]); return query; }, maybeSingle: async () => ({ data: { college: "Another college" }, error: null }), then: (resolve) => resolve({ data: [], error: null }) };
      return query;
    } }) },
  });
  await store.listPartyRegistrations();
  assert(scopes.some(([key, value]) => key === "college" && value === viewer.college));
  await assert.rejects(store.getPartyRegistration(randomUUID()), /not_found/);
  assert.equal(store.canReadParty(viewer, ""), false);
  assert.equal(store.canReadParty(viewer, viewer.college), true);
  viewer = { affiliation: "local", college: null };
  assert.deepEqual(await store.listPartyRegistrations(), []);
  console.log("PolPaR checks passed: validation, multipart submission, private upload manifest, missing requirements, alumni IDs, file signatures, period closure, upload rollback, retry receipts, origin/size checks, and Local account isolation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
