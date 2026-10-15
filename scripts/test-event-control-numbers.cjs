/* eslint-disable @typescript-eslint/no-require-imports -- In-memory PostgreSQL checks, never a live Supabase project. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
async function main() {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.events (id text primary key, created_at timestamptz not null default now(), event_date date default current_date, venue_mode text default 'onsite');
    create table public.portal_accounts (id text, active boolean, affiliation text, college text);
    create table public.portal_messages (kind text, title text, body text, sender_name text, audience_label text, recipient_ids text[], sender_affiliation text, sender_college text, recipient_mention text);`);
  for (const name of ['0059_letters_tracker','0060_letter_control_numbers','0061_letter_number_preview','0062_letter_destination_office','0063_letter_document_links','0064_letter_remarks','0065_letter_status_notifications','0066_letter_labels','0067_minutes_tracker_and_control_year','0068_secretariat_settings','20261015000100_event_documentations']) {
   await db.exec(fs.readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
  }
  await db.exec(`insert into events (id, created_at) values ('first','2026-01-01T00:00:00Z'),('second','2026-01-02T00:00:00Z'),('third','2026-01-03T00:00:00Z'),('fourth','2026-01-04T00:00:00Z');`);
  const insert = async (event, type='Request Letter', patch={}) => (await db.query(`insert into secretariat_letters
    (event_id, title, type, status, prepared_by, created_by, updated_by, control_format, control_number, notify_status_updates)
    values ($1, 'Document', $2, 'Draft', 'Officer', 'officer@ust.edu.ph', 'officer@ust.edu.ph', $3, $4, false) returning *`,[event,type,patch.format ?? null,patch.number ?? 'OLD'])).rows[0];
  const old1 = await insert('fourth','Request Letter',{format:'UST:CC-{YYY}-LTR'});
  const old2 = await insert('fourth','Invitation Letter',{format:'UST:CC-{YYY}-LTR'});
  const fixed = await insert('first','Project Proposal',{number:'UST:S030-00-FO120'});
  const general = await insert(null,'Request Letter',{format:'UST:CC-{YYY}-LTR'});
  const migration=fs.readFileSync('supabase/migrations/20261015000200_event_control_numbers.sql','utf8');
  await db.exec(migration);
  const get=async (table,id)=>(await db.query(`select * from ${table} where id=$1`,[id])).rows[0];
  assert.equal((await get('events','first')).control_number,'UST:CC-026-SA01');
  assert.equal((await get('events','fourth')).control_number,'UST:CC-026-SA04');
  assert.equal((await get('secretariat_letters',old1.id)).control_number,'UST:CC-026-SA04-01');
  assert.equal((await get('secretariat_letters',old2.id)).control_number,'UST:CC-026-SA04-02');
  assert.equal((await get('secretariat_letters',fixed.id)).control_number,'UST:S030-00-FO120 (SA01)');
  assert.equal((await get('secretariat_letters',general.id)).control_number,general.control_number,'General Letters are unchanged');
  await db.exec(migration);
  assert.equal((await get('secretariat_letters',old2.id)).control_number,'UST:CC-026-SA04-02','Repeated migration preserves event document numbers');
  const preview=async(event,type)=>(await db.query('select preview_event_document_control_number($1,$2) as number',[event,type])).rows[0].number;
  assert.equal(await preview('fourth','Request Letter'),'UST:CC-026-SA04-03');
  assert.equal(await preview('fourth','Invitation Letter'),'UST:CC-026-SA04-03','Types share the event’s counter');
  assert.equal(await preview('first','Budget Proposal'),'UST:S030-00-FO130 (SA01)');
  assert.equal(await preview('first','Project Proposal'),'UST:S030-00-FO120 (SA01)');
  const budget=await insert('first','Budget Proposal',{number:'forged',format:'forged'});
  assert.equal(budget.control_number,'UST:S030-00-FO130 (SA01)');
  assert.equal(budget.control_sequence,null);
  assert.equal(budget.control_format,null);
  assert.equal(await preview('first','Request Letter'),'UST:CC-026-SA01-01','Fixed forms do not consume document numbers');
  const doc=await insert('fourth','Request Letter',{number:'forged',format:'forged'});
  assert.equal(doc.control_number,'UST:CC-026-SA04-03','The database ignores submitted numbering');
  assert.equal(await preview('fourth','Request Letter'),'UST:CC-026-SA04-04');
  await db.query('delete from secretariat_letters where id=$1',[doc.id]);
  assert.equal((await insert('fourth')).control_number,'UST:CC-026-SA04-04','Deleted numbers are never reused');
  const retyped=(await db.query("update secretariat_letters set type='Narrative Report' where id=$1 returning *",[old2.id])).rows[0];
  assert.equal(retyped.control_number,'UST:CC-026-SA04-02','Regular type changes preserve document identity');
  const asFixed=(await db.query("update secretariat_letters set type='Budget Proposal' where id=$1 returning *",[old2.id])).rows[0];
  assert.equal(asFixed.control_number,'UST:S030-00-FO130 (SA04)');
  const asRegular=(await db.query("update secretariat_letters set type='Request Letter' where id=$1 returning *",[old2.id])).rows[0];
  assert.equal(asRegular.control_number,'UST:CC-026-SA04-05','Switching away from a fixed form gets the next regular number');
  await assert.rejects(db.query("update secretariat_letters set control_number='forged' where id=$1",[old1.id]),/fixed/);
  await assert.rejects(db.query("update secretariat_letters set event_id='first' where id=$1",[old1.id]),/parent event is fixed/);
  await assert.rejects(db.query("update secretariat_letters set event_id=null where id=$1",[old1.id]),/parent event is fixed/);
  await assert.rejects(db.query("update secretariat_letters set event_id='first' where id=$1",[general.id]),/parent event is fixed/);
  await assert.rejects(db.query("update events set control_number='forged' where id='first'"),/fixed/);
  await db.exec("update events set event_date='2028-01-01' where id='first'");
  assert.equal((await get('events','first')).control_number,'UST:CC-026-SA01','Rescheduling does not change an event’s control number');
  await db.exec("delete from events where id='third'; insert into events(id,activity_sequence,control_number,control_year) values('fifth',999,'forged',2000)");
  assert.equal(Number((await get('events','fifth')).activity_sequence),5,'Event numbering never reuses a deleted activity number');
  await db.exec("update event_document_counters set last_value=98 where event_id='fourth'");
  assert.equal((await insert('fourth')).control_number,'UST:CC-026-SA04-99');
  assert.equal((await insert('fourth')).control_number,'UST:CC-026-SA04-100','Document numbers are not truncated after 99');
  const batch=await Promise.all(Array.from({length:5},()=>insert('first')));
  assert.equal(new Set(batch.map(row=>row.control_number)).size,5,'Atomic event counters issue distinct numbers');
  await db.exec("select setval('event_activity_numbers',99,true); insert into events(id) values('hundredth')");
  assert.ok((await get('events','hundredth')).control_number.endsWith('-SA100'),'Activity numbers are not truncated after 99');
  const renamedSettings = { letters: { types: [{ id: 'project-proposal', name: 'Project filing', format: 'UST:S030-00-FO120' }] } };
  const changes = { renamed: [{ kind: 'letterType', from: 'Project Proposal', to: 'Project filing' }], removed: [] };
  assert.deepEqual((await db.query("select save_secretariat_settings($1,$2,null,'officer@ust.edu.ph') as result", [renamedSettings,changes])).rows[0].result,{ok:true});
  assert.equal((await get('secretariat_letters',fixed.id)).control_number,'UST:S030-00-FO120 (SA01)','Settings renames preserve fixed form numbers');
  assert.equal(await preview('first','Project filing'),'UST:S030-00-FO120 (SA01)','Renamed university forms retain their suffix');
  assert.equal((await insert('first','Project filing')).control_number,'UST:S030-00-FO120 (SA01)');
  const minute=(await db.query(`insert into secretariat_minutes (title,type,status,prepared_by,created_by,updated_by,control_number)
    values ('Minutes','Minutes of the Meeting','Draft','Officer','officer@ust.edu.ph','officer@ust.edu.ph','MIN-FIXED') returning *`)).rows[0];
  assert.equal(minute.control_number,'MIN-FIXED','Minutes still use their own numbering behavior');
  const letterCounter=(await db.query("select last_value from secretariat_control_counters where format='UST:CC-{YYY}-LTR'")).rows[0].last_value;
  await insert('first');
  assert.equal((await db.query("select last_value from secretariat_control_counters where format='UST:CC-{YYY}-LTR'")).rows[0].last_value,letterCounter,'Event papers do not consume General Letters numbers');
  const fourFormsMigration=fs.readFileSync('supabase/migrations/20261015000300_event_fixed_document_types.sql','utf8');
  await db.exec(fourFormsMigration);
  assert.equal((await get('secretariat_letters',old1.id)).control_number,'UST:CC-026-SA04-05','Existing first letters move past the four reserved forms');
  assert.equal((await get('secretariat_letters',fixed.id)).control_number,'UST:S030-00-FO130 (SA01)','The revised PPF code is applied to existing event forms');
  assert.equal((await get('secretariat_letters',fixed.id)).type,'Project Proposal Form (PPF)');
  assert.equal((await get('secretariat_letters',general.id)).control_number,general.control_number,'General Letters remain unchanged');
  await db.exec("insert into events(id) values('forms-only')");
  const newEvent=await get('events','forms-only');
  const activity='SA'+String(newEvent.activity_sequence).padStart(2,'0');
  const forms=[['Project Proposal Form (PPF)','UST:S030-00-FO130'],['Community Development Project Proposal Form (Simbahayan)','UST:S040-00-FO21'],['Vehicle Reservation Form','UST:S040-00-FO25'],['Budget Proposal','UST:S030-00-FO130']];
  for(const [type,code] of forms){
    assert.equal(await preview('forms-only',type),`${code} (${activity})`);
    const added=await insert('forms-only',type);
    assert.equal(added.control_number,`${code} (${activity})`);
    assert.equal(added.control_sequence,null);
  }
  assert.equal(await preview('forms-only','Request Letter'),`${newEvent.control_number}-05`,'The first regular document starts at 05');
  assert.equal((await insert('forms-only','Request Letter')).control_number,`${newEvent.control_number}-05`);
  assert.equal((await insert('forms-only','Invitation Letter')).control_number,`${newEvent.control_number}-06`);
  await db.exec(fourFormsMigration);
  assert.equal((await get('secretariat_letters',old1.id)).control_number,'UST:CC-026-SA04-05','Rerunning never shifts numbers twice');
  assert.equal(await preview('forms-only','Request Letter'),`${newEvent.control_number}-07`);
  const settingsStamp=(await db.query('select updated_at::text as stamp from secretariat_settings')).rows[0].stamp;
  const latestSettings={letters:{types:[...renamedSettings.letters.types,{id:'budget-proposal',name:'Budget filing',format:'UST:S030-00-FO130'}]}};
  assert.deepEqual((await db.query("select save_secretariat_settings($1,$2,$3,'officer@ust.edu.ph') as result",[latestSettings,{renamed:[{kind:'letterType',from:'Budget Proposal',to:'Budget filing'}],removed:[]},settingsStamp])).rows[0].result,{ok:true});
  assert.equal((await get('secretariat_letters',budget.id)).type,'Budget Proposal','Mandatory event type names stay independent of General Letters settings');
  // The activity checklist: PPF takes FO120 as printed on its template, and more forms are fixed.
  const checklistMigration=fs.readFileSync('supabase/migrations/20261015000400_event_activity_checklist.sql','utf8');
  await db.exec(checklistMigration);
  const ppf=(await db.query("select * from secretariat_letters where event_id='forms-only' and type='Project Proposal Form (PPF)'")).rows[0];
  assert.equal(ppf.control_number,`UST:S030-00-FO120 (${activity})`,'Existing PPFs take the FO120 code');
  for(const [type,code] of [['Advocacy Project Proposal','UST:S040-00-FO38'],['Service Learning Project Proposal','UST:S040-00-FO47'],['Food Approval Form','UST:S042-00-FO83'],['Accomplished Vehicle Reservation Form','UST:S040-00-FO25']]){
    assert.equal(await preview('forms-only',type),`${code} (${activity})`);
    const added=await insert('forms-only',type);
    assert.equal(added.control_number,`${code} (${activity})`); assert.equal(added.control_sequence,null);
  }
  assert.equal(await preview('forms-only','Approved Publicity Material/s'),`${newEvent.control_number}-07`,'Other checklist documents take the next counter number');
  assert.equal((await get('events','forms-only')).venue_type,'in-campus');
  await db.exec(checklistMigration);
  assert.equal((await get('secretariat_letters',ppf.id)).control_number,`UST:S030-00-FO120 (${activity})`,'Rerunning keeps numbers');
  await assert.rejects(db.query("update events set venue_type='moon' where id='forms-only'"),/events_venue_type_check/);
  await db.exec("grant all on all tables in schema public to service_role; set role service_role");
  assert.equal(await preview('first','Project Proposal'),'UST:S030-00-FO120 (SA01)');
  await db.exec('reset role; set role authenticated');
  await assert.rejects(db.query("select preview_event_document_control_number('first','Request Letter')"),/permission denied/);
  await assert.rejects(db.query('select * from event_document_counters'),/permission denied/);
  await db.exec('reset role');
  await db.exec("delete from events where id='first'");
  assert.equal(Number((await db.query("select count(*) from event_document_counters where event_id='first'")).rows[0].count),0);
  console.log('Event control numbering passed: stable activities, year formatting, per-event counters, migration backfill/idempotence, four fixed form suffixes, reserved positions 01–04, 05-starting ordinary letters, previews, type changes, tamper protection, deletions, overflow, independent General Letters and private database access.');
 } finally { await db.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
