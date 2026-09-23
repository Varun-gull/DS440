"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

async function requireUser(returnTo = "/friends") {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage(returnTo, "Connect Supabase before using groups.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?message=${encodeURIComponent("Log in before using groups.")}`);
  }

  return { supabase, user };
}

export async function createGroup(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    redirectWithMessage("/friends", "Add a group name.");
  }

  const { data: group, error } = await supabase
    .from("career_groups")
    .insert({
      name,
      description: description || null,
      owner_id: user.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !group) {
    redirectWithMessage("/friends", error?.message ?? "Group could not be created. Run the groups SQL in Supabase first.");
  }

  const { error: memberError } = await supabase.from("career_group_members").insert({
    group_id: group.id,
    user_id: user.id,
    added_by: user.id,
  });

  if (memberError) {
    redirectWithMessage("/friends", memberError.message);
  }

  await awardXp({ supabase, userId: user.id, amount: pointValues.createGroup });
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  redirectWithMessage("/friends", "Group created. You earned 25 XP and 5 Reward Points.");
}

export async function addGroupMember(formData: FormData) {
  const { supabase, user } = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");
  const friendId = String(formData.get("friendId") ?? "");

  if (!groupId || !friendId) {
    redirectWithMessage("/friends", "Choose a group and friend.");
  }

  const { data: group, error: groupError } = await supabase
    .from("career_groups")
    .select("id, owner_id")
    .eq("id", groupId)
    .maybeSingle<{ id: string; owner_id: string }>();

  if (groupError || !group) {
    redirectWithMessage("/friends", "Group not found.");
  }

  const { data: currentMember } = await supabase
    .from("career_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();

  if (!currentMember) {
    redirectWithMessage("/friends", "Join the group before adding friends.");
  }

  const { data: friendship } = await supabase
    .from("friends")
    .select("id")
    .eq("status", "accepted")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`)
    .maybeSingle<{ id: string }>();

  if (!friendship) {
    redirectWithMessage("/friends", "You can only add accepted friends to a group.");
  }

  const { data: existing } = await supabase
    .from("career_group_members")
    .select("id")
    .eq("group_id", groupId)
    .eq("user_id", friendId)
    .maybeSingle<{ id: string }>();

  if (existing) {
    redirectWithMessage("/friends", "That friend is already in the group.");
  }

  const { error } = await supabase.from("career_group_members").insert({
    group_id: groupId,
    user_id: friendId,
    added_by: user.id,
  });

  if (error) {
    redirectWithMessage("/friends", error.message);
  }

  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  redirectWithMessage("/friends", "Friend added to group.");
}

export async function leaveGroup(formData: FormData) {
  const { supabase, user } = await requireUser();
  const groupId = String(formData.get("groupId") ?? "");

  if (!groupId) {
    redirectWithMessage("/friends", "Group not found.");
  }

  const { error } = await supabase.from("career_group_members").delete().eq("group_id", groupId).eq("user_id", user.id);

  if (error) {
    redirectWithMessage("/friends", error.message);
  }

  revalidatePath("/friends");
  revalidatePath("/leaderboard");
  redirectWithMessage("/friends", "You left the group.");
}
