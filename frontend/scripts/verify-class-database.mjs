import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const name=`careerup-class-${randomBytes(4).toString("hex")}`;
const run=(args,input)=>spawnSync("docker",args,{input,encoding:"utf8",timeout:120000});
const start=run(["run","--rm","--network","none","--name",name,"-e","POSTGRES_HOST_AUTH_METHOD=trust","-d","postgres:17-alpine"]);
assert.equal(start.status,0,start.stderr);
const sql=(q,ok=true)=>{const r=run(["exec","-i",name,"psql","-U","postgres","-v","ON_ERROR_STOP=1","-qAt"],q);if(ok)assert.equal(r.status,0,r.stderr);else assert.notEqual(r.status,0,"Expected a denial");return r.stdout.trim().split("\n").at(-1);};
const alice="11111111-1111-4111-8111-111111111111",bob="22222222-2222-4222-8222-222222222222",eve="33333333-3333-4333-8333-333333333333";
const sessions=new Map([[alice,"11111111-aaaa-4111-8111-111111111111"],[bob,"22222222-bbbb-4222-8222-222222222222"],[eve,"33333333-cccc-4333-8333-333333333333"]]);
const asUser=(uid,q,ok=true,aal="aal1")=>sql(`set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({sub:uid,aal,session_id:sessions.get(uid)})}',false);${q}`,ok);
let passed=0;const check=(label,fn)=>{fn();passed++;console.log(`PASS ${label}`);};
try{
 let ready=false;
 for(let i=0;i<100;i++){
  const logs=run(["logs",name]);
  if((logs.stdout+logs.stderr).includes('PostgreSQL init process complete') && run(["exec",name,"pg_isready","-U","postgres"]).status===0){ready=true;break;}
  await new Promise(r=>setTimeout(r,150));
 }
 assert.ok(ready,'Isolated PostgreSQL did not become ready');
 sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
 create table auth.mfa_factors(user_id uuid,status text);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select nullif(auth.jwt()->>'sub','')::uuid$$;
 grant usage on schema auth,public to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;`);
 for(const file of ['schema.sql','postings-cache.sql','email-scanner.sql','career-assistant.sql',
 'migrations/20261104232035_rewards_studio.sql','migrations/20261104235817_reward_pool_member_cleanup.sql',
 'migrations/20261105001028_private_reward_balances.sql','migrations/20261105002038_restore_missing_account_profiles.sql'])sql(readFileSync(new URL('../supabase/'+file,import.meta.url),'utf8'));
 sql('grant all on all tables in schema public to service_role;grant all on all tables in schema auth to service_role;');
 const migration=readFileSync(new URL('../supabase/migrations/20261111211531_class_privacy_hardening.sql',import.meta.url),'utf8');
 check('privacy migration applies and is repeatable',()=>{sql(migration);sql(migration);});
 for(const [uid,sid] of sessions)sql(`insert into auth.users(id,email) values('${uid}','${uid}@example.invalid');insert into auth.sessions(id,user_id) values('${sid}','${uid}');`);
 const app=sql(`insert into public.applications(user_id,company,role,notes) values('${alice}','Synthetic Company','AI Engineer','PRIVATE NOTES') returning id;`);
 sql(`update public.profiles set resume_text='PRIVATE RESUME' where id='${alice}';`);
 check('owner can read their resume',()=>assert.equal(asUser(alice,"select resume_text from public.profiles;"),'PRIVATE RESUME'));
 check('other users see no private profile row',()=>assert.equal(asUser(bob,`select count(*) from public.profiles where id='${alice}';`),'0'));
 check('anonymous profile access is denied',()=>sql('set role anon; select * from public.profiles;',false));
 check('browser cannot edit resume, role, XP or progress flags',()=>{for(const field of ["resume_text='forged'","role='admin'","xp=999999","profile_completed_awarded=false"])asUser(alice,`update public.profiles set ${field} where id='${alice}';`,false);});
 check('browser cannot invoke an arbitrary XP award',()=>{asUser(alice,'select public.award_xp(999999);',false);asUser(alice,`select public.award_careerup_xp('${alice}',999999);`,false);});
 check('trusted progress awards are atomic and keep rank bonuses',()=>{sql(`set role service_role;select public.award_careerup_xp('${alice}',225);`);assert.equal(sql(`select total_xp from public.profiles where id='${alice}';`),'300');});
 check('outsider cannot read a private application',()=>assert.equal(asUser(bob,`select count(*) from public.applications where id='${app}';`),'0'));
 const friendship=asUser(alice,`insert into public.friends(requester_id,addressee_id) values('${alice}','${bob}') returning id;`);
 check('requester cannot accept their own invitation',()=>{asUser(alice,`update public.friends set status='accepted' where id='${friendship}';`);assert.equal(sql(`select status from public.friends where id='${friendship}';`),'pending');});
 check('recipient can accept without changing participants',()=>{asUser(bob,`update public.friends set status='accepted' where id='${friendship}';`);assert.equal(sql(`select status from public.friends where id='${friendship}';`),'accepted');asUser(bob,`update public.friends set requester_id='${eve}' where id='${friendship}';`,false);});
 check('accepted friend still cannot read an unshared board',()=>assert.equal(asUser(bob,`select count(*) from public.applications where id='${app}';`),'0'));
 sql(`update public.profiles set share_application_board=true where id='${alice}';`);
 check('accepted friend can read only the opted in board projection',()=>{
  assert.equal(asUser(bob,`select count(*) from public.shared_application_board('${alice}');`),'1');
  assert.equal(asUser(bob,`select count(*) from public.applications where id='${app}';`),'0');
  asUser(bob,`select notes from public.shared_application_board('${alice}');`,false);
 });
 check('sharing never grants application editing',()=>{asUser(bob,`update public.applications set notes='changed' where id='${app}';`);assert.equal(sql(`select notes from public.applications where id='${app}';`),'PRIVATE NOTES');});
 check('sharing does not expose the board to strangers',()=>assert.equal(asUser(eve,`select count(*) from public.applications where id='${app}';`),'0'));
 check('peer lookups obey the same board consent',()=>{const key=sql(`select role_key from public.applications where id='${app}';`);assert.equal(asUser(bob,`select count(*) from public.get_role_peer_applicants('${key}');`),'1');assert.equal(asUser(eve,`select count(*) from public.get_role_peer_applicants('${key}');`),'0');sql(`update public.profiles set share_application_board=false where id='${alice}';`);assert.equal(asUser(bob,`select count(*) from public.get_role_peer_applicants('${key}');`),'0');});
 const group=asUser(alice,`insert into public.career_groups(name,owner_id) values('Synthetic group','${alice}') returning id;`);
 check('group owner can create their membership without RLS recursion',()=>{asUser(alice,`insert into public.career_group_members(group_id,user_id,added_by) values('${group}','${alice}','${alice}');`);assert.equal(asUser(alice,`select count(*) from public.career_group_members where group_id='${group}';`),'1');});
 check('outsiders cannot join a private group by changing a request',()=>asUser(eve,`insert into public.career_group_members(group_id,user_id,added_by) values('${group}','${eve}','${eve}');`,false));
 check('members can add an accepted friend and both can see the group',()=>{asUser(alice,`insert into public.career_group_members(group_id,user_id,added_by) values('${group}','${bob}','${alice}');`);assert.equal(asUser(bob,`select count(*) from public.career_group_members where group_id='${group}';`),'2');});
 check('enrolled MFA blocks direct first factor database reads',()=>{sql(`insert into auth.mfa_factors values('${alice}','verified');`);assert.equal(asUser(alice,'select count(*) from public.profiles;'),'0');assert.equal(asUser(alice,'select count(*) from public.profiles;',true,'aal2'),'1');});
 check('a revoked session loses database access immediately',()=>{sql(`delete from auth.sessions where user_id='${bob}';`);assert.equal(asUser(bob,'select public.careerup_session_valid();'),'f');assert.equal(asUser(bob,'select count(*) from public.applications;'),'0');});
 const pacing=readFileSync(new URL('../supabase/migrations/20261111230045_provider_request_pacing.sql',import.meta.url),'utf8');
 check('provider pacing migration applies and repeats safely',()=>{sql(pacing);sql(pacing);});
 check('browser and anonymous clients cannot reserve provider capacity',()=>{asUser(alice,"select public.reserve_provider_slot('synthetic');",false);sql("set role anon;select public.reserve_provider_slot('synthetic');",false);});
 check('25 requests get separate slots within the bounded queue',()=>{const rows=JSON.parse(sql("set role service_role;select jsonb_agg(public.reserve_provider_slot('gemini:text:synthetic')) from generate_series(1,25);"));assert.equal(rows.length,25);assert.ok(rows.every(r=>r.allowed));assert.ok(rows.at(-1).waitMs>=107000&&rows.at(-1).waitMs<=108100);for(let i=1;i<rows.length;i++)assert.ok(rows[i].waitMs-rows[i-1].waitMs>=4400);});
 check('full provider queues refuse work instead of unbounded waiting',()=>{sql("update careerup_private.provider_schedule set next_start_at=now()+interval '200 seconds' where bucket='gemini:text:synthetic';");const r=JSON.parse(sql("set role service_role;select public.reserve_provider_slot('gemini:text:synthetic');"));assert.equal(r.allowed,false);});
 check('provider scheduling rejects unsafe pacing and keeps models independent',()=>{sql("set role service_role;select public.reserve_provider_slot('synthetic',1);",false);const r=JSON.parse(sql("set role service_role;select public.reserve_provider_slot('gemini:text:another-model');"));assert.equal(r.allowed,true);assert.ok(r.waitMs<100);});
 console.log(`${passed} isolated class privacy checks passed. No production records were used.`);
}finally{run(['rm','-f',name]);}
