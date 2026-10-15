/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const ts = require('typescript');
const path = require('node:path');
function load(file, dependencies = {}, cache = new Map()) {
  file = path.resolve(file); if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  new Function('require', 'module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`, dependencies, cache);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`), dependencies, cache);
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports); return compiled.exports;
}
const capacity = { exports: {} };
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/events/capacity.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(require,capacity,capacity.exports);
const {capacitySchema} = capacity.exports;
assert.deepEqual(capacitySchema.parse({}),{minimumRegistrants:1,maximumRegistrants:null});
for(const value of [{minimumRegistrants:0},{minimumRegistrants:2,maximumRegistrants:1},{maximumRegistrants:1.5},{maximumRegistrants:'no'}]) assert.equal(capacitySchema.safeParse(value).success,false);
(async()=>{
 const deliveries=[];
 const registration = load('src/lib/events/actions.ts', {
   'next/headers': { headers: async()=>new Headers() }, 'next/cache': { revalidatePath: ()=>{} },
   '@/lib/notifications/notify': { sendAutomatic: async(kind, send)=>{deliveries.push(kind);send();return 'sent'} },
   '@/lib/security/rate-limit': {clientIp:()=>'',limits:{eventRegister:{}},rateLimit:()=>({ok:true})},
   '@/lib/supabase/config': {isSupabaseConfigured:()=>true},
   '@/lib/supabase/server': {createAdminClient:()=>({from:()=>({insert:()=>({select:()=>({single:async()=>({data:{reference_code:'ABCDE',status:'waitlisted'},error:null})})})})})},
   '@/lib/forms/email-domain': {emailDomainProblem:async()=>null},
   './emails': {registrationEmail:(_person,_event,kind)=>{assert.equal(kind,'waitlisted');return {}}},
   './queries': {getEvent:async()=>({id:'sample',published:true,registrationStatus:'open',endDate:'2099-01-01',endsTime:'23:59',requireGoogle:false})},
   './registrations': {findRegistration:async()=>null,fullName:()=> 'ANA CRUZ'},
   './schema': {readRegistration:()=>({lastName:'CRUZ',firstName:'ANA',middleName:'',email:'guest@example.com',affiliation:'independent',attendingAs:'independent',institution:'',age:'20',consent:true}),checkRegistration:()=>({}),needsVerification:()=>false,toRequests:()=>({})},
   './verification': {readEventPass:async()=>null,clearEventPass:async()=>{}},
 });
 const result = await registration.submitRegistration('sample',{},new FormData());
 assert.equal(result.result.kind,'waitlisted','Confirmation follows the saved status when the last place was taken meanwhile');
 assert.deepEqual(deliveries,['event-waitlisted']);
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table events(id text primary key, registration_status text not null default 'open', published boolean not null default true);
    create table event_registrations(id text primary key, event_id text not null references events(id) on delete cascade, status text not null, email text, unique(event_id,email));
    alter table events enable row level security; alter table event_registrations enable row level security;
    insert into events(id) values('legacy'); insert into event_registrations values('old','legacy','registered','old@example.com');`);
  await db.exec(fs.readFileSync('supabase/migrations/20261014053716_event_registration_capacity.sql','utf8'));
  const event=async id=>(await db.query('select * from events where id=$1',[id])).rows[0];
  assert.equal((await event('legacy')).registered_count,1);
  assert.equal((await event('legacy')).minimum_registrants,1);
  assert.equal((await event('legacy')).maximum_registrants,null);
  await db.exec(`insert into events(id,maximum_registrants) values('limited',2); insert into event_registrations values('a','limited','registered','a@example.com');`);
  assert.equal((await event('limited')).registration_status,'open');
  await db.exec(`insert into event_registrations values('b','limited','registered','b@example.com'),('c','limited','registered','c@example.com');`);
  assert.equal((await event('limited')).registered_count,2);
  assert.equal((await event('limited')).registration_status,'waitlist');
  assert.equal((await db.query("select status from event_registrations where id='c'")).rows[0].status,'waitlisted');
  await db.exec("update events set registration_status='open' where id='limited'; update event_registrations set email='new@example.com' where id='a';");
  assert.equal((await event('limited')).registration_status,'waitlist');
  assert.equal((await event('limited')).registered_count,2);
  await assert.rejects(db.exec("insert into event_registrations values('duplicate','legacy','registered','old@example.com');"));
  assert.equal((await event('legacy')).registered_count,1,'Failed writes roll back capacity');
  await db.exec("delete from event_registrations where id='a'; update events set registration_status='open' where id='limited'; update event_registrations set status='registered' where id='c';");
  assert.equal((await event('limited')).registered_count,2);
  assert.equal((await event('limited')).registration_status,'waitlist','Waitlist promotion fills last place');
  await db.exec("update events set maximum_registrants=1 where id='legacy';");
  assert.equal((await event('legacy')).registration_status,'waitlist','Lowering the maximum reconciles status');
  await db.exec("insert into events(id,registration_status) values('closed','closed');");
  await assert.rejects(db.exec("insert into event_registrations values('d','closed','registered','d@example.com');"),/Event registration is closed/);
  assert.equal((await event('closed')).registered_count,0);
  await assert.rejects(db.exec("update events set minimum_registrants=3 where id='limited';"));
  await db.exec("delete from events where id='limited';");
  assert.equal((await db.query("select count(*)::int as n from event_registrations where event_id='limited'")).rows[0].n,0);
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.events'::regclass")).rows[0].relrowsecurity,true);
  console.log('Event capacity passed: validation, legacy defaults, admission limits, automatic waitlist, promotions, rollback, deletion, closed events and RLS.');
 } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
