import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { GoogleGenAI, Modality } from "@google/genai";

process.loadEnvFile(process.env.CAREERUP_PRIVATE_ENV || new URL("../.env.local", import.meta.url));
const origin = new URL(process.env.CAREERUP_TEST_BASE_URL || "http://127.0.0.1:3210").origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname) || process.env.CAREERUP_ALLOW_DEPLOYED_TESTS === "true", "Explicit deployment test flag required");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const cookies = new Map();
const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => [...cookies].map(([name, value]) => ({ name, value })), setAll: items => items.forEach(({ name, value }) => cookies.set(name, value)) },
});
const email = `careerup-voice-completion-${randomBytes(8).toString("hex")}@example.invalid`;
const fullName = "Disposable voice completion test";
const password = "V!" + randomBytes(24).toString("hex");
const requestId = randomUUID();
let userId, session, timeout, settle;
async function request(payload) {
  const response = await fetch(origin + "/api/assistant/voice", { method: "POST", signal: AbortSignal.timeout(30000),
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: [...cookies].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("; ") },
    body: JSON.stringify({ requestId, ...payload }),
  });
  return { status: response.status, data: await response.json() };
}
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
  assert.ok(!created.error && created.data.user, "Could not create isolated voice test account"); userId = created.data.user.id;
  assert.ok(!(await client.auth.signInWithPassword({ email, password })).error, "Disposable account sign in failed");
  let response;
  const deadline = Date.now() + 90000;
  do {
    response = await request({ consent: true, jobTitle: "AI Engineer Internship", includeResume: false });
    if (response.status !== 202) break;
    assert.ok(Date.now() < deadline, "Voice queue did not become available within the test window");
    await new Promise(resolve => setTimeout(resolve, Math.min(5, Math.max(1, response.data.pollAfterSeconds || 5)) * 1000));
  } while (true);
  assert.equal(response.status, 200, "The app did not deliver a voice session");
  const result = { origin, synthetic: true, caption: "", audioSeconds: 0, audioChunks: 0, turnComplete: false, interrupted: false };
  let finish, fail;
  const done = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  timeout = setTimeout(() => fail(new Error("Voice response did not finish")), 60000);
  const ai = new GoogleGenAI({ apiKey: response.data.token, httpOptions: { apiVersion: "v1alpha" } });
  session = await ai.live.connect({ model: response.data.model, config: { responseModalities: [Modality.AUDIO] }, callbacks: {
    onmessage: event => {
      const c = event.serverContent;
      if (c?.outputTranscription?.text) result.caption += c.outputTranscription.text;
      if (c?.interrupted) result.interrupted = true;
      for (const part of c?.modelTurn?.parts || []) {
        const d = part.inlineData; if (!d?.data || !d.mimeType?.startsWith("audio/pcm")) continue;
        result.audioSeconds += Buffer.from(d.data, "base64").length / 2 / Number(d.mimeType.match(/rate=(\d+)/)?.[1] || 24000); result.audioChunks++;
      }
      if (c?.turnComplete) { result.turnComplete = true; settle = setTimeout(finish, 600); }
    },
    onerror: () => fail(new Error("Voice connection failed")),
    onclose: () => { if (!result.turnComplete) fail(new Error("Voice connection closed early")); },
  } });
  const paragraph = "Our first practice question is about the CareerUp project. Explain the problem you wanted to solve, the specific tools and techniques you used, and how you measured the result. Describe your own contribution honestly and avoid inventing metrics. What would you improve if you had another week? This practice question is complete.";
  session.sendClientContent({ turns: [{ role: "user", parts: [{ text: "For an audio playback test, read this entire sample interview paragraph exactly, including the last sentence. A longer reply is requested for this test: " + paragraph }] }], turnComplete: true });
  await done;
  assert.equal(result.interrupted, false, "Synthetic reply was unexpectedly interrupted");
  assert.ok(result.audioSeconds > 10 && result.audioChunks > 1, "Only a short or partial audio reply arrived");
  assert.match(result.caption, /This practice question is complete[.!]?\s*$/i, "The final spoken sentence did not arrive");
  result.audioSeconds = Number(result.audioSeconds.toFixed(2));
  console.log(JSON.stringify({ passed: true, ...result }));
} finally {
  clearTimeout(timeout); clearTimeout(settle); session?.close();
  if (userId) {
    await request({ action: "leave" }).catch(() => undefined);
    await client.auth.signOut({ scope: "global" });
    const existing = await admin.auth.admin.getUserById(userId);
    assert.ok(existing.data.user?.email === email && existing.data.user?.user_metadata?.full_name === fullName, "Disposable account cleanup identity mismatch");
    assert.ok(!(await admin.auth.admin.deleteUser(userId)).error, "Disposable account cleanup failed");
    console.log("Disposable voice test account removed. No physical microphone or student data was used.");
  }
}
