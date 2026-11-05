import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
const name = `careerup-rewards-${randomBytes(4).toString("hex")}`;
const run = (args, input) =>
  spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000 });
const start = run([
  "run",
  "--rm",
  "--network",
  "none",
  "--name",
  name,
  "-e",
  "POSTGRES_HOST_AUTH_METHOD=trust",
  "-d",
  "postgres:16-alpine",
]);
assert.equal(start.status, 0, start.stderr);
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  eve = "33333333-3333-4333-8333-333333333333";
let passed = 0;
const sql = (query, ok = true) => {
  const r = run(
    [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    query,
  );
  if (ok) assert.equal(r.status, 0, r.stderr);
  else assert.notEqual(r.status, 0, "Expected a database denial");
  return r.stdout.trim();
};
const service = (query) =>
  sql(`set role service_role; ${query}`).split("\n").at(-1);
const id = () => crypto.randomUUID();
function check(label, fn) {
  fn();
  passed++;
  console.log(`PASS ${label}`);
}
function redeem(user, reward, key = id()) {
  return service(
    `select public.redeem_careerup_reward('${user}','${reward}','${key}');`,
  );
}
const balance = (user) =>
  Number(
    sql(`select balance from public.reward_wallets where user_id='${user}';`),
  );
const concurrent = (query) =>
  new Promise((resolve) => {
    const p = spawn("docker", [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ]);
    let out = "",
      err = "";
    p.stdout.on("data", (v) => (out += v));
    p.stderr.on("data", (v) => (err += v));
    p.on("close", (code) => resolve({ code, out, err }));
    p.stdin.end(`set role service_role;${query}`);
  });
try {
  for (let i = 0; i < 50; i++) {
    if (run(["exec", name, "pg_isready", "-U", "postgres"]).status === 0) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  sql(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create table public.profiles(id uuid primary key,xp integer default 25,full_name text,email text,school text,major text,graduation_year text,target_roles text[],target_locations text[],resume_text text,resume_updated_at timestamptz,applications_applied integer default 0,created_at timestamptz default now());
 create table public.applications(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete cascade,company text,role text,location text,application_year integer,status text,created_at timestamptz default now(),updated_at timestamptz default now());
 create table public.interview_answers(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete cascade,prompt text,situation text,task text,action_taken text,result_outcome text,created_at timestamptz default now());
 create table public.user_rewards(id uuid primary key default gen_random_uuid(),user_id uuid references profiles(id) on delete cascade,reward_id text,unlocked_at timestamptz default now(),unique(user_id,reward_id));
 create table public.friends(id uuid primary key default gen_random_uuid(),requester_id uuid,addressee_id uuid,status text);
 create table public.assistant_usage(user_id uuid references profiles(id) on delete cascade,usage_day date,text_requests integer default 0,voice_sessions integer default 0,last_text_at timestamptz,voice_until timestamptz,primary key(user_id,usage_day));
 grant usage on schema public to service_role,anon,authenticated;grant all on public.assistant_usage to service_role;
 insert into public.profiles(id,xp) values('${alice}',430),('${bob}',100),('${eve}',25);
 insert into public.user_rewards(user_id,reward_id) values('${alice}','behavioral-interview-pack');
 insert into public.friends(requester_id,addressee_id,status) values('${alice}','${bob}','accepted');`);
  const migration =
    readFileSync(
      new URL(
        "../supabase/migrations/20261104232035_rewards_studio.sql",
        import.meta.url,
      ),
      "utf8",
    ) +
    readFileSync(
      new URL(
        "../supabase/migrations/20261104235817_reward_pool_member_cleanup.sql",
        import.meta.url,
      ),
      "utf8",
    ) +
    readFileSync(
      new URL(
        "../supabase/migrations/20261105001028_private_reward_balances.sql",
        import.meta.url,
      ),
      "utf8",
    );
  check("migration applies and preserves balances and lifetime XP", () => {
    sql(migration);
    assert.equal(balance(alice), 430);
    assert.equal(
      sql(`select xp from public.profiles where id='${alice}'`),
      "430",
    );
  });
  check("migration is repeatable without duplicate opening credit", () => {
    sql(migration);
    assert.equal(balance(alice), 430);
    assert.equal(
      sql(
        `select count(*) from public.reward_ledger where user_id='${alice}' and kind='opening'`,
      ),
      "1",
    );
  });
  check("previously unlocked resources remain unlocked", () =>
    assert.equal(
      sql(
        `select count(*) from public.reward_redemptions where user_id='${alice}' and reward_id='behavioral-interview-pack'`,
      ),
      "1",
    ),
  );
  check(
    "missing account profiles recover once with normal welcome credit",
    () => {
      const orphan = id();
      sql(
        `insert into auth.users(id,email,raw_user_meta_data) values('${orphan}','recovered@example.invalid','{"full_name":"Recovered Student"}');`,
      );
      const repair = readFileSync(
        new URL(
          "../supabase/migrations/20261105002038_restore_missing_account_profiles.sql",
          import.meta.url,
        ),
        "utf8",
      );
      sql(repair);
      sql(repair);
      assert.equal(balance(orphan), 25);
      assert.equal(
        sql(`select xp from public.profiles where id='${orphan}'`),
        "25",
      );
      assert.equal(
        sql(
          `select count(*) from public.reward_ledger where user_id='${orphan}' and kind='opening'`,
        ),
        "1",
      );
      assert.equal(balance(alice), 430);
    },
  );
  check("browser cannot read or write the wallet or invoke redemption", () => {
    for (const role of ["anon", "authenticated"]) {
      sql(`set role ${role};select * from public.reward_wallets;`, false);
      sql(
        `set role ${role};select public.redeem_careerup_reward('${alice}','extra-voice-session','${id()}');`,
        false,
      );
    }
  });
  check("unknown and upcoming rewards cannot charge points", () => {
    const before = balance(alice);
    sql(
      `set role service_role;select public.redeem_careerup_reward('${alice}','career-workshop-pass','${id()}');`,
      false,
    );
    assert.equal(balance(alice), before);
  });
  check("redemption is atomic and retries charge once", () => {
    const key = id(),
      before = balance(alice);
    const first = redeem(alice, "extra-voice-session", key);
    assert.equal(redeem(alice, "extra-voice-session", key), first);
    assert.equal(balance(alice), before - 25);
    assert.equal(
      sql(`select reward_points from public.profiles where id='${alice}'`),
      "430",
    );
    assert.equal(
      sql(`select xp from public.profiles where id='${alice}'`),
      "430",
    );
  });
  check("insufficient funds never produce a reward", () => {
    sql(`update public.reward_wallets set balance=0 where user_id='${eve}';`);
    sql(
      `set role service_role;select public.redeem_careerup_reward('${eve}','deep-resume-review','${id()}');`,
      false,
    );
    assert.equal(balance(eve), 0);
    assert.equal(
      sql(
        `select count(*) from public.reward_redemptions where user_id='${eve}'`,
      ),
      "0",
    );
  });
  check("one time rewards cannot be purchased twice", () => {
    redeem(alice, "career-insights");
    const before = balance(alice);
    sql(
      `set role service_role;select public.redeem_careerup_reward('${alice}','career-insights','${id()}');`,
      false,
    );
    assert.equal(balance(alice), before);
  });
  check("refunds require ownership and are idempotent", () => {
    const reward = redeem(alice, "personal-interview-pack"),
      before = balance(alice);
    sql(
      `set role service_role;select public.refund_careerup_reward('${bob}','${reward}');`,
      false,
    );
    service(`select public.refund_careerup_reward('${alice}','${reward}');`);
    service(`select public.refund_careerup_reward('${alice}','${reward}');`);
    assert.equal(balance(alice), before + 25);
  });
  check(
    "insights report reflects actual records and stays locked for other users",
    () => {
      const r = JSON.parse(
        service(`select public.get_reward_insights('${alice}');`),
      );
      assert.equal(r.total, 0);
      assert.equal(r.weeks.length, 4);
      sql(
        `set role service_role;select public.get_reward_insights('${bob}');`,
        false,
      );
    },
  );
  check("style choices require ownership and an earned badge", () => {
    sql(
      `set role service_role;select public.set_reward_appearance('${bob}','forest','rocket','');`,
      false,
    );
    redeem(alice, "profile-studio");
    service(
      `select public.set_reward_appearance('${alice}','forest','rocket','');`,
    );
    sql(
      `set role service_role;select public.set_reward_appearance('${alice}','plum','rocket','apps-diamond');`,
      false,
    );
  });
  check("streak protection never changes lifetime XP", () => {
    const reward = redeem(alice, "streak-day-pass");
    service(
      `select public.activate_streak_day('${alice}','${reward}',(now() at time zone 'America/New_York')::date+1);`,
    );
    sql(
      `set role service_role;select public.refund_careerup_reward('${alice}','${reward}');`,
      false,
    );
    assert.equal(
      sql(`select xp from public.profiles where id='${alice}'`),
      "430",
    );
  });
  check(
    "streak protection refuses retroactive dates and more than two days a week",
    () => {
      const reward = redeem(alice, "streak-day-pass");
      sql(
        `set role service_role;select public.activate_streak_day('${alice}','${reward}',(now() at time zone 'America/New_York')::date-1);`,
        false,
      );
      service(
        `select public.activate_streak_day('${alice}','${reward}',(now() at time zone 'America/New_York')::date+2);`,
      );
      const third = redeem(alice, "streak-day-pass");
      sql(
        `set role service_role;select public.activate_streak_day('${alice}','${third}',(now() at time zone 'America/New_York')::date+3);`,
        false,
      );
    },
  );
  check(
    "AI content cannot be generated or completed by a different user",
    () => {
      const reward = redeem(alice, "personal-skill-challenge");
      sql(
        `set role service_role;select public.begin_reward_generation('${bob}','${reward}');`,
        false,
      );
      const key = service(
        `select public.begin_reward_generation('${alice}','${reward}');`,
      );
      sql(
        `set role service_role;select public.begin_reward_generation('${alice}','${reward}');`,
        false,
      );
      assert.equal(
        service(
          `select public.finish_reward_generation('${bob}','${reward}','${key}','{}');`,
        ),
        "f",
      );
      assert.equal(
        service(
          `select public.finish_reward_generation('${alice}','${reward}','${key}','{"title":"Practice"}');`,
        ),
        "t",
      );
      service(
        `select public.complete_reward_skill('${alice}','${reward}','${"I practiced a real skill and reviewed my approach. ".repeat(3)}');`,
      );
      sql(
        `set role service_role;select public.complete_reward_skill('${alice}','${reward}','${"reflection ".repeat(15)}');`,
        false,
      );
    },
  );
  check(
    "application status toggles and duplicate roles do not farm points",
    () => {
      const before = balance(alice);
      const app = id();
      sql(
        `insert into public.applications(id,user_id,company,role,status,application_year) values('${app}','${alice}','Example','Analyst','saved',2026);update public.applications set status='applied' where id='${app}';update public.applications set status='saved' where id='${app}';update public.applications set status='applied' where id='${app}';delete from public.applications where id='${app}';insert into public.applications(user_id,company,role,status,application_year) values('${alice}','Example','Analyst','applied',2026);`,
      );
      assert.equal(balance(alice), before + 5);
    },
  );
  check("daily earning cap limits repetitive activity", () => {
    sql(
      `insert into public.applications(user_id,company,role,status,application_year) select '${alice}','Example'||x,'Engineer','offer',2026 from generate_series(1,20)x;`,
    );
    assert.equal(
      sql(
        `select sum(delta) from public.reward_ledger where user_id='${alice}' and kind='earn' and created_at>=date_trunc('day',now() at time zone 'America/New_York') at time zone 'America/New_York'`,
      ),
      "30",
    );
  });
  check(
    "custom challenges require accepted friends and consume one host pass",
    () => {
      const pass = redeem(alice, "friend-challenge-pass");
      sql(
        `set role service_role;select public.create_reward_goal('${alice}','Practice together','practice',2,7,array['${eve}']::uuid[],'${pass}');`,
        false,
      );
      const goal = service(
        `select public.create_reward_goal('${alice}','Practice together','practice',2,7,array['${bob}']::uuid[],'${pass}');`,
      );
      assert.equal(
        sql(
          `select state from public.reward_goal_members where goal_id='${goal}' and user_id='${bob}'`,
        ),
        "invited",
      );
      service(`select public.respond_reward_goal('${bob}','${goal}',true);`);
      assert.equal(
        sql(
          `select state from public.reward_goal_members where goal_id='${goal}' and user_id='${bob}'`,
        ),
        "accepted",
      );
    },
  );
  let pool;
  check("shared pools wait for consent before accepting points", () => {
    pool = service(
      `select public.create_reward_pool('${alice}','Interview night',array['${bob}']::uuid[]);`,
    );
    sql(
      `set role service_role;select public.contribute_reward_pool('${alice}','${pool}',20,'${id()}');`,
      false,
    );
    service(`select public.respond_reward_pool('${bob}','${pool}',true);`);
  });
  check(
    "pool contributions retry safely and unlock rewards for every member",
    () => {
      sql(
        `update public.reward_wallets set balance=100 where user_id in ('${alice}','${bob}');`,
      );
      const key = id();
      service(
        `select public.contribute_reward_pool('${alice}','${pool}',20,'${key}');`,
      );
      service(
        `select public.contribute_reward_pool('${alice}','${pool}',20,'${key}');`,
      );
      assert.equal(balance(alice), 80);
      service(
        `select public.contribute_reward_pool('${bob}','${pool}',20,'${id()}');`,
      );
      assert.equal(
        sql(`select status from public.reward_pools where id='${pool}'`),
        "funded",
      );
      assert.equal(
        sql(
          `select count(*) from public.reward_redemptions where details->>'poolId'='${pool}'`,
        ),
        "4",
      );
    },
  );
  check("cancelled pools return contributions exactly once", () => {
    const next = service(
      `select public.create_reward_pool('${alice}','Another practice night',array['${bob}']::uuid[]);`,
    );
    service(`select public.respond_reward_pool('${bob}','${next}',true);`);
    const before = balance(alice);
    service(
      `select public.contribute_reward_pool('${alice}','${next}',10,'${id()}');`,
    );
    service(`select public.cancel_reward_pool('${bob}','${next}');`);
    service(`select public.cancel_reward_pool('${bob}','${next}');`);
    assert.equal(balance(alice), before);
  });
  check("base voice sessions are used before Reward Point credits", () => {
    const before = sql(
      `select count(*) from public.reward_redemptions where user_id='${alice}' and reward_id='extra-voice-session' and status='available'`,
    );
    const r = JSON.parse(
      service(`select public.reserve_careerup_assistant('${alice}','voice');`),
    );
    assert.equal(r.allowed, true);
    assert.equal(r.rewardUsed, false);
    service(
      `select public.cancel_careerup_voice('${alice}','${r.reservationId}');`,
    );
    assert.equal(
      sql(
        `select count(*) from public.reward_redemptions where user_id='${alice}' and reward_id='extra-voice-session' and status='available'`,
      ),
      before,
    );
  });
  check("voice credits are restored when token creation fails", () => {
    sql(
      `update public.assistant_usage set voice_sessions=3,voice_until=null where user_id='${alice}';`,
    );
    const r = JSON.parse(
      service(`select public.reserve_careerup_assistant('${alice}','voice');`),
    );
    assert.equal(r.rewardUsed, true);
    service(
      `select public.cancel_careerup_voice('${alice}','${r.reservationId}');`,
    );
    assert.equal(
      sql(
        `select voice_sessions from public.assistant_usage where user_id='${alice}'`,
      ),
      "3",
    );
  });
  sql(`update public.reward_wallets set balance=30 where user_id='${eve}';`);
  const concurrentResults = await Promise.all(
    [1, 2].map(() =>
      concurrent(
        `select public.redeem_careerup_reward('${eve}','extra-voice-session','${id()}');`,
      ),
    ),
  );
  check("simultaneous redemptions cannot overspend the wallet", () => {
    assert.equal(concurrentResults.filter((r) => r.code === 0).length, 1);
    assert.equal(balance(eve), 5);
  });
  check("deleting a pool owner returns other members' held points", () => {
    sql(
      `update public.reward_wallets set balance=100 where user_id in ('${alice}','${bob}');`,
    );
    const pool = service(
      `select public.create_reward_pool('${alice}','Owner deletion test',array['${bob}']::uuid[]);`,
    );
    service(`select public.respond_reward_pool('${bob}','${pool}',true);`);
    const before = balance(bob);
    service(
      `select public.contribute_reward_pool('${bob}','${pool}',10,'${id()}');`,
    );
    sql(`delete from public.profiles where id='${alice}';`);
    assert.equal(balance(bob), before);
  });
  console.log(
    `${passed} isolated database checks passed. No production records were used.`,
  );
} finally {
  run(["rm", "-f", name]);
}
