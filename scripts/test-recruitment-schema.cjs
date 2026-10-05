// Run with: node scripts/test-recruitment-schema.cjs
// Regression coverage for recruitment reads before and after migrations 0033–0036.
/* eslint-disable @typescript-eslint/no-require-imports -- Isolated adapters load transpiled server modules. */
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const ts = require("typescript");

function load(file, dependencies = {}, unusedImports = false) {
  const source = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", source)((name) => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "@/lib/forms/input" ? load("src/lib/forms/input.ts") : unusedImports ? {} : require(name), compiled, compiled.exports);
  return compiled.exports;
}

const id = "11111111-1111-1111-1111-111111111111";
const application = { id, first_name: "ANA", middle_initial: "D", last_name: "REYES", reference_code: "CC-7K3M-9QXA", status: "pending", created_at: "2026-10-01T00:00:00Z", college: "College of Science", preferred_body: "central", year_level: "3", interview_slots: null };
let missingNames = true;
let missingLogs = true;
let logError = null;
let mainError = null;
let emailRows = [];
const requests = [];

function client() {
  return { from(table) {
    const request = { table, columns: "", filters: [], single: false };
    requests.push(request);
    const query = {
      select(columns) { request.columns = columns; return this; },
      eq(field, value) { request.filters.push([field, value]); return this; },
      ilike(field, value) { request.filters.push([field, value]); return this; },
      gte(field, value) { request.filters.push([field, value]); return this; },
      in(field, value) { request.filters.push([field, value]); return this; },
      order() { return this; },
      maybeSingle() { request.single = true; return this; },
      overrideTypes() { return this; },
      then(resolveResult, reject) {
        let result;
        if (table === "application_email_logs") {
          const error = logError || (missingLogs ? { code: "PGRST205", message: "Could not find the table 'public.application_email_logs' in the schema cache" } : null);
          const ids = request.filters.find(([field]) => field === "application_id")?.[1] ?? [];
          result = { error, data: error ? null : emailRows.filter(row => ids.includes(row.application_id)) };
        } else if (mainError) {
          result = { data: null, error: mainError };
        } else if (request.columns.includes("application_email_logs(")) {
          result = { data: null, error: { code: "PGRST200", message: "Could not find a relationship between 'applications' and 'application_email_logs' in the schema cache" } };
        } else if (missingNames && request.columns.includes("middle_name")) {
          result = { data: null, error: { code: "42703", message: "column applications.middle_name does not exist" } };
        } else if (table === "interview_slots") {
          result = { error: null, data: [{ id: "slot", division: "operations", starts_at: "2026-10-07T00:00:00Z", duration_minutes: 20, mode: "online", capacity: 3, applications: [application] }] };
        } else {
          result = { error: null, data: request.single ? application : [application] };
        }
        return Promise.resolve(result).then(resolveResult, reject);
      },
    };
    return query;
  } };
}

const common = {
  "server-only": {},
  "@/lib/supabase/config": { isSupabaseConfigured: () => true },
  "@/lib/supabase/server": { createAdminClient: client },
};
const name = load("src/lib/applications/name.ts");
const options = load("src/lib/applications/options.ts");
const format = load("src/lib/applications/interview-format.ts");
const emails = load("src/lib/applications/email-log.ts", { ...common, "next/cache": {}, "@/lib/notifications/notify": {} });
const admin = load("src/lib/applications/admin.ts", {
  ...common,
  "@/lib/data/accounts": { upperName: value => value.trim().toUpperCase(), fullName: parts => [parts.firstName, parts.lastName].join(" ") },
  "@/lib/data/store": { store: { list: async () => [] } },
  "./name": name,
  "./email-log": emails,
  "./interview-format": format,
  "./options": options,
  "./status": load("src/lib/applications/status.ts"),
});
const interviews = load("src/lib/applications/interviews.ts", { ...common, "./name": name, "./interview-format": format, "./options": options });
const actions = load("src/lib/applications/actions.ts", {
  ...common,
  "next/headers": { headers: async () => new Headers() },
  "@/lib/security/rate-limit": { clientIp: () => "test", limits: { track: { limit: 10, windowMs: 1000 } }, rateLimit: () => ({ ok: true }) },
  "@/lib/portal/form": load("src/lib/portal/form.ts"),
  "./schema": { applicationFields: { shape: {} } },
  "./name": name,
  "./options": options,
  "./reference": load("src/lib/applications/reference.ts"),
}, true);

async function test() {
  // The original schema must load without either new column or the email-log table/relationship.
  const records = await admin.listApplications({ status: "pending", body: "central", college: application.college });
  assert.equal(records[0].name, "ANA D. REYES");
  assert.equal(records[0].middleName, "D");
  assert.equal(records[0].registrationFormUrl, null);
  assert.equal(records[0].letterOfIntentUrl, null);
  assert.equal(records[0].gradesUrl, null);
  assert.deepEqual(records[0].emailLogs, []);
  assert.equal(records[0].emailLogsAvailable, false);
  assert.deepEqual(requests[0].filters.slice(-3), [["status", "pending"], ["preferred_body", "central"], ["college", application.college]]);
  assert.equal((await admin.getApplication(id)).id, id);
  assert.ok(requests.every(request => !request.columns.includes("application_email_logs(")));

  // Interview and tracking queries retry only the missing optional middle-name column.
  const slots = await interviews.getSlotsForPortal();
  assert.equal(slots[0].bookings[0].name, "ANA D. REYES");
  assert.equal(slots[0].bookings[0].middleName, "D");
  assert.equal(slots[0].bookings[0].yearLevel, "3rd year");
  assert.equal(slots[0].bookings[0].college, application.college);
  assert.equal(slots[0].bookings[0].email, "");
  assert.ok(requests.filter(request => request.table === "interview_slots").every(request => ["email", "facebook_url", "college", "program", "year_level", "position"].every(field => request.columns.includes(field))), "Both schema versions select the interview booking profile");
  assert.ok(requests.filter(request => request.table === "interview_slots").every(request => request.filters.some(([field, value]) => field === "college" && value === "")), "Central schedules are scoped to Central");
  await interviews.getSlotsForPortal(application.college);
  assert.ok(requests.at(-1).filters.some(([field, value]) => field === "college" && value === application.college), "Local schedule query uses the selected college");
  const tracking = new FormData();
  tracking.set("reference", application.reference_code);
  tracking.set("identity", "2026000001");
  const tracked = await actions.trackApplication(undefined, tracking);
  assert.equal(tracked.application.name, "ANA D. REYES");
  const trackingRequests = requests.filter(request => request.single && request.filters.some(([field]) => field === "reference_code"));
  assert.equal(trackingRequests.length, 2);
  assert.ok(trackingRequests.every(request => request.filters.some(([field, value]) => field === "student_number" && value === "2026000001")));
  assert.ok(trackingRequests.every(request => !request.columns.includes("email") && !request.columns.includes("cv_url")));

  // Updated schemas read the new fields and email rows without needing a cached relationship.
  missingNames = false;
  missingLogs = false;
  application.middle_name = "DE LA CRUZ";
  application.email = "ana.reyes.sci@ust.edu.ph";
  application.facebook_url = "https://www.facebook.com/ana.reyes";
  application.program = "BS Biology";
  application.position = "Operations Staff";
  application.registration_form_url = "https://drive.google.com/file/d/test/view";
  application.letter_of_intent_url = "https://drive.google.com/file/d/intent/view";
  application.grades_url = "https://drive.google.com/file/d/grades/view";
  emailRows = [{ application_id: id, kind: "acknowledgement", sent_at: "2026-10-01T00:01:00Z" }, { application_id: id, kind: "rejected", sent_at: "2026-10-02T00:00:00Z" }, { application_id: "other", kind: "accepted", sent_at: "2026-10-02T00:00:00Z" }];
  const updated = await admin.getApplication(id);
  assert.equal(updated.name, "ANA DE LA CRUZ REYES");
  assert.equal(updated.registrationFormUrl, application.registration_form_url);
  assert.equal(updated.letterOfIntentUrl, application.letter_of_intent_url);
  assert.equal(updated.gradesUrl, application.grades_url);
  assert.equal(updated.emailLogsAvailable, true);
  assert.deepEqual(updated.emailLogs, [{ kind: "acknowledgement", sentAt: emailRows[0].sent_at }, { kind: "rejected", sentAt: emailRows[1].sent_at }]);
  assert.equal((await actions.trackApplication(undefined, tracking)).application.name, updated.name);
  assert.equal((await interviews.getSlotsForPortal())[0].bookings[0].name, updated.name);
  const booking = (await interviews.getSlotsForPortal())[0].bookings[0];
  assert.deepEqual({ lastName: booking.lastName, firstName: booking.firstName, middleName: booking.middleName, email: booking.email, facebookUrl: booking.facebookUrl, college: booking.college, program: booking.program, yearLevel: booking.yearLevel, position: booking.position }, {
    lastName: "REYES", firstName: "ANA", middleName: "DE LA CRUZ", email: application.email, facebookUrl: application.facebook_url, college: application.college, program: application.program, yearLevel: "3rd year", position: application.position,
  });
  assert.equal(name.isMiddleNameColumnMissing({ code: "42501", message: "permission denied for middle_name" }), false);

  // Permission and other database failures must remain visible instead of becoming empty results.
  logError = { code: "42501", message: "permission denied for application_email_logs" };
  await assert.rejects(admin.listApplications(), /permission denied/);
  logError = null;
  mainError = { code: "42501", message: "permission denied for applications" };
  await assert.rejects(admin.listApplications(), /permission denied/);
  console.log("Passed recruitment reads on original and migrated schemas, isolated email-history queries, missing-column fallbacks, preserved filters, and genuine error handling.");
}

test().catch(error => { console.error(error); process.exitCode = 1; });
