// Run with: node scripts/test-directory-database.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Check directory visibility without a Next.js runtime. */
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    const base = name.startsWith("@/") ? path.resolve("src", name.slice(2)) : name.startsWith(".") ? path.resolve(path.dirname(file), name) : null;
    if (!base) return require(name);
    const found = [".ts", ".tsx"].map(ext => base + ext).find(existsSync);
    if (!found) throw new Error(`Cannot resolve ${name}`);
    return load(found);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}

const { directoryDatabaseRows, filterDirectoryDatabase } = load("src/lib/portal/directory-database.ts");
const { toSummary } = load("src/lib/data/accounts.ts");
const account = (id, affiliation, college, lastName, position = "executive-board") => toSummary({
  id, name: `Juan ${lastName}`, lastName, firstName: "Juan", middleName: "Pedro", email: `${id}@ust.edu.ph`,
  kind: "personal", affiliation, college, position, role: "Chairperson", active: true,
  studentNumber: `student-${id}`, contactNumber: `phone-${id}`, declarations: [],
});
const accounts = [account("central", "central", null, "Santos"), account("science", "local", "College of Science", "Dela Cruz"), account("arts", "local", "Faculty of Arts and Letters", "Reyes")];
const viewer = { ...accounts[1] };
const localRows = directoryDatabaseRows(accounts, accounts, viewer, true);
assert.deepEqual(localRows.map(row => row.id), ["science"], "Local viewers only receive their own unit, even in Database view");
assert.equal(localRows[0].name, "Dela Cruz, Juan Pedro");
assert.equal(localRows[0].studentNumber, "student-science");
assert.deepEqual(directoryDatabaseRows(accounts, accounts, { ...viewer, college: null }, true), [], "Local accounts without a unit receive no directory rows");

const readRows = directoryDatabaseRows(accounts, accounts, accounts[0], false);
assert.deepEqual(readRows.map(row => row.id), ["science", "arts", "central"], "Rows are ordered by last name");
assert.equal(readRows[0].studentNumber, null, "Other people's student numbers are omitted from client props");
assert.equal(readRows[0].contactNumber, null, "Other people's mobile numbers are omitted from client props");
assert.equal(readRows[2].studentNumber, "student-central", "People may still read their own private details");
assert.ok(readRows.every(row => !row.manageable), "Readers receive no account management links");

const managerRows = directoryDatabaseRows(accounts, accounts, accounts[0], true);
assert.deepEqual(filterDirectoryDatabase(readRows, "", "JUAN science chairperson").map(row => row.id), ["science"], "Search matches words across name, college and role");
assert.deepEqual(filterDirectoryDatabase(readRows, "", "faculty of arts").map(row => row.id), ["arts"], "Search finds faculties");
assert.deepEqual(filterDirectoryDatabase(readRows, "", "Central Comelec").map(row => row.id), ["central"], "Search finds units");
assert.equal(filterDirectoryDatabase(readRows, "", "executive-board").length, 3, "Search matches displayed positions and normalizes punctuation");
assert.deepEqual(filterDirectoryDatabase(readRows, readRows[0].unit, "Reyes"), [], "Search combines with the unit dropdown");
assert.deepEqual(filterDirectoryDatabase(readRows, "", "   "), readRows, "Clearing search restores all rows");
assert.equal(filterDirectoryDatabase([{ ...readRows[0], name: "Peña, María" }], "", "pena maria").length, 1, "Names match without requiring accents");
assert.ok(managerRows.every(row => row.manageable && row.studentNumber && row.contactNumber), "Central board managers receive the fields they can already read in profiles");
const associate = { ...accounts[0], position: "executive-associate" };
assert.equal(directoryDatabaseRows(accounts, accounts, associate, true)[0].studentNumber, null, "Management access alone does not grant access to higher-ranking accounts");

const legacy = { ...accounts[0], firstName: "", lastName: "", name: "Legacy full name" };
assert.equal(directoryDatabaseRows([legacy], [legacy], legacy, false)[0].name, "Legacy full name", "Older accounts without name parts retain their full name");
const initial = { ...accounts[0], middleName: "", middleInitial: "P" };
assert.equal(directoryDatabaseRows([initial], [initial], initial, false)[0].name, "Santos, Juan P", "Older middle initials remain visible");
console.log("Passed: directory database names, sorting, Local unit visibility, and private-field access.");
