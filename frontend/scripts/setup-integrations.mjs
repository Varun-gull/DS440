import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const file = new URL("../.env.local", import.meta.url);
let text = existsSync(file) ? readFileSync(file, "utf8") : "";
const args = process.argv.slice(2);
const originIndex = args.indexOf("--origin");
const origin = new URL(originIndex >= 0 ? args[originIndex + 1] : "http://localhost:3000");
if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) throw new Error("Use HTTPS or localhost.");
if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new Error("Supply only the site origin.");
function value(key) { const match=text.match(new RegExp(`^${key}=(.*)$`,"m")); return match?.[1]?.trim().replace(/^(["'])(.*)\1$/,"$2") ?? ""; }
function set(key, content, replace=false) {
  if (value(key) && !replace) return;
  const line=`${key}=${JSON.stringify(content)}`;
  const pattern=new RegExp(`^${key}=.*$`,"m");
  text=pattern.test(text)?text.replace(pattern,line):`${text.trimEnd()}\n${line}\n`;
}
set("EMAIL_SCANNER_ENCRYPTION_KEY",randomBytes(32).toString("base64"));
set("APP_BASE_URL",origin.origin,true);
set("EMAIL_SCANNER_BASE_URL",origin.origin,true);
set("CAREERUP_CHAT_MODEL","gemini-3.5-flash-lite");
set("CAREERUP_VOICE_MODEL","gemini-3.8-live");
if(args.includes("--enable-voice"))set("CAREERUP_VOICE_ENABLED","true",true);
for(const key of ["GEMINI_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET"])set(key,"");
writeFileSync(file,text,{mode:0o600});
console.log("Private integration settings prepared. No credentials were printed.");
for(const key of ["SUPABASE_SERVICE_ROLE_KEY","GEMINI_API_KEY","GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","EMAIL_SCANNER_ENCRYPTION_KEY"])
  console.log(`${key}: ${value(key)?"configured":"still needed"}`);
