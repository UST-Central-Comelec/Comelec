// Run with: node scripts/test-recruitment-unit-slots.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise server modules without Next.js. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const ts = require("typescript");
function load(file, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/data/types" ? load("src/lib/data/types.ts") : name === "@/lib/data/local-roles" ? load("src/lib/data/local-roles.ts", { "./types": load("src/lib/data/types.ts") }) : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : require(name), compiled, compiled.exports);
  return compiled.exports;
}
const options = load("src/lib/applications/options.ts");
const college = options.colleges[0];
const position = options.positions[0].id;
const rows = [{ college: "", position_id: position, slots: 2 }, { college, position_id: position, slots: 5 }];
let writes = [];
const slots = load("src/lib/applications/slots.ts", {
  "server-only": {}, "./options": options,
  "@/lib/supabase/config": { isSupabaseConfigured: () => true },
  "@/lib/supabase/server": { createAdminClient: () => ({ from: () => ({
    select: () => ({ data: rows, error: null, eq: (key, value) => ({ data: rows.filter((row) => row[key] === value), error: null }) }),
    upsert: async (data, config) => { writes.push({ data, config }); return { error: null }; },
  }) }) },
});
// Every unit recruits for its own offices; renamed offices keep their saved vacancy ids.
const { localRolesByCollege } = load("src/lib/data/local-roles.ts", { "./types": load("src/lib/data/types.ts") });
for (const [unit, roles] of Object.entries(localRolesByCollege)) {
  const choices = options.positionsForUnit(unit);
  assert.deepEqual(choices.map((choice) => choice.role), roles);
  assert.equal(new Set(choices.map((choice) => choice.id)).size, choices.length, `${unit} has unique slot ids`);
}
const pharmacy = options.positionsForUnit("Faculty of Pharmacy");
assert.equal(pharmacy.find((choice) => choice.id === "ea-finance-officer").role, "Finance Head");
assert.ok(pharmacy.some((choice) => choice.role === "Internal Public Information Officer"));
assert.ok(pharmacy.some((choice) => choice.role === "External Public Information Officer"));
assert.ok(!pharmacy.some((choice) => choice.role === "Deputy Head"));
assert.ok(!options.positionsForUnit("College of Rehabilitation Sciences").some((choice) => choice.role === "Deputy Head"));
assert.equal(options.positionsForUnit("College of Science").find((choice) => choice.id === "ea-deputy-head").role, "Deputy Head/Chief-of-Staff Officer");

let user = { affiliation: "local", college, readOnly: false, position: "executive-board", email: "manager@ust.edu.ph" };
const actions = load("src/lib/portal/recruitment-actions.ts", {
  "next/cache": { revalidatePath: () => {} },
  "next/navigation": { redirect: (href) => { throw new Error(`redirect:${href}`); } },
  "@/lib/auth/session": { requireEditor: async () => user },
  "@/lib/applications/options": options,
  "@/lib/applications/apply-cache": { clearApplyPageCache: () => {} },
  "@/lib/applications/slots": slots,
  "@/lib/events/access": load("src/lib/events/access.ts"),
  "@/lib/periods/kinds": load("src/lib/periods/kinds.ts"),
  "@/lib/notifications/concern": { concernOf: () => ({}) },
  "@/lib/notifications/notify": { actorOf: () => ({ name: "Manager" }) },
  "@/lib/notifications/settings-emails": { settingChanged: () => {} },
  "./form": load("src/lib/portal/form.ts"),
});
function form(unit) {
  const data = new FormData();
  data.set("unit", unit);
  for (const item of options.positions) {
    data.set(`loaded-${item.id}`, "0");
    data.set(`slots-${item.id}`, item.id === position ? "3" : "0");
  }
  return data;
}
async function main() {
  assert.equal((await slots.getSlots())[position], 2);
  assert.equal((await slots.getSlots(college))[position], 5);
  assert.equal((await slots.getSlots(options.colleges[1]))[position], 0);
  const assistant = "ea-central-representative";
  assert.equal((await slots.getSlots())[assistant], undefined, "Central does not offer Local Central Division");
  assert.equal((await slots.getSlots(college))[assistant], 0, "Local assistant defaults to closed until configured");
  const units = await slots.getUnitSlots();
  assert.equal(units[""][position], 2);
  assert.equal(units[college][position], 5);
  assert.ok((await actions.updateRecruitmentSlots(undefined, form(""))).error, "Local cannot write Central slots");
  assert.ok((await actions.updateRecruitmentSlots(undefined, form(options.colleges[1]))).error, "Local cannot write another college's slots");
  assert.equal(writes.length, 0);
  await assert.rejects(actions.updateRecruitmentSlots(undefined, form(college)), /redirect:.*unit=/);
  assert.equal(writes[0].data[0].college, college);
  assert.equal(writes[0].config.onConflict, "college,position_id");
  user = { ...user, affiliation: "central", position: "deputy" };
  assert.ok((await actions.updateRecruitmentSlots(undefined, form(college))).error, "Only Central board can change another unit's settings");
  await assert.rejects(actions.updateRecruitmentSlots(undefined, form("")), /redirect:/);
  assert.equal(writes[1].data[0].college, "");
  console.log("Unit-specific slot reads, writes, zero defaults, and editing permissions passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
