/* eslint-disable @typescript-eslint/no-require-imports -- Isolated PostgreSQL migration checks.
 * Run with node scripts/test-secretariat-control-numbers.cjs /path/to/@electric-sql/pglite
 * The test uses an in-memory database and never connects to Supabase.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require(process.argv[2] || "@electric-sql/pglite");
async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table public.portal_accounts (id text, active boolean, affiliation text, college text);
      create table public.portal_messages (
        kind text, title text, body text, sender_name text, audience_label text, recipient_ids text[],
        sender_affiliation text, sender_college text, recipient_mention text
      );
    `);
    const migrations = ["0059_letters_tracker", "0060_letter_control_numbers", "0061_letter_number_preview", "0062_letter_destination_office", "0063_letter_document_links", "0064_letter_remarks", "0065_letter_status_notifications", "0066_letter_labels"];
    for (const name of migrations) await db.exec(fs.readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
    // Simulate records created under the old hardcoded-year implementation.
    await db.exec(`
      alter table secretariat_letters disable trigger secretariat_letter_control_number;
      insert into secretariat_letters (control_number, control_sequence, title, type, prepared_by, created_by, updated_by, created_at)
      values ('UST:CC-026-LTR-001', 1, 'Past letter', 'Request Letter', 'Officer', 'officer@ust.edu.ph', 'officer@ust.edu.ph', '2025-12-31T15:59:59Z'),
             ('UST:CC-026-LTR-002', 2, 'New Year letter', 'Request Letter', 'Officer', 'officer@ust.edu.ph', 'officer@ust.edu.ph', '2026-12-31T16:00:00Z');
      select setval('secretariat_letter_numbers', 2, true);
      alter table secretariat_letters enable trigger secretariat_letter_control_number;
    `);
    await db.exec(fs.readFileSync("supabase/migrations/0067_minutes_tracker_and_control_year.sql", "utf8"));
    assert.deepEqual((await db.query("select control_number from secretariat_letters order by control_sequence")).rows.map(row => row.control_number), ["UST:CC-025-LTR-001", "UST:CC-027-LTR-002"]);
    const year = (await db.query("select to_char(now() at time zone 'Asia/Manila', 'YYY') as year")).rows[0].year;
    const preview = async kind => (await db.query(`select preview_${kind}_control_number() as number`)).rows[0].number;
    assert.equal(await preview("minute"), `UST:CC-${year}-MIN-001`);
    assert.equal(await preview("minute"), `UST:CC-${year}-MIN-001`, "Previews do not reserve numbers");
    assert.equal(await preview("letter"), `UST:CC-${year}-LTR-003`);
    const added = (await db.query(`insert into secretariat_minutes
      (title, prepared_by, created_by, updated_by, created_at, control_number, control_sequence, notify_status_updates)
      values ('Meeting', 'Officer', 'officer@ust.edu.ph', 'officer@ust.edu.ph', '2000-01-01', 'forged', 900, true)
      returning *`)).rows[0];
    assert.equal(added.control_number, `UST:CC-${year}-MIN-001`);
    assert.equal(Number(added.control_sequence), 1);
    assert.notEqual(new Date(added.created_at).getUTCFullYear(), 2000);
    await db.exec("insert into portal_accounts values ('central-officer', true, 'central', null), ('local-officer', true, 'local', 'CICS')");
    await db.query("update secretariat_minutes set status = 'Approved' where id = $1", [added.id]);
    const message = (await db.query("select * from portal_messages")).rows[0];
    assert.ok(message.body.includes("Minutes of the Meetings"));
    assert.deepEqual(message.recipient_ids, ["central-officer", "built-in"]);
    const edited = (await db.query("select * from secretariat_minutes where id = $1", [added.id])).rows[0];
    assert.equal(edited.control_number, added.control_number);
    assert.equal(String(edited.created_at), String(added.created_at));
    await assert.rejects(db.query("update secretariat_minutes set control_number = 'forged' where id = $1", [added.id]), /fixed/);
    await assert.rejects(db.query("update secretariat_minutes set created_at = '2000-01-01' where id = $1", [added.id]), /fixed/);
    await assert.rejects(db.query("update secretariat_letters set control_sequence = 900 where control_sequence = 1"), /fixed/);
    await db.query("delete from secretariat_minutes where id = $1", [added.id]);
    assert.equal(await preview("minute"), `UST:CC-${year}-MIN-002`, "Deleted numbers are never reused");
    await db.exec("select setval('secretariat_minute_numbers', 999, true)");
    assert.equal(await preview("minute"), `UST:CC-${year}-MIN-1000`, "Numbers beyond 999 are not truncated");
    assert.equal(await preview("letter"), `UST:CC-${year}-LTR-003`, "Trackers have independent sequences");
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from secretariat_minutes"), /permission denied/);
    await db.exec("reset role");

    // 0068: Settings, per-format counters, university-issued and hand-typed numbers.
    await db.exec(fs.readFileSync("supabase/migrations/0068_secretariat_settings.sql", "utf8"));
    // Supabase grants the service role every table by default; the functions must be granted explicitly.
    await db.exec("grant all on all tables in schema public to service_role; set role service_role");
    const next = async format => (await db.query("select preview_secretariat_control_number($1) as number", [format])).rows[0].number;
    assert.equal(await next("UST:CC-{YYY}-LTR"), `UST:CC-${year}-LTR-003`, "Letters continue their old sequence");
    assert.equal(await next("UST:CC-{YYY}-MIN"), `UST:CC-${year}-MIN-1000`, "Minutes continue past numbers already consumed");
    assert.equal(await next("UST:CC-{YYYY}-SPN"), `UST:CC-2${year}-SPN-001`, "A new format starts at -001");
    const insert = async (table, patch) => (await db.query(`insert into ${table} (title, type, status, prepared_by, created_by, updated_by, control_format, control_number)
      values ('Letter', $1, 'Draft', 'Officer', 'officer@ust.edu.ph', 'officer@ust.edu.ph', $2, $3) returning *`, [patch.type ?? "Request Letter", patch.format ?? null, patch.number ?? null])).rows[0];
    const automatic = await insert("secretariat_letters", { format: "UST:CC-{YYY}-LTR", number: "forged" });
    assert.equal(automatic.control_number, `UST:CC-${year}-LTR-003`);
    assert.equal(Number(automatic.control_sequence), 3);
    const proposals = [await insert("secretariat_letters", { type: "Project Proposal", number: " UST:S030-00-FO120 " }), await insert("secretariat_letters", { type: "Project Proposal", number: "UST:S030-00-FO120" })];
    assert.deepEqual(proposals.map(row => row.control_number), ["UST:S030-00-FO120", "UST:S030-00-FO120"], "University-issued numbers repeat and are trimmed");
    assert.ok(proposals.every(row => row.control_sequence === null && row.control_format === null));
    await assert.rejects(insert("secretariat_letters", { number: "  " }), /Enter a control number/);
    assert.equal(await next("UST:CC-{YYY}-LTR"), `UST:CC-${year}-LTR-004`, "Fixed and typed numbers don't use the count");
    const sponsor = await insert("secretariat_letters", { format: "UST:CC-{YYYY}-SPN" });
    assert.equal(sponsor.control_number, `UST:CC-2${year}-SPN-001`);
    await assert.rejects(db.query("update secretariat_letters set control_number = 'forged' where id = $1", [automatic.id]), /fixed/);
    await assert.rejects(db.query("update secretariat_letters set created_at = '2000-01-01' where id = $1", [automatic.id]), /fixed/);
    const kept = (await db.query("update secretariat_letters set title = 'Renamed' where id = $1 returning *", [automatic.id])).rows[0];
    assert.equal(kept.control_number, automatic.control_number, "Editing other fields keeps the number");
    const moved = (await db.query("update secretariat_letters set control_format = 'UST:CC-{YYYY}-SPN' where id = $1 returning *", [automatic.id])).rows[0];
    assert.equal(moved.control_number, `UST:CC-2${year}-SPN-002`, "Moving to another automatic format takes its next number");
    const typed = (await db.query("update secretariat_letters set control_format = null, control_number = 'CC-HAND-1' where id = $1 returning *", [proposals[1].id])).rows[0];
    assert.equal(typed.control_number, "CC-HAND-1");
    const minute = await insert("secretariat_minutes", { type: "Minutes of the Meeting", format: "UST:CC-{YYY}-MIN" });
    assert.equal(minute.control_number, `UST:CC-${year}-MIN-1000`);

    // Saving settings: renames carry into records without status notifications; removals are checked.
    await db.exec("reset role");
    await db.query("update secretariat_letters set notify_status_updates = true, label = 'Print', remark_presets = array['Send to email'] where id = $1", [sponsor.id]);
    await db.query("update secretariat_letters set label = 'Revise' where id = $1", [moved.id]);
    await db.exec("set role service_role");
    const messages = Number((await db.query("select count(*) from portal_messages")).rows[0].count);
    const save = async (changes, expected = null) => (await db.query("select save_secretariat_settings($1, $2, $3, 'chair@ust.edu.ph') as result", [{ saved: true }, changes, expected])).rows[0].result;
    assert.deepEqual(await save({ removed: [{ kind: "status", name: "Draft" }, { kind: "letterType", name: "Excuse Letter" }] }), { blocked: [{ kind: "status", name: "Draft", count: 7 }] }, "A status in use can't be removed; an unused type can");
    assert.equal(Number((await db.query("select count(*) from secretariat_settings")).rows[0].count), 0, "A blocked save writes nothing");
    assert.deepEqual(await save({ renamed: [{ kind: "status", from: "Draft", to: "Initial" }, { kind: "label", from: "Print", to: "Revise" }, { kind: "label", from: "Revise", to: "Print" }, { kind: "remark", from: "Send to email", to: "Email it" }, { kind: "letterType", from: "Project Proposal", to: "Project Proposal Form" }], removed: [] }), { ok: true });
    const after = (await db.query("select * from secretariat_letters where id = $1", [sponsor.id])).rows[0];
    assert.equal(after.status, "Initial");
    assert.equal(after.label, "Revise", "Swapped label names don't merge");
    assert.equal((await db.query("select label from secretariat_letters where id = $1", [moved.id])).rows[0].label, "Print");
    assert.deepEqual(after.remark_presets, ["Email it"]);
    assert.equal(Number((await db.query("select count(*) from secretariat_letters where type = 'Project Proposal Form'")).rows[0].count), 2);
    assert.equal(Number((await db.query("select count(*) from portal_messages")).rows[0].count), messages, "Renaming a status doesn't announce a status change");
    assert.equal(after.control_number, sponsor.control_number, "Renames never renumber");
    assert.deepEqual(await save({}, null), { conflict: true }, "A save over a version someone else saved is refused");
    const stamp = (await db.query("select updated_at from secretariat_settings")).rows[0].updated_at;
    assert.deepEqual(await save({ removed: [{ kind: "label", name: "Revise" }, { kind: "remark", name: "Email it" }, { kind: "office", name: "Office of the Rector (OR)" }] }, stamp), { ok: true });
    const cleared = (await db.query("select * from secretariat_letters where id = $1", [sponsor.id])).rows[0];
    assert.equal(cleared.label, null, "Removing a label takes it off records");
    assert.deepEqual(cleared.remark_presets, [], "Removing a preset unticks it");
    await db.query("update secretariat_letters set status = 'Approved' where id = $1", [sponsor.id]);
    assert.equal(Number((await db.query("select count(*) from portal_messages")).rows[0].count), messages + 1, "Real status changes still notify after a save");
    await db.exec("reset role; set role authenticated");
    await assert.rejects(db.query("select * from secretariat_settings"), /permission denied/);
    await assert.rejects(db.query("select preview_secretariat_control_number('X')"), /permission denied/);
    await db.exec("reset role");
    console.log("PostgreSQL migration checks passed: historical Manila years, previews, immutable creation metadata, notifications, deletion, overflow, per-format counters, university-issued and typed numbers, settings renames and removals, and restricted database access.");
  } finally { await db.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
