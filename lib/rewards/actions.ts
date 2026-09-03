"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rewardCatalog } from "@/lib/rewards/catalog";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function unlockReward(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/rewards", "Connect Supabase before unlocking rewards.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before unlocking rewards.");
  }

  const rewardId = String(formData.get("rewardId") ?? "");
  const reward = rewardCatalog.find((item) => item.id === rewardId);

  if (!reward) {
    redirectWithMessage("/rewards", "Reward not found.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<{ xp: number | null; reward_points?: number | null }>();

  if (profileError || !profile) {
    redirectWithMessage("/rewards", "Profile not found.");
  }

  const currentRewardPoints = profile.reward_points ?? profile.xp ?? 0;

  if (currentRewardPoints < reward.xpCost) {
    redirectWithMessage("/rewards", `You need ${reward.xpCost.toLocaleString()} Reward Points to unlock ${reward.title}.`);
  }

  const { data: existing } = await supabase
    .from("user_rewards")
    .select("id")
    .eq("user_id", user.id)
    .eq("reward_id", reward.id)
    .maybeSingle<{ id: string }>();

  if (existing) {
    redirectWithMessage("/rewards", "You already unlocked that reward.");
  }

  const { error: spendError } = await supabase
    .from("profiles")
    .update({ reward_points: currentRewardPoints - reward.xpCost })
    .eq("id", user.id);
  let usedLegacySpend = false;

  if (spendError) {
    const { error: fallbackSpendError } = await supabase
      .from("profiles")
      .update({ xp: Math.max(0, (profile.xp ?? 0) - reward.xpCost) })
      .eq("id", user.id);

    if (fallbackSpendError) {
      redirectWithMessage("/rewards", spendError.message);
    }

    usedLegacySpend = true;
  }

  const { error } = await supabase.from("user_rewards").insert({
    user_id: user.id,
    reward_id: reward.id
  });

  if (error) {
    if (usedLegacySpend) {
      await supabase
        .from("profiles")
        .update({ xp: profile.xp ?? 0 })
        .eq("id", user.id);
    } else {
      await supabase
        .from("profiles")
        .update({ reward_points: currentRewardPoints })
        .eq("id", user.id);
    }
    redirectWithMessage("/rewards", error.message);
  }

  revalidatePath("/rewards");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  redirectWithMessage("/rewards", `${reward.title} unlocked for ${reward.xpCost.toLocaleString()} Reward Points.`);
}
