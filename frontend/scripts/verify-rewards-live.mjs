import assert from "node:assert/strict";
import fs from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
Object.assign(
  process.env,
  parseEnv(
    fs.readFileSync(
      process.env.CAREERUP_PRIVATE_ENV ||
        new URL("../.env.local", import.meta.url),
      "utf8",
    ),
  ),
);
const base = process.env.CAREERUP_REWARDS_TEST_URL || "http://127.0.0.1:3211",
  origin = new URL(base).origin;
if (
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) &&
  process.env.CAREERUP_ALLOW_DEPLOYED_TESTS !== "true"
)
  throw new Error("Explicitly enable deployed tests first.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && anon && key, "Private Supabase settings are required.");
const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  ids = [];
const nonce = randomBytes(6).toString("hex"),
  password = randomBytes(24).toString("base64url") + "Aa1!";
let passed = 0;
async function check(label, fn) {
  await fn();
  passed++;
  console.log(`PASS ${label}`);
}
async function account(tag) {
  const email = `rewards-test-${nonce}-${tag}@example.invalid`;
  const r = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Synthetic rewards test" },
  });
  assert.ok(!r.error, "Temporary account could not be created");
  ids.push(r.data.user.id);
  const cookies = new Map();
  const client = createServerClient(url, anon, {
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: (items) =>
        items.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  assert.ok(!(await client.auth.signInWithPassword({ email, password })).error);
  return { id: r.data.user.id, email, client, cookies };
}
async function req(user, body, customOrigin = origin) {
  const response = await fetch(base + "/api/rewards", {
    method: body ? "POST" : "GET",
    headers: {
      Origin: customOrigin,
      ...(user
        ? {
            Cookie: [...user.cookies]
              .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
              .join("; "),
          }
        : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
async function buy(user, rewardId) {
  const before = (await req(user)).data;
  const r = await req(user, {
    action: "redeem",
    rewardId,
    requestKey: crypto.randomUUID(),
  });
  assert.equal(r.status, 200, `Reward purchase failed: ${r.data.error}`);
  const item = r.data.redemptions.find(
    (x) =>
      x.reward_id === rewardId &&
      !before.redemptions.some((y) => y.id === x.id),
  );
  assert.ok(item);
  return item;
}
function totp(secret) {
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase())
    bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
      .indexOf(c)
      .toString(2)
      .padStart(5, "0");
  const k = Buffer.from((bits.match(/.{8}/g) || []).map((x) => parseInt(x, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac("sha1", k).update(counter).digest(),
    offset = digest.at(-1) & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, "0");
}
try {
  const a = await account("a"),
    b = await account("b");
  await admin
    .from("profiles")
    .update({
      resume_text:
        "College student in computer science. Built and evaluated a Python forecasting model using scikit-learn, pandas, and SQL. Used train and test splits to compare error. Created a dashboard to explain the findings.",
      target_roles: ["AI Engineer"],
      school: "Synthetic University",
      major: "Computer Science",
      graduation_year: "2027",
      target_locations: ["New York"],
    })
    .eq("id", a.id);
  await admin
    .from("reward_wallets")
    .update({ balance: 500 })
    .in("user_id", [a.id, b.id]);
  await check("anonymous access is rejected", async () =>
    assert.equal((await req(null)).status, 401),
  );
  await check("cross origin point spending is rejected", async () =>
    assert.equal(
      (
        await req(
          a,
          {
            action: "redeem",
            rewardId: "extra-voice-session",
            requestKey: crypto.randomUUID(),
          },
          "https://untrusted.example",
        )
      ).status,
      403,
    ),
  );
  await check("authenticated wallet loads real balance", async () => {
    const r = await req(a);
    assert.equal(r.status, 200);
    assert.equal(r.data.balance, 500);
    assert.equal(r.data.hasResume, true);
  });
  await check(
    "direct browser wallet access and privileged RPC are denied",
    async () => {
      assert.ok((await a.client.from("reward_wallets").select("*")).error);
      assert.ok(
        (
          await a.client.rpc("redeem_careerup_reward", {
            p_user_id: a.id,
            p_reward_id: "extra-voice-session",
            p_request_key: crypto.randomUUID(),
          })
        ).error,
      );
    },
  );
  await check("upcoming workshop cannot charge points", async () => {
    const before = (await req(a)).data.balance;
    assert.equal(
      (
        await req(a, {
          action: "redeem",
          rewardId: "career-workshop-pass",
          requestKey: crypto.randomUUID(),
        })
      ).status,
      400,
    );
    assert.equal((await req(a)).data.balance, before);
  });
  let extra;
  await check("duplicate requests redeem a credit only once", async () => {
    const request = {
      action: "redeem",
      rewardId: "extra-voice-session",
      requestKey: crypto.randomUUID(),
    };
    const before = (await req(a)).data.balance;
    const results = await Promise.all([req(a, request), req(a, request)]);
    for (const r of results) assert.equal(r.status, 200);
    const current = (await req(a)).data;
    assert.equal(current.balance, before - 25);
    extra = current.redemptions.find(
      (r) => r.reward_id === "extra-voice-session",
    );
    assert.equal(current.voiceCredits, 1);
  });
  await check("another user cannot see or return a reward", async () => {
    assert.ok(!(await req(b)).data.redemptions.some((r) => r.id === extra.id));
    assert.equal(
      (await req(b, { action: "refund", redemptionId: extra.id })).status,
      409,
    );
  });
  await check("unused reward returns its points once", async () => {
    const before = (await req(a)).data.balance;
    assert.equal(
      (await req(a, { action: "refund", redemptionId: extra.id })).status,
      200,
    );
    assert.equal(
      (await req(a, { action: "refund", redemptionId: extra.id })).status,
      200,
    );
    assert.equal((await req(a)).data.balance, before + 25);
  });
  await check("appearance is a persistent, owned unlock", async () => {
    await buy(a, "profile-studio");
    assert.equal(
      (
        await req(a, {
          action: "appearance",
          theme: "forest",
          avatar: "rocket",
          badge: "",
        })
      ).status,
      200,
    );
    assert.equal((await req(a)).data.preferences.theme, "forest");
    assert.equal(
      (
        await req(b, {
          action: "appearance",
          theme: "plum",
          avatar: "compass",
          badge: "",
        })
      ).status,
      409,
    );
  });
  await check("earned insight report uses real private activity", async () => {
    await a.client
      .from("applications")
      .insert({
        user_id: a.id,
        company: "Synthetic Example",
        role: "AI Engineer",
        location: "New York",
        status: "saved",
      });
    await buy(a, "career-insights");
    const r = (await req(a)).data;
    assert.equal(r.insights.total, 1);
    assert.equal(r.insights.weeks.length, 4);
    assert.equal((await req(b)).data.insights, null);
  });
  const jobDescription =
    "Responsibilities: build and evaluate forecasting models in Python, prepare SQL datasets, and communicate findings. Qualifications: experience with Python, pandas, scikit-learn, model evaluation and clear written communication.";
  for (const rewardId of [
    "deep-resume-review",
    "personal-interview-pack",
    "personal-skill-challenge",
  ]) {
    const item = await buy(a, rewardId);
    await check(`${rewardId} needs explicit Google consent`, async () =>
      assert.equal(
        (
          await req(a, {
            action: "generate",
            redemptionId: item.id,
            jobTitle: "AI Engineer at Synthetic Example",
            jobDescription,
            includeResume: true,
            consent: false,
          })
        ).status,
        400,
      ),
    );
    if (process.env.CAREERUP_TEST_REWARD_AI === "true")
      await check(
        `${rewardId} creates a real Gemini report and saves it privately`,
        async () => {
          const r = await req(a, {
            action: "generate",
            redemptionId: item.id,
            jobTitle: "AI Engineer at Synthetic Example",
            jobDescription,
            includeResume: true,
            consent: true,
          });
          assert.equal(r.status, 200, r.data.error);
          const result = r.data.redemptions.find((x) => x.id === item.id);
          assert.equal(result.status, "ready");
          assert.equal(result.content, null);
          assert.equal(result.hasContent, true);
          const saved = await fetch(
            base + "/api/rewards?redemptionId=" + item.id,
            {
              headers: {
                Cookie: [...a.cookies]
                  .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
                  .join("; "),
              },
            },
          );
          assert.equal(saved.status, 200);
          assert.ok((await saved.json()).content.sections.length >= 2);
          const denied = await fetch(
            base + "/api/rewards?redemptionId=" + item.id,
            {
              headers: {
                Cookie: [...b.cookies]
                  .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
                  .join("; "),
              },
            },
          );
          assert.equal(denied.status, 404);
          assert.ok(
            !(await req(b)).data.redemptions.some((x) => x.id === item.id),
          );
          if (rewardId === "personal-skill-challenge") {
            const completed = await req(a, {
              action: "completeSkill",
              redemptionId: item.id,
              reflection:
                "I practiced implementing the evaluation pipeline using synthetic data, compared error values, and learned how to explain the train and test split. I would improve the error analysis next.",
            });
            assert.equal(completed.status, 200);
            assert.equal(
              completed.data.redemptions.find((x) => x.id === item.id).status,
              "used",
            );
          }
        },
      );
  }
  assert.ok(
    !(
      await a.client
        .from("friends")
        .insert({ requester_id: a.id, addressee_id: b.id, status: "accepted" })
    ).error,
    "Synthetic friendship could not be created",
  );
  await check("friend goal invites share only opted in progress", async () => {
    const pass = await buy(a, "friend-challenge-pass");
    const made = await req(a, {
      action: "createGoal",
      title: "Practice together",
      metric: "practice",
      target: 2,
      days: 7,
      friends: [b.id],
      redemptionId: pass.id,
    });
    assert.equal(made.status, 200, made.data.error);
    const g = made.data.goals[0];
    assert.equal((await req(b)).data.goals[0].state, "invited");
    assert.equal(
      (await req(b, { action: "respondGoal", goalId: g.id, accept: true }))
        .status,
      200,
    );
    assert.equal(
      (await req(b, { action: "leaveGoal", goalId: g.id })).status,
      200,
    );
    assert.equal((await req(b)).data.goals.length, 0);
  });
  await check(
    "pool contributions are opt in and cancellation refunds everyone",
    async () => {
      let r = await req(a, {
        action: "createPool",
        title: "Synthetic interview night",
        friends: [b.id],
      });
      assert.equal(r.status, 200, r.data.error);
      const p = r.data.pools[0];
      assert.equal(
        (
          await req(a, {
            action: "contribute",
            poolId: p.id,
            points: 10,
            requestKey: crypto.randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (await req(b, { action: "respondPool", poolId: p.id, accept: true }))
          .status,
        200,
      );
      const before = (await req(a)).data.balance;
      assert.equal(
        (
          await req(a, {
            action: "contribute",
            poolId: p.id,
            points: 10,
            requestKey: crypto.randomUUID(),
          })
        ).status,
        200,
      );
      assert.equal(
        (await req(b, { action: "cancelPool", poolId: p.id })).status,
        200,
      );
      assert.equal((await req(a)).data.balance, before);
    },
  );
  await check(
    "a fully funded pool delivers both tools to every participant",
    async () => {
      const made = await req(a, {
        action: "createPool",
        title: "Funded practice night",
        friends: [b.id],
      });
      assert.equal(made.status, 200);
      const pool = made.data.pools.find((p) => p.status === "open");
      assert.ok(pool);
      await req(b, { action: "respondPool", poolId: pool.id, accept: true });
      assert.equal(
        (
          await req(a, {
            action: "contribute",
            poolId: pool.id,
            points: 20,
            requestKey: crypto.randomUUID(),
          })
        ).status,
        200,
      );
      const done = await req(b, {
        action: "contribute",
        poolId: pool.id,
        points: 20,
        requestKey: crypto.randomUUID(),
      });
      assert.equal(done.status, 200);
      for (const user of [a, b]) {
        const state = (await req(user)).data;
        assert.equal(
          state.pools.find((p) => p.id === pool.id).status,
          "funded",
        );
        assert.equal(
          state.redemptions.filter((r) => r.details.poolId === pool.id).length,
          2,
        );
      }
    },
  );
  await check(
    "a protected day persists without adding lifetime XP",
    async () => {
      const pass = await buy(a, "streak-day-pass");
      const before = (await req(a)).data.xp;
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const r = await req(a, {
        action: "protect",
        redemptionId: pass.id,
        day: parts,
      });
      assert.equal(r.status, 200, r.data.error);
      assert.ok(r.data.shieldDays.includes(parts));
      assert.equal(r.data.xp, before);
    },
  );
  if (process.env.CAREERUP_TEST_REWARD_AI === "true")
    await check(
      "a paid voice credit works after free daily sessions are exhausted",
      async () => {
        await admin
          .from("assistant_usage")
          .upsert({
            user_id: a.id,
            usage_day: new Date().toISOString().slice(0, 10),
            text_requests: 0,
            voice_sessions: 3,
            reward_voice_sessions: 0,
            voice_until: null,
          });
        const before = (await req(a)).data.voiceCredits;
        assert.ok(before > 0);
        const response = await fetch(base + "/api/assistant/voice", {
          method: "POST",
          headers: {
            Origin: origin,
            Cookie: [...a.cookies]
              .map(([n, v]) => `${n}=${encodeURIComponent(v)}`)
              .join("; "),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ consent: true, includeResume: false }),
        });
        const body = await response.json();
        assert.equal(response.status, 200, body.error);
        assert.ok(body.token);
        assert.equal((await req(a)).data.voiceCredits, before - 1);
        const usage = await admin
          .from("assistant_usage")
          .select("voice_sessions,reward_voice_sessions")
          .eq("user_id", a.id)
          .single();
        assert.equal(usage.data.voice_sessions, 4);
        assert.equal(usage.data.reward_voice_sessions, 1);
      },
    );
  await check(
    "second factor requirements protect the rewards API",
    async () => {
      const factor = await a.client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Synthetic rewards test",
        issuer: "CareerUp QA",
      });
      assert.ok(!factor.error);
      assert.ok(
        !(
          await a.client.auth.mfa.challengeAndVerify({
            factorId: factor.data.id,
            code: totp(factor.data.totp.secret),
          })
        ).error,
      );
      assert.equal((await req(a)).status, 200);
      await a.client.auth.signOut();
      await a.client.auth.signInWithPassword({ email: a.email, password });
      assert.equal((await req(a)).status, 403);
    },
  );
  console.log(
    `${passed} authenticated rewards checks passed. AI report tests ${process.env.CAREERUP_TEST_REWARD_AI === "true" ? "included real Gemini calls" : "were explicitly skipped"}.`,
  );
} finally {
  for (const uid of ids) {
    const r = await admin.auth.admin.deleteUser(uid);
    assert.ok(!r.error, "Synthetic account cleanup failed");
  }
  console.log("Temporary rewards accounts and their records removed.");
}
