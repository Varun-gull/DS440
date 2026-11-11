import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
process.loadEnvFile(process.env.CAREERUP_PRIVATE_ENV || new URL('../.env.local',import.meta.url));
const base=process.env.CAREERUP_CLASS_TEST_URL || 'http://127.0.0.1:3215',origin=new URL(base).origin;
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)&&process.env.CAREERUP_ALLOW_DEPLOYED_TESTS!=='true')throw new Error('Explicitly enable deployed tests first.');
const count=Number(process.env.CAREERUP_CLASS_TEST_USERS || 25);
assert.ok(Number.isInteger(count)&&count>=2&&count<=30,'Use between 2 and 30 disposable accounts.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url&&anon&&key,'Private Supabase settings are required.');
const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const nonce=randomBytes(6).toString('hex'),password=randomBytes(24).toString('base64url')+'Aa1!',users=[],ids=[],measurements=[],stages=[];
const report={startedAt:new Date().toISOString(),origin,users:count,syntheticDataOnly:true,publicSignupTested:false,stages,cleanup:false};
// Finish every in-flight request before deleting accounts or writing evidence.
async function settled(tasks){const results=await Promise.allSettled(tasks);const failed=results.filter(x=>x.status==='rejected');if(failed.length)throw new AggregateError(failed.map(x=>x.reason),`${failed.length} operation(s) failed: ${failed[0].reason?.message || 'unknown failure'}`);return results.map(x=>x.value);}
async function stage(name,fn){const start=performance.now();try{await fn();stages.push({name,passed:true,elapsedMs:Math.round(performance.now()-start)});console.log('PASS '+name);}catch(error){stages.push({name,passed:false,elapsedMs:Math.round(performance.now()-start),error:error.message});throw error;}}
async function req(user,path,body,options={}){
 const start=performance.now();
 const response=await fetch(base+path,{method:options.method || (body?'POST':'GET'),redirect:'manual',signal:AbortSignal.timeout(options.timeoutMs || 60000),headers:{Origin:origin,...(user?{Cookie:[...user.cookies].map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('; ')}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...options.headers},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{}
 measurements.push({path:path.split('?')[0],status:response.status,ms:Math.round(performance.now()-start)});
 return{status:response.status,text,data,headers:response.headers};
}
async function page(user,path){const r=await req(user,path);assert.equal(r.status,200,`Page ${path} returned ${r.status}`);assert.ok(!/"digest":"\d+"/.test(r.text),`Server rendering failed on ${path}`);for(let i=0;i<users.length;i++)if(users[i].id!==user.id)assert.ok(!r.text.includes(users[i].resumeMarker),'Another account resume appeared in rendered HTML');return r;}
async function account(i){const email=`careerup-class-${nonce}-${i}@example.invalid`;const r=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Disposable class capacity test'}});assert.ok(!r.error,'Could not create disposable account: '+r.error?.message);ids.push(r.data.user.id);const cookies=new Map();const client=createServerClient(url,anon,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(({name,value})=>cookies.set(name,value))}});const login=await client.auth.signInWithPassword({email,password});assert.ok(!login.error,'Disposable account sign in failed');return{id:r.data.user.id,email,client,cookies,index:i,resumeMarker:`PRIVATE_RESUME_${nonce}_${i}_END`};}
try{
 // A small setup pool avoids confusing administrator provisioning with an
 // actual public signup capacity test. All measured stages use count workers.
 for(let i=0;i<count;i+=5){const batch=await settled(Array.from({length:Math.min(5,count-i)},(_,j)=>account(i+j)));users.push(...batch);}
 await stage(`${count} independent active sessions`,async()=>{await settled(users.map(async u=>{const r=await u.client.rpc('careerup_session_valid');assert.equal(r.error,null);assert.equal(r.data,true);}));});
 await stage('concurrent profile saves through the app API',async()=>{await settled(users.map(async u=>{const r=await req(u,'/api/profile',{fullName:`Class test ${nonce} ${u.index}`,school:'Synthetic University',major:'Computer Science',graduationYear:'2027',targetRoles:['AI Engineer'],targetLocations:['New York'],shareApplicationBoard:false});assert.equal(r.status,200,r.data?.error);assert.equal(r.data.ok,true);}));});
 await stage('concurrent resume uploads through the app API',async()=>{await settled(users.map(async u=>{const form=new FormData();form.set('resumeFile',new File([`${u.resumeMarker}\nComputer science student. Built and evaluated Python forecasting models with SQL, pandas and scikit-learn. Used a held out test set and reported prediction error.`],'synthetic-resume.txt',{type:'text/plain'}));const r=await req(u,'/api/profile/resume',form);assert.equal(r.status,200,r.data?.error);assert.equal(r.data.extractedText,true);}));});
 await stage('private profile isolation and progress write denial',async()=>{await settled(users.map(async(u,i)=>{const other=users[(i+1)%count];const r=await u.client.from('profiles').select('id,resume_text,email').eq('id',other.id);assert.equal(r.error,null);assert.equal(r.data.length,0);const w=await u.client.from('profiles').update({xp:999999}).eq('id',u.id);assert.ok(w.error,'Browser role changed XP');}));});
 await stage('concurrent application saves using the rendered website form',async()=>{await settled(users.map(async u=>{const p=await page(u,'/applications/new');const action=p.text.match(/name="(\$ACTION_ID_[^"]+)"/);assert.ok(action,'Application form has no server action');const form=new FormData();form.set(action[1],'');form.set('company',`SyntheticCo ${nonce} ${u.index}`);form.set('role','AI Engineer Internship');form.set('location','New York');form.set('sourceUrl','https://example.com/synthetic-role');const r=await req(u,'/applications/new',form);assert.equal(r.status,303,'Application action did not redirect successfully');assert.ok(/^\/applications(?:\?|$)/.test(r.headers.get('location') || ''),'Application action returned an error');const a=await u.client.from('applications').select('id,status,updated_at').eq('company',`SyntheticCo ${nonce} ${u.index}`).single();assert.equal(a.error,null);u.application=a.data;}));});
 for(const path of ['/dashboard','/postings/internships?q=AI%20Engineer&location=New%20York','/postings/new-grad?q=Software%20Engineer','/applications','/calendar','/challenges','/rewards','/friends','/leaderboard','/messages','/interview','/profile','/settings']){
  await stage(`${count} simultaneous page requests: ${path.split('?')[0]}`,async()=>{await settled(users.map(u=>page(u,path)));});
 }
 await stage('concurrent email review creation and confirmation',async()=>{await settled(users.map(async u=>{let r=await req(u,'/api/email-scanner',{action:'paste',subject:'Interview invitation',sender:'recruiter@example.com',body:`We invite you to interview for the AI Engineer Internship at SyntheticCo ${nonce} ${u.index}.`,receivedAt:new Date().toISOString(),consent:true});assert.equal(r.status,200,r.data?.error);r=await req(u,'/api/email-scanner');assert.equal(r.status,200);assert.equal(r.data.updates.length,1);u.emailUpdate=r.data.updates[0].id;r=await req(u,'/api/email-scanner',{action:'confirm',updateId:u.emailUpdate,applicationId:u.application.id,expectedStatus:u.application.status,expectedUpdatedAt:u.application.updated_at});assert.equal(r.status,200,r.data?.error);const a=await u.client.from('applications').select('status').eq('id',u.application.id).single();assert.equal(a.data.status,'interviewing');}));});
 await stage('email and rewards data stay isolated between accounts',async()=>{await settled(users.map(async(u,i)=>{const other=users[(i+1)%count];const r=await req(u,'/api/email-scanner');assert.ok(r.data.updates.every(x=>x.id!==other.emailUpdate));const w=await u.client.from('reward_wallets').select('*').eq('user_id',other.id);assert.ok(w.error || w.data.length===0);}));});
 await stage('concurrent reward purchases and duplicate submit protection',async()=>{await settled(users.map(async u=>{const requestKey=randomUUID(),payload={action:'redeem',rewardId:'extra-voice-session',requestKey};const before=await req(u,'/api/rewards');assert.equal(before.status,200);const replies=await settled([req(u,'/api/rewards',payload),req(u,'/api/rewards',payload)]);for(const r of replies)assert.equal(r.status,200,r.data?.error);const after=await req(u,'/api/rewards');assert.equal(after.data.balance,before.data.balance-25);assert.equal(after.data.redemptions.filter(x=>x.reward_id==='extra-voice-session').length,1);}));});
 await stage('concurrent contextual resume matching',async()=>{await settled(users.map(async u=>{const r=await req(u,'/api/assistant',{mode:'guide',includeResume:true,jobTitle:'AI Engineer Internship',jobDescription:'Required: Python, SQL, model evaluation and forecasting.',messages:[{role:'user',text:'Explain my fit score.'}]});assert.equal(r.status,200,r.data?.error);assert.ok(r.data.fit?.score>0);}));});
 if(process.env.CAREERUP_CLASS_TEST_AI==='true')await stage('concurrent real Gemini replies',async()=>{await settled(users.map(async u=>{const r=await req(u,'/api/assistant',{mode:'ai',consent:true,messages:[{role:'user',text:'Ask one short interview question about evaluating a Python forecasting model. Reply with one question only.'}]},{timeoutMs:210000});assert.equal(r.status,200,r.data?.error);assert.equal(r.data.provider,'Google Gemini');assert.ok(r.data.text.length>10);}));});

 report.passed=true;
}catch(error){report.passed=false;report.error=error.message;console.error('FAIL '+error.message);process.exitCode=1;}
finally{
 const ordered=measurements.map(x=>x.ms).sort((a,b)=>a-b);const percentile=p=>ordered[Math.min(ordered.length-1,Math.ceil(p*ordered.length)-1)];
 report.requests=measurements.length;report.timingsMs={p50:percentile(.5),p95:percentile(.95),max:ordered.at(-1)};
 report.routes=Object.fromEntries([...new Set(measurements.map(x=>x.path))].map(path=>{const m=measurements.filter(x=>x.path===path),v=m.map(x=>x.ms).sort((a,b)=>a-b);return[path,{requests:m.length,p95Ms:v[Math.ceil(v.length*.95)-1],maxMs:v.at(-1),serverErrors:m.filter(x=>x.status>=500).length}];}));
 report.httpErrors=measurements.filter(x=>x.status>=400).length;
 let clean=true;
 for(const id of ids){const r=await admin.auth.admin.deleteUser(id);if(r.error)clean=false;}
 report.cleanup=clean;report.finishedAt=new Date().toISOString();
 if(!clean){process.exitCode=1;report.passed=false;}
 const output=process.env.CAREERUP_CLASS_REPORT || '/tmp/careerup-class-load.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{mode:0o600});
 console.log(`${stages.length} stages completed. ${measurements.length} requests measured. Disposable account cleanup: ${clean?'complete':'needs attention'}.`);
 console.log('Aggregate report: '+output);
}
