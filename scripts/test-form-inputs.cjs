// Run with: node scripts/test-form-inputs.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- Exercise shared form rules without Next.js. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const cache = new Map();
function load(file, dependencies = {}) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}
const input = load("src/lib/forms/input.ts");
const applications = load("src/lib/applications/schema.ts");
const events = load("src/lib/events/schema.ts");
const access = load("src/lib/access-requests/schema.ts");
const polpar = load("src/lib/polpar/schema.ts");
const portal = load("src/lib/portal/form.ts");
for (const emoji of ["😀", "👨‍👩‍👧‍👦", "🇵🇭", "👍🏽", "1️⃣", "#️⃣", "❤️", "🏴\u{E0067}\u{E0062}\u{E007F}"]) {
  assert.equal(input.withoutEmoji(`hello ${emoji} world`), "hello  world");
  assert.equal(input.containsEmoji(emoji), true);
}
assert.equal(input.withoutEmoji("2026000001 #1 *2 + ₱100 José Niño"), "2026000001 #1 *2 + ₱100 José Niño");
assert.equal(input.sanitizeFormInput("JUAN 😀123 DELA-CRUZ.", "lastName"), "JUAN DELACRUZ", "names keep letters, single spaces, in capitals");
assert.equal(input.sanitizeFormInput("José1 Niño🎉", "officers.0.fullName"), "JOSÉ NIÑO");
assert.equal(input.sanitizeFormInput("Party 2026!😀", "partyName"), "Party 2026!");
assert.equal(input.sanitizeFormInput("Partner 2026!😀", "affiliates.0.name"), "Partner 2026!");
for (const name of ["José Niño", "DELA CRUZ", "Jose\u0301", "李 明"]) {
  // Typed in any case; saved in capitals.
  assert.equal(input.personNamePattern.test(input.tidyPersonName(name)), true);
  assert.equal(input.personNamePattern.test(name), name === name.toLocaleUpperCase("en-PH"));
  assert.equal(applications.applicationFields.shape.firstName.safeParse(name).success, true);
  assert.equal(polpar.conformeSchema.shape.fullName.safeParse(name).success, true);
}
for (const name of ["Juan123", "Dela-Cruz", "O’Neil", "Juan.", "Juan😀", "\u0301Juan"]) {
  assert.equal(applications.applicationFields.shape.firstName.safeParse(name).success, false);
  assert.equal(polpar.conformeSchema.shape.fullName.safeParse(name).success, false);
}
const form = new FormData();
form.set("firstName", "José Niño");
form.set("conflictOfficeDetail", "Office 😀");
assert.ok(applications.checkFields(applications.readApplication(form), ["conflictOfficeDetail"]).conflictOfficeDetail);
form.set("firstName", "Juan1");
assert.ok(applications.checkFields(applications.readApplication(form), ["firstName"]).firstName);
const registration = { ...events.emptyRegistration(), firstName: "Juan1", institution: "School 😀" };
const registrationErrors = events.checkRegistration(registration, { allowed: [], requireGoogle: false, verifiedEmail: null });
assert.ok(registrationErrors.firstName);
assert.match(registrationErrors.institution, /Emoji/);
const accessErrors = access.checkAccessRequest({ ...access.readAccessRequest(form), facebookUrl: "facebook.com/😀" });
assert.ok(accessErrors.firstName);
assert.match(accessErrors.facebookUrl, /Emoji/);
form.set("title", "Notice 😀");
assert.equal(portal.text(form, "title"), "Notice ");
assert.equal(polpar.partyRegistrationFields.shape.partyName.safeParse("Party 😀").success, false);
assert.equal(polpar.partyRegistrationFields.shape.contactPerson.safeParse("Juan1").success, false);

// School rules are shared by public applications, access requests and event registration.
const schoolOptions = load("src/lib/applications/options.ts");
assert.deepEqual(Object.keys(schoolOptions.yearLevelsFor("Junior High School")), ["7", "8", "9", "10"]);
assert.deepEqual(Object.keys(schoolOptions.yearLevelsFor("Senior High School")), ["11", "12"]);
assert.equal(schoolOptions.programsByCollege["Senior High School"].length, 12);
assert.equal(new Set(schoolOptions.comelecUnits).size, schoolOptions.comelecUnits.length);
for (const college of ["Education High School", "Junior High School", "Senior High School"]) {
  const yearLevel = Object.keys(schoolOptions.yearLevelsFor(college))[0];
  const program = schoolOptions.programsByCollege[college][0] ?? "";
  const academic = { college, program, yearLevel };
  assert.deepEqual(applications.checkFields({ ...applications.readApplication(new FormData()), ...academic }, ["college", "program", "yearLevel"]), {});
  const accessAcademic = access.checkAccessRequest({ ...access.readAccessRequest(new FormData()), ...academic });
  assert.equal(accessAcademic.college, undefined);
  assert.equal(accessAcademic.program, undefined);
  assert.equal(accessAcademic.yearLevel, undefined);
  const eventAcademic = events.checkRegistration({ ...events.emptyRegistration(), affiliation: "ust-student", ...academic }, { allowed: ["ust-student"], requireGoogle: false, verifiedEmail: null });
  assert.equal(eventAcademic.college, undefined);
  assert.equal(eventAcademic.program, undefined);
  assert.equal(eventAcademic.yearLevel, undefined);
  if (schoolOptions.programLocked(college)) assert.ok(applications.programError({ college, program: "A college degree" }));
}
for (const [college, yearLevel] of [["Junior High School", "11"], ["Senior High School", "7"], ["College of Science", "12"]]) {
  assert.ok(applications.checkFields({ college, yearLevel }, ["yearLevel"]).yearLevel);
  assert.ok(access.checkAccessRequest({ ...access.readAccessRequest(new FormData()), college, yearLevel }).yearLevel);
  assert.ok(events.checkRegistration({ ...events.emptyRegistration(), affiliation: "ust-student", college, yearLevel }, { allowed: ["ust-student"], requireGoogle: false, verifiedEmail: null }).yearLevel);
}
for (const program of schoolOptions.programsByCollege["Senior High School"]) {
  assert.equal(applications.programError({ college: "Senior High School", program }), null);
}
assert.equal(input.sanitizeFormInput("00A12-3456789", "studentNumber"), "0012345678");
assert.equal(input.sanitizeFormInput("00A12-3456789", "conformes.0.studentNumber"), "0012345678");

// Exercise the input listener with DOM fields whose own setter models React's value tracker.
class Element {
  closest() { return null; }
}
class Input extends Element {
  constructor(value, name, type = "text") {
    super();
    this.stored = value;
    this.tracked = value;
    this.name = name;
    this.type = type;
    this.selectionStart = type === "email" ? null : value.length;
    this.selectionEnd = this.selectionStart;
    Object.defineProperty(this, "value", {
      get: () => this.stored,
      set: (next) => { this.stored = next; this.tracked = next; },
    });
  }
  get value() { return this.stored; }
  set value(next) { this.stored = next; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  dispatchEvent(event) { Object.defineProperty(event, "target", { value: this }); listeners.get(event.type)(event); }
}
class Textarea extends Input {}
class InputEvent {
  constructor(target, isComposing = false) { this.type = "input"; this.target = target; this.isComposing = isComposing; }
}
const listeners = new Map();
const originals = Object.fromEntries(["HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "InputEvent", "document"].map((key) => [key, global[key]]));
let cleanup;
try {
  Object.assign(global, {
    HTMLElement: Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, InputEvent,
    document: { addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name) => listeners.delete(name) },
  });
  const { FormInputGuard } = load("src/components/form-input-guard.tsx", { react: { useEffect: (effect) => { cleanup = effect(); } } });
  FormInputGuard();
  const name = new Input("J😀uan1", "firstName");
  listeners.get("input")(new InputEvent(name));
  assert.equal(name.value, "JUAN", "A name is cleaned to capital letters as it's typed");
  assert.equal(name.tracked, "J😀uan1", "Leave React's tracker untouched so onChange detects the cleaned input");
  assert.equal(name.selectionStart, 4, "Keep the caret after the cleaned text");
  const text = new Input("A😀B", "description");
  text.selectionStart = text.selectionEnd = 3;
  listeners.get("input")(new InputEvent(text));
  assert.equal(text.value, "AB");
  assert.equal(text.selectionStart, 1, "Pasting in the middle must preserve caret position");
  const email = new Input("juan😀@ust.edu.ph", "email", "email");
  listeners.get("input")(new InputEvent(email));
  assert.equal(email.value, "juan@ust.edu.ph", "Email inputs clean safely without selection APIs");
  const composing = new Input("José😀", "firstName");
  listeners.get("input")(new InputEvent(composing, true));
  assert.equal(composing.value, "José😀", "Let composition finish before cleaning text");
  listeners.get("compositionend")({ type: "compositionend", target: composing });
  assert.equal(composing.value, "JOSÉ");
  const file = new Input("photo😀.png", "photo", "file");
  listeners.get("input")(new InputEvent(file));
  assert.equal(file.value, "photo😀.png", "Never rewrite browser-managed file inputs");
  cleanup();
  assert.equal(listeners.size, 0, "Remove listeners when leaving a root layout");
} finally {
  Object.assign(global, originals);
}
console.log("Emoji sequences, accented names, client/server validation, React input tracking, and caret preservation checks passed.");

// Recruitment's combined venue survives form parsing and validation for persistence.
const details = load("src/lib/events/details.ts");
const venueOptions = load("src/lib/events/options.ts");
const venueForm = new FormData();
for (const [key, value] of Object.entries({
  name: "Commissioner recruitment", summary: "Join the commission this term.", background: "",
  eventDate: "2099-10-05", endDate: "2099-10-06", ingressTime: "", egressTime: "",
  startsTime: "09:00", endsTime: "17:00", venueMode: "both",
  venueDetails: "Room 101, Tan Yan Kee; Zoom link emailed to applicants", openToStudents: "on",
})) venueForm.set(key, value);
const venueParsed = details.detailsSchema.parse(details.readDetails(venueForm));
assert.equal(details.toDetails(venueParsed).venueMode, "both");
assert.equal(details.toDetails(venueParsed).venueDetails, venueForm.get("venueDetails"));
assert.equal(venueOptions.isVenueMode("both"), true);
for (const mode of ["onsite", "online", "both"]) assert.equal(details.detailFields.venueMode.safeParse(mode).success, true);
assert.equal(details.detailFields.venueMode.safeParse("invalid").success, false);
console.log("Combined recruitment venue parsing, validation, and persistence values passed.");

// Internal audiences and collaborators survive the same parsing used by create/edit actions.
venueForm.delete("openToStudents");
venueForm.set("openToInternal", "on");
venueForm.append("collaborators", "central");
venueForm.append("collaborators", venueOptions.collaboratorUnits[1].value);
venueForm.append("collaborators", "central");
venueForm.append("otherCollaborators", "  Partner Organization  ");
const internal = details.toDetails(details.detailsSchema.parse(details.readDetails(venueForm)));
assert.equal(internal.openToInternal, true);
assert.equal(internal.openToStudents, false);
assert.deepEqual(internal.collaborators, ["central", venueOptions.collaboratorUnits[1].value]);
assert.deepEqual(internal.otherCollaborators, ["Partner Organization"]);
assert.equal(venueOptions.describeAudience(internal), "Comelec units (internal) only");
venueForm.append("collaborators", "Unrecognized unit");
assert.equal(details.detailsSchema.safeParse(details.readDetails(venueForm)).success, false, "Unknown units cannot be persisted");
venueForm.delete("collaborators");
venueForm.set("otherCollaborators", " ");
assert.equal(details.detailsSchema.safeParse(details.readDetails(venueForm)).success, false, "Others needs an organization name");
venueForm.set("otherCollaborators", "x".repeat(201));
assert.equal(details.detailsSchema.safeParse(details.readDetails(venueForm)).success, false);
venueForm.delete("openToInternal");
venueForm.set("openToStudents", "on");
const cleared = details.toDetails(details.detailsSchema.parse(details.readDetails(venueForm)));
assert.equal(cleared.openToInternal, false);
assert.deepEqual(cleared.collaborators, []);
assert.deepEqual(cleared.otherCollaborators, [], "Turning off Internal clears collaborators even if stale fields are submitted");
venueForm.delete("openToStudents");
assert.equal(details.detailsSchema.safeParse(details.readDetails(venueForm)).success, false, "At least one audience remains required");
console.log("Internal participants passed: unit checklist, organization names, validation, persistence values, and clearing selections.");
