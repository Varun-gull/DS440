"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type VisibleRoleApplicant = {
  application_id: string;
  profile_id: string;
  can_message: boolean | null;
};

type ExistingPeerMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  application_id: string | null;
  role_key: string;
};

function redirectWithMessage(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`);
}

function getPeerMessageErrorMessage(errorMessage: string) {
  const normalizedMessage = errorMessage.toLowerCase();

  if (normalizedMessage.includes("row-level security") || normalizedMessage.includes("peer_messages")) {
    return "Messages are almost ready. Run supabase/direct-profile-messages-policy.sql in Supabase, then try sending this again.";
  }

  return errorMessage;
}

function getSafeReturnTo(value: FormDataEntryValue | null) {
  const returnTo = String(value ?? "");
  if (returnTo.startsWith("/postings/insights") || returnTo.startsWith("/messages") || returnTo.startsWith("/u/")) {
    return returnTo;
  }

  return "/postings/internships";
}

function isDirectProfileMessage(applicationId: string, roleKey: string, recipientId: string) {
  return !applicationId && roleKey === `profile::${recipientId}`;
}

async function canSendPeerMessage({
  supabase,
  userId,
  recipientId,
  applicationId,
  roleKey,
  sourceMessageId
}: {
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>;
  userId: string;
  recipientId: string;
  applicationId: string;
  roleKey: string;
  sourceMessageId: string;
}) {
  if (sourceMessageId) {
    const { data: sourceMessage, error } = await supabase
      .from("peer_messages")
      .select("id, sender_id, recipient_id, application_id, role_key")
      .eq("id", sourceMessageId)
      .maybeSingle<ExistingPeerMessage>();

    if (error || !sourceMessage) {
      return false;
    }

    const isParticipant = sourceMessage.sender_id === userId || sourceMessage.recipient_id === userId;
    const isReplyingToOtherParticipant = sourceMessage.sender_id === recipientId || sourceMessage.recipient_id === recipientId;
    const sameRoleContext = sourceMessage.role_key === roleKey && (!sourceMessage.application_id || sourceMessage.application_id === applicationId);

    return isParticipant && isReplyingToOtherParticipant && sameRoleContext;
  }

  if (!applicationId) {
    if (roleKey !== `profile::${recipientId}`) {
      return false;
    }

    const { data: recipient, error } = await supabase.from("profiles").select("id").eq("id", recipientId).maybeSingle<{ id: string }>();
    return !error && Boolean(recipient);
  }

  const { data, error } = await supabase.rpc("get_role_peer_applicants", { target_role_key: roleKey });

  if (error || !data) {
    return false;
  }

  return (data as VisibleRoleApplicant[]).some(
    (applicant) => applicant.application_id === applicationId && applicant.profile_id === recipientId && applicant.can_message
  );
}

export async function sendPeerMessage(formData: FormData) {
  const supabase = getSupabaseServerClient();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));

  if (!supabase) {
    redirectWithMessage(returnTo, "Connect Supabase before sending messages.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?message=${encodeURIComponent("Log in before messaging another applicant.")}`);
  }

  const recipientId = String(formData.get("recipientId") ?? "").trim();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const roleKey = String(formData.get("roleKey") ?? "").trim();
  const sourceMessageId = String(formData.get("sourceMessageId") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!recipientId || !roleKey || !subject || !body) {
    redirectWithMessage(returnTo, "Add a subject and message before sending.");
  }

  if (recipientId === user.id) {
    redirectWithMessage(returnTo, "You cannot message yourself.");
  }

  const allowed = await canSendPeerMessage({
    supabase,
    userId: user.id,
    recipientId,
    applicationId,
    roleKey,
    sourceMessageId
  });

  if (!allowed) {
    redirectWithMessage(returnTo, "This message thread is not available. Make sure the role is still visible and the database migration has been run.");
  }

  const { error } = isDirectProfileMessage(applicationId, roleKey, recipientId)
    ? await supabase.rpc("send_direct_profile_message", {
        target_recipient_id: recipientId,
        message_subject: subject,
        message_body: body
      })
    : await supabase.from("peer_messages").insert({
        sender_id: user.id,
        recipient_id: recipientId,
        application_id: applicationId || null,
        role_key: roleKey,
        subject,
        body
      });

  if (error) {
    redirectWithMessage(returnTo, getPeerMessageErrorMessage(error.message));
  }

  await awardXp({ supabase, userId: user.id, amount: pointValues.sendMessage });
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath(returnTo);
  revalidatePath("/messages");
  redirectWithMessage(returnTo, "Message sent.");
}

export async function markPeerMessageRead(formData: FormData) {
  const supabase = getSupabaseServerClient();
  const returnTo = getSafeReturnTo(formData.get("returnTo"));

  if (!supabase) {
    redirectWithMessage(returnTo, "Connect Supabase before updating messages.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?message=${encodeURIComponent("Log in before updating messages.")}`);
  }

  const messageId = String(formData.get("messageId") ?? "").trim();

  if (!messageId) {
    redirectWithMessage(returnTo, "Message not found.");
  }

  const { error } = await supabase
    .from("peer_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("recipient_id", user.id);

  if (error) {
    redirectWithMessage(returnTo, error.message);
  }

  revalidatePath("/messages");
  redirectWithMessage(returnTo, "Message marked as read.");
}
