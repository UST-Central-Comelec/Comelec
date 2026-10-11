/* eslint-disable @typescript-eslint/no-require-imports -- Standalone portal regression checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`, dependencies);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`), dependencies);
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const options = load("src/lib/letters/options.ts");
const settings = load("src/lib/letters/settings.ts");
const defaults = settings.defaultSecretariatSettings;
const values = { title: "Executive meeting", type: "Minutes of the Meeting", status: "Draft", destinationOffice: "Office for Student Affairs (OSA)", workingDocuments: [], remarks: "", label: null, notifyStatusUpdates: false, remarkPresets: [] };
assert.ok(options.recordSchema(defaults, "minutes").safeParse(values).success);
assert.equal(options.recordSchema(defaults, "letters").safeParse(values).success, false);
assert.equal(options.recordSchema(defaults, "minutes").safeParse({ ...values, type: "Request Letter" }).success, false);
const id = "11111111-1111-4111-8111-111111111111";
let records = [];
let configured = true;
let user = { email: "officer@ust.edu.ph", name: "Officer", college: "CICS", affiliation: "local", readOnly: false };
const admin = {
  rpc: async (name, args) => { assert.equal(name, "preview_secretariat_control_number"); assert.deepEqual(args, { p_format: "UST:CC-{YYY}-MIN" }); return { data: "UST:CC-027-MIN-001", error: null }; },
  from(table) {
    assert.equal(table, "secretariat_minutes", "Minutes never mutate the letters table");
    const filters = [];
    let mutation;
    return {
      select() { return this; }, order() { return this; }, range() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      insert(data) { mutation = { type: "insert", data }; return this; },
      update(data) { mutation = { type: "update", data }; return this; },
      delete() { mutation = { type: "delete" }; return this; },
      result(single) {
        let rows = records.filter(row => filters.every(([key, value]) => row[key] === value));
        if (mutation?.data) for (const key of ["control_number", "control_sequence", "created_at", "prepared_by"]) {
          if (mutation.type === "update" || key !== "prepared_by") assert.equal(key in mutation.data, false, `${key} is immutable or database assigned`);
        }
        if (mutation?.type === "insert") {
          rows = [{ id, control_number: "UST:CC-027-MIN-001", created_at: "2027-01-01T00:00:00Z", ...mutation.data }]; records.push(...rows);
        }
        if (mutation?.type === "update") rows.forEach(row => Object.assign(row, mutation.data));
        if (mutation?.type === "delete") records = records.filter(row => !rows.includes(row));
        return { data: single ? rows[0] ?? null : rows, error: null };
      },
      maybeSingle() { return Promise.resolve(this.result(true)); },
      then(resolve, reject) { return Promise.resolve(this.result(false)).then(resolve, reject); },
    };
  },
};
const store = load("src/lib/letters/store.ts", { "server-only": {}, "@/lib/supabase/server": { createAdminClient: () => admin }, "@/lib/supabase/config": { isSupabaseConfigured: () => configured } });
const actions = load("src/lib/portal/minute-actions.ts", {
  "next/cache": { revalidatePath: route => assert.ok(["/portal/secretariat/minutes", "/portal"].includes(route)) },
  "@/lib/auth/session": { isLocal: account => account.affiliation === "local", requireEditor: async tab => { assert.equal(tab, "secretariat/minutes"); if (user.readOnly) throw new Error("view only"); return user; } },
  "@/lib/letters/options": options, "@/lib/letters/store": store, "@/lib/letters/settings": settings,
  "@/lib/letters/settings-store": { getSecretariatSettings: async () => ({ settings: defaults, updatedAt: null, updatedBy: null }) },
  "./form": { text: (form, key) => typeof form.get(key) === "string" ? form.get(key) : "" },
});
function form(patch = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ ...values, ...patch })) {
    if (key === "remarkPresets") value.forEach(preset => data.append(key, preset));
    else if (key === "notifyStatusUpdates") { if (value) data.set(key, "on"); }
    else data.set(key, value === null ? "" : Array.isArray(value) ? JSON.stringify(value) : value);
  }
  return data;
}
async function main() {
  assert.equal((await actions.getMinuteNumberPreview("Minutes of the Meeting")).controlNumber, "UST:CC-027-MIN-001");
  assert.ok((await actions.getMinuteNumberPreview("Request Letter")).error, "Only automatic minutes types have previews");
  const saved = await actions.saveMinute(null, form({ college: "AB", created_at: "2000-01-01" }));
  assert.equal(saved.letter.college, "CICS");
  assert.equal(saved.letter.preparedBy, "Officer");
  assert.equal(saved.letter.controlNumber, "UST:CC-027-MIN-001");
  assert.equal((await actions.saveMinute(id, form({ status: "Approved" }))).letter.createdAt, saved.letter.createdAt);
  assert.equal((await actions.setMinuteLabel(id, "Priority")).letter.label, "Priority");
  user = { ...user, college: "AB" };
  assert.equal((await store.listLetters({ local: true, college: "AB" }, "minutes")).length, 0);
  assert.ok((await actions.saveMinute(id, form())).error);
  assert.ok((await actions.setMinuteLabel(id, null)).error);
  assert.ok((await actions.deleteMinute(id)).error);
  user = { ...user, readOnly: true };
  await assert.rejects(actions.saveMinute(null, form()), /view only/);
  user = { ...user, college: "CICS", readOnly: false };
  assert.ok((await actions.saveMinute(null, form({ type: "Request Letter" }))).fieldErrors.type);
  assert.ok((await actions.saveMinute(null, form({ workingDocuments: "invalid" }))).error);
  assert.equal((await actions.deleteMinute(id)).success, true);
  configured = false;
  const RealDate = Date;
  try {
    for (const [instant, year] of [["2026-12-31T15:59:59Z", "026"], ["2026-12-31T16:00:00Z", "027"]]) {
      global.Date = class extends RealDate { constructor(...args) { super(...(args.length ? args : [instant])); } };
      assert.equal(await store.previewControlNumber("UST:CC-{YYY}-LTR"), `UST:CC-${year}-LTR-001`);
      assert.equal(await store.previewControlNumber("UST:CC-{YYY}-MIN"), `UST:CC-${year}-MIN-001`);
    }
  } finally { global.Date = RealDate; }
  console.log("Minutes tracker checks passed: separate storage, validation, college access, immutable metadata, labels, deletion, read-only access, and Manila year rollover.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
