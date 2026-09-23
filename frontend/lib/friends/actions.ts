"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function sendFriendRequest(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/friends", "Connect Supabase before adding friends.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before adding friends.");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirectWithMessage("/friends", "Enter your friend's account email.");
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle<{ id: string; email: string | null }>();

  if (targetError || !targetProfile) {
    redirectWithMessage("/friends", "No CareerUp account found with that email.");
  }

  if (targetProfile.id === user.id) {
    redirectWithMessage("/friends", "You are already on your own team.");
  }

  const { data: existing } = await supabase
    .from("friends")
    .select("id, status")
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${targetProfile.id}),and(requester_id.eq.${targetProfile.id},addressee_id.eq.${user.id})`
    )
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    redirectWithMessage("/friends", existing.status === "accepted" ? "You are already friends." : "A friend request already exists.");
  }

  const { error } = await supabase.from("friends").insert({
    requester_id: user.id,
    addressee_id: targetProfile.id,
    status: "pending"
  });

  if (error) {
    redirectWithMessage("/friends", error.message);
  }

  await awardXp({ supabase, userId: user.id, amount: pointValues.sendFriendRequest });
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  redirectWithMessage("/friends", "Friend request sent.");
}

export async function sendFriendRequestById(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/friends", "Connect Supabase before adding friends.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before adding friends.");
  }

  const profileId = String(formData.get("profileId") ?? "");

  if (!profileId) {
    redirectWithMessage("/friends", "Friend invite not found.");
  }

  if (profileId === user.id) {
    redirectWithMessage("/friends", "This is your own invite link.");
  }

  const { data: targetProfile, error: targetError } = await supabase.from("profiles").select("id").eq("id", profileId).maybeSingle<{ id: string }>();

  if (targetError || !targetProfile) {
    redirectWithMessage("/friends", "That CareerUp profile could not be found.");
  }

  const { data: existing } = await supabase
    .from("friends")
    .select("id, status")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user.id})`)
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    redirectWithMessage("/friends", existing.status === "accepted" ? "You are already friends." : "A friend request already exists.");
  }

  const { error } = await supabase.from("friends").insert({
    requester_id: user.id,
    addressee_id: profileId,
    status: "pending"
  });

  if (error) {
    redirectWithMessage("/friends", error.message);
  }

  await awardXp({ supabase, userId: user.id, amount: pointValues.sendFriendRequest });
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  redirectWithMessage("/friends", "Friend request sent from invite link.");
}

export async function acceptFriendRequest(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/friends", "Connect Supabase before accepting friends.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before accepting friends.");
  }

  const friendshipId = String(formData.get("friendshipId") ?? "");

  if (!friendshipId) {
    redirectWithMessage("/friends", "Friend request not found.");
  }

  const { error } = await supabase
    .from("friends")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .eq("addressee_id", user.id);

  if (error) {
    redirectWithMessage("/friends", error.message);
  }

  await awardXp({ supabase, userId: user.id, amount: pointValues.acceptFriendRequest });
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  redirectWithMessage("/friends", "Friend added to your leaderboard.");
}

export async function removeFriend(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/friends", "Connect Supabase before changing friends.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before changing friends.");
  }

  const friendshipId = String(formData.get("friendshipId") ?? "");

  if (!friendshipId) {
    redirectWithMessage("/friends", "Friendship not found.");
  }

  const { error } = await supabase.from("friends").delete().eq("id", friendshipId).or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  if (error) {
    redirectWithMessage("/friends", error.message);
  }

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  redirectWithMessage("/friends", "Friendship updated.");
}
