import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { analyzeEmail, extractApplicationIdentity } from '../lib/email-scanner/scanner.ts';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const users=[],clients=[],checks=[];
const must=({data,error})=>{if(error)throw error;return data;};
const check=(name,truth)=>{assert.ok(truth,name);checks.push({name,passed:true});console.log('PASS '+name);};
const date=(hours)=>new Date(Date.now()-hours*3600000).toISOString();
const mail=(company,role,status,receivedAt)=>({source_key:randomUUID(),thread_key:randomUUID(),subject:`Application update: ${role} at ${company}`,sender:`Recruiting <careers@example.invalid>`,received_at:receivedAt,proposed_status:status,evidence:status==='applied'?'Thank you for applying.':'We invite you to interview.',extracted_company:company,extracted_role:role,action_date_text:'',confidence:'review',suggested_application_id:null,identity_complete:true});
async function save(user,rows){const lease=must(await admin.rpc('claim_email_scan',{p_user_id:user.id}));assert.ok(lease);must(await admin.rpc('save_gmail_updates',{p_user_id:user.id,p_lease:lease,p_updates:rows,p_next_page:null,p_query:'synthetic fixture only',p_days:30}));}
try{
 for(let i=0;i<2;i++){
  const email=`careerup-privacy-auto-${randomUUID()}@example.invalid`,password='Aa!'+randomUUID()+'2';
  const {user}=must(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Gmail Automation Fixture',privacy_prompt_answered:true,privacy_test_fixture:true,gmail_automation_fixture:true}}));users.push(user);
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});must(await client.auth.signInWithPassword({email,password}));clients.push(client);
  must(await admin.from('email_connections').insert({user_id:user.id,email,refresh_token_encrypted:'NOT_A_REAL_GOOGLE_CREDENTIAL',granted_scope:'gmail.readonly',consented_at:date(1)}));
 }
 const [a,b]=users,[ca,cb]=clients;
 const before=must(await admin.from('reward_wallets').select('balance').eq('user_id',a.id).single());
 const receipt=mail('ExampleCo','AI Engineer','applied',date(72)), interview=mail('ExampleCo Inc.','Artificial Intelligence Engineer','interviewing',date(48));
 await save(a,[interview,receipt]);
 let result=must(await ca.rpc('apply_gmail_board_updates'));
 check('Automation off by default',result.added===0&&must(await ca.from('applications').select('id')).length===0);
 must(await admin.from('email_connections').update({auto_sync_enabled:true,auto_sync_consented_at:date(1),last_scan_attempt_at:null}).eq('user_id',a.id));
 result=must(await ca.rpc('apply_gmail_board_updates'));
 check('Receipt automatically creates a card',result.added===1);
 check('Later interview automatically updates same card',result.updated===1);
 let apps=must(await ca.from('applications').select('*'));
 check('Company suffix and AI wording aliases avoid duplicates',apps.length===1&&apps[0].status==='interviewing');
 check('New imports have no fabricated fit or location',apps[0].fit_score===0&&apps[0].location===null);
 check('Email evidence is not copied into board notes',!apps[0].notes);
 let records=must(await ca.from('email_updates').select('*'));
 check('Changes keep automatic audit records',records.length===2&&records.every(r=>r.decision==='confirmed'&&r.automatically_applied));
 check('Imported state uses the email timeline',Date.parse(apps[0].email_status_received_at)===Date.parse(interview.received_at));
 const twice=must(await ca.rpc('apply_gmail_board_updates'));check('Repeating sync creates no duplicate or extra update',twice.added===0&&twice.updated===0);
 const after=must(await admin.from('reward_wallets').select('balance').eq('user_id',a.id).single());check('Automatic imports award no Reward Points',before.balance===after.balance);
 check('Other account cannot view imported cards',must(await cb.from('applications').select('id').eq('user_id',a.id)).length===0);
 check('Other account cannot apply owner emails',must(await cb.rpc('apply_gmail_board_updates')).added===0);
 const mixed=[mail('ExampleCo','AI Engineer','applied',date(24)),{...mail('ExampleCo','Unknown','offer',date(23)),identity_complete:false},mail('ExampleCo','AI Engineer','offer',date(100))];
 must(await admin.from('email_updates').insert(mixed.map(x=>({...x,user_id:a.id,source:'gmail'}))));
 result=must(await ca.rpc('apply_gmail_board_updates'));
 check('Late receipt cannot regress an interview',result.review===3&&must(await ca.from('applications').select('status').eq('id',apps[0].id).single()).status==='interviewing');
 check('Unclear identity and old offer remain in review',must(await ca.from('email_updates').select('id').eq('decision','pending')).length===3);
 const [manual]=must(await ca.from('applications').insert({user_id:a.id,company:'ManualCo',role:'Data Analyst',status:'saved'}).select('*'));
 const old=mail('ManualCo','Data Analyst','interviewing',date(1));old.suggested_application_id=manual.id;old.confidence='high';
 must(await admin.from('email_updates').insert({...old,user_id:a.id,source:'gmail'}));result=must(await ca.rpc('apply_gmail_board_updates'));
 check('A newer manually created card is protected from older email',result.review===1&&must(await ca.from('applications').select('status').eq('id',manual.id).single()).status==='saved');
 const term=mail('TerminalCo','Analyst','rejected',date(2));must(await admin.from('email_updates').insert({...term,user_id:a.id,source:'gmail'}));check('Clear untracked rejection can create a tracked card',must(await ca.rpc('apply_gmail_board_updates')).added===1);
 const offer=mail('TerminalCo','Analyst','offer',date(1));must(await admin.from('email_updates').insert({...offer,user_id:a.id,source:'gmail'}));check('Conflicting final outcome stays for review',must(await ca.rpc('apply_gmail_board_updates')).review===1);
 must(await ca.from('applications').insert([{user_id:a.id,company:'CycleCo',role:'Analyst',status:'applied',application_year:2026},{user_id:a.id,company:'CycleCo',role:'Analyst',status:'applied',application_year:2027}]));
 const cycle=mail('CycleCo','Analyst','interviewing',new Date().toISOString());must(await admin.from('email_updates').insert({...cycle,user_id:a.id,source:'gmail'}));check('Multiple recruiting cycles require manual selection',must(await ca.rpc('apply_gmail_board_updates')).review===1);
 must(await admin.from('email_connections').update({auto_sync_enabled:false}).eq('user_id',a.id));const paused=mail('PausedCo','Engineer','applied',date(1));must(await admin.from('email_updates').insert({...paused,user_id:a.id,source:'gmail'}));check('Disabling automation stops further imports',must(await ca.rpc('apply_gmail_board_updates')).added===0);
 const anon=createClient(url,key,{auth:{persistSession:false}});check('Anonymous automation RPC denied',!!(await anon.rpc('apply_gmail_board_updates')).error);
 const input={subject:'Application received: AI Engineer at ExampleCo',sender:'jobs@example.invalid',body:'Thank you for applying to ExampleCo for the AI Engineer position.',receivedAt:date(1)};
 const classified=analyzeEmail(input,[]);check('Parser extracts explicit company and role for new cards',classified.identityComplete&&classified.company==='ExampleCo'&&classified.role==='AI Engineer');
 check('Company-only receipt does not invent a job title',!extractApplicationIdentity({...input,subject:'Application received',body:'Thank you for applying to ExampleCo.'}));
 check('Generic newsletter does not become an application',analyzeEmail({...input,subject:'Jobs for you',body:'Apply for the AI Engineer position at ExampleCo today.'},[]).status===null);
 const staleToken=(await ca.auth.getSession()).data.session.access_token;await ca.auth.signOut({scope:'local'});const stale=createClient(url,key,{global:{headers:{Authorization:'Bearer '+staleToken}},auth:{persistSession:false}});check('Revoked sessions cannot run automation',!!(await stale.rpc('apply_gmail_board_updates')).error);
}finally{
 for(let i=0;i<users.length;i++){
  await clients[i]?.auth.signOut({scope:'local'});
  const {data}=await admin.auth.admin.getUserById(users[i].id);
  if(data.user?.user_metadata.gmail_automation_fixture&&/^careerup-privacy-auto-.*@example\.invalid$/.test(data.user.email))must(await admin.auth.admin.deleteUser(users[i].id));
 }
 if(process.env.GMAIL_AUTOMATION_RESULTS)writeFileSync(process.env.GMAIL_AUTOMATION_RESULTS,JSON.stringify({recordedAt:new Date().toISOString(),checks,total:checks.length},null,2));
}
console.log(`${checks.length} Gmail automation checks passed. Synthetic messages; no real mailbox was scanned.`);
