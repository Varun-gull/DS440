import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {currentRecruitingCycle,resolveScanWindow,emailWithinWindow,gmailSearchQuery} from '../lib/email-scanner/window.ts';
import {analyzeEmail} from '../lib/email-scanner/scanner.ts';
const checks=[];
function check(name,ok){assert.ok(ok,name);checks.push({name,passed:true});console.log('PASS '+name);}
const now=new Date('2026-11-18T17:00:00Z'),cycle=resolveScanWindow({}, {}, now);
check('Current cycle starts July 1, not 30 days ago',cycle.startDate==='2026-07-01'&&cycle.endDate==='2026-11-18');
check('January continues the previous July cycle',currentRecruitingCycle(new Date('2027-01-18T17:00:00Z')).startDate==='2026-07-01');
check('July starts a new cycle',currentRecruitingCycle(new Date('2027-07-01T17:00:00Z')).cycleYear===2027);
check('Exact local midnight boundary includes July 1',emailWithinWindow('2026-07-01T04:00:00Z',cycle)&&!emailWithinWindow('2026-07-01T03:59:59Z',cycle));
check('Messages after the requested end date are excluded',!emailWithinWindow('2026-11-19T05:00:00Z',cycle));
check('Custom archived cycle is supported',resolveScanWindow({mode:'custom',startDate:'2025-07-01',endDate:'2026-06-30'}, {}, now).cycleYear===2025);
for(const [name,input] of [['Future dates rejected',{mode:'custom',startDate:'2026-07-01',endDate:'2027-01-01'}],['Invalid calendar dates rejected',{mode:'custom',startDate:'2026-02-30',endDate:'2026-11-18'}],['Reversed dates rejected',{mode:'custom',startDate:'2026-11-18',endDate:'2026-07-01'}],['Unbounded historical scans rejected',{mode:'custom',startDate:'2000-01-01',endDate:'2026-11-18'}]]){let failed=false;try{resolveScanWindow(input,{},now);}catch{failed=true;}check(name,failed);}
check('Recent windows remain compatible',resolveScanWindow({days:90},{},now).mode==='recent');
check('Search excludes sent mail, drafts and job-alert subjects',gmailSearchQuery(cycle).includes('-in:sent -in:drafts -subject:"job matches"'));
const email=(subject,body,sender='Recruiting <jobs@company.invalid>')=>({subject,body,sender,receivedAt:now.toISOString()});
for(const [name,input,company,role,status] of [
 ['Comeet role in subject',email('We Got It: Thanks for applying for Outbound AI Engineer','Thank you for applying for a position at NimbleWay. We received your information.'),'NimbleWay','Outbound AI Engineer','applied'],
 ['DoorDash role-at-employer template',email('DoorDash Application Update',"Thank you for your interest in the Software Engineer I, Entry-Level (Graduation Date: Fall 2026-Summer 2027) - US role at DoorDash. Our team is carefully evaluating each candidate's skills."),'DoorDash','Software Engineer I, Entry-Level (Graduation Date: Fall 2026-Summer 2027) - US','applied'],
 ['PwC distinguishes role from employer',email('PwC job application: Progress update','Many thanks for applying to Finance Data, Analytics & AI - Associate . We regret to inform you that we will not be proceeding with your application to this role.'),'PwC','Finance Data, Analytics & AI - Associate','rejected'],
 ['HRT explicit employer and internship',email('HRT Application Status','We want to thank you very much for your interest in Hudson River Trading. We have decided not to move forward with your application for our Algorithm Development Internship – 2027 role.'),'Hudson River Trading','Algorithm Development Internship – 2027','rejected'],
 ['Interview selection with following-position title',email("You've been selected for an interview with Deloitte!",'Congratulations! You have been selected to interview for the following position: Consultative Offerings - Government & Public Services - Analyst - AI & Data Engineering.'),'Deloitte','Consultative Offerings - Government & Public Services - Analyst - AI & Data Engineering','interviewing']
]){const r=analyzeEmail(input);check(name,r.identityComplete&&r.company===company&&r.role===role&&r.status===status);}
check('Competing roles are held for review',!analyzeEmail(email('Application received: Developer or Analyst at ExampleCo','Thank you for applying.')).identityComplete);
check('A season alone is not a job title',!analyzeEmail(email('Application received: Winter 2027 at ExampleCo','Thank you for applying.')).identityComplete);
check('Offer congratulations are recognized',analyzeEmail(email('Congratulations on your offer with ExampleCo!','Congratulations on your offer! Please review your offer letter.')).status==='offer');
check('A different explicit role cannot hijack an existing company card',analyzeEmail(email('Application received: Senior Data Analyst at ExampleCo','Thank you for applying.'),[{id:'existing',company:'ExampleCo',role:'Data Analyst',status:'applied',updated_at:'2026-08-01T12:00:00Z'}]).suggestedApplicationId===null);

const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=({data,error})=>{if(error)throw error;return data;},users=[],clients=[];
const row=(role,status,date)=>({source_key:randomUUID(),thread_key:randomUUID(),subject:'Application update',sender:'careers@example.invalid',received_at:date,proposed_status:status,evidence:'Synthetic recruiting message.',extracted_company:'CycleCo',extracted_role:role,action_date_text:'',confidence:'review',suggested_application_id:null,identity_complete:true,parser_version:3});
async function save(u,rows,start,end,year,next,restart){
 must(await admin.from('email_connections').update({last_scan_attempt_at:null}).eq('user_id',u.id));
 const lease=must(await admin.rpc('claim_email_scan',{p_user_id:u.id}));
 return admin.rpc('save_gmail_cycle_batch',{p_user_id:u.id,p_lease:lease,p_updates:rows,p_query:'Synthetic cycle fixture only',p_next_page:next,p_days:30,p_mode:'custom',p_start_date:start,p_end_date:end,p_cycle_year:year,p_parser_version:3,p_checked:20,p_restart:restart});
}
try{
 for(let i=0;i<2;i++){
  const email=`careerup-privacy-auto-${randomUUID()}@example.invalid`,password='Aa!'+randomUUID()+'2';
  const u=must(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{privacy_test_fixture:true,gmail_automation_fixture:true,privacy_prompt_answered:true}})).user;users.push(u);
  const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});must(await c.auth.signInWithPassword({email,password}));clients.push(c);
  must(await admin.from('email_connections').insert({user_id:u.id,email,refresh_token_encrypted:'SYNTHETIC_NO_GOOGLE_TOKEN',granted_scope:'gmail.readonly',auto_sync_enabled:true,auto_sync_consented_at:now.toISOString()}));
 }
 const [a,b]=users,[ca,cb]=clients;
 const receipt=row('Engineer','applied','2025-08-20T16:00:00Z');
 must(await save(a,[receipt],'2025-07-01','2026-06-30',2025,'synthetic-page-2',true));
 check('Past email creates a recruiting-cycle card',must(await ca.rpc('apply_gmail_board_updates')).added===1);
 let app=must(await ca.from('applications').select('*').eq('company','CycleCo').single());
 check('Archived cycle uses its July start year',app.application_year===2025);
 const interview=row('Engineer','interviewing','2026-01-20T16:00:00Z');
 must(await save(a,[interview],'2025-07-01','2026-06-30',2025,null,false));
 check('January interview updates the prior-July card',must(await ca.rpc('apply_gmail_board_updates')).updated===1);
 let connection=must(await admin.from('email_connections').select('scan_checked,scan_page_token,scan_completed_at,scan_parser_version').eq('user_id',a.id).single());
 check('Progress accumulates across pages and records completion',connection.scan_checked===40&&!connection.scan_page_token&&connection.scan_completed_at&&connection.scan_parser_version===3);
 const nextYear=row('Engineer','applied','2026-08-20T16:00:00Z');
 must(await save(a,[nextYear],'2026-07-01','2026-11-18',2026,null,true));
 check('Same role in a new cycle creates a separate card',must(await ca.rpc('apply_gmail_board_updates')).added===1&&must(await ca.from('applications').select('id').eq('company','CycleCo')).length===2);
 check('New cycle leaves archived interview unchanged',must(await ca.from('applications').select('status').eq('id',app.id).single()).status==='interviewing');
 const broad=[row('Archived Analyst','applied','2025-08-21T16:00:00Z'),row('Current Analyst','applied','2026-08-21T16:00:00Z')];
 must(await save(a,broad,'2025-07-01','2026-11-18',2025,null,true));must(await ca.rpc('apply_gmail_board_updates'));
 const broadApps=must(await ca.from('applications').select('role,application_year').in('role',['Archived Analyst','Current Analyst']));
 check('Custom ranges spanning July assign each email to its own cycle',broadApps.find(x=>x.role==='Archived Analyst')?.application_year===2025&&broadApps.find(x=>x.role==='Current Analyst')?.application_year===2026);
 const outside=await save(a,[row('Wrong Date','applied','2025-08-20T16:00:00Z')],'2026-07-01','2026-11-18',2026,null,true);
 check('Database rejects email outside the selected date range',!!outside.error);
 must(await admin.from('email_connections').update({scan_lease:null,scan_lease_until:null}).eq('user_id',a.id));
 const unresolved={...row('Unknown','rejected','2026-08-20T16:00:00Z'),identity_complete:false};
 const pending=must(await admin.from('email_updates').insert({...unresolved,user_id:a.id,source:'gmail',recruiting_cycle_year:2026}).select('id').single());
 check('Other account cannot resolve owner review record',!!(await cb.rpc('create_email_application',{p_update_id:pending.id,p_company:'ResolvedCo',p_role:'Data Analyst',p_year:2026})).error);
 const balance=must(await admin.from('reward_wallets').select('balance').eq('user_id',a.id).single()).balance;
 const created=must(await ca.rpc('create_email_application',{p_update_id:pending.id,p_company:'ResolvedCo',p_role:'Data Analyst',p_year:2026}));
 check('Review can create a new application with corrected details',must(await ca.from('applications').select('company,role,status,application_year').eq('id',created).single()).company==='ResolvedCo');
 check('Reviewed import gives no extra Reward Points',must(await admin.from('reward_wallets').select('balance').eq('user_id',a.id).single()).balance===balance);
 check('Repeated review cannot create another card',!!(await ca.rpc('create_email_application',{p_update_id:pending.id,p_company:'ResolvedCo',p_role:'Data Analyst',p_year:2026})).error);
 const duplicate=must(await admin.from('email_updates').insert({...unresolved,source_key:randomUUID(),user_id:a.id,source:'gmail'}).select('id').single());
 check('Manual review cannot duplicate the same company role and cycle',!!(await ca.rpc('create_email_application',{p_update_id:duplicate.id,p_company:'ResolvedCo',p_role:'Data Analyst',p_year:2026})).error);
 check('Cycle batch saving is inaccessible to browser accounts',!!(await ca.rpc('save_gmail_cycle_batch',{})).error);
 check('Other accounts cannot see cycle cards',must(await cb.from('applications').select('id').eq('user_id',a.id)).length===0);
}finally{
 for(let i=0;i<users.length;i++){
  await clients[i]?.auth.signOut({scope:'local'});
  const user=must(await admin.auth.admin.getUserById(users[i].id)).user;
  if(user?.user_metadata.gmail_automation_fixture&&/^careerup-privacy-auto-.*@example\.invalid$/.test(user.email))must(await admin.auth.admin.deleteUser(user.id));
 }
}
console.log(`${checks.length} recruiting-cycle checks passed. Synthetic database accounts were removed.`);
