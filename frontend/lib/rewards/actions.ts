"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rewardCatalog } from "@/lib/rewards/catalog";
import { assistantUser, AssistantError } from "@/lib/assistant/server";
import { rewardRpc } from "@/lib/rewards/server";

export async function unlockReward(formData: FormData) {
  const rewardId = String(formData.get("rewardId") ?? "");
  let message = "Reward not found.";
  const reward = rewardCatalog.find((item) => item.id === rewardId);
  if (reward) {
    try {
      const session = await assistantUser();
      await rewardRpc("redeem_careerup_reward", { p_user_id: session.user.id, p_reward_id: rewardId, p_request_key: crypto.randomUUID() });
      message = `${reward.title} is now in your library.`;
    } catch (error) { message = error instanceof AssistantError ? error.message : "This reward could not be unlocked. Please try again."; }
  }
  revalidatePath("/rewards"); revalidatePath("/dashboard");
  redirect(`/rewards?tab=library&message=${encodeURIComponent(message)}`);
}
