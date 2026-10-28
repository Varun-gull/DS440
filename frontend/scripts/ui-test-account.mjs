import { existsSync,readFileSync,writeFileSync,unlinkSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(new URL("../.env.local",import.meta.url));
const file=new URL("../.careerup-ui-fixture.local.json",import.meta.url);
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
if(process.argv[2]==="delete"){
  if(!existsSync(file)){console.log("No UI fixture to remove.");process.exit(0);}
  const fixture=JSON.parse(readFileSync(file,"utf8"));
  if(!/^careerup-ui-[a-f0-9]+@example\.invalid$/.test(fixture.email))throw new Error("Unexpected fixture identity; no account deleted.");
  const found=await admin.auth.admin.getUserById(fixture.id);
  if(found.data?.user?.email!==fixture.email)throw new Error("Fixture ownership check failed; no account deleted.");
  const result=await admin.auth.admin.deleteUser(fixture.id);if(result.error)throw new Error("Test account cleanup failed.");
  unlinkSync(file);console.log("Disposable UI account and local credential file removed.");
}else{
  if(existsSync(file))throw new Error("A UI fixture already exists. Clean it up before creating another.");
  const email=`careerup-ui-${randomBytes(6).toString("hex")}@example.invalid`,password=randomBytes(24).toString("base64url")+"aA1!";
  const result=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:"CareerUp test student",privacy_prompt_answered:true}});
  if(result.error)throw new Error("Could not create disposable UI account.");
  writeFileSync(file,JSON.stringify({id:result.data.user.id,email,password}),{mode:0o600});
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
  const login=await client.auth.signInWithPassword({email,password});if(login.error)throw new Error("UI fixture login failed.");
  await client.from("profiles").update({full_name:"CareerUp test student",privacy_prompt_answered:true,target_roles:["AI Engineer"],resume_text:"Built a forecasting model with Python and SQL for a university project."}).eq("id",result.data.user.id);
  console.log("Disposable UI account prepared. Credentials are stored only in the ignored local fixture file.");
}
