// Creates and seeds disposable accounts for verify-account-privacy.mjs.
// Secrets stay in an ignored local file; no email is sent by admin creation.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const file=process.env.PRIVACY_FIXTURE_FILE || '.careerup-privacy-fixture.local.json';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const mode=process.argv[2];
const must=({data,error})=>{if(error)throw error;return data;};
if(mode==='cleanup') {
 for(const u of JSON.parse(readFileSync(file))){
  const {data}=await admin.auth.admin.getUserById(u.id);
  if(!data.user)continue;
  if(!data.user.user_metadata.privacy_test_fixture || !/^careerup-privacy-.*@example\.invalid$/.test(data.user.email))throw Error('Not a disposable privacy fixture');
  must(await admin.auth.admin.deleteUser(u.id));
 }
 unlinkSync(file);console.log('Disposable privacy accounts removed.');
} else if(mode==='create') {
 const users=[],clients=[];
 for(let i=0;i<3;i++){
  const password='Cp!'+randomUUID()+'xZ2',email=`careerup-privacy-${randomUUID()}@example.invalid`;
  const {user}=must(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Privacy Test ${i+1}`,privacy_prompt_answered:true,privacy_test_fixture:true,...(i===1?{}:{terms_version:'2026-11-17',privacy_version:'2026-11-17',adult_confirmed:true})}}));
  users.push({id:user.id,email,password});writeFileSync(file,JSON.stringify(users),{mode:0o600});
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});must(await client.auth.signInWithPassword({email,password}));clients.push(client);
 }
 try{
  for(const i of [0,1]){
   must(await admin.from('profiles').update({resume_text:i===0?'PRIVATE_RESUME_A Python forecasting':'PRIVATE_RESUME_B_DO_NOT_EXPORT',resume_keywords:['Python','forecasting']}).eq('id',users[i].id));
   must(await clients[i].from('applications').insert({user_id:users[i].id,company:'Fixture company',role:'AI Engineer',status:'saved',notes:i===0?'PRIVATE_NOTE_A':'PRIVATE_NOTE_B_DO_NOT_EXPORT'}).select('id'));
   if(i===0){
    must(await clients[i].from('interview_answers').insert({user_id:users[i].id,prompt:'Fixture prompt',situation:'PRIVATE_STAR_A',task:'Evaluate',action_taken:'Built test',result_outcome:'Improved'}));
   }
  }
  const [pool]=must(await admin.from('reward_pools').insert({owner_id:users[0].id,title:'Privacy fixture pool',target:40,raised:10}).select('id'));
  must(await admin.from('reward_pool_members').insert([{pool_id:pool.id,user_id:users[0].id,state:'accepted',contribution:0},{pool_id:pool.id,user_id:users[1].id,state:'accepted',contribution:10}]));
  const wallet=must(await admin.from('reward_wallets').select('balance,spent_total').eq('user_id',users[1].id).single());
  must(await admin.from('reward_wallets').update({balance:wallet.balance-10,spent_total:wallet.spent_total+10}).eq('user_id',users[1].id));
  console.log('Created three disposable privacy accounts and seeded private records and a shared pool.');
 }finally{await Promise.all(clients.map(c=>c.auth.signOut({scope:'local'})));}
} else throw Error('Use create or cleanup. Load private configuration first.');
