// Run with: node scripts/test-reference-data.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}, cache = new Map()) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  cache.set(file, compiled.exports);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const resolve = (target) => (fs.existsSync(`${target}.ts`) ? `${target}.ts` : `${target}.tsx`);
  new Function("require", "module", "exports", source)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith("@/")) return load(resolve(`src/${name.slice(2)}`), dependencies, cache);
    if (name.startsWith(".")) return load(resolve(path.resolve(path.dirname(file), name)), dependencies, cache);
    return require(name);
  }, compiled, compiled.exports);
  Object.assign(cache.get(file), compiled.exports);
  return cache.get(file);
}

const cache = new Map();
const data = load("src/lib/reference/data.ts", {}, cache);
const options = load("src/lib/applications/options.ts", {}, cache);
const accounts = load("src/lib/data/accounts.ts", {}, cache);
const types = load("src/lib/data/types.ts", {}, cache);
const offices = load("src/lib/letters/offices.ts", {}, cache);
const eventOptions = load("src/lib/events/options.ts", {}, cache);
const apps = load("src/lib/applications/schema.ts", {}, cache);

// Defaults keep every id recruitment slots were saved under.
const defaults = data.defaultReferenceData();
assert.equal(defaults.colleges.filter((college) => college.comelec).length, options.colleges.length);
assert.ok(defaults.colleges.some((college) => college.name === "Graduate School" && !college.comelec), "Units without a Local Comelec are listed too");
const amv = "Alfredo M. Velayo College of Accountancy";
assert.equal(options.positionsForUnit(amv).find((position) => position.office === "Chief Finance Officer" && position.kind === "associate").id, "ea-finance-officer");
assert.equal(options.positionsForUnit("").find((position) => position.office === "Chairperson" && position.kind === "associate").id, "ea-chairperson");
assert.equal(options.programLocked("Junior High School"), true);
assert.equal(options.programLocked("College of Science"), false);
assert.equal(options.programLocked(""), false);
for (const college of options.academicUnits) {
  assert.equal(options.isYearLevelFor(college, "5"), college === "College of Architecture", `${college}: only Architecture offers 5th year`);
}
assert.equal(options.yearLevelsFor("College of Architecture")["5"], "5th year");
assert.equal(options.yearLevelsFor("College of Science")["4"], "4th year");
assert.equal(options.yearLevelsFor("College of Science").swis, "SWIS");
assert.equal(options.yearLevelsFor("Junior High School")["7"], "Grade 7");
assert.equal(options.yearLevelsFor("Senior High School")["11"], "Grade 11");
assert.equal(options.yearLevels["5"], "5th year", "Previously stored fifth-year values still have a display label");

// Saved sections replace the defaults, and every list reads the saved ones.
const saved = data.composeReferenceData([
  { section: "colleges", updatedAt: "2026-10-15T00:00:00Z", value: [
    ...defaults.colleges,
    { name: "College of Testing", abbreviation: "CT", aliases: ["TEST"], comelec: true },
  ] },
  { section: "programs:College of Testing", updatedAt: "2026-10-15T00:00:01Z", value: ["Bachelor of Science in Testing"] },
  { section: "positions:College of Testing", updatedAt: "2026-10-15T00:00:02Z", value: [{ id: "ea-chairperson", name: "Chairperson" }, { id: "ea-head-tester", name: "Head Tester" }, { id: "ea-central-representative", name: "Central Representative" }] },
  { section: "roles:College of Testing", updatedAt: "2026-10-15T00:00:03Z", value: [{ id: "role-1", name: "Junior Tester", position: "deputy" }] },
  { section: "role-names", updatedAt: "2026-10-15T00:00:04Z", value: { ...defaults.roleNames, deputy: "Deputy Commissioner" } },
  { section: "offices", updatedAt: "2026-10-15T00:00:05Z", value: ["Office of Testing"] },
  { section: "positions:", updatedAt: "2026-10-15T00:00:06Z", value: "not a list" },
]);
assert.equal(saved.stamps["positions:"], undefined, "A section that can't be read keeps its default");
assert.ok(saved.positions["College of Testing"].length === 3);
data.applyReferenceData(saved);

assert.ok(options.colleges.includes("College of Testing"));
assert.ok(options.comelecUnits.includes("College of Testing"), "comelecUnits is the same list");
assert.equal(options.unitAbbreviations["College of Testing"], "CT");
assert.deepEqual(options.filterCollegeOptions(options.colleges, "test"), ["College of Testing"]);
assert.deepEqual(options.programsByCollege["College of Testing"], ["Bachelor of Science in Testing"]);
assert.deepEqual(accounts.programsOf("College of Testing"), ["Bachelor of Science in Testing"]);
// Each office recruits its board seat, Executive Associates and the unit's added roles; an
// Executive Associate keeps the office's id, the others add a suffix.
const testing = options.positionsForUnit("College of Testing");
assert.deepEqual(testing.filter((position) => position.officeId === "ea-head-tester").map(({ id, label, position, role }) => ({ id, label, position, role })), [
  { id: "ea-head-tester:board", label: "Head Tester", position: "executive-board", role: "Head Tester" },
  { id: "ea-head-tester", label: "Executive Associate to the Head Tester", position: "executive-associate", role: "Office of the Head Tester" },
  { id: "ea-head-tester:role-1", label: "Junior Tester to the Head Tester", position: "deputy", role: "Junior Tester" },
]);
assert.deepEqual([...new Set(testing.map((position) => position.office))], ["Chairperson", "Head Tester", "Central Representative"]);
for (const opening of testing) assert.ok(accounts.isRoleFor("local", opening.position, opening.role, "College of Testing"), `${opening.label} onboards into a valid account role`);
assert.equal(options.positionsForUnit("").some((position) => position.kind === "added"), false, "Central has no added roles by default");
assert.ok(options.positions.some((position) => position.id === "ea-head-tester"));
assert.deepEqual(accounts.rolesFor("local", "executive-board", "College of Testing"), ["Chairperson", "Head Tester", "Central Representative"]);
assert.deepEqual(accounts.rolesFor("local", "deputy", "College of Testing"), ["Deputy"], "An added role is its own role, not a deputy's seat");
assert.deepEqual(accounts.addedRolesFor("local", "College of Testing").map((role) => role.name), ["Junior Tester"]);
assert.deepEqual(accounts.addedRolesFor("local", "College of Science"), []);
assert.equal(accounts.positionName({ affiliation: "local", position: "deputy", role: "Junior Tester", college: "College of Testing" }), "Junior Tester");
assert.equal(accounts.positionName({ affiliation: "local", position: "deputy", role: "Deputy", college: "College of Testing" }), "Deputy Commissioner");
assert.ok(accounts.rolesFor("local", "executive-associate", "College of Testing").includes("Office of the Head Tester"));
assert.equal(accounts.isRoleFor("local", "deputy", "Junior Tester", "College of Testing"), true);
assert.equal(accounts.isRoleFor("local", "deputy", "Junior Tester", "College of Science"), false, "A unit's added roles are its own");
assert.equal(types.accountPositions.deputy, "Deputy Commissioner");
assert.deepEqual(offices.universityOffices, ["Office of Testing"]);
assert.ok(offices.destinationOffices.includes("Office of Testing"));
assert.ok(offices.destinationOffices.includes("Dean of the College of Testing (CT, TEST)"));
assert.ok(eventOptions.collaboratorUnits.some((unit) => unit.value === "College of Testing"), "Lists built from the colleges rebuild");

// The checks the editors and the server share.
const colleges = data.collegesSchema.safeParse([{ name: "A", abbreviation: "X", aliases: [], comelec: true }, { name: " a ", abbreviation: "Y", aliases: [], comelec: false }]);
assert.equal(colleges.success, false);
assert.equal(colleges.error.issues[0].path.join("."), "1.name");
assert.equal(data.customRolesSchema.safeParse([{ id: "role-1", name: "Office of the Chairperson", position: "executive-associate" }]).success, false);
assert.equal(data.positionsSchema.safeParse([]).success, false);
assert.equal(data.roleNamesSchema.safeParse({ ...defaults.roleNames, adviser: "Deputy" }).success, false);

// Who may change what.
const official = { kind: "official", affiliation: "local", college: "College of Testing", readOnly: false };
assert.equal(data.canEditSection(official, "positions:College of Testing"), true);
assert.equal(data.canEditSection(official, "positions:College of Science"), false);
assert.equal(data.canEditSection(official, "colleges"), false);
assert.equal(data.canEditSection({ ...official, affiliation: "central", college: null }, "positions:College of Science"), true);
assert.equal(data.canEditSection({ ...official, kind: "personal" }, "positions:College of Testing"), false, "Only official accounts edit");
assert.equal(data.readSectionKey("positions:").unit, "");
assert.equal(data.readSectionKey("nonsense"), null);

// Programs: renames carry onto accounts, retiring keeps them valid for whoever has them.
(async () => {
  const cics = "College of Information and Computing Sciences";
  const old = "Bachelor of Science in Information Technology, specialization in Automation";
  const renamed = "Bachelor of Science in Information Technology, Automation";
  const programs = data.defaultReferenceData().programs[cics];
  assert.ok(programs.every((program) => program.id.startsWith("p-") && !program.retired), "Default programs have ids");
  const target = programs.find((program) => program.name === old);
  let stored = { ...data.defaultReferenceData(), stamps: {} };
  const writes = [];
  const actions = load("src/lib/portal/database-actions.ts", {
    "@/lib/auth/session": { requireEditor: async () => ({ kind: "official", affiliation: "central", college: null, readOnly: false, email: "comelec@ust.edu.ph" }) },
    "@/lib/reference/store": {
      getReferenceData: async () => stored,
      writeReferenceSection: async (section, value, expected, actor, checks) => {
        writes.push({ section, value, checks });
        stored = data.composeReferenceData([...Object.entries(stored.stamps).map(([key, updatedAt]) => ({ section: key, updatedAt, value: key.startsWith("programs:") ? stored.programs[key.slice(9)] : [] })).filter((row) => row.section !== section), { section, updatedAt: String(writes.length), value }]);
        return { ok: true, updatedAt: String(writes.length) };
      },
    },
  }, cache);
  const save = (next) => actions.saveDatabaseSection(`programs:${cics}`, stored.stamps[`programs:${cics}`] ?? null, next);

  // Rename, and add one.
  let result = await save([...programs.map((program) => (program.id === target.id ? { ...program, name: renamed } : program)), { id: "new-1", name: "Bachelor of Science in Cybersecurity", retired: false, formerNames: ["made up"] }]);
  assert.ok(result.data, result.error);
  assert.deepEqual(writes.at(-1).checks.programRenames, [{ from: old, to: renamed }], "The rename goes to the database, for accounts and pending requests");
  assert.deepEqual(writes.at(-1).checks.programs, []);
  const saved = result.data.programs[cics];
  assert.deepEqual(saved.find((program) => program.id === target.id).formerNames, [old], "The old name is remembered");
  const added = saved.find((program) => program.name === "Bachelor of Science in Cybersecurity");
  assert.equal(added.id, "p-bachelor-of-science-in-cybersecurity");
  assert.deepEqual(added.formerNames, [], "Former names only come from the server");
  data.applyReferenceData(result.data);
  assert.equal(options.currentProgramName(cics, old), renamed, "Registrations under the old name count as the program");
  assert.equal(options.currentProgramName("College of Science", old), old, "Only in its own college");
  assert.ok(options.programsByCollege[cics].includes(renamed) && !options.programsByCollege[cics].includes(old));

  // Retire: off the forms, still valid for accounts that have it.
  result = await save(result.data.programs[cics].map((program) => (program.id === target.id ? { ...program, retired: true } : program)));
  assert.ok(result.data, result.error);
  assert.deepEqual(writes.at(-1).checks.programs, [], "Retiring deletes nothing");
  data.applyReferenceData(result.data);
  assert.ok(!options.programsByCollege[cics].includes(renamed), "Retired programs leave the pickers");
  assert.deepEqual(accounts.retiredProgramsOf(cics), [renamed]);
  assert.equal(apps.programError({ college: cics, program: renamed }), "Pick a program from your college’s list.", "New applications can't pick it");

  // Deleting outright asks the database whether any account has it.
  result = await save(result.data.programs[cics].filter((program) => program.id !== target.id));
  assert.deepEqual(writes.at(-1).checks.programs, [renamed]);

  // Every program retired: the school reads as having none, but holders keep theirs.
  result = await save(result.data.programs[cics].map((program) => ({ ...program, retired: true })));
  data.applyReferenceData(result.data);
  assert.equal(options.programLocked(cics), true);
  assert.ok(accounts.retiredProgramsOf(cics).includes("Bachelor of Science in Cybersecurity"));

  // A list saved as plain names reads as programs with ids.
  const legacy = data.composeReferenceData([{ section: `programs:${cics}`, updatedAt: "x", value: ["A", "B"] }]);
  assert.deepEqual(legacy.programs[cics].map((program) => program.id), ["p-a", "p-b"]);

  console.log("Reference data passed: defaults keep slot ids, saved sections reach every list, added roles, program renames and retiring, schemas and permissions.");
})().catch((error) => { console.error(error); process.exit(1); });
