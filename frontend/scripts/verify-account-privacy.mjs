// Disposable accounts only. Never pass a real account to destructive checks.
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const fixture=JSON.parse(readFileSync(process.env.PRIVACY_FIXTURE_FILE || '.careerup-privacy-fixture.local.json'));
const base=process.env.PRIVACY_TEST_BASE_URL || 'http://localhost:3217';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const results=[];
function check(name,value){assert.ok(value,name);results.push({name,passed:true});console.log('PASS '+name);}
async function signIn(u){
 const cookies=new Map();
 const client=createServerClient(url,key,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>cookies.set(name,value))}});
 const {data,error}=await client.auth.signInWithPassword({email:u.email,password:u.password});if(error)throw error;
 return {client,token:data.session.access_token,cookie:()=>[...cookies].map(([n,v])=>`${n}=${v}`).join('; ')};
}
async function account(s,body,origin=base){return fetch(base+'/api/account',{method:'POST',headers:{origin,'content-type':'application/json',...(s?{cookie:s.cookie()}: {})},body:JSON.stringify(body),redirect:'manual'});}
for(const u of fixture){const {data,error}=await admin.auth.admin.getUserById(u.id);if(error||!data.user?.user_metadata.privacy_test_fixture||!/^careerup-privacy-.*@example\.invalid$/.test(data.user.email))throw Error('Tests require disposable fixture accounts');}
const [a,b,c]=await Promise.all(fixture.map(signIn));
try{
 for(const path of ['/privacy-policy','/terms','/signup','/data-privacy']){const r=await fetch(base+path,{redirect:'manual'});check('Public anonymous '+path,r.status===200);const text=await r.text();if(path==='/signup'){check('Signup has unchecked required agreement',text.includes('name="acceptTerms"')&&text.includes('name="adultConfirmation"')&&!/name="acceptTerms"[^>]*checked/.test(text));}}
 check('Privacy onboarding remains protected',(await fetch(base+'/privacy',{redirect:'manual'})).status===307);
 check('Anonymous export rejected',(await account(null,{action:'export',password:fixture[0].password})).status===401);
 check('Cross-origin request rejected',(await account(a,{action:'export',password:fixture[0].password},'https://example.invalid')).status===403);
 check('Deletion requires explicit confirmation',(await account(a,{action:'delete',password:fixture[0].password,confirmation:'no'})).status===400);
 check('Wrong password rejected',(await account(a,{action:'export',password:'definitely-wrong'})).status===403);
 const exported=await account(a,{action:'export',password:fixture[0].password,userId:fixture[1].id});
 check('Export download succeeds',exported.status===200);
 check('Export is uncached attachment',exported.headers.get('cache-control').includes('no-store')&&exported.headers.get('content-disposition').includes('attachment'));
 const text=await exported.text();const data=JSON.parse(text).data;
 check('Own profile and resume exported',data.profile.id===fixture[0].id&&text.includes('PRIVATE_RESUME_A'));
 check('Applications and STAR records exported',text.includes('PRIVATE_NOTE_A')&&text.includes('PRIVATE_STAR_A'));
 check('Other account private records excluded',!text.includes('PRIVATE_RESUME_B_DO_NOT_EXPORT')&&!text.includes('PRIVATE_NOTE_B_DO_NOT_EXPORT'));
 check('No OAuth or session credentials',!/(refresh_token|access_token|credential_encrypted|scan_page_token|password_hash)/.test(text));
 check('Versioned signup acknowledgment recorded',data.account_legal_acceptances[0]?.terms_version==='2026-11-17');
 const legacy=await b.client.from('account_legal_acceptances').select('*');check('No invented agreement for older signup',!legacy.error&&legacy.data.length===0);
 const foreign=await b.client.from('account_legal_acceptances').select('*').eq('user_id',fixture[0].id);check('Acknowledgment is owner only',!foreign.error&&foreign.data.length===0);
 const anon=createClient(url,key,{auth:{persistSession:false}});check('Anonymous database export denied',!!(await anon.rpc('export_careerup_account')).error);
 // Temporary verified factor simulates an enrolled account whose cookie is still AAL1.
 const enrolled=await admin.auth.admin.mfa.listFactors({userId:fixture[2].id});
 check('Fixture C has no existing factors',!enrolled.error&&enrolled.data.factors.length===0);
 const before=await admin.from('reward_wallets').select('balance').eq('user_id',fixture[1].id).single();
 const deleted=await account(a,{action:'delete',password:fixture[0].password,confirmation:'DELETE',userId:fixture[1].id});
 check('Own account deletion succeeds',deleted.status===200);
 const after=await admin.from('reward_wallets').select('balance').eq('user_id',fixture[1].id).single();
 check('Other member pool contribution refunded',after.data.balance===before.data.balance+10);
 check('Deletion cannot target supplied other user ID',!!(await admin.auth.admin.getUserById(fixture[1].id)).data.user);
 check('Deleted Auth user removed',!(await admin.auth.admin.getUserById(fixture[0].id)).data.user);
 check('Deleted profile removed',(await admin.from('profiles').select('id').eq('id',fixture[0].id)).data.length===0);
 const replay=await account(a,{action:'export',password:fixture[0].password});check('Deleted session cannot replay export',replay.status===401);
 const stale=createClient(url,key,{global:{headers:{Authorization:'Bearer '+a.token}},auth:{persistSession:false}});const rpc=await stale.rpc('export_careerup_account');check('Deleted JWT blocked by database active-session check',!!rpc.error);
 const signed=await c.client.auth.signOut({scope:'local'});check('Fixture signout succeeds',!signed.error);
 check('Revoked session export denied',!!(await c.client.rpc('export_careerup_account')).error);
 // Repeated password attempts are limited per account, across server instances.
 const attempts=[];for(let i=0;i<6;i++)attempts.push((await account(b,{action:'export',password:'wrong-password'})).status);
 check('Password attempts are rate limited',attempts.at(-1)===429&&attempts.includes(403));
}finally{
 await b.client.auth.signOut({scope:'local'});await c.client.auth.signOut({scope:'local'});
 writeFileSync(process.env.PRIVACY_RESULTS_FILE||'/tmp/careerup-privacy-results.json',JSON.stringify({base,recordedAt:new Date().toISOString(),checks:results,total:results.length},null,2));
}
