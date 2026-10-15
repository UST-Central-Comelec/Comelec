/* eslint-disable @typescript-eslint/no-require-imports -- Standalone portal regression checks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const React = require("react");
function load(file, dependencies = {}) {
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", source)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name.startsWith("@/")) { const target = `src/${name.slice(2)}.ts`; return load(fs.existsSync(target) ? target : `${target}x`, dependencies); }
    if (name.startsWith(".")) return load(path.resolve(path.dirname(file), `${name}.ts`), dependencies);
    return require(name);
  }, compiled, compiled.exports);
  return compiled.exports;
}
const options = load("src/lib/letters/options.ts");
const offices = load("src/lib/letters/offices.ts");
const settings = load("src/lib/letters/settings.ts");
const defaults = settings.defaultSecretariatSettings;
const schema = options.recordSchema(defaults, "letters");
const numbering = load("src/lib/events/document-numbering.ts");
const eventSettings = numbering.eventDocumentSettings({ ...defaults, letters: { autoIncrement: false, types: defaults.letters.types.filter(type => !type.universityIssued) } }, "UST:CC-026-SA04");
assert.equal(eventSettings.letters.autoIncrement, true, "Event numbering ignores General Letters’ manual-numbering preference");
assert.equal(eventSettings.letters.types.find(type => type.name === "Request Letter").format, "UST:CC-026-SA04");
assert.equal(eventSettings.letters.types.find(type => type.name === "Project Proposal Form (PPF)").format, "UST:S030-00-FO120 (SA04)");
assert.equal(eventSettings.letters.types.find(type => type.name === "Budget Proposal").format, "UST:S030-00-FO130 (SA04)");
assert.equal(defaults.letters.types.find(type => type.name === "Budget Proposal").format, "UST:S030-00-FO130", "Event suffixes never change General Letters settings");
assert.deepEqual(eventSettings.letters.types.slice(0, 4).map(type => [type.name, type.format]), [
  ["Project Proposal Form (PPF)", "UST:S030-00-FO120 (SA04)"],
  ["Community Development Project Proposal Form (Simbahayan)", "UST:S040-00-FO21 (SA04)"],
  ["Vehicle Reservation Form", "UST:S040-00-FO25 (SA04)"],
  ["Budget Proposal", "UST:S030-00-FO130 (SA04)"],
]);
// Only the event's own checklist is offered; its printed forms keep their codes, the rest take the counter.
assert.ok(!eventSettings.letters.types.some(type => type.name === "Approved Publicity Material/s" || type.name === "Advocacy Project Proposal"), "Documents outside the event’s checklist aren’t offered");
const allChecklist = load("src/lib/events/activity-checklist.ts").activityDocuments.map(document => document.name);
const checklistSettings = numbering.eventDocumentSettings({ ...defaults, letters: { autoIncrement: false, types: defaults.letters.types.filter(type => !type.universityIssued) } }, "UST:CC-026-SA04", allChecklist);
for (const [name, format] of [["Advocacy Project Proposal", "UST:S040-00-FO38 (SA04)"], ["Service Learning Project Proposal", "UST:S040-00-FO47 (SA04)"], ["Student Undertaking and Parental Consent for Sports and Physical Activities", "UST:S030-00-FO90 (SA04)"], ["Accomplished and Notarized Student Undertaking and Parental Consent", "UST:S030-00-FO30 (SA04)"], ["Food Approval Form", "UST:S042-00-FO83 (SA04)"]]) {
  const type = checklistSettings.letters.types.find(item => item.name === name);
  assert.equal(type.format, format); assert.equal(type.universityIssued, true);
}
assert.equal(checklistSettings.letters.types.find(type => type.name === "Approved Publicity Material/s").format, "UST:CC-026-SA04");
assert.equal(new Set(checklistSettings.letters.types.map(type => type.name.toLowerCase())).size, checklistSettings.letters.types.length, "Each event document type is listed once");
const advocacyNames = numbering.eventChecklistNames({ venueType: "in-campus", natureOfActivity: "Advocacy" }, ["Request Letter"]);
assert.ok(advocacyNames.includes("Approved Publicity Material/s") && advocacyNames.includes("Request Letter") && !advocacyNames.some(name => name.startsWith("~")));
assert.equal(numbering.eventDocumentFormNumber({ id: "", name: "Accomplished Vehicle Reservation Form", format: "" }), "UST:S040-00-FO25");
const checklist = load("src/lib/events/activity-checklist.ts");
const advocacy = checklist.activityChecklist("in-campus", "Advocacy");
assert.equal(advocacy.length, 10, "Advocacy in-campus: 8 required and 2 optional, without the additional-document placeholders");
assert.deepEqual([advocacy.filter(item => item.required).length, advocacy.filter(item => !item.required).length], [8, 2]);
assert.ok(advocacy.some(item => item.name === "Vehicle Reservation Form" && item.template));
assert.equal(checklist.activityChecklist("off-campus-local", "Elections").length, 0, "Natures e-ReSERVe doesn’t offer for a venue type have no checklist");
assert.ok(!checklist.naturesFor("off-campus-local").includes("Elections") && checklist.naturesFor("online").includes("Elections"));
for (const nature of checklist.activityNatures) for (const venue of Object.keys(checklist.venueTypes)) for (const item of checklist.activityChecklist(venue, nature)) assert.ok(checklistSettings.letters.types.some(type => type.name === item.name), `${item.name} is an event document type`);


const presetNames = defaults.remarkPresets.map(preset => preset.name);
assert.equal(offices.universityOffices.length, 62);
assert.equal(offices.letterFacultiesAndColleges.length, 26);
assert.equal(new Set(offices.destinationOffices).size, offices.destinationOffices.length);
for (const unit of offices.letterFacultiesAndColleges) {
  assert.ok(offices.destinationOffices.includes(`Dean of the ${unit}`));
  assert.ok(offices.destinationOffices.includes(`Regent of the ${unit}`));
}
assert.ok(offices.destinationOffices.includes("Dean of the UST–Alfredo M. Velayo College of Accountancy (AMV)"));
assert.ok(offices.destinationOffices.includes("Regent of the Faculty of Medicine and Surgery (FMS, MED)"));
for (const unit of ["Graduate School (GS)", "Graduate School of Law (GS Law)", "Institute of Religion (IR)", "Senior High School (SHS)", "Junior High School (JHS)", "Education High School (EHS)"]) assert.ok(offices.destinationOffices.includes(`Regent of the ${unit}`));
assert.equal(offices.normalizeDestinationOffice("Dean of the Alfredo M. Velayo College of Accountancy"), "Dean of the UST–Alfredo M. Velayo College of Accountancy (AMV)");
const values = { title: " Request for venue ", type: "Request Letter", status: "Draft", destinationOffice: "Office for Student Affairs (OSA)", workingDocuments: [{ type: "docs", url: "https://docs.google.com/document/d/example/edit" }], notifyStatusUpdates: false, remarkPresets: [] };
assert.equal(schema.parse({ ...values, destinationOffice: "Regent of the Faculty of Medicine and Surgery" }).destinationOffice, "Regent of the Faculty of Medicine and Surgery (FMS, MED)");
for (const destinationOffice of offices.destinationOffices) assert.ok(schema.safeParse({ ...values, destinationOffice }).success);
assert.deepEqual(defaults.offices.map(office => office.name), offices.destinationOffices, "Office suggestions start from the full list");
assert.equal(schema.parse({ ...values, destinationOffice: "  Office of the   City Mayor  " }).destinationOffice, "Office of the City Mayor", "Any office may be typed; extra spaces are removed");
assert.equal(schema.parse(values).title, "Request for venue");
assert.equal(schema.parse({ ...values, controlSequence: 9, preparedBy: "tampered" }).preparedBy, undefined, "Fields outside the form are dropped");
for (const { name: status } of defaults.statuses) assert.ok(schema.safeParse({ ...values, status }).success);
for (const { name: type } of defaults.letters.types) assert.ok(schema.safeParse({ ...values, type }).success);
assert.deepEqual(defaults.letters.types.filter(type => type.universityIssued).map(type => [type.name, type.format]), [["Project Proposal", "UST:S030-00-FO120"], ["Budget Proposal", "UST:S030-00-FO130"]]);
assert.ok(schema.safeParse({ ...values, type: "Project Proposal" }).success, "University-issued types need no typed number");
const manual = options.recordSchema({ ...defaults, letters: { ...defaults.letters, autoIncrement: false } }, "letters");
assert.equal(manual.safeParse(values).error.issues[0].path[0], "controlNumber", "With automatic numbering off, a number must be typed");
assert.equal(manual.parse({ ...values, controlNumber: " CC-2026-17 " }).controlNumber, "CC-2026-17");
assert.ok(manual.safeParse({ ...values, type: "Budget Proposal" }).success, "University-issued numbers fill in while automatic numbering is off");
for (const workingDocument of ["javascript:alert(1)", "http://docs.google.com/document/d/example/edit", "https://docs.google.com.evil.test/document/d/example", "https://drive.google.com/example", "https://user@docs.google.com/document/d/example", "https://example.com/download?file=letter.pdf", "https://example.com/letter.pdf.html", "https://docs.google.com:444/document/d/example/edit", "https://drive.google.com/open?id="]) {
  assert.equal(schema.safeParse({ ...values, workingDocuments: [{ type: "docs", url: workingDocument }] }).success, false);
}
assert.ok(schema.safeParse({ ...values, workingDocuments: [] }).success);
assert.ok(options.isGoogleDocument("https://docs.google.com/document/u/0/d/example/edit"));
const supportedLinks = [
  ["https://docs.google.com/document/d/example/edit", "docs"],
  ["https://docs.google.com/spreadsheets/d/example/edit#gid=0", "sheets"],
  ["https://docs.google.com/spreadsheets/u/0/d/example/edit", "sheets"],
  ["https://drive.google.com/file/d/example/view?usp=sharing", "drive"],
  ["https://drive.google.com/drive/u/0/folders/example", "drive"],
  ["https://drive.google.com/open?id=example", "drive"],
  ["https://drive.google.com/uc?export=download&id=example", "drive"],
  ["https://example.com/letter.PDF?download=1", "pdf"],
];
for (const [workingDocument, kind] of supportedLinks) {
  assert.equal(options.workingDocumentKind(workingDocument), kind);
  assert.ok(schema.safeParse({ ...values, workingDocuments: [{ type: kind, url: workingDocument }] }).success);
}
const multipleDocuments = [
  { type: "docs", url: "https://docs.google.com/document/d/first/edit" },
  { type: "sheets", url: "https://docs.google.com/spreadsheets/d/budget/edit" },
  { type: "docs", url: "https://docs.google.com/document/d/second/edit" },
];
assert.ok(schema.safeParse({ ...values, workingDocuments: multipleDocuments }).success);
assert.equal(schema.safeParse({ ...values, workingDocuments: [{ type: "sheets", url: multipleDocuments[0].url }] }).success, false, "Selected document type must match the URL");
assert.equal(schema.safeParse({ ...values, workingDocuments: [{ type: "docs", url: "" }] }).success, false);
const otherLinks = ["https://example.com/shared-document", "https://example.com/download?file=letter.pdf", "https://example.com:8443/document", multipleDocuments[0].url];
for (const url of otherLinks) assert.ok(options.workingDocumentSchema.safeParse({ type: "pdf", url }).success, "Others accepts valid HTTPS links regardless of file extension");
for (const url of ["http://example.com/document", "javascript:alert(1)", "ftp://example.com/file", "invalid", "https://user:password@example.com/document"]) assert.equal(options.workingDocumentSchema.safeParse({ type: "pdf", url }).success, false);
for (const patch of [{ title: " " }, { status: "Pending" }, { type: "Unknown" }, { destinationOffice: "" }, { destinationOffice: "   " }, { label: "Invented" }, { remarkPresets: ["Invented"] }]) assert.equal(schema.safeParse({ ...values, ...patch }).success, false);

const record = { id: "11111111-1111-4111-8111-111111111111", control_number: "UST:CC-026-LTR-001", control_sequence: 1, prepared_by: "Original Preparer", created_by: "original@ust.edu.ph", title: "Venue", type: "Request Letter", status: "Draft", destination_office: "Office for Student Affairs (OSA)", working_document: "", college: "CICS", created_at: "2026-10-09T00:00:00Z", updated_at: "2026-10-09T00:00:00Z" };
let database = [record, { ...record, control_number: "UST:CC-026-LTR-999", control_sequence: 999, id: "22222222-2222-4222-8222-222222222222", college: "AB" }, { ...record, control_number: "UST:CC-026-LTR-1000", control_sequence: 1000, id: "33333333-3333-4333-8333-333333333333", college: null }];
let configured = true;
let dbError = null;
const admin = { from: table => {
  assert.equal(table, "secretariat_letters");
  let mutation = null;
  const filters = [];
  const orders = [];
  let eventJoin = false;
  let range = null;
  const builder = {
    select(columns = "") { eventJoin = columns.includes("event:events!inner"); return this; }, order(key, settings) { orders.push([key, settings?.ascending !== false]); return this; }, range(from, to) { range = [from, to]; return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    is(key, value) { filters.push([key, value]); return this; },
    delete() { mutation = { kind: "delete" }; return this; },
    update(data) { for (const key of ["control_number", "control_sequence", "prepared_by", "created_by", "created_at"]) assert.ok(!(key in data), `Updates must never write ${key}`); mutation = { kind: "update", data }; return this; },
    insert(data) { for (const key of ["control_sequence", "created_at"]) assert.ok(!(key in data), `${key} is assigned by the database`); assert.ok(!("control_number" in data) || data.control_format === null, "Automatic numbers are assigned by the database"); mutation = { kind: "insert", data }; return this; },
    result(single) {
      let rows = database.filter(row => (!eventJoin || row.event) && filters.every(([key, value]) => (key.split(".").reduce((value, part) => value?.[part], row) ?? null) === value));
      rows.sort((left, right) => { for (const [key, ascending] of orders) { if (left[key] !== right[key]) return (left[key] > right[key] ? 1 : -1) * (ascending ? 1 : -1); } return 0; });
      if (range) rows = rows.slice(range[0], range[1] + 1);
      if (!dbError && mutation?.kind === "update") rows.forEach(row => Object.assign(row, mutation.data));
      if (!dbError && mutation?.kind === "delete") database = database.filter(row => !rows.includes(row));
      if (!dbError && mutation?.kind === "insert") { rows = [{ ...record, ...mutation.data }]; database.push(...rows); }
      return { data: dbError ? null : single ? rows[0] ?? null : rows, error: dbError };
    },
    maybeSingle() { return Promise.resolve(this.result(true)); },
    then(resolve, reject) { return Promise.resolve(this.result(false)).then(resolve, reject); },
  };
  return builder;
}, rpc: async (name, args) => { if (name === "preview_event_document_control_number") { assert.equal(args.p_event_id, "event-one"); return { data: args.p_type === "Project Proposal Form (PPF)" ? "UST:S030-00-FO120 (SA01)" : "UST:CC-026-SA01-05", error: null }; } assert.equal(name, "preview_secretariat_control_number"); assert.deepEqual(args, { p_format: "UST:CC-{YYY}-LTR" }); return { data: "UST:CC-026-LTR-1001", error: null }; } };
const store = load("src/lib/letters/store.ts", { "server-only": {}, "@/lib/supabase/server": { createAdminClient: () => admin }, "@/lib/supabase/config": { isSupabaseConfigured: () => configured } });
let user = { email: "officer@ust.edu.ph", name: "Current Officer", affiliation: "local", college: "CICS", readOnly: false };
let revalidated = 0;
const actions = load("src/lib/portal/letter-actions.ts", {
  "next/cache": { revalidatePath: (path, type) => { if (path === "/portal") { assert.equal(type, "layout"); return; } assert.equal(path, "/portal/secretariat/letters-tracker"); revalidated++; } },
  "@/lib/auth/session": { isLocal: account => account.affiliation === "local", requireEditor: async tab => { assert.equal(tab, "secretariat/letters-tracker"); if (user.readOnly) throw new Error("view only"); return user; } },
  "@/lib/letters/options": options, "@/lib/letters/store": store, "@/lib/letters/settings": settings,
  "@/lib/data/edit-guard": { saverName: async email => email },
  "@/lib/letters/settings-store": { getSecretariatSettings: async () => ({ settings: defaults, updatedAt: null, updatedBy: null }) },
  "./form": { text: (form, key) => typeof form.get(key) === "string" ? form.get(key) : "" },
});
function form(patch = {}) { const data = new FormData(); Object.entries({ ...values, ...patch }).forEach(([key, value]) => {
  if (key === "remarkPresets" && Array.isArray(value)) value.forEach(preset => data.append(key, preset));
  else if (key === "notifyStatusUpdates") { if (value) data.set(key, "on"); }
  else data.set(key, Array.isArray(value) ? JSON.stringify(value) : value);
}); return data; }

async function main() {
  assert.deepEqual(await actions.getLetterNumberPreview("Request Letter"), { controlNumber: "UST:CC-026-LTR-1001" });
  assert.ok((await actions.getLetterNumberPreview("Project Proposal")).error, "University-issued types have no preview");
  assert.equal((await store.listLetters({ local: true, college: "CICS" })).length, 1);
  assert.equal((await store.listLetters({ local: true, college: null })).length, 0);
  assert.equal((await store.listLetters({ local: false, college: null })).length, 3);
  assert.deepEqual((await store.listLetters({ local: false, college: null })).map(letter => letter.controlNumber), ["UST:CC-026-LTR-1000", "UST:CC-026-LTR-999", "UST:CC-026-LTR-001"], "Numeric control order stays correct beyond 999");
  assert.ok((await actions.saveLetter(record.id, form({ status: "Signed", destinationOffice: "Office of the Rector (OR)", controlNumber: "forged", preparedBy: "forged", createdAt: "forged" }))).letter);
  assert.equal(database[0].status, "Signed");
  assert.equal(database[0].destination_office, "Office of the Rector (OR)");
  assert.equal((await actions.saveLetter(record.id, form({ destinationOffice: "Office of the City Mayor " }))).letter.destinationOffice, "Office of the City Mayor", "Destinations outside the suggestions are kept, trimmed");
  assert.equal((await actions.saveLetter(record.id, form({ destinationOffice: " " }))).fieldErrors.destinationOffice, "Enter a destination office.");
  assert.equal(database[0].control_format, undefined, "Saving without a type change never touches the number");
  assert.equal(database[0].control_number, "UST:CC-026-LTR-001");
  assert.equal(database[0].prepared_by, "Original Preparer");
  assert.equal(database[0].created_at, "2026-10-09T00:00:00Z");
  assert.ok((await actions.saveLetter(database[1].id, form({ status: "Rejected" }))).error);
  assert.equal(database[1].status, "Draft", "Local cannot update another college's letter");
  assert.ok((await actions.saveLetter(database[2].id, form())).error, "Local cannot update Central letters");
  const created = await actions.saveLetter(null, form({ label: "Print", college: "AB", preparedBy: "forged", controlNumber: "forged", workingDocuments: multipleDocuments, remarks: "Awaiting office confirmation.", notifyStatusUpdates: true, remarkPresets: [presetNames[0], presetNames[2]] }));
  assert.equal(created.letter.label, "Print", "Modal label selection survives saving and loading");
  assert.equal(created.letter.college, "CICS", "Unit comes from session, never form data");
  assert.equal(created.letter.preparedBy, "Current Officer");
  assert.equal(created.letter.preparedByEmail, user.email);
  assert.equal(created.letter.destinationOffice, values.destinationOffice);
  assert.equal(created.letter.notifyStatusUpdates, true, "Status notification preference survives saving and loading");
  assert.deepEqual(created.letter.remarkPresets, [presetNames[0], presetNames[2]], "Preset checkboxes save separately from free-text remarks");
  assert.equal(database.at(-1).control_format, "UST:CC-{YYY}-LTR", "Automatic types send their format for the database to number");
  const proposal = await actions.saveLetter(null, form({ type: "Project Proposal", controlNumber: "forged" }));
  assert.equal(database.at(-1).control_number, "UST:S030-00-FO120", "University-issued numbers are fixed, whatever is sent");
  assert.equal(database.at(-1).control_format, null);
  assert.ok(proposal.letter);
  const proposalId = database.at(-1).id = "44444444-4444-4444-8444-444444444444";
  const retyped = await actions.saveLetter(proposalId, form({ type: "Request Letter" }));
  assert.ok(retyped.letter);
  assert.equal(database.at(-1).control_format, "UST:CC-{YYY}-LTR", "Changing to an automatic type asks the database for a number");
  database.pop();
  assert.equal(created.letter.remarks, "Awaiting office confirmation.", "Remarks survive saving and loading");
  assert.deepEqual(created.letter.workingDocuments, multipleDocuments, "All typed links survive saving and loading");
  assert.ok((await actions.saveLetter(null, form({ workingDocuments: "malformed" }))).error);
  assert.ok((await actions.saveLetter(null, form({ remarkPresets: ["Invented preset"] }))).fieldErrors.remarkPresets);
  assert.equal(schema.parse({ ...values, notifyStatusUpdates: undefined }).notifyStatusUpdates, false);
  assert.equal((await actions.saveLetter(null, form({ workingDocuments: [{ type: "sheets", url: multipleDocuments[0].url }] }))).fieldErrors["workingDocuments.0.type"], "Choose the document type that matches this link.");
  assert.equal((await actions.saveLetter(null, form({ workingDocuments: [{ type: "docs", url: "https://evil.test" }] }))).fieldErrors["workingDocuments.0.url"], "Enter a Google Docs link, or select Others for another HTTPS link.");
  assert.ok((await actions.saveLetter("invalid-id", form())).error);
  dbError = { code: "23505" };
  assert.match((await actions.saveLetter(null, form())).error, /Couldn’t load or save tracker records/);
  dbError = null;
  user = { ...user, readOnly: true };
  await assert.rejects(actions.saveLetter(record.id, form()), /view only/);
  await assert.rejects(actions.getLetterNumberPreview(), /view only/);
  user = { ...user, readOnly: false, affiliation: "central", college: null };
  assert.equal((await actions.saveLetter(null, form())).letter.college, null);
  assert.equal(revalidated, 6, "Only successful writes revalidate the list");
  const deletionRows = [...database];
  user = { ...user, affiliation: "local", college: "CICS" };
  assert.ok((await actions.deleteLetter(database[1].id)).error, "Local cannot delete another college's letter");
  assert.ok((await actions.deleteLetter(database[2].id)).error, "Local cannot delete Central letters");
  assert.ok((await actions.deleteLetter("invalid-id")).error);
  assert.deepEqual(await actions.deleteLetter(record.id), { success: true }, "Local editors can delete letters in their own college");
  assert.ok(!database.some(row => row.id === record.id && row.college === "CICS"));
  database = [...deletionRows];
  user = { ...user, readOnly: true };
  await assert.rejects(actions.deleteLetter(record.id), /view only/);
  user = { ...user, readOnly: false, college: null };
  assert.match((await actions.deleteLetter(record.id)).error, /needs a college/);
  user = { ...user, affiliation: "central" };
  dbError = { code: "delete-failed" };
  assert.ok((await actions.deleteLetter(database[1].id)).error);
  dbError = null;
  assert.equal(database.length, deletionRows.length, "Failed deletions leave the records intact");
  const deletedId = database[1].id;
  assert.deepEqual(await actions.deleteLetter(deletedId), { success: true });
  assert.ok(!database.some(row => row.id === deletedId));
  assert.equal(revalidated, 8, "Only a successful deletion refreshes the table");
  assert.ok((await actions.deleteLetter(deletedId)).error, "An already removed letter cannot be deleted again");
  database = deletionRows;
  user = { ...user, affiliation: "local", college: "CICS" };
  const originalStatus = record.status;
  const originalDocuments = record.working_documents;
  const labeled = await actions.setLetterLabel(record.id, "Priority");
  assert.equal(labeled.letter.label, "Priority", "Labels can be edited directly from the table");
  assert.equal(record.status, originalStatus, "Label-only edits do not alter status or send status updates");
  assert.deepEqual(record.working_documents, originalDocuments, "Label-only edits do not overwrite working links");
  assert.ok((await actions.setLetterLabel(database[1].id, "Print")).error, "Labels obey college access");
  assert.ok((await actions.setLetterLabel("invalid-id", "Revise")).error);
  assert.ok((await actions.setLetterLabel(record.id, "Invented label")).error);
  user = { ...user, readOnly: true };
  await assert.rejects(actions.setLetterLabel(record.id, "Follow-up"), /view only/);
  user = { ...user, readOnly: false };
  assert.equal((await actions.setLetterLabel(record.id, null)).letter.label, null, "Labels can be cleared");
  assert.equal(revalidated, 10, "Only successful label edits refresh the list");
  // Event documents are isolated from the Secretariat tracker and every other event.
  const eventPaths = [];
  const eventActions = load("src/lib/portal/event-document-actions.ts", {
    "next/cache": { revalidatePath: path => eventPaths.push(path) },
    "@/lib/auth/session": { requireEditor: async tab => { assert.equal(tab, "events"); if (user.readOnly) throw new Error("view only"); return user; } },
    "@/lib/events/queries": { getEvent: async id => id === "missing" ? null : { id, controlNumber: "UST:CC-026-SA01", organizer: "local", college: id === "other-unit" ? "AB" : "CICS" } },
    "@/lib/events/access": load("src/lib/events/access.ts"),
    "@/lib/letters/options": options, "@/lib/letters/store": store, "@/lib/letters/settings": settings,
    "@/lib/data/edit-guard": { saverName: async email => email },
    "@/lib/letters/settings-store": { getSecretariatSettings: async () => ({ settings: defaults }) },
    "./form": { text: (form, key) => typeof form.get(key) === "string" ? form.get(key) : "" },
  });
  assert.deepEqual(await eventActions.getEventDocumentNumberPreview("event-one", "Request Letter"), { controlNumber: "UST:CC-026-SA01-05" });
  assert.deepEqual(await eventActions.getEventDocumentNumberPreview("event-one", "Project Proposal Form (PPF)"), { controlNumber: "UST:S030-00-FO120 (SA01)" });
  const refusedProposal = await eventActions.saveEventDocument("event-one", null, form({ type: "Project Proposal Form (PPF)" }));
  assert.equal(refusedProposal.fieldErrors?.type, "Choose a letter type. The checklist’s documents are added for you.", "Official documents aren’t added by hand");
  const eventRecord = { ...record, id: "55555555-5555-4555-8555-555555555555", event_id: "event-one", event: { id: "event-one", name: "First event", organizer: "local", college: "CICS" }, updated_at: "2026-10-15T00:00:00Z" };
  const otherEventRecord = { ...eventRecord, id: "66666666-6666-4666-8666-666666666666", event_id: "event-two", event: { id: "event-two", name: "Second event", organizer: "local", college: "CICS" } };
  database.push(eventRecord, otherEventRecord);
  const centralPaper = { ...eventRecord, id: "77777777-7777-4777-8777-777777777777", event_id: "central-event", college: null, event: { id: "central-event", name: "Central event", organizer: "central", college: null } };
  database.push(centralPaper);
  assert.deepEqual((await store.listEventPapers({ local: true, college: "CICS" })).map(row => row.event.id).sort(), ["event-one", "event-two"]);
  assert.equal((await store.listEventPapers({ local: true, college: null })).length, 0);
  assert.equal((await store.listEventPapers({ local: true, college: "AB" })).length, 0);
  assert.equal((await store.listEventPapers({ local: false, college: null })).length, 3, "Central can consolidate all units’ event papers");
  database = database.filter(row => row !== centralPaper);
  const smallDatabase = database;
  database = Array.from({ length: 1005 }, (_, index) => ({ ...eventRecord, id: `bulk-${index}`, control_sequence: index }));
  assert.equal((await store.listEventPapers({ local: true, college: "CICS" })).length, 1005, "Consolidation reads all pages beyond the Supabase row limit");
  database = smallDatabase;
  const paperActions = load("src/lib/portal/event-paper-actions.ts", {
    "next/navigation": { unstable_rethrow: () => {} },
    "@/lib/auth/session": { isLocal: account => account.affiliation === "local", requireEditor: async tab => { assert.equal(tab, "secretariat/letters-tracker"); if (user.readOnly) throw new Error("view only"); return user; } },
    "@/lib/supabase/server": { createAdminClient: () => admin },
    "./event-document-actions": eventActions,
  });
  assert.deepEqual(await paperActions.getEventPaperNumberPreview("Request Letter", eventRecord.id), { controlNumber: "UST:CC-026-SA01-05" });
  assert.ok((await paperActions.saveEventPaper(null, form())).error, "Papers must be added within their event");
  assert.ok((await paperActions.saveEventPaper(record.id, form())).error, "General letters cannot be edited through Event Papers");
  assert.ok((await paperActions.deleteEventPaper(record.id)).error);
  assert.ok((await paperActions.setEventPaperLabel(record.id, "Print")).error);
  assert.ok((await paperActions.saveEventPaper(eventRecord.id, form())).letter, "Consolidated edits resolve the actual parent event");
  assert.equal((await paperActions.setEventPaperLabel(eventRecord.id, "Print")).letter.label, "Print");
  user = { ...user, readOnly: true };
  assert.ok((await paperActions.saveEventPaper(eventRecord.id, form())).error);
  assert.ok((await paperActions.deleteEventPaper(eventRecord.id)).error);
  assert.ok((await paperActions.setEventPaperLabel(eventRecord.id, "Print")).error);
  user = { ...user, readOnly: false };
  const trackerPage = load("src/app/(portal)/portal/(dashboard)/secretariat/letters-tracker/page.tsx", {
    "@/components/portal/letters-tracker": { LettersTracker: "tracker" },
    "@/components/portal/sliding-filters": { SlidingFilters: "tracker-selector" },
    "@/lib/auth/session": { isLocal: account => account.affiliation === "local", requireAccess: async () => ({ ...user, tabs: ["events", "secretariat/letters-tracker"] }) },
    "@/lib/events/access": load("src/lib/events/access.ts"),
    "@/lib/letters/store": store, "@/lib/letters/settings": settings,
    "@/lib/letters/settings-store": { getSecretariatSettings: async () => ({ settings: defaults }) },
    "@/lib/portal/letter-actions": actions,
    "@/lib/portal/event-paper-actions": paperActions,
  }).default;
  const general = await trackerPage({ searchParams: Promise.resolve({}) });
  assert.equal(general.props.eventPapers, false, "General Letters is the default view");
  assert.ok(general.props.rows.every(row => !row.event));
  assert.equal(general.props.selector.props.active, "general");
  assert.deepEqual(general.props.selector.props.items.map(item => item.label), ["General Letters", "Event Papers"]);
  const papers = await trackerPage({ searchParams: Promise.resolve({ view: "event-papers" }) });
  assert.equal(papers.props.eventPapers, true);
  assert.equal(papers.props.rows.length, 2);
  assert.ok(papers.props.rows.every(row => row.event.editable));
  user = { ...user, affiliation: "central", college: null };
  const centralPapers = await trackerPage({ searchParams: Promise.resolve({ view: "event-papers" }) });
  assert.ok(centralPapers.props.rows.every(row => !row.event.editable), "Central readers cannot edit Local papers without executive access");
  assert.ok((await paperActions.saveEventPaper(eventRecord.id, form())).error);
  assert.ok((await paperActions.deleteEventPaper(eventRecord.id)).error);
  assert.ok((await paperActions.setEventPaperLabel(eventRecord.id, "Print")).error);
  user = { ...user, affiliation: "local", college: "CICS" };

  assert.ok(!(await store.listLetters({ local: false, college: null })).some(row => row.id === eventRecord.id));
  assert.deepEqual((await store.listLetters({ local: true, college: "CICS", eventId: "event-one" })).map(row => row.id), [eventRecord.id]);
  assert.ok((await actions.saveLetter(eventRecord.id, form())).error, "Secretariat actions cannot edit event documents");
  assert.ok((await actions.deleteLetter(eventRecord.id)).error, "Secretariat actions cannot delete event documents");
  assert.ok((await actions.setLetterLabel(eventRecord.id, "Print")).error, "Secretariat actions cannot relabel event documents");
  await assert.rejects(eventActions.saveEventDocument("other-unit", null, form()), /don’t have access/);
  await assert.rejects(eventActions.deleteEventDocument("missing", eventRecord.id), /don’t have access/);
  assert.ok((await eventActions.saveEventDocument("event-one", otherEventRecord.id, form())).error);
  assert.ok((await eventActions.deleteEventDocument("event-one", otherEventRecord.id)).error);
  assert.ok((await eventActions.setEventDocumentLabel("event-one", otherEventRecord.id, "Print")).error);
  assert.ok((await eventActions.saveEventDocument("event-one", record.id, form())).error, "Event actions cannot edit Secretariat letters");
  const stale = await eventActions.saveEventDocument("event-one", eventRecord.id, form({ _expected: "old" }));
  assert.equal(stale.conflict.letter.id, eventRecord.id, "Event documents retain concurrent edit protection");
  assert.ok((await eventActions.saveEventDocument("event-one", eventRecord.id, form({ _expected: eventRecord.updated_at }))).letter);
  assert.equal((await eventActions.setEventDocumentLabel("event-one", eventRecord.id, "Print")).letter.label, "Print");
  assert.ok((await eventActions.saveEventDocument("event-one", null, form({ eventId: "event-two", college: "AB" }))).letter);
  assert.equal(database.at(-1).event_id, "event-one", "The server binds the event, ignoring forged form values");
  assert.equal(database.at(-1).college, "CICS");
  database.pop();
  user = { ...user, readOnly: true };
  await assert.rejects(eventActions.saveEventDocument("event-one", eventRecord.id, form()), /view only/);
  await assert.rejects(eventActions.deleteEventDocument("event-one", eventRecord.id), /view only/);
  await assert.rejects(eventActions.setEventDocumentLabel("event-one", eventRecord.id, "Print"), /view only/);
  await assert.rejects(eventActions.getEventDocumentNumberPreview("event-one", "Request Letter"), /view only/);
  user = { ...user, readOnly: false, affiliation: "central", position: "executive-board", college: null };
  assert.ok((await eventActions.saveEventDocument("event-one", eventRecord.id, form())).letter, "Central Executive Board may manage a Local event’s documents");
  assert.deepEqual(await eventActions.deleteEventDocument("event-one", eventRecord.id), { success: true });
  assert.ok(database.includes(otherEventRecord), "Deleting a document leaves another event’s records intact");
  assert.ok(eventPaths.includes("/portal/events/event-one/documentations"));
  database = database.filter(row => row !== otherEventRecord);
  user = { ...user, affiliation: "central", college: null };
  configured = false;
  assert.deepEqual(await store.listLetters({ local: false, college: null }), []);
  await assert.rejects(store.writeLetter(null, schema.parse(values), { email: user.email, name: user.name, local: false, college: null }, defaults), /configured/);

  // Exercise filtering, the read-only table, and opening the modal with the chosen record.
  const state = [];
  let cursor = 0;
  let opened = 0;
  let effect;
  const toasts = [];
  const dialog = { showModal: () => opened++, close() {} };
  const { LettersTracker } = load("src/components/portal/letters-tracker.tsx", {
    react: { ...React, useCallback: callback => callback, useEffect: callback => { effect = callback; }, useId: () => "letters-test", useRef: () => ({ current: dialog }), useTransition: () => [false, callback => callback()], useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }]; } },
    "@/components/action-icons": new Proxy({}, { get: () => "action-icon" }),
    "./review-action-icon": { ReviewActionIcon: "review-action-icon" },
    "next/navigation": { unstable_rethrow: () => {} }, "@/lib/letters/options": options, "@/lib/portal/letter-actions": actions,
    "@/lib/portal/minute-actions": {},
    "@/lib/letters/settings": settings, "@/components/combobox": { Combobox: "combobox" },
    "./toast": { toast: (message, tone = "ok") => toasts.push({ message, tone }) },
    "./letter-label": { LetterLabel: "letter-label" },
    "./dropdown": { Dropdown: "dropdown" }, "./info-tip": { TitleWithInfo: "h1", InfoTip: "info-tip" }, "./view-only": { ViewOnlyTag: "view-only" }, "./letters-tracker.css": {},
    "./working-document-link": { WorkingDocumentLink: "document-link" },
    "./sliding-filters": { SlidingFilterButtons: "view-picker" },
    "./letter-document-sortable": { LetterDocumentList: "document-list", LetterDocumentCard: "document-card" },
  });
  const modifiedAt = "2026-10-09T05:30:00Z";
  const rows = [{ ...values, id: record.id, preparedBy: "Original Preparer", preparedByEmail: "original@ust.edu.ph", college: "CICS", createdAt: record.created_at, updatedAt: record.updated_at, controlNumber: "UST:CC-026-LTR-001", controlFormat: "UST:CC-{YYY}-LTR", title: "Venue", label: null }, { ...values, preparedBy: "Second Preparer", preparedByEmail: "second@ust.edu.ph", createdAt: record.created_at, updatedAt: modifiedAt, id: "other", controlNumber: "UST:CC-026-LTR-002", controlFormat: "UST:CC-{YYY}-LTR", title: "Invite speaker", status: "Approved", label: "Priority" }];
  const props = { rows, settings: defaults, readOnly: false, loadError: null, preparerName: "Current Officer" };
  function walk(node) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(walk); return [node, ...walk(node.props?.children)]; }
  const render = () => { cursor = 0; return walk(LettersTracker(props)); };
  const table = () => walk(render().find(node => node.type === "table"));
  assert.equal(table().filter(node => node.type === "input" || node.type === "dropdown").length, 0, "Table never contains editable fields");
  render().find(node => node.type === "dropdown" && node.props.label === "Filter letters by label").props.onChange("none");
  assert.equal(table().filter(node => node.type === "letter-label").length, 1, "No-label filter shows only unlabeled letters");
  assert.equal(table().find(node => node.type === "letter-label").props.value, null);
  render().find(node => node.type === "dropdown" && node.props.label === "Filter letters by label").props.onChange("all");
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(global, "navigator");
  let copiedValue;
  Object.defineProperty(global, "navigator", { configurable: true, value: { clipboard: { writeText: async value => { copiedValue = value; } } } });
  table().find(node => node.type === "button" && node.props.title === "Copy title").props.onClick();
  await Promise.resolve();
  assert.equal(copiedValue, "Venue");
  assert.deepEqual(toasts.at(-1), { message: "Title copied to clipboard.", tone: "ok" }, "Copy confirmation pops up on the header");
  assert.ok(!render().some(node => node.type === "p" && node.props.children === "Title copied to clipboard."), "Copy confirmation does not add a paragraph to the page");
  if (navigatorDescriptor) Object.defineProperty(global, "navigator", navigatorDescriptor);
  else delete global.navigator;
  assert.ok(!table().some(node => node.type === "th" && node.props.children === "Type"), "Letter type stays in the modal, outside the table columns");
  const destination = render().find(node => node.type === "combobox" && node.props.name === "destinationOffice");
  assert.ok(destination, "Destination uses a searchable dropdown inside the modal");
  assert.equal(destination.props.freeText, true, "Destination accepts offices outside the suggestions");
  render().find(node => node.type === "dropdown" && node.props.label === "Filter letters by label").props.onChange("Priority");
  assert.equal(table().filter(node => node.type === "button" && node.props["aria-haspopup"] === "dialog").length, 1);
  table().find(node => node.type === "button" && node.props["aria-haspopup"] === "dialog").props.onClick();
  assert.equal(opened, 1);
  const clickableRow = table().find(node => node.type === "tr" && node.props.onClick);
  clickableRow.props.onClick({ target: { closest: () => null } });
  assert.equal(opened, 2, "Clicking row space opens the letter modal");
  for (const excluded of ["button", "a", ".portal-document-icon"]) {
    clickableRow.props.onClick({ target: { closest: selector => selector.includes(excluded) ? {} : null } });
    assert.equal(opened, 2, "Copy buttons and document icons do not trigger the row modal");
  }
  const trashButton = () => render().find(node => node.type === "button" && node.props["aria-label"] === "Delete letter");
  assert.equal(trashButton().props.disabled, false);
  trashButton().props.onClick();
  assert.ok(render().some(node => node.props?.children === "Delete permanently?"), "Trash requires a second click to confirm");
  render().find(node => node.type === "button" && node.props.children === "Keep").props.onClick();
  assert.ok(trashButton(), "Keeping the letter restores the trash button");
  assert.ok(table().some(node => node.type === "th" && node.props.children === "Label"));
  assert.equal(table().find(node => node.type === "letter-label").props.value, "Priority");
  const headerLabel = () => render().find(node => node.type === "letter-label" && node.props.name === "label");
  assert.equal(headerLabel().props.value, "Priority");
  headerLabel().props.onChange("Revise");
  assert.equal(headerLabel().props.value, "Revise", "Modal header labels update the saved draft");
  const fixedNumber = render().find(node => node.type === "input" && node.props.readOnly);
  assert.equal(fixedNumber.props.value, "UST:CC-026-LTR-002");
  assert.equal(fixedNumber.props.onChange, undefined);
  assert.ok(render().some(node => node.type === "span" && node.props.children === "Last modified date"));
  assert.ok(render().some(node => node.type === "time" && node.props.dateTime === modifiedAt), "Modal uses the latest modification timestamp");
  const documentPanel = () => render().find(node => node.type === "section" && node.props.className?.includes("portal-letter-documents"));
  const detailsPanel = () => render().find(node => node.props?.className?.includes("portal-letter-details-panel"));
  const viewPicker = () => render().find(node => node.type === "view-picker");
  assert.deepEqual(viewPicker().props.items.map(item => item.label), ["Details", "Working Documents", "Remarks"]);
  assert.equal(documentPanel().props.hidden, true);
  assert.equal(detailsPanel().props.hidden, false);
  render().find(node => node.type === "input" && node.props.name === "title").props.onChange({ target: { value: "Unsaved title" } });
  viewPicker().props.onChange("documents");
  assert.equal(documentPanel().props.hidden, false);
  assert.equal(detailsPanel().props.hidden, true);
  viewPicker().props.onChange("details");
  assert.equal(render().find(node => node.type === "input" && node.props.name === "title").props.value, "Unsaved title", "Switching views preserves unsaved fields");
  render().find(node => node.type === "input" && node.props.name === "notifyStatusUpdates").props.onChange({ target: { checked: true } });
  viewPicker().props.onChange("remarks");
  const presetCheckbox = () => render().find(node => node.type === "input" && node.props.name === "remarkPresets" && node.props.value === presetNames[0]);
  presetCheckbox().props.onChange({ target: { checked: true } });
  assert.equal(presetCheckbox().props.checked, true);
  render().find(node => node.type === "textarea" && node.props.name === "remarks").props.onChange({ target: { value: "Unsaved remark" } });
  viewPicker().props.onChange("details");
  viewPicker().props.onChange("remarks");
  assert.equal(render().find(node => node.type === "textarea" && node.props.name === "remarks").props.value, "Unsaved remark");
  assert.equal(presetCheckbox().props.checked, true, "Preset selection survives tab switches");
  assert.equal(render().find(node => node.type === "input" && node.props.name === "notifyStatusUpdates").props.checked, true);
  presetCheckbox().props.onChange({ target: { checked: false } });
  assert.equal(presetCheckbox().props.checked, false);
  assert.ok(render().some(node => node.type === "dd" && node.props.children[0] === "Second Preparer"));
  assert.ok(!render().some(node => typeof node.props?.children === "string" && node.props.children.includes("Assigned once:")));
  render().find(node => node.type === "button" && node.props.children?.[1] === "Add letter").props.onClick();
  render();
  assert.equal(trashButton().props.disabled, true, "Unsaved letters cannot be deleted");
  const originalWindow = global.window;
  const originalDocument = global.document;
  let refresh;
  let cleared = false;
  global.window = { setInterval: (callback, delay) => { assert.equal(delay, 5000); refresh = callback; return 1; }, clearInterval: () => { cleared = true; }, addEventListener() {}, removeEventListener() {} };
  global.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
  try {
    const cleanup = effect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(render().find(node => node.type === "input" && node.props.readOnly).props.value, "UST:CC-026-LTR-001");
    configured = true;
    refresh();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(render().find(node => node.type === "input" && node.props.readOnly).props.value, "UST:CC-026-LTR-1001", "An open creation modal refreshes its possible number");
    cleanup();
    assert.ok(cleared, "Polling stops when the modal closes");
  } finally {
    if (originalWindow === undefined) delete global.window; else global.window = originalWindow;
    if (originalDocument === undefined) delete global.document; else global.document = originalDocument;
  }
  // University-issued types show their fixed number; with automatic numbering off, a number is typed.
  const typeField = () => render().find(node => node.type === "dropdown" && node.props.name === "type");
  typeField().props.onChange("Budget Proposal");
  assert.equal(render().find(node => node.type === "input" && node.props.readOnly).props.value, "UST:S030-00-FO130");
  assert.ok(!render().some(node => node.type === "input" && node.props.name === "controlNumber"));
  props.settings = { ...defaults, letters: { ...defaults.letters, autoIncrement: false } };
  typeField().props.onChange("Request Letter");
  const typedNumber = () => render().find(node => node.type === "input" && node.props.name === "controlNumber");
  assert.ok(typedNumber() && !typedNumber().props.readOnly, "Manual numbering offers an editable control number");
  typedNumber().props.onChange({ target: { value: "CC-17" } });
  assert.equal(typedNumber().props.value, "CC-17");
  props.settings = defaults;
  const addLink = () => render().find(node => node.type === "button" && node.props.children?.[1] === "Add link");
  addLink().props.onClick();
  addLink().props.onClick();
  assert.equal(render().filter(node => node.type === "input" && node.props.type === "url").length, 2, "Modal can add multiple link rows");
  render().filter(node => node.type === "input" && node.props.type === "url")[0].props.onChange({ target: { value: multipleDocuments[0].url } });
  render().filter(node => node.type === "input" && node.props.type === "url")[1].props.onChange({ target: { value: multipleDocuments[1].url } });
  const sortableList = render().find(node => node.type === "document-list");
  const initialKeys = [...sortableList.props.ids];
  sortableList.props.onMove(0, 1);
  const reordered = JSON.parse(render().find(node => node.type === "input" && node.props.name === "workingDocuments").props.value);
  assert.deepEqual(reordered.map(document => document.url), [multipleDocuments[1].url, multipleDocuments[0].url], "Reordered documents are submitted in their new main/reference order");
  assert.deepEqual(render().find(node => node.type === "document-list").props.ids, [initialKeys[1], initialKeys[0]], "Card identities stay stable during reorder");
  const typePicker = render().find(node => node.type === "dropdown" && node.props.labelledBy?.includes("document-type"));
  assert.equal(typePicker.props.options.length, 4, "Each link offers all four document types");
  render().find(node => node.type === "button" && node.props["aria-label"] === "Remove document link 1").props.onClick();
  assert.equal(render().filter(node => node.type === "input" && node.props.type === "url").length, 1);
  props.readOnly = true;
  assert.ok(render().find(node => node.type === "fieldset").props.disabled);
  assert.equal(render().filter(node => node.type === "button" && node.props.type === "submit").length, 0);
  const services = load("src/lib/letters/document-services.ts");
  const { WorkingDocumentLink } = load("src/components/portal/working-document-link.tsx", { "@/lib/letters/options": options, "./document-service-icon": { DocumentServiceIcon: "service-icon" } });
  const activeLinks = WorkingDocumentLink({ documents: multipleDocuments }).props.children.filter(icon => icon.type === "a");
  assert.equal(activeLinks.length, 3, "Every saved link has its own clickable icon, including links of the same type");
  for (const url of otherLinks) {
    const otherIcon = WorkingDocumentLink({ documents: [{ type: "pdf", url }] }).props.children.find(icon => icon.type === "a");
    assert.equal(otherIcon.props.href, url);
    assert.equal(otherIcon.props.title, "Others");
    assert.equal(otherIcon.props.children.props.kind, "pdf", "Others retains the PDF icon");
  }
  for (const [href, kind] of supportedLinks) {
    const icons = WorkingDocumentLink({ documents: [{ type: kind, url: href }] }).props.children;
    assert.equal(icons.length, kind === "pdf" ? 4 : 3, "Google formats stay visible; Others appears only with content");
    assert.equal(icons.filter(icon => icon.type === "a").length, 1, "Only the matching format is clickable");
    const link = icons.find(icon => icon.type === "a");
    assert.equal(link.props.href, href);
    assert.equal(link.props.children.props.kind, kind, "Matching document format lights up");
    assert.ok(link.props.className.includes("is-available"));
    assert.equal(link.props["aria-label"], `Open working document (${{ docs: "Google Docs", sheets: "Google Sheets", drive: "Google Drive", pdf: "Others" }[kind]})`);
    assert.equal(link.props.title, { docs: "Google Docs", sheets: "Google Sheets", drive: "Google Drive", pdf: "Others" }[kind]);
  }
  const serviceLinks = [
    ["https://www.facebook.com/post", "facebook"], ["https://fb.watch/example", "facebook"],
    ["https://instagram.com/example", "instagram"], ["https://twitter.com/example", "x"], ["https://x.com/example", "x"],
    ["https://www.threads.net/@example", "threads"], ["https://threads.com/@example", "threads"],
    ["https://github.com/example/repo", "github"], ["https://gist.github.com/example", "github"],
    ["https://vercel.com/example", "vercel"], ["https://example.vercel.app", "vercel"],
  ];
  for (const [url, service] of serviceLinks) {
    assert.equal(services.documentService(url), service);
    const icon = WorkingDocumentLink({ documents: [{ type: "pdf", url }] }).props.children.find(node => node.type === "a");
    assert.equal(icon.props.title, services.documentServiceLabels[service]);
    assert.equal(icon.props.children.props.service, service, "Others shows the detected service logo");
  }
  for (const url of ["https://facebook.com.evil.test/post", "https://fakefacebook.com/post", "https://example.com/?site=github.com", "http://github.com/example"]) assert.equal(services.documentService(url), null);
  const emptyIcons = WorkingDocumentLink({ documents: [] }).props.children;
  assert.equal(emptyIcons.length, 3);
  assert.deepEqual(emptyIcons.map(icon => icon.props.children.props.kind), ["docs", "sheets", "drive"]);
  const modalIcons = WorkingDocumentLink({ documents: [], modal: true }).props.children;
  assert.equal(modalIcons.length, 10, "Modal always displays the Google, Others, and six service icons");
  assert.ok(modalIcons.every(icon => icon.props.className.includes("is-inactive")));
  const modalWithGithub = WorkingDocumentLink({ documents: [{ type: "pdf", url: "https://github.com/example/repo" }], modal: true }).props.children;
  assert.equal(modalWithGithub.length, 10);
  assert.equal(modalWithGithub.filter(icon => icon.type === "a").length, 1);
  assert.equal(modalWithGithub.find(icon => icon.type === "a").props.title, "GitHub");
  for (const href of ["", "javascript:alert(1)"]) assert.equal(WorkingDocumentLink({ documents: [{ type: "docs", url: href }] }).props.children.filter(icon => icon.type === "a").length, 0);
  let sortableDragging = true;
  const sortableUi = load("src/components/portal/letter-document-sortable.tsx", {
    react: { ...React, useState: () => [null, () => {}], useRef: () => ({ current: { getBoundingClientRect: () => ({ top: 100, bottom: 500 }) } }) },
    "@dnd-kit/core": { DndContext: "drag-context", DragOverlay: "drag-overlay", KeyboardSensor: {}, PointerSensor: {}, closestCenter: {}, useSensor: () => ({}), useSensors: () => [] },
    "@dnd-kit/sortable": { SortableContext: "sortable-context", sortableKeyboardCoordinates: {}, verticalListSortingStrategy: {}, useSortable: () => ({ attributes: {}, transform: { x: 99, y: 35 }, isDragging: sortableDragging }) },
    "motion/react": { motion: { div: "motion-div" }, useReducedMotion: () => false },
  });
  const dragList = sortableUi.LetterDocumentList({ ids: ["first", "second"], onMove() {}, children: null });
  const constrain = dragList.props.modifiers[0];
  const drag = { draggingNodeRect: { top: 200, bottom: 300 }, transform: { x: 500, y: 600, scaleX: 1, scaleY: 1 } };
  assert.deepEqual(constrain(drag), { x: 0, y: 200, scaleX: 1, scaleY: 1 }, "Drag stays vertical and inside the list's bottom edge");
  assert.equal(constrain({ ...drag, transform: { ...drag.transform, y: -600 } }).y, -100);
  const animatedCard = sortableUi.LetterDocumentCard({ id: "first", index: 0, count: 2, onMove() {}, disabled: false, children: null });
  assert.equal(animatedCard.props.layout, undefined, "Sorting has one animation owner; Motion must not project the reordered layout again");
  assert.equal(animatedCard.props.style.transform, "translate3d(0, 35px, 0)");
  assert.equal(animatedCard.props.style.opacity, 0, "The original card is hidden while its overlay is dragged");
  const overlay = dragList.props.children.find(child => child.type === "drag-overlay");
  assert.equal(overlay.props.dropAnimation.duration, 220, "Release settles the overlay into the reordered card");
  sortableDragging = false;
  const manualMoves = [];
  const manualButtons = (index, disabled = false) => walk(sortableUi.LetterDocumentCard({ id: "manual", index, count: 3, disabled, onMove: (from, to) => manualMoves.push([from, to]), children: null })).filter(node => node.type === "button" && node.props.title?.startsWith("Move"));
  const [firstUp, firstDown] = manualButtons(0);
  assert.equal(firstUp.props.disabled, true, "The first document cannot move up");
  firstUp.props.onClick();
  firstDown.props.onClick();
  const [lastUp, lastDown] = manualButtons(2);
  assert.equal(lastDown.props.disabled, true, "The last document cannot move down");
  lastDown.props.onClick();
  lastUp.props.onClick();
  manualButtons(1, true).forEach(button => { assert.equal(button.props.disabled, true); button.props.onClick(); });
  assert.deepEqual(manualMoves, [[0, 1], [2, 1]], "Manual buttons move one position and respect boundaries and editor state");
  // The Minutes page uses the same table and modal but never offers letter types.
  state.length = 0;
  Object.assign(props, { kind: "minutes", rows: [], readOnly: false });
  assert.equal(render().find(node => node.type === "h1").props.children, "Minutes of the Meetings");
  const addMinutes = render().find(node => node.type === "button" && node.props.children?.includes?.("Add meeting minutes"));
  assert.ok(addMinutes);
  addMinutes.props.onClick();
  const minuteType = render().find(node => node.type === "dropdown" && node.props.name === "type");
  assert.equal(minuteType.props.value, "Minutes of the Meeting");
  assert.deepEqual(minuteType.props.options, [{ value: "Minutes of the Meeting", label: "Minutes of the Meeting" }]);
  assert.ok(render().find(node => node.type === "dropdown" && node.props.label === "Filter meeting minutes by label"));
  state.length = 0;
  Object.assign(props, { rows: [], readOnly: false, kind: "letters", eventPapers: false, eventControlNumber: "UST:CC-026-SA04", eventActions: { previewNumber: async () => ({ controlNumber: "UST:CC-026-SA04-05" }), saveRecord: async () => ({ letter: rows[0] }), deleteRecord: async () => ({ success: true }), labelRecord: async () => ({ letter: rows[0] }) } });
  render().find(node => node.type === "button" && node.props.children?.includes?.("Add letter")).props.onClick();
  const documentType = () => render().find(node => node.type === "dropdown" && node.props.name === "type");
  assert.ok(!documentType().props.options.some(option => option.value === "Project Proposal Form (PPF)" || option.value === "Budget Proposal"), "A new event document offers letter types only");
  assert.ok(documentType().props.options.some(option => option.value === "Request Letter"));
  const eventFixedNumber = () => render().find(node => node.type === "input" && node.props.className === "is-fixed").props.value;
  documentType().props.onChange("Project Proposal Form (PPF)");
  assert.equal(eventFixedNumber(), "UST:S030-00-FO120 (SA04)");
  documentType().props.onChange("Budget Proposal");
  assert.equal(eventFixedNumber(), "UST:S030-00-FO130 (SA04)");
  state.length = 0;
  Object.assign(props, { eventControlNumber: undefined, eventPapers: true, rows: [{ ...rows[0], event: { id: "event-nine", name: "Ninth activity", organizer: "central", college: null, controlNumber: "UST:CC-026-SA09", editable: true } }] });
  render().find(node => node.type === "button" && node.props["aria-label"]?.startsWith("Open document ")).props.onClick();
  documentType().props.onChange("Budget Proposal");
  assert.equal(eventFixedNumber(), "UST:S030-00-FO130 (SA09)", "Consolidated forms use the selected paper’s event suffix");
  console.log("Letters and minutes UI checks passed: numeric descending order, fixed numbers, automatic preparer, creation timestamp, saves, college scope, viewer restrictions, modal editing, minutes-specific creation, event isolation, event permissions, forged scope rejection, concurrent document edits, default General Letters, consolidated pagination, parent-event search metadata, and per-event edit permissions.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
