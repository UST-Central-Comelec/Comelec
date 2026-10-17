/* eslint-disable @typescript-eslint/no-require-imports -- Test deployment SQL against isolated Postgres. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.events(id text primary key, published boolean not null default true,
        registration_status text not null default 'closed', minimum_registrants int not null default 1,
        maximum_registrants int check (maximum_registrants >= minimum_registrants),
        require_google boolean not null default true, updated_at timestamptz, updated_by text);
      create table public.event_rsvp_forms(event_id text primary key references public.events(id),
        enabled boolean not null default false, require_google boolean not null default false,
        invitation_token uuid not null default gen_random_uuid(), definition jsonb, updated_at timestamptz default now());
      create table public.event_evaluation_forms(event_id text primary key references public.events(id),
        enabled boolean not null default false, require_google boolean not null default false,
        allow_anonymous boolean not null default false, questions jsonb not null, steps jsonb,
        updated_at timestamptz default now());
      insert into public.events(id) values('sample'),('fresh');
      insert into public.event_rsvp_forms(event_id,definition) values('sample','{"original":true}');
      insert into public.event_evaluation_forms(event_id,questions) values('sample','[{"original":true}]');
    `);
    const migration = fs.readFileSync("supabase/migrations/20261015081414_event_deployment_grace.sql", "utf8");
    await db.exec(migration.split("-- Existing project")[0]);
    const values = { published: false, registrationStatus: "open", minimumRegistrants: "1", maximumRegistrants: "20",
      requireGoogle: false, rsvpEnabled: true, rsvpGoogle: true, evaluationEnabled: true,
      evaluationGoogle: true, allowAnonymous: true, evaluationQuestions: [{ seed: true }], evaluationSteps: null };
    const client = "11111111-1111-4111-8111-111111111111";
    const queue = async (revision, settings = values, id = "sample") =>
      (await db.query("select * from public.queue_event_deployment($1,$2::jsonb,$3,$4::uuid,$5)", [id, JSON.stringify(settings), "editor@example.com", client, revision])).rows[0];
    const event = async id => (await db.query("select * from public.events where id=$1", [id])).rows[0];
    const run = async () => (await db.query("select public.apply_due_event_deployments() as applied")).rows[0].applied;
    const due = async id => db.query("update public.event_deployment_changes set apply_at=now()-interval '1 second',retry_at=now()-interval '1 second' where event_id=$1", [id]);
    const first = await queue(1);
    assert.ok(Date.parse(first.apply_at) - Date.now() >= 59000, "Deadline includes a full minute on the database clock");
    assert.equal(await run(), 0, "The worker cannot apply settings early");
    assert.equal((await event("sample")).published, true, "Live values stay unchanged during grace");
    const second = await queue(2, { ...values, maximumRegistrants: "30" });
    assert.notEqual(first.version, second.version, "Each accepted edit gets a new cancellation version");
    const late = await queue(1);
    assert.equal(late.version, second.version, "Out-of-order requests cannot replace newer edits");
    await db.exec(`update public.event_rsvp_forms set definition='{"edited":true}' where event_id='sample';
      update public.event_evaluation_forms set questions='[{"edited":true}]' where event_id='sample';`);
    const token = (await db.query("select invitation_token from public.event_rsvp_forms where event_id='sample'")).rows[0].invitation_token;
    await due("sample");
    assert.equal(await run(), 1, "A background worker applies the persisted settings without a browser");
    assert.equal((await event("sample")).maximum_registrants, 30);
    assert.equal((await event("sample")).published, false);
    const rsvp = (await db.query("select * from public.event_rsvp_forms where event_id='sample'")).rows[0];
    assert.equal(rsvp.enabled, true);
    assert.deepEqual(rsvp.definition, { edited: true }, "Question edits made during grace survive application");
    assert.equal(rsvp.invitation_token, token, "Application preserves invitation tokens");
    const evaluation = (await db.query("select * from public.event_evaluation_forms where event_id='sample'")).rows[0];
    assert.equal(evaluation.allow_anonymous, true);
    assert.deepEqual(evaluation.questions, [{ edited: true }]);
    assert.equal(await run(), 0, "Applied settings are not applied twice");
    assert.ok((await queue(1)).applied_at, "Late requests cannot resurrect already-applied settings");

    const cancellation = await queue(3);
    assert.equal((await db.query("select public.cancel_event_deployment($1,$2::uuid) as cancelled", ["sample", first.version])).rows[0].cancelled, false, "Old versions cannot cancel newer changes");
    assert.equal((await db.query("select public.cancel_event_deployment($1,$2::uuid) as cancelled", ["sample", cancellation.version])).rows[0].cancelled, true);
    await due("sample");
    assert.equal(await run(), 0, "Discarded changes never apply");

    await queue(4, { ...values, minimumRegistrants: "100", maximumRegistrants: "2", published: true });
    await due("sample");
    assert.equal(await run(), 0, "An invalid group rolls back atomically");
    assert.equal((await event("sample")).published, false, "Failure never partially changes website visibility");
    assert.ok((await db.query("select error from public.event_deployment_changes where event_id='sample'")).rows[0].error);
    await queue(5);
    await due("sample");
    assert.equal(await run(), 1, "A later edit recovers from a failed scheduled change");

    await queue(1, values, "fresh");
    await due("fresh");
    assert.equal(await run(), 1);
    assert.deepEqual((await db.query("select questions from public.event_evaluation_forms where event_id='fresh'")).rows[0].questions, [{ seed: true }], "Missing forms are seeded without requiring the editor to stay open");
    const privileges = (await db.query(`select
      has_table_privilege('anon','public.event_deployment_changes','select') as can_read,
      has_function_privilege('authenticated','public.queue_event_deployment(text,jsonb,text,uuid,bigint)','execute') as can_queue,
      (select relrowsecurity from pg_class where oid='public.event_deployment_changes'::regclass) as rls`)).rows[0];
    assert.deepEqual(privileges, { can_read: false, can_queue: false, rls: true });
    console.log("Deployment database passed: one-minute grace, persistence, ordering, cancellation, atomic application, retries, questionnaire preservation, seeding, and restricted access.");
  } finally { await db.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
