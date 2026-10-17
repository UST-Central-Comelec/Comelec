/* eslint-disable @typescript-eslint/no-require-imports -- Test keepalive endpoint validation without a live session. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "exports", code)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) return load(path.resolve("src", name.slice(2) + ".ts"), dependencies);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name + ".ts"), dependencies);
    return require(name);
  }, compiled.exports);
  return compiled.exports;
}
(async () => {
  const calls = [];
  const actions = {
    saveEventDeployment: async (id, _, form) => { calls.push({ id, form }); return { success: true, scheduled: { applyAt: "future" } }; },
    discardEventDeployment: async (id, version) => { calls.push({ id, version }); return { success: true }; },
  };
  const route = load("src/app/(portal)/portal/(dashboard)/events/[id]/deployment/schedule/route.ts", {
    "@/lib/portal/event-actions": actions,
  });
  const values = { published: false, registrationStatus: "closed", minimumRegistrants: "2", maximumRegistrants: "20",
    requireGoogle: true, rsvpEnabled: true, rsvpGoogle: false, evaluationEnabled: true, evaluationGoogle: true, allowAnonymous: false };
  const payload = { values, clientId: "11111111-1111-4111-8111-111111111111", revision: 3 };
  const context = { params: Promise.resolve({ id: "sample" }) };
  const request = (body = payload, origin = "https://example.com") => new Request("https://example.com/portal/events/sample/deployment/schedule", {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body),
  });
  let result = await route.POST(request(payload, "https://other.example"), context);
  assert.equal(result.status, 403);
  assert.equal(calls.length, 0, "Cross-origin requests cannot schedule changes");
  result = await route.POST(request("bad json"), context);
  assert.equal(result.status, 400);
  result = await route.POST(request({ ...payload, revision: -1 }), context);
  assert.equal(result.status, 400);
  result = await route.POST(request({ ...payload, values: { ...values, published: "yes" } }), context);
  assert.equal(result.status, 400);
  assert.equal(calls.length, 0, "Invalid requests never reach privileged actions");
  result = await route.POST(request("x".repeat(9000)), context);
  assert.equal(result.status, 413, "Actual body size is bounded");
  result = await route.POST(request(), context);
  assert.equal((await result.json()).success, true);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(calls[0].id, "sample");
  assert.equal(calls[0].form.get("publicationStatus"), "unpublished");
  assert.equal(calls[0].form.get("clientId"), payload.clientId);
  assert.equal(calls[0].form.get("revision"), "3");
  assert.equal(calls[0].form.get("googleEnabled"), "on");
  assert.equal(calls[0].form.get("rsvpGoogleEnabled"), null, "Unchecked settings are represented explicitly by their setting marker");
  assert.equal(calls[0].form.get("rsvpGoogleSetting"), "on");
  await route.POST(request({ cancelVersion: payload.clientId }), context);
  assert.equal(calls[1].version, payload.clientId, "Discard uses the protected server action and version check");
  actions.saveEventDeployment = async () => { throw Error("Sign in required"); };
  await assert.rejects(route.POST(request(), context), /Sign in required/, "Authentication failures cannot fall through to a database write");
  console.log("Deployment endpoint passed: same-origin protection, bounded payloads, schema checks, explicit toggles, revision tracking, cancellation, and auth enforcement.");
})().catch(error => { console.error(error); process.exitCode = 1; });
