import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

// Isolated PostgreSQL only. No Supabase URL, service key, or production data used.
const name = `careerup-email-test-${randomBytes(5).toString("hex")}`;
const run = (args, input) => spawnSync("docker", args, { input, encoding: "utf8", timeout: 180000 });
const started = run(["run", "--rm", "--network", "none", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-d", "postgres:16-alpine"]);
assert.equal(started.status, 0, started.stderr);
let passed = 0;
function sql(value, succeeds = true, expected = "") {
  const result = run(["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], value);
  if (succeeds) assert.equal(result.status, 0, result.stderr);
  else { assert.notEqual(result.status, 0, "Expected database denial"); if (expected) assert.match(result.stderr, new RegExp(expected, "i")); }
  return result.stdout.trim();
}
function check(label, fn) { fn(); passed++; console.log(`PASS ${label}`); }
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const app = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const update = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const asUser = (id, query, aal = "aal1") => `set role authenticated; set request.jwt.sub='${id}'; set request.jwt.claims='{"aal":"${aal}"}'; ${query}`;
const confirm = (id = update, expected = "applied", stamp = "2026-10-01T00:00:00Z", older = false) => `select public.confirm_email_update('${id}','${app}','${expected}','${stamp}',${older});`;
try {
  let ready = false;
  for (let index = 0; index < 40; index++) {
    if (run(["exec", name, "pg_isready", "-U", "postgres"]).status === 0) { ready = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Test database did not become ready");
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create table auth.mfa_factors(user_id uuid, status text);
    grant usage on schema auth, public to authenticated, anon, service_role;
    create type public.application_status as enum('saved','applied','interviewing','offer','rejected');
    create table public.profiles(id uuid primary key, xp integer default 25);
    create table public.applications(id uuid primary key,user_id uuid references public.profiles(id),status public.application_status,updated_at timestamptz);
    insert into public.profiles(id) values('${alice}'),('${bob}');
    insert into public.applications values('${app}','${alice}','applied','2026-10-01T00:00:00Z');`);
  const migration = readFileSync(new URL("../supabase/email-scanner.sql", import.meta.url), "utf8");
  check("migration applies and is repeatable", () => { sql(migration); sql(migration); });
  sql(`insert into public.email_updates(id,user_id,source,source_key,subject,sender,received_at,proposed_status,evidence,confidence)
    values('${update}','${alice}','paste','test-one','Interview invitation','recruiting@example.com','2026-10-28T00:00:00Z','interviewing','We invite you to interview.','review');`);
  check("owner can read own suggestions", () => assert.ok(sql(asUser(alice, "select count(*) from public.email_updates;")).endsWith("1")));
  check("another account cannot read suggestions", () => assert.ok(sql(asUser(bob, "select count(*) from public.email_updates;")).endsWith("0")));
  check("anonymous access is denied", () => sql("set role anon; select * from public.email_updates;", false, "permission denied"));
  check("browser cannot read mailbox credentials", () => sql(asUser(alice, "select * from public.email_connections;"), false, "permission denied"));
  check("browser cannot insert or forge suggestions", () => sql(asUser(alice, "insert into public.email_updates(user_id) values(null);"), false, "permission denied"));
  check("another account cannot confirm owner suggestion", () => sql(asUser(bob, confirm()), false, "not found"));
  check("changed application status is rejected", () => sql(asUser(alice, confirm(update, "saved")), false, "application changed"));
  check("changed application version is rejected", () => sql(asUser(alice, confirm(update, "applied", "2026-10-02T00:00:00Z")), false, "application changed"));
  sql(`insert into auth.mfa_factors values('${alice}','verified');`);
  check("MFA is enforced on direct suggestion reads", () => {
    assert.ok(sql(asUser(alice, "select count(*) from public.email_updates;")).endsWith("0"));
    assert.ok(sql(asUser(alice, "select count(*) from public.email_updates;", "aal2")).endsWith("1"));
  });
  check("MFA enrolled account must complete second factor", () => sql(asUser(alice, confirm()), false, "two factor"));
  check("confirmed update commits status and audit together", () => {
    sql(asUser(alice, confirm(), "aal2"));
    assert.equal(sql(`select status from public.applications where id='${app}';`), "interviewing");
    assert.equal(sql(`select decision || ':' || previous_status from public.email_updates where id='${update}';`), "confirmed:applied");
    assert.equal(sql(`select xp from public.profiles where id='${alice}';`), "25");
  });
  check("double confirmation is rejected", () => sql(asUser(alice, confirm(), "aal2"), false, "already been reviewed"));
  const oldUpdate = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  sql(`insert into public.email_updates(id,user_id,source,source_key,subject,sender,received_at,proposed_status,evidence,confidence)
    values('${oldUpdate}','${alice}','paste','test-old','Old receipt','','2026-09-01T00:00:00Z','applied','Thank you for applying.','review');`);
  const stamp = sql(`select updated_at from public.applications where id='${app}';`);
  check("old mail needs explicit acknowledgement", () => sql(asUser(alice, confirm(oldUpdate, "interviewing", stamp), "aal2"), false, "predates"));
  check("acknowledged old mail may be explicitly applied", () => sql(asUser(alice, confirm(oldUpdate, "interviewing", stamp, true), "aal2")));
  sql(`insert into public.email_connections(user_id,email,refresh_token_encrypted,granted_scope) values('${alice}','synthetic@example.com','encrypted-fixture','readonly');`);
  check("null scan lease cannot import", () => sql(`set role service_role; select public.save_gmail_updates('${alice}',null,'[]'::jsonb,null,'query',30);`, false, "expired"));
  const lease = sql(`set role service_role; select public.claim_email_scan('${alice}');`).split("\n").at(-1);
  check("scan lease is claimed", () => assert.match(lease, /^[0-9a-f-]{36}$/));
  check("overlapping scan is rejected", () => assert.ok(!sql(`set role service_role; select public.claim_email_scan('${alice}') is not null;`).endsWith("t")));
  check("authenticated user cannot claim service lease", () => sql(asUser(alice, `select public.claim_email_scan('${alice}');`), false, "permission denied"));
  const rows = JSON.stringify([{ source_key: "gmail-message-one", thread_key: "gmail-thread-one", subject: "Receipt", sender: "recruiting@example.com", received_at: "2026-10-28T00:00:00Z", proposed_status: "applied", evidence: "Thank you for applying.", extracted_company: "", extracted_role: "", action_date_text: "", confidence: "review", suggested_application_id: null }]);
  check("Gmail batch and cursor commit together", () => {
    assert.ok(sql(`set role service_role; select public.save_gmail_updates('${alice}','${lease}','${rows}'::jsonb,'next-page','query',30);`).endsWith("1"));
    assert.equal(sql(`select scan_page_token from public.email_connections where user_id='${alice}';`), "next-page");
  });
  check("completed lease cannot be reused", () => sql(`set role service_role; select public.save_gmail_updates('${alice}','${lease}','[]'::jsonb,null,'query',30);`, false, "expired"));
  check("duplicate Gmail messages cannot be inserted", () => sql(`insert into public.email_updates(user_id,source,source_key,subject,sender,received_at,proposed_status,evidence,confidence) values('${alice}','gmail','gmail-message-one','Duplicate','','2026-10-28','applied','Receipt','review');`, false, "duplicate key"));
  check("disconnect deletes Gmail credentials and mail, not application or pasted records", () => {
    sql(`set role service_role; select public.disconnect_email_scanner('${alice}');`);
    assert.equal(sql(`select count(*) from public.email_connections where user_id='${alice}';`), "0");
    assert.equal(sql(`select count(*) from public.email_updates where user_id='${alice}' and source='gmail';`), "0");
    assert.equal(sql(`select count(*) from public.email_updates where user_id='${alice}' and source='paste';`), "2");
    assert.equal(sql(`select count(*) from public.applications where id='${app}';`), "1");
  });
  check("in flight lease cannot import after disconnect", () => sql(`set role service_role; select public.save_gmail_updates('${alice}','${lease}','${rows}'::jsonb,null,'query',30);`, false, "expired"));
  const assistantMigration = readFileSync(new URL("../supabase/career-assistant.sql", import.meta.url), "utf8");
  check("assistant usage migration is repeatable", () => { sql(assistantMigration); sql(assistantMigration); });
  check("ordinary clients cannot change provider quotas", () => sql(asUser(alice, `select public.reserve_assistant_usage('${alice}','text');`), false, "permission denied"));
  check("usage rows are not visible to other clients", () => sql(asUser(bob, "select * from public.assistant_usage;"), false, "permission denied"));
  check("unknown usage mode rejected", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','other');`).endsWith("f")));
  check("null usage mode rejected", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}',null);`).endsWith("f")));
  check("first AI message may reserve usage", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','text');`).endsWith("t")));
  check("rapid AI requests are limited", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','text');`).endsWith("f")));
  sql(`update public.assistant_usage set text_requests=50,last_text_at=now()-interval '10 seconds' where user_id='${alice}';`);
  check("daily message cap enforced", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','text');`).endsWith("f")));
  check("first voice session may reserve usage", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','voice');`).endsWith("t")));
  check("concurrent voice reservations blocked", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','voice');`).endsWith("f")));
  sql(`update public.assistant_usage set voice_sessions=3,voice_until=now()-interval '1 second' where user_id='${alice}';`);
  check("daily voice cap enforced", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${alice}','voice');`).endsWith("f")));
  check("another account retains its own quota", () => assert.ok(sql(`set role service_role; select public.reserve_assistant_usage('${bob}','text');`).endsWith("t")));
  console.log(`${passed} isolated PostgreSQL checks passed. No live database was accessed.`);
} finally { run(["stop", "-t", "1", name]); }
