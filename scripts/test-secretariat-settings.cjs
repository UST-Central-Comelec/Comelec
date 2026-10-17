/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Secretariat settings checks. */
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
const settings = load("src/lib/letters/settings.ts");
const defaults = settings.defaultSecretariatSettings;
const clone = value => JSON.parse(JSON.stringify(value));
const errors = value => Object.fromEntries((settings.secretariatSettingsSchema.safeParse(value).error?.issues ?? []).map(issue => [issue.path.join("."), issue.message]));

assert.deepEqual(settings.secretariatSettingsSchema.parse(defaults), defaults, "The defaults are valid settings");
assert.equal(defaults.letters.autoIncrement, true, "Automatic numbering starts on");
assert.equal(settings.numberMode(defaults.letters, defaults.letters.types.find(type => type.name === "Project Proposal")), "fixed");
assert.equal(settings.numberMode(defaults.letters, defaults.letters.types[0]), "auto");
assert.equal(settings.numberMode({ ...defaults.letters, autoIncrement: false }, defaults.letters.types[0]), "manual");
assert.equal(settings.numberMode(defaults.letters, { ...defaults.letters.types[0], autoIncrement: false }), "manual");
assert.equal(settings.numberMode({ ...defaults.letters, autoIncrement: false }, defaults.letters.types.at(-1)), "fixed", "University-issued numbers ignore the switch");
assert.equal(settings.controlNumber("UST:CC-{YYY}-LTR", 7, new Date("2026-12-31T16:00:00Z")), "UST:CC-027-LTR-007", "Years follow Manila time");
assert.equal(settings.controlNumber("CC-{YYYY}", 1234, new Date("2026-06-01T00:00:00Z")), "CC-2026-1234");

const edited = clone(defaults);
edited.letters.types.push({ id: "new-type", name: "  Endorsement   Letter ", format: "UST:CC-{YYY}-END-  ", autoIncrement: true, universityIssued: false });
const parsed = settings.secretariatSettingsSchema.parse(edited);
assert.equal(parsed.letters.types.at(-1).name, "Endorsement Letter", "Names are trimmed and spaces collapsed");
assert.equal(parsed.letters.types.at(-1).format, "UST:CC-{YYY}-END", "Trailing hyphens are dropped, since -001 is appended");
assert.equal("offices" in parsed, false, "Destination offices come from the Database, not these settings");

const broken = clone(defaults);
broken.letters.types[1].name = "request letter";
broken.letters.types[2].format = " ";
broken.letters.types.at(-1).format = "";
broken.statuses = [];
broken.labels.push({ id: "bad id!", name: "Urgent", tone: "pink" });
const problems = errors(broken);
assert.equal(problems["letters.types.1.name"], "Another type already has this name.", "Names are unique, ignoring case");
assert.equal(problems["letters.types.2.format"], "Enter a control number format.");
assert.equal(problems["letters.types.10.format"], "Enter the university-issued number.");
assert.equal(problems.statuses, "Keep at least one status.");
assert.ok(problems["labels.4.id"] && problems["labels.4.tone"]);
assert.ok(errors({ ...clone(defaults), minutes: { autoIncrement: true, types: [] } })["minutes.types"], "Each tracker keeps a type");
assert.ok(errors({ ...clone(defaults), letters: { ...clone(defaults.letters), types: [{ ...defaults.letters.types[0], format: "X".repeat(91) }] } })["letters.types.0.format"], "Automatic formats leave room for the count");

const next = clone(defaults);
next.statuses[0].name = "Initial";
next.labels = next.labels.filter(label => label.name !== "Print");
next.letters.types = next.letters.types.filter(type => type.name !== "Excuse Letter");
next.remarkPresets = next.remarkPresets.filter(preset => preset.name !== "Send to email").concat({ id: "re-added", name: "Send to email" });
assert.deepEqual(settings.settingsChanges(defaults, next), {
  renamed: [{ kind: "status", from: "Draft", to: "Initial" }],
  removed: [{ kind: "letterType", name: "Excuse Letter" }, { kind: "label", name: "Print" }],
}, "Renames and removals are found by id; an item added back under the same name keeps its records");

// The store refuses a save over a newer version before calling the database.
let stored = null;
let rpcCalls = [];
const admin = {
  from: table => { assert.equal(table, "secretariat_settings"); return { select() { return this; }, maybeSingle: async () => ({ data: stored, error: null }) }; },
  rpc: async (name, args) => { rpcCalls.push([name, args]); return { data: { ok: true }, error: null }; },
};
const store = load("src/lib/letters/settings-store.ts", { "server-only": {}, "@/lib/supabase/server": { createAdminClient: () => admin }, "@/lib/supabase/config": { isSupabaseConfigured: () => true } });
let user = { email: "chair@ust.edu.ph", readOnly: false };
let outcome = null;
let revalidated = [];
const actions = load("src/lib/portal/secretariat-settings-actions.ts", {
  "next/cache": { revalidatePath: (...args) => revalidated.push(args) },
  "@/lib/auth/session": { requireEditor: async tab => { assert.equal(tab, "secretariat/settings"); if (user.readOnly) throw new Error("view only"); return user; } },
  "@/lib/letters/settings": settings,
  "@/lib/letters/settings-store": { getSecretariatSettings: store.getSecretariatSettings, writeSecretariatSettings: async (...args) => outcome ?? store.writeSecretariatSettings(...args) },
});

async function main() {
  assert.deepEqual(await store.getSecretariatSettings(), { settings: defaults, updatedAt: null, updatedBy: null }, "Defaults stand until the first save");
  assert.deepEqual(await store.writeSecretariatSettings(next, "2026-10-09T00:00:00Z", "chair@ust.edu.ph"), { conflict: true });
  assert.equal(rpcCalls.length, 0);
  assert.deepEqual(await store.writeSecretariatSettings(next, null, "chair@ust.edu.ph"), { ok: true });
  assert.equal(rpcCalls[0][0], "save_secretariat_settings");
  assert.deepEqual(rpcCalls[0][1].p_changes, settings.settingsChanges(defaults, next));
  stored = { value: { letters: "broken" }, updated_at: "2026-10-09T00:00:00Z", updated_by: "someone" };
  await assert.rejects(store.getSecretariatSettings(), /couldn’t be read/);
  stored = null;

  const saved = await actions.saveSecretariatSettings(null, next);
  assert.deepEqual(saved.settings, defaults, "The page gets what is stored after saving");
  assert.deepEqual(revalidated, [["/portal/secretariat", "layout"]]);
  const invalid = await actions.saveSecretariatSettings(null, broken);
  assert.equal(invalid.fieldErrors["letters.types.1.name"], "Another type already has this name.");
  outcome = { blocked: [{ kind: "status", name: "Draft", count: 3 }] };
  assert.match((await actions.saveSecretariatSettings(null, next)).error, /The status “Draft” is still used by 3 letter or meeting minutes records\./);
  outcome = { conflict: true };
  assert.match((await actions.saveSecretariatSettings(null, next)).error, /Someone else saved/);
  assert.equal(revalidated.length, 1, "Only a successful save refreshes the Secretariat pages");
  user = { ...user, readOnly: true };
  await assert.rejects(actions.saveSecretariatSettings(null, next), /view only/);
  console.log("Secretariat settings checks passed: defaults, numbering modes, Manila years, validation, rename and removal detection, conflicts, blocked removals, and viewer restrictions.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
