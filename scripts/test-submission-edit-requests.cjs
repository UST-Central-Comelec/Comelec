/* eslint-disable @typescript-eslint/no-require-imports -- Verify edit requests for every currently trackable submission. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, dependencies = {}, cache = new Map()) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (name in dependencies) return dependencies[name];
    if (name.startsWith('@/')) { const target = `src/${name.slice(2)}.ts`; return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    if (name.startsWith('.')) { const target = path.resolve(path.dirname(file), `${name}.ts`); return load(fs.existsSync(target) ? target : `${target}x`, dependencies, cache); }
    return require(name);
  }, compiled, compiled.exports);
  cache.set(file, compiled.exports);
  return compiled.exports;
}

const { PGlite } = require('@electric-sql/pglite');
const applicationId='11111111-1111-4111-8111-111111111111',accessId='22222222-2222-4222-8222-222222222222';
let existing=null,limited=false,fail=false,collision=false,user={email:'officer@ust.edu.ph',affiliation:'local',college:'Arts',readOnly:false};
let application={id:applicationId,college:'Arts'},access={id:accessId,affiliation:'local',college:'Arts',status:'approved'};
let request={id:'edit',application_id:applicationId,access_request_id:null,status:'pending'};
const writes=[],refreshes=[],lookups=[];
const client={from(table){return {
 insert(row){writes.push({table,row});return {select:()=>({single:async()=>{if(collision)existing={id:'concurrent',...row};return {data:{id:'new',...row},error:fail?{}:collision?{code:'23505'}:null}}})}},
 select(){const filters={};const query={eq(key,value){filters[key]=value;return query},gte(key,value){filters[key]=value;return query},ilike(key,value){filters[key]=value;return query},async maybeSingle(){lookups.push({table,filters});return {data:table==='applications'?(filters.reference_code==='CC-7K3M-9QXA'&&(filters.student_number==='2026123456'||filters.last_name==='DELA CRUZ')?{id:applicationId}:null):request,error:fail?{}:null}}};return query},
 update(row){const filters={};const query={eq(key,value){filters[key]=value;return query},async select(){writes.push({table,row,filters});return {data:[{id:'edit'}],error:fail?{}:null}}};return query},
}}};
const deps={
 'server-only':{},'next/headers':{headers:async()=>new Headers()},'next/cache':{revalidatePath:path=>refreshes.push(path)},'next/navigation':{unstable_rethrow:()=>{}},
 '@/lib/auth/session':{requireEditor:async()=>{if(user.readOnly)throw Error('Read only');return user},canSeeCollege:(manager,college)=>manager.affiliation!=='local'||manager.college===college},
 '@/lib/supabase/config':{isSupabaseConfigured:()=>true},'@/lib/supabase/server':{createAdminClient:()=>client},
 '@/lib/security/rate-limit':{clientIp:()=> 'local',limits:{track:{limit:10,windowMs:1000}},rateLimit:()=>({ok:!limited})},
 '@/lib/access-requests/admin':{findAccessRequest:async(code,identity,numeric)=>code==='PA-7K3M-9QXA'&&(numeric?identity==='2026123456':identity==='DELA CRUZ')?access:null,getAccessRequest:async()=>access},
 './registrations':{findRegistrationByReference:async()=>null},'./rsvp-store':{findRsvpByReference:async()=>null},'./queries':{getEvent:async()=>null},
 './edit-requests':{pendingEventEditRequest:async()=>null},
};
const store=load('src/lib/applications/edit-requests.ts',deps);
const publicActions=load('src/lib/events/edit-request-actions.ts',{...deps,'@/lib/applications/edit-requests':{...store,pendingSubmissionEditRequest:async()=>existing}});
const officer=load('src/lib/applications/edit-request-actions.ts',{...deps,'./admin':{getApplication:async()=>application},'./edit-requests':store,'@/lib/portal/account-scope':{canDecideRequest:(manager,target)=>manager.affiliation==='central'||(target.affiliation==='local'&&target.college===manager.college)}});
function form(prefix,identity='DELA CRUZ',changes='Please correct my program.') {const data=new FormData();data.set('reference',prefix+'-7K3M-9QXA');data.set('identity',identity);data.set('changes',changes);data.set('application_id','forged');return data}
(async()=>{
 for(const prefix of ['CC','PA'])for(const identity of ['DELA CRUZ','2026123456','2026 123456']) {
 const result=await publicActions.requestResponseEdit({},form(prefix,identity));assert.equal(result.request.id,'new');
 assert.deepEqual(writes.at(-1).row,{application_id:prefix==='CC'?applicationId:null,access_request_id:prefix==='PA'?accessId:null,requested_changes:'Please correct my program.'});
 }
 for(const prefix of ['CC','PA']) {
 const data=form(prefix);data.delete('changes');
 const result=await publicActions.requestResponseEdit({},data);
 assert.equal(result.request.id,'new','An edit request needs no description');
 assert.equal(writes.at(-1).row.requested_changes,'Requesting permission to edit this submission.');
 }
 assert.ok(lookups.some(lookup=>lookup.table==='applications'&&'created_at'in lookup.filters),'Application identity matching enforces retention');
 const count=writes.length;
 for(const prefix of ['CC','PA']) {
 assert.ok((await publicActions.requestResponseEdit({},form(prefix,'OTHER'))).error);
 assert.ok((await publicActions.requestResponseEdit({},form(prefix,'2026'))).error);
 assert.ok((await publicActions.requestResponseEdit({},form(prefix,'DELA_CRUZ'))).error);
 assert.ok((await publicActions.requestResponseEdit({},form(prefix,'DELA CRUZ',' '))).fieldErrors.changes);
 }
 limited=true;assert.ok((await publicActions.requestResponseEdit({},form('CC'))).error);limited=false;
 assert.equal(writes.length,count,'Wrong identities, validation errors and rate limits never write');
 existing={id:'existing',requested_changes:'Original request'};assert.equal((await publicActions.requestResponseEdit({},form('PA'))).request.id,'existing');assert.equal(writes.length,count);existing=null;
 collision=true;assert.equal((await publicActions.requestResponseEdit({},form('CC'))).request.id,'concurrent');collision=false;existing=null;
 fail=true;assert.ok((await publicActions.requestResponseEdit({},form('PA'))).error);fail=false;
 assert.ok(refreshes.includes('/portal/accounts'));assert.ok(refreshes.includes('/portal/recruitment/applications'));
 const before=writes.length;user.college='Science';assert.ok((await officer.addressSubmissionEdit('application','edit')).error);
 request={id:'edit',application_id:null,access_request_id:accessId,status:'pending'};assert.ok((await officer.addressSubmissionEdit('access','edit')).error);
 user.college='Arts';assert.ok((await officer.addressSubmissionEdit('application','edit')).error,'Wrong submission kind cannot resolve another type');
 user.readOnly=true;await assert.rejects(officer.addressSubmissionEdit('access','edit'),/Read only/);user.readOnly=false;
 assert.equal(writes.length,before,'Unauthorized reviewers cannot update requests');
 assert.equal((await officer.addressSubmissionEdit('access','edit')).saved,true,'Decided access requests remain reviewable');
 assert.deepEqual(writes.at(-1).filters,{id:'edit',access_request_id:accessId,status:'pending'});
 request={id:'edit',application_id:applicationId,access_request_id:null,status:'pending'};assert.equal((await officer.addressSubmissionEdit('application','edit')).saved,true);
 fail=true;assert.ok((await officer.addressSubmissionEdit('application','edit')).error);fail=false;
 const db=new PGlite();try{
 await db.exec(`create role authenticated;create table applications(id uuid primary key);create table access_requests(id uuid primary key);insert into applications values('${applicationId}');insert into access_requests values('${accessId}');`);
 const migration=fs.readFileSync('supabase/migrations/0080_submission_edit_requests.sql','utf8');await db.exec(migration);await db.exec(migration);
 for(const [column,id]of [['application_id',applicationId],['access_request_id',accessId]]){
 const insert=`insert into submission_edit_requests(${column},requested_changes) values('${id}','Please correct my program')`;await db.exec(insert);await assert.rejects(db.exec(insert),/unique constraint/);
 await db.exec(`update submission_edit_requests set status='addressed' where ${column}='${id}';`);await db.exec(insert);
 }
 await assert.rejects(db.exec("insert into submission_edit_requests(requested_changes)values('Change')"),/check constraint/);
 await assert.rejects(db.exec(`insert into submission_edit_requests(application_id,access_request_id,requested_changes)values('${applicationId}','${accessId}','Change')`),/check constraint/);
 await db.exec('grant select on submission_edit_requests to authenticated;set role authenticated;');assert.equal((await db.query('select * from submission_edit_requests')).rows.length,0);await db.exec('reset role;');
 await db.exec('delete from applications;delete from access_requests;');assert.equal((await db.query('select * from submission_edit_requests')).rows.length,0);
 }finally{await db.close()}
 console.log('All-submission edit checks passed: application/access identities by surname or student number, retention, validation, private targets, duplicate/concurrent requests, reviewer permissions, decided access requests, errors, migration idempotence, RLS and cascade cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1});
