// Run with: node scripts/test-recruitment-local-division.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise validation and server permissions without Next.js. */
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
const schema = load("src/lib/applications/schema.ts", {
  "./options": options,
  "@/lib/events/options": { comelecUnit: () => "Local Comelec" },
  "@/lib/periods/summary": { isBodyOpen: () => true },
});
const values = { preferredBody: "local", division: "central", position: "ea-central-representative", college };
assert.deepEqual(schema.checkFields(values, ["division", "position"], { "ea-central-representative": 1 }), {});
assert.ok(schema.checkFields({ ...values, preferredBody: "central" }, ["position"], { "ea-central-representative": 1 }).position);
assert.ok(schema.checkFields(values, ["division", "position"], { "ea-central-representative": 0 }).position);
const pharmacy = options.positionsForUnit("Faculty of Pharmacy");
for (const role of ["Finance Head", "Internal Public Information Officer", "External Public Information Officer", "Biochemistry Deputy Head"]) {
  const position = pharmacy.find((choice) => choice.role === role);
  const values = { preferredBody: "local", college: "Faculty of Pharmacy", position: position.id };
  assert.deepEqual(schema.checkFields(values, ["position"], { [position.id]: 1 }), {});
  assert.ok(schema.checkFields({ ...values, college: "College of Science" }, ["position"], { [position.id]: 1 }).position || role === "Finance Head", "Distinct offices must be limited to their unit");
}
assert.ok(schema.checkFields({ preferredBody: "local", college: "Faculty of Pharmacy", position: "ea-public-information-officer" }, ["position"], { "ea-public-information-officer": 5 }).position);
assert.ok(schema.needsPortfolio("ea-internal-public-information-officer"));
assert.ok(schema.needsPortfolio("ea-creatives-director"));
assert.equal(schema.needsPortfolio("ea-finance-officer"), false);

let user = { affiliation: "local", college, readOnly: false, position: "executive-board", email: "manager@ust.edu.ph" };
const created = [];
let deleted = 0;
let targetCollege = college;
const actions = load("src/lib/portal/interview-actions.ts", {
  "next/cache": { revalidatePath: () => {} },
  "next/navigation": { redirect: (href) => { throw new Error(`redirect:${href}`); } },
  "@/lib/auth/session": { requireEditor: async () => user },
  "@/lib/applications/options": options,
  "@/lib/applications/apply-cache": { clearApplyPageCache: () => {} },
  "@/lib/applications/interviews": {
    createSlots: async (slots, author, unit) => created.push({ slots, author, unit }),
    getSlot: async () => ({ college: targetCollege }),
    deleteEmptySlot: async () => { deleted++; return true; },
  },
  "@/lib/events/access": load("src/lib/events/access.ts"),
  "@/lib/periods/kinds": load("src/lib/periods/kinds.ts"),
  "./form": load("src/lib/portal/form.ts"),
});
function form(unit, division = "central") {
  const data = new FormData();
  for (const [key, value] of Object.entries({ unit, division, date: "2099-10-05", time: "09:00", duration: "30", mode: "online" })) data.set(key, value);
  return data;
}
async function main() {
  assert.ok((await actions.addInterviewSlots(undefined, form(""))).error, "Local cannot add Central interviews");
  assert.ok((await actions.addInterviewSlots(undefined, form(options.colleges[1]))).error, "Local cannot add another unit's interviews");
  assert.equal(created.length, 0);
  await assert.rejects(actions.addInterviewSlots(undefined, form(college)), /redirect:.*unit=/);
  assert.equal(created[0].unit, college);
  assert.equal(created[0].slots[0].division, undefined, "Interviews are shared within the unit");
  targetCollege = options.colleges[1];
  await actions.deleteInterviewSlot("slot");
  assert.equal(deleted, 0, "Local cannot delete another unit's interview");
  targetCollege = college;
  await assert.rejects(actions.deleteInterviewSlot("slot"), /redirect:.*unit=/);
  assert.equal(deleted, 1);
  user = { ...user, affiliation: "central", position: "deputy" };
  await assert.rejects(actions.addInterviewSlots(undefined, form("")), /redirect:/, "Division selection is no longer required");
  assert.ok((await actions.addInterviewSlots(undefined, form(college))).error, "Central deputies cannot manage Local interviews");
  user.position = "executive-board";
  await assert.rejects(actions.addInterviewSlots(undefined, form(college)), /redirect:.*unit=/);
  assert.equal(created[2].unit, college, "Central board can manage Local interviews");
  console.log("Unit-specific position validation, vacancy enforcement, and interview create/delete permissions passed.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
