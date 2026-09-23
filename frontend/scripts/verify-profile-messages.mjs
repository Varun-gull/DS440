import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadDotEnvLocal() {
  if (!existsSync(".env.local")) {
    return;
  }

  for (const line of readFileSync(".env.local", "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1).replace(/^"|"$/g, "");
    process.env[key] ??= value;
  }
}

async function signIn(label, email, password) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    throw new Error(`${label} sign-in failed: ${error?.message ?? "No user returned"}`);
  }

  return { supabase, user: data.user };
}

loadDotEnvLocal();

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CAREERUP_TEST_SENDER_EMAIL",
  "CAREERUP_TEST_SENDER_PASSWORD",
  "CAREERUP_TEST_RECIPIENT_EMAIL",
  "CAREERUP_TEST_RECIPIENT_PASSWORD"
];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Use two confirmed CareerUp test accounts so Supabase Auth can return sessions.");
  process.exit(1);
}

const sender = await signIn("sender", process.env.CAREERUP_TEST_SENDER_EMAIL, process.env.CAREERUP_TEST_SENDER_PASSWORD);
const recipient = await signIn("recipient", process.env.CAREERUP_TEST_RECIPIENT_EMAIL, process.env.CAREERUP_TEST_RECIPIENT_PASSWORD);
const roleKey = `profile::${recipient.user.id}`;
const subject = `CareerUp profile message verification ${new Date().toISOString()}`;

const { data: messageId, error: sendError } = await sender.supabase.rpc("send_direct_profile_message", {
  target_recipient_id: recipient.user.id,
  message_subject: subject,
  message_body: "Automated verification that direct profile messages can be sent and counted as unread."
});

if (sendError || !messageId) {
  throw new Error(`Profile message RPC failed: ${sendError?.message ?? "No message id returned"}`);
}

const { data: receivedMessage, error: readError } = await recipient.supabase
  .from("peer_messages")
  .select("id, subject, role_key, application_id, read_at")
  .eq("id", messageId)
  .single();

if (readError || !receivedMessage) {
  throw new Error(`Recipient could not read inserted message: ${readError?.message ?? "No message returned"}`);
}

const { count, error: countError } = await recipient.supabase
  .from("peer_messages")
  .select("id", { count: "exact", head: true })
  .eq("recipient_id", recipient.user.id)
  .is("read_at", null);

if (countError) {
  throw new Error(`Unread count query failed: ${countError.message}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      messageId,
      roleKey: receivedMessage.role_key,
      applicationId: receivedMessage.application_id,
      recipientCanRead: true,
      unreadCountForRecipient: count
    },
    null,
    2
  )
);
