// Synthetic Gmail batch → actual HTTP sync endpoint → application board HTML.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {currentRecruitingCycle} from '../lib/email-scanner/window.ts';
const base=process.env.GMAIL_BOARD_TEST_BASE_URL||'http://localhost:3217';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=({data,error})=>{if(error)throw error;return data;};
const checks=[];function check(name,value){assert.ok(value,name);checks.push({name,passed:true});console.log('PASS '+name);}
let user,client;
try{
 const email=`careerup-privacy-auto-${randomUUID()}@example.invalid`,password='Aa!'+randomUUID()+'2';
 user=must(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Gmail HTTP Fixture',privacy_prompt_answered:true,privacy_test_fixture:true,gmail_automation_fixture:true}})).user;
 const cookies=new Map();client=createServerClient(url,key,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:vs=>vs.forEach(({name,value})=>cookies.set(name,value))}});must(await client.auth.signInWithPassword({email,password}));
 const cookie=()=>[...cookies].map(([n,v])=>`${n}=${v}`).join('; ');
 async function post(body,origin=base,authenticated=true){return fetch(base+'/api/email-scanner',{method:'POST',headers:{origin,'content-type':'application/json',...(authenticated?{cookie:cookie()}: {})},body:JSON.stringify(body)});}
 must(await admin.from('email_connections').insert({user_id:user.id,email,refresh_token_encrypted:'SYNTHETIC_NOT_A_GOOGLE_TOKEN',granted_scope:'gmail.readonly',consented_at:new Date().toISOString()}));
 check('Unauthenticated sync rejected',(await post({action:'auto-sync'},base,false)).status===401);
 check('Cross-origin sync rejected',(await post({action:'auto-sync'},'https://example.invalid')).status===403);
 check('Automatic permission is required',(await post({action:'automation',enabled:true,consent:false})).status===400);
 check('Disabled sync rejected',(await post({action:'auto-sync'})).status===409);
 check('Explicit consent enables sync',(await post({action:'automation',enabled:true,consent:true})).status===200);
 const settings=must(await admin.from('email_connections').select('auto_sync_enabled,auto_sync_consented_at').eq('user_id',user.id).single());check('Permission and timestamp stored',settings.auto_sync_enabled&&settings.auto_sync_consented_at);
 const lease=must(await admin.rpc('claim_email_scan',{p_user_id:user.id}));
 const cycle=currentRecruitingCycle();
 must(await admin.rpc('save_gmail_cycle_batch',{p_user_id:user.id,p_lease:lease,p_query:'Synthetic test only',p_next_page:null,p_days:30,p_mode:'cycle',p_start_date:cycle.startDate,p_end_date:cycle.endDate,p_cycle_year:cycle.cycleYear,p_parser_version:3,p_checked:1,p_restart:true,p_updates:[{source_key:randomUUID(),thread_key:randomUUID(),subject:'Application received: AI Engineer at SyntheticCo',sender:'careers@example.invalid',received_at:new Date(Date.now()-3600000).toISOString(),proposed_status:'applied',evidence:'Thank you for applying.',extracted_company:'SyntheticCo',extracted_role:'AI Engineer',action_date_text:'',confidence:'review',suggested_application_id:null,identity_complete:true,parser_version:3}]}));
 const sync=await post({action:'auto-sync'});const result=await sync.json();check('HTTP sync creates a board card',sync.status===200&&result.added===1);
 const board=await fetch(base+'/applications?year=all',{headers:{cookie:cookie()}});const html=await board.text();check('Real board page displays imported application',board.status===200&&html.includes('SyntheticCo')&&html.includes('AI Engineer'));
 check('Board carries imported source and unknown location',html.includes('Imported from Gmail')&&html.includes('Location not provided'));
 const state=await fetch(base+'/api/email-scanner?view=board',{headers:{cookie:cookie()}});const view=await state.json();check('Board sync status excludes mailbox credentials',state.status===200&&view.enabled===true&&!JSON.stringify(view).includes('SYNTHETIC_NOT_A_GOOGLE_TOKEN'));
 check('Saved cycle dates and cumulative progress reach the browser',view.mode==='cycle'&&view.startDate===cycle.startDate&&view.checked===1);
 check('Repeated HTTP sync does not duplicate cards',(await(await post({action:'auto-sync'})).json()).added===0);
 const pending=must(await admin.from('email_updates').insert({user_id:user.id,source:'gmail',source_key:randomUUID(),thread_key:randomUUID(),subject:'Synthetic review email',sender:'careers@example.invalid',received_at:new Date(Date.now()-3600000).toISOString(),proposed_status:'applied',evidence:'Thank you for applying.',extracted_company:'',extracted_role:'',confidence:'review',identity_complete:false,parser_version:3,recruiting_cycle_year:cycle.cycleYear}).select('id').single());
 const create={action:'create',updateId:pending.id,company:'ReviewedCo',role:'Data Analyst',cycleYear:cycle.cycleYear};
 check('HTTP review creates a missing application card',(await post(create)).status===200);
 const reviewedBoard=await fetch(base+'/applications?year=all',{headers:{cookie:cookie()}});
 check('Created review card appears on the real board',(await reviewedBoard.text()).includes('ReviewedCo'));
 check('Repeated review request cannot create duplicates',(await post(create)).status===409);
 check('User can disable automatic sync',(await post({action:'automation',enabled:false})).status===200);
 check('Disabled sync stops HTTP writes',(await post({action:'auto-sync'})).status===409);
}finally{
 if(client)await client.auth.signOut({scope:'local'});
 if(user){const {data}=await admin.auth.admin.getUserById(user.id);if(data.user?.user_metadata.gmail_automation_fixture&&/^careerup-privacy-auto-.*@example\.invalid$/.test(data.user.email))must(await admin.auth.admin.deleteUser(user.id));}
 if(process.env.GMAIL_BOARD_TEST_RESULTS)writeFileSync(process.env.GMAIL_BOARD_TEST_RESULTS,JSON.stringify({base,recordedAt:new Date().toISOString(),checks,total:checks.length},null,2));
}
console.log(`${checks.length} HTTP board checks passed. Synthetic saved mail only; no Google mailbox request made.`);
