/* eslint-disable @typescript-eslint/no-require-imports -- Verify RSVP review steps, guarded edits, receipts and scoped removal. */
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

const { PGlite }=require('@electric-sql/pglite');
const rsvp=load('src/lib/events/rsvp.ts'),review=load('src/lib/events/rsvp-review.ts'),editor=load('src/lib/events/form-editor.ts'),flow=load('src/lib/events/form-flow.ts');
const id='11111111-1111-4111-8111-111111111111';
const initial={rsvp_consent:'yes',rsvp_consent_share:'yes',rsvp_last_name:'CRUZ',rsvp_first_name:'ANA',rsvp_middle_name:'MARIA',rsvp_email:'ana@example.com',rsvp_affiliation:'External',rsvp_external_type:'Invited Guest (Delegates)',rsvp_attendance:'Confirmed Attendance',rsvp_delegation:'No',rsvp_accurate:'yes',rsvp_authorized:'yes'};
let record={id,reference_code:'RS-7K3M-9QXA',answers:{version:2,definition:rsvp.defaultRsvpDefinition,values:editor.keptAnswers(rsvp.defaultRsvpDefinition,initial)},created_at:'2026-10-13T00:00:00Z',updated_at:'2026-10-13T00:00:01Z'};
const modernRequests=review.rsvpLogisticalRequests({rsvp_logistics:['I would like to request for a car parking reservation','I have dietary restrictions'],rsvp_car_plate:'ABC1234',rsvp_car_model:'Sedan',rsvp_car_color:'Silver',rsvp_arrival:'8:30 AM',rsvp_allergens:'Peanuts'});
assert.deepEqual(modernRequests.map(request=>request.kind),['parking','dietary']);
assert.ok(modernRequests[0].facts.some(([label,value])=>label==='Plate'&&value==='ABC1234'));
assert.deepEqual(modernRequests[1].facts,[['Allergens','Peanuts']]);
assert.deepEqual(review.rsvpLogisticalRequests({'logisticalNeeds.requests':['Car parking','Dietary restrictions'],'logisticalNeeds.parkingPlate':'ABC1234','logisticalNeeds.parkingModel':'Sedan','logisticalNeeds.parkingColor':'Silver','logisticalNeeds.parkingArrival':'8:30 AM','logisticalNeeds.dietaryAllergens':'Peanuts'}),modernRequests);
assert.deepEqual(review.rsvpLogisticalRequests({rsvp_logistics:[]}),[]);
assert.equal(review.rsvpLogisticalRequests({rsvp_logistics:['dietary'],rsvp_car_plate:'STALE'})[0].facts.length,1,'Unselected parking details do not leak into another request');
let user={readOnly:false,affiliation:'local',college:'Arts'},event={id:'event',organizer:'local',college:'Arts',name:'Leadership forum'},race=false,duplicate=false,delivery='sent';
const mutations=[],emails=[];
const client={from(table){const query={filters:{},operation:'read',row:null,select(){return query},eq(key,value){query.filters[key]=value;return query},update(row){query.operation='update';query.row=row;return query},delete(){query.operation='delete';return query},async maybeSingle(){if(query.filters.event_id!=='event'||query.filters.id!==id)return {data:null,error:null};if(query.operation==='read')return {data:structuredClone(record),error:null};if(duplicate)return {data:null,error:{code:'23505'}};if(race){record.updated_at='2026-10-13T00:00:09Z';race=false;return {data:null,error:null}};if(query.filters.updated_at!==record.updated_at)return {data:null,error:null};mutations.push({table,filters:query.filters,row:query.row});record={...record,...query.row,updated_at:'2026-10-13T00:00:02Z'};return {data:structuredClone(record),error:null}},then(resolve,reject){if(query.operation==='delete'){const valid=query.filters.event_id==='event'&&query.filters.id===id&&query.filters.updated_at===record.updated_at;if(valid)mutations.push({table,filters:query.filters,operation:'delete'});return Promise.resolve({data:valid?[{id}]:[],error:null}).then(resolve,reject)}return query.maybeSingle().then(resolve,reject)}};return query}};
const actions=load('src/lib/events/rsvp-response-actions.ts',{
 'server-only':{},'next/cache':{revalidatePath:()=>{}},'next/navigation':{unstable_rethrow:()=>{}},'@/lib/auth/session':{requireEditor:async()=>user},'@/lib/supabase/server':{createAdminClient:()=>client},'./queries':{getEvent:async()=>event},
 '@/lib/forms/email-domain':{emailDomainProblem:async email=>email.endsWith('@bad.test')?'That domain can’t receive email.':null},
 '@/lib/notifications/notify':{sendAutomatic:async(key,build)=>{assert.ok(['event-rsvp','event-request'].includes(key));emails.push(build());return delivery}},
 './emails':{requestDecisionsEmail:(person,event,answered,waiting)=>({to:person.email,answered,waiting})},
 './rsvp-emails':{acknowledgementEmail:(to,ack,event,name,eyebrow,reference,answers)=>({to,reference,answers})},
});
(async()=>{
 const model=review.rsvpReviewModel(record.answers);const steps=flow.resolveFlow(model.definition,model.values).steps.filter(review.isRsvpReviewStep);
 const grouped = review.rsvpReviewSteps(steps);
 assert.equal(grouped[0].title, 'Profile & Attendance');
 const expectedProfile = steps.filter(step => ['rsvp_profile', 'rsvp_attendance'].includes(step.id)).flatMap(step => step.fields.map(field => field.id));
 assert.deepEqual(grouped[0].fields.map(field => field.id), expectedProfile, 'Merged profile and attendance preserve all original questions in order');
 assert.deepEqual(grouped.flatMap(step => step.fields.map(field => field.id)), steps.flatMap(step => step.fields.map(field => field.id)), 'Grouping preserves every visible question exactly once');
 const allGrouped = review.rsvpReviewSteps(rsvp.defaultRsvpDefinition.steps);
 const detailGroups = review.rsvpProfileGroups(allGrouped[0].fields);
 assert.deepEqual(detailGroups.map(group => [group.number, group.title]), [['01', 'Profile'], ['02', 'Affiliation'], ['03', 'Participation']]);
 assert.ok(detailGroups[0].fields.some(field => field.id === 'rsvp_last_name'));
 assert.ok(detailGroups[1].fields.some(field => field.id === 'rsvp_affiliation'));
 assert.ok(detailGroups[2].fields.some(field => field.id === 'rsvp_attendance'));
 assert.ok(detailGroups[2].fields.some(field => field.id === 'rsvp_proxy_email'), 'Proxy answers stay with participation');
 assert.deepEqual(detailGroups.flatMap(group => group.fields.map(field => field.id)).sort(), allGrouped[0].fields.map(field => field.id).sort(), 'Detail grouping keeps every field exactly once');
 assert.equal(allGrouped.find(step => step.id === 'rsvp_committees').title, 'Committee Assignment');
 assert.equal(allGrouped.find(step => step.fields.some(field => field.id === 'rsvp_resources')).title, 'Logistical Support');
 assert.ok(steps.some(step=>step.title==='Profile and affiliation'));assert.ok(!steps.some(step=>['Data Privacy Consent','Conforme','Acknowledgement','Receipt'].includes(step.title)));
 user.college='Science';assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,initial)).error);assert.ok((await actions.removeRsvpResponse('event',id,record.updated_at)).error);assert.ok((await actions.resendRsvpAcknowledgement('event',id)).error);
 user.college='Arts';user.readOnly=true;assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,initial)).error);user.readOnly=false;
 assert.equal(mutations.length,0);assert.equal(emails.length,0);
 assert.ok((await actions.updateRsvpResponse('other',id,record.updated_at,initial)).error,'Wrong event cannot load the response');
 assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,{...initial,rsvp_last_name:"D’CRUZ"})).error,'Names with symbols are refused');
 assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,{...initial,rsvp_email:'ana@bad.test'})).error,'Domains must take mail');
 assert.ok((await actions.updateRsvpResponse('event',id,'stale',initial)).conflict);assert.equal(mutations.length,0);
 duplicate=true;assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,initial)).error);duplicate=false;assert.equal(emails.length,0);
 const saved=await actions.updateRsvpResponse('event',id,record.updated_at,{...initial,rsvp_last_name:'MALACAÑANG',rsvp_consent:'',rsvp_accurate:''});
 assert.ok(saved.saved, JSON.stringify(saved));assert.equal(saved.saved.answers.values.rsvp_last_name,'MALACAÑANG');assert.equal(saved.saved.answers.values.rsvp_consent,'yes');assert.equal(saved.saved.answers.values.rsvp_accurate,'yes','Consent and Conforme cannot be changed');
 assert.equal(emails.at(-1).reference,'RS-7K3M-9QXA');assert.ok(emails.at(-1).answers.some(([label,value])=>label==='Last name'&&value==='MALACAÑANG'));
 assert.equal(mutations.at(-1).filters.id,id);assert.equal(mutations.at(-1).filters.event_id,'event');assert.ok(mutations.at(-1).filters.updated_at);
 assert.equal((await actions.resendRsvpAcknowledgement('event',id)).sent,true);
 delivery='failed';assert.equal((await actions.resendRsvpAcknowledgement('event',id)).sent,false);
 const warning=await actions.updateRsvpResponse('event',id,record.updated_at,{...initial,rsvp_first_name:'JUAN'});assert.ok(warning.saved);assert.equal(warning.sent,false,'A failed email never reports a saved response as failed');delivery='sent';
 const count=mutations.length;race=true;assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,initial)).conflict);assert.equal(mutations.length,count,'A write racing the save does not overwrite another officer');
 assert.ok((await actions.removeRsvpResponse('event',id,'stale')).conflict);assert.equal((await actions.removeRsvpResponse('event',id,record.updated_at)).removed,true);assert.equal(mutations.at(-1).table,'event_rsvp_responses','Remove targets RSVPs, not public registrations');
 const legacy={profile:{firstName:'ANA',middleName:'MARIA',lastName:'CRUZ',email:'ana@example.com',studentNumber:''},affiliation:'external',affiliationKind:'invited-guest',organization:'',college:'',school:'',role:'guest',attendance:'confirmed',delegation:'no',additionalParticipants:'',committees:[],resources:[],resourceOther:'',accurate:true,authorized:true};
 record={...record,answers:legacy};const legacyModel=review.rsvpReviewModel(legacy);const legacySteps=review.rsvpReviewSteps(legacyModel.definition.steps);assert.equal(legacySteps[0].title,'Profile & Attendance');assert.ok(legacySteps[0].fields.some(field=>field.id==='attendance'));assert.ok(legacySteps[0].fields.some(field=>field.id==='affiliation'));assert.equal(legacySteps.find(step=>step.id==='committees').title,'Committee Assignment');assert.equal(legacySteps.find(step=>step.id==='resources').title,'Logistical Support');const legacyValues={...legacyModel.values,'profile.firstName':'JUAN','attendance':'Confirmed Attendance'};
 assert.ok((await actions.updateRsvpResponse('event',id,record.updated_at,{...legacyValues,'profile.lastName':'CRUZ-REYES'})).error,'Legacy names are also refused, not silently stripped');
 const oldSaved=await actions.updateRsvpResponse('event',id,record.updated_at,legacyValues);assert.ok(oldSaved.saved);assert.equal(oldSaved.saved.answers.profile.firstName,'JUAN');assert.equal(oldSaved.saved.answers.accurate,true);assert.deepEqual(oldSaved.saved.answers.committees,[]);
 const proxy=review.editedRsvpAnswers(legacy,{...legacyValues,attendance:'Sending a Proxy','proxy.firstName':'MARIA','proxy.lastName':'SANTOS','proxy.email':'maria@example.com'});assert.equal(proxy.attendance,'proxy');assert.equal(proxy.proxy.firstName,'MARIA');
 const requestValues={...initial,rsvp_logistics:['I would like to request for a car parking reservation','I have dietary restrictions'],rsvp_car_plate:'ABC1234',rsvp_car_model:'Sedan',rsvp_car_color:'Silver',rsvp_arrival:'8:30 AM',rsvp_allergens:'Peanuts'};
 record={...record,answers:{version:2,definition:rsvp.defaultRsvpDefinition,values:requestValues},logistics_decisions:{}};
 user.college='Science';assert.ok((await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:true})).error);user.college='Arts';
 assert.ok((await actions.saveRsvpRequestDecisions('other',id,record.updated_at,{parking:true})).error);
 assert.ok((await actions.saveRsvpRequestDecisions('event',id,'stale',{parking:true})).conflict);
 assert.ok((await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{unknown:true})).error);
 assert.ok((await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{certificate:true})).error,'Cannot decide requests not selected');
 assert.ok((await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:'yes'})).error);
 const approved=await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:true});assert.equal(approved.saved.logistics_decisions.parking,'approved');assert.equal(approved.sent,true);assert.equal(emails.at(-1).waiting,1);assert.equal(emails.at(-1).answered[0].approved,true);
 const deliveries=emails.length;await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:true});assert.equal(emails.length,deliveries,'No-op decisions do not send another email');
 const revoked=await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:false});assert.equal(revoked.saved.logistics_decisions.parking,'revoked');assert.equal(emails.at(-1).answered[0].revoked,true);
 const again=await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:false});assert.equal(again.saved.logistics_decisions.parking,'revoked','Revocation survives repeated saves');
 delivery='failed';const declined=await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{dietary:false});assert.equal(declined.saved.logistics_decisions.dietary,'unavailable');assert.equal(declined.sent,false);delivery='sent';
 const writes=mutations.length;race=true;assert.ok((await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:true})).conflict);assert.equal(mutations.length,writes);
 await actions.saveRsvpRequestDecisions('event',id,record.updated_at,{parking:true});
 const kept=await actions.updateRsvpResponse('event',id,record.updated_at,{...requestValues,rsvp_first_name:'JUAN'});assert.equal(kept.saved.logistics_decisions.parking,'approved','Unrelated answer edits keep approval');
 const reset=await actions.updateRsvpResponse('event',id,record.updated_at,{...requestValues,rsvp_car_plate:'NEW1234'});assert.equal(reset.saved.logistics_decisions.parking,'pending','Changed request details require another decision');
 const removedRequest=await actions.updateRsvpResponse('event',id,record.updated_at,{...requestValues,rsvp_logistics:['I have dietary restrictions']});assert.equal(removedRequest.saved.logistics_decisions.parking,undefined,'Removed requests cannot retain approvals');
 const db=new PGlite();try{
 await db.exec(`create table event_rsvp_responses(id uuid primary key,answers jsonb not null);insert into event_rsvp_responses values('${id}','{}');`);
 const sql=fs.readFileSync('supabase/migrations/0081_rsvp_response_edit_guard.sql','utf8');await db.exec(sql);await db.exec(sql);const decisionsSql=fs.readFileSync('supabase/migrations/0082_rsvp_logistics_decisions.sql','utf8');await db.exec(decisionsSql);await db.exec(decisionsSql);await db.exec("update event_rsvp_responses set logistics_decisions='{\"parking\":\"approved\"}';");assert.equal((await db.query('select logistics_decisions from event_rsvp_responses')).rows[0].logistics_decisions.parking,'approved');
 const first=(await db.query('select updated_at::text as stamp from event_rsvp_responses')).rows[0].stamp;
 await db.exec("update event_rsvp_responses set answers='{\"name\":\"ANA\"}';");
 const next=(await db.query('select updated_at::text as stamp from event_rsvp_responses')).rows[0].stamp;assert.notEqual(next,first);
 const guarded=await db.query('update event_rsvp_responses set answers=$1 where id=$2 and updated_at=$3 returning id',['{}',id,first]);assert.equal(guarded.rows.length,0,'Database stamp prevents a stale update');
 }finally{await db.close()}
 console.log('RSVP review passed: step exclusions, unit permissions, strict validation, privacy/Conforme preservation, duplicates, save/resend receipts, email warnings, races, RSVP-only deletion, legacy editing and database stamps.');
})().catch(error=>{console.error(error);process.exitCode=1});
