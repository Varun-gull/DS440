import { ProviderCapacityError, withQueuedProviderRequest } from "@/lib/assistant/provider-pacing";
import "server-only";
import { GoogleGenAI } from "@google/genai";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  assistantConfig,
  assistantContext,
  assistantUser,
  AssistantError,
} from "@/lib/assistant/server";
import { buildAssistantInstructions } from "@/lib/assistant/core";
import { geminiFailure } from "@/lib/assistant/provider-errors";
import { rewardCatalog } from "./catalog";
import { parseRewardArtifact } from "./artifacts";
import {
  rewardById,
  type RewardsState,
  type RewardPreferences,
  type RewardInsights,
  type Redemption,
} from "./store";
import { getTodayKey } from "@/lib/streak";
import { cache } from "react";

export type RewardSession = Awaited<ReturnType<typeof assistantUser>>;
export function rewardsAdmin() {
  const admin = getSupabaseAdminClient();
  if (!admin)
    throw new AssistantError(
      "Rewards are temporarily unavailable. Please try again later.",
      503,
    );
  return admin;
}
export async function rewardRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await rewardsAdmin().rpc(name, args);
  if (error)
    throw new AssistantError(
      error.code === "P0001"
        ? error.message
        : error.code === "23505"
          ? "This action was already completed. Refresh to see your rewards."
          : "Your rewards could not be updated. Please refresh and try again.",
      error.code === "P0001" || error.code === "23505" ? 409 : 503,
    );
  return data;
}
export async function rewardAppearance(
  userId: string,
): Promise<RewardPreferences> {
  const { data } = await rewardsAdmin()
    .from("reward_preferences")
    .select("theme,avatar,badge")
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? { theme: "ocean", avatar: "initials", badge: "" };
}
export async function rewardState(
  session: RewardSession,
): Promise<RewardsState> {
  const admin = rewardsAdmin(),
    uid = session.user.id;
  const [
    wallet,
    profile,
    redemptions,
    ledger,
    preferences,
    shields,
    friendships,
    goalMemberships,
    poolMemberships,
    legacy,
  ] = await Promise.all([
    admin
      .from("reward_wallets")
      .select("balance,earned_total,spent_total")
      .eq("user_id", uid)
      .single(),
    admin
      .from("profiles")
      .select("full_name,xp,total_xp,applications_applied,resume_text")
      .eq("id", uid)
      .single(),
    admin
      .from("reward_redemptions")
      .select("id,reward_id,cost,status,created_at,details")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(250),
    admin
      .from("reward_ledger")
      .select("id,delta,balance_after,kind,reason,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(60),
    rewardAppearance(uid),
    admin
      .from("reward_streak_days")
      .select("protected_on")
      .eq("user_id", uid)
      .gte(
        "protected_on",
        new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
      ),
    admin
      .from("friends")
      .select("requester_id,addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
    admin
      .from("reward_goal_members")
      .select("goal_id")
      .eq("user_id", uid)
      .neq("state", "declined"),
    admin.from("reward_pool_members").select("pool_id").eq("user_id", uid),
    admin.from("user_rewards").select("reward_id").eq("user_id", uid),
  ]);
  if (
    wallet.error ||
    profile.error ||
    redemptions.error ||
    ledger.error ||
    friendships.error ||
    goalMemberships.error ||
    poolMemberships.error
  )
    throw new AssistantError(
      "Your rewards could not be loaded. Please try again shortly.",
      503,
    );
  const goalIds = (goalMemberships.data ?? []).map((m) => m.goal_id),
    poolIds = (poolMemberships.data ?? []).map((m) => m.pool_id);
  const [goals, goalMembers, pools, poolMembers] = await Promise.all([
    goalIds.length
      ? admin
          .from("reward_friend_goals")
          .select("*")
          .in("id", goalIds)
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [] },
    goalIds.length
      ? admin.from("reward_goal_members").select("*").in("goal_id", goalIds)
      : { data: [] },
    poolIds.length
      ? admin
          .from("reward_pools")
          .select("*")
          .in("id", poolIds)
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [] },
    poolIds.length
      ? admin.from("reward_pool_members").select("*").in("pool_id", poolIds)
      : { data: [] },
  ]);
  const friendIds = (friendships.data ?? []).map((f) =>
    f.requester_id === uid ? f.addressee_id : f.requester_id,
  );
  const namesIds = [
    ...new Set([
      ...friendIds,
      ...(goalMembers.data ?? []).map((m) => m.user_id),
      ...(poolMembers.data ?? []).map((m) => m.user_id),
    ]),
  ];
  const names = namesIds.length
    ? await admin.from("profiles").select("id,full_name").in("id", namesIds)
    : { data: [] };
  const nameMap = new Map<string, string>(
    (names.data ?? []).map((p) => [p.id, p.full_name || "CareerUp friend"]),
  );
  const goalsWithProgress: RewardsState["goals"] = [];
  for (const goal of goals.data ?? []) {
    const members = await Promise.all(
      (goalMembers.data ?? [])
        .filter((m) => m.goal_id === goal.id)
        .map(async (member) => {
          // Invitation does not expose another person's activity before they join.
          const activity =
            member.state === "accepted" && member.joined_at
              ? await admin
                  .from("reward_activity")
                  .select("id", { count: "exact", head: true })
                  .eq("user_id", member.user_id)
                  .eq("kind", goal.metric)
                  .gte("happened_at", member.joined_at)
                  .lte("happened_at", goal.ends_at)
              : { count: 0 };
          return {
            userId: member.user_id,
            name:
              member.user_id === uid
                ? "You"
                : nameMap.get(member.user_id) || "CareerUp friend",
            state: member.state,
            progress: activity.count ?? 0,
            contribution: 0,
          };
        }),
    );
    goalsWithProgress.push({
      id: goal.id,
      title: goal.title,
      metric: goal.metric,
      target: goal.target,
      endsAt: goal.ends_at,
      ownerId: goal.owner_id,
      state: members.find((m) => m.userId === uid)?.state ?? "invited",
      members,
    });
  }
  const [permanent, credits] = await Promise.all([
    admin
      .from("reward_redemptions")
      .select("id,reward_id,cost,status,created_at,details")
      .eq("user_id", uid)
      .in("reward_id", ["career-insights", "profile-studio"])
      .eq("status", "ready"),
    admin
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("reward_id", "extra-voice-session")
      .eq("status", "available"),
  ]);
  const indexed = new Map(
    [...(redemptions.data ?? []), ...(permanent.data ?? [])].map((r) => [
      r.id,
      r,
    ]),
  );
  const owned = [...indexed.values()].map((r) => ({
    ...r,
    content: null,
    hasContent:
      [
        "deep-resume-review",
        "personal-interview-pack",
        "personal-skill-challenge",
      ].includes(r.reward_id) && ["ready", "used"].includes(r.status),
  })) as Redemption[];
  const hasInsights = owned.some(
    (r) => r.reward_id === "career-insights" && r.status === "ready",
  );
  let insights: RewardInsights | null = null;
  if (hasInsights)
    insights = await rewardRpc("get_reward_insights", { p_user_id: uid });
  const legacyIds = new Set((legacy.data ?? []).map((r) => r.reward_id));
  return {
    userId: uid,
    name: profile.data?.full_name || "Student",
    xp: Math.max(profile.data?.xp ?? 0, profile.data?.total_xp ?? 0),
    applicationsApplied: profile.data?.applications_applied ?? 0,
    balance: wallet.data!.balance,
    earned: wallet.data!.earned_total,
    spent: wallet.data!.spent_total,
    voiceCredits: credits.count ?? 0,
    shieldDays: (shields.data ?? []).map((s) => s.protected_on),
    hasResume: Boolean(profile.data?.resume_text?.trim()),
    aiConfigured: assistantConfig().configured,
    preferences,
    redemptions: owned,
    ledger: ledger.data ?? [],
    friends: friendIds.map((id) => ({
      id,
      name: nameMap.get(id) || "CareerUp friend",
    })),
    goals: goalsWithProgress,
    pools: (pools.data ?? []).map((pool) => ({
      id: pool.id,
      title: pool.title,
      target: pool.target,
      raised: pool.raised,
      endsAt: pool.ends_at,
      ownerId: pool.owner_id,
      status: pool.status,
      members: (poolMembers.data ?? [])
        .filter((m) => m.pool_id === pool.id)
        .map((m) => ({
          userId: m.user_id,
          name:
            m.user_id === uid
              ? "You"
              : nameMap.get(m.user_id) || "CareerUp friend",
          state: m.state,
          contribution: m.contribution,
          progress: 0,
        })),
    })),
    insights,
    legacy: rewardCatalog
      .filter((r) => legacyIds.has(r.id))
      .map((r) => ({ id: r.id, title: r.title, contents: r.contents })),
  };
}

const artifactSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["title", "items"],
      },
    },
  },
  required: ["title", "summary", "sections"],
};
export async function generateReward(
  session: RewardSession,
  body: Record<string, unknown>,
  redemptionId: string,
) {
  if (body.consent !== true)
    throw new AssistantError(
      "Approve sharing the selected context with Google and saving the generated report first.",
    );
  const { data: redemption } = await rewardsAdmin()
    .from("reward_redemptions")
    .select("reward_id")
    .eq("id", redemptionId)
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (!redemption) throw new AssistantError("Reward not found.", 404);
  const definition = rewardById(redemption.reward_id);
  if (
    !definition ||
    !["resume", "interview", "skill"].includes(definition.kind)
  )
    throw new AssistantError("Choose a preparation reward.");
  if (
    body.skillFocus !== undefined &&
    (typeof body.skillFocus !== "string" || body.skillFocus.length > 100)
  )
    throw new AssistantError("Keep the skill focus under 100 characters.");
  const context = await assistantContext(session, body);
  if (!context.job || context.job.description.trim().length < 80)
    throw new AssistantError(
      "Add the actual job description, at least 80 characters, for useful guidance.",
    );
  if (definition.kind === "resume" && !context.resumeText)
    throw new AssistantError(
      "Save a resume on your profile and enable resume context for this review.",
    );
  if (!assistantConfig().configured)
    throw new AssistantError(
      "Gemini is not configured. Your reward will stay unused.",
      503,
    );
  const generationKey = await rewardRpc("begin_reward_generation", {
    p_user_id: session.user.id,
    p_redemption_id: redemptionId,
  });
  const tasks: Record<string, string> = {
    resume:
      "Create a detailed resume review. Use four sections: Confirmed strengths with exact resume evidence; Requirements needing clearer evidence; Truthful bullet improvements quoting original bullets and suggested edits; A prioritized action checklist. Distinguish absent evidence from absent ability. Never invent numbers or experience.",
    interview:
      "Create a personal interview preparation pack. Use four sections: Three technical or role specific questions; Three behavioral questions; Follow up questions and what a strong truthful answer should demonstrate; A short preparation plan. Base company references only on the provided description; do not claim to verify current company news.",
    skill:
      "Create one achievable skill exercise addressing a relevant gap or job skill. Use four sections: Goal and why it matters; Concrete steps and a 30 to 60 minute timebox; Deliverables the student can produce using freely available tools; Self assessment criteria and reflection questions. Keep scope feasible. Do not claim exercise completion proves professional competence.",
  };
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!.trim(),
      httpOptions: { apiVersion: "v1beta", timeout: 35000 },
    });
    let response;
    try {
      response = await withQueuedProviderRequest(assistantConfig().model, async () => {
        const { data: active, error: sessionError } = await session.supabase.rpc("careerup_session_valid");
        if (sessionError || active !== true) throw new AssistantError("Your session expired. Sign in again.", 401);
      }, () => ai.models.generateContent({
        model: assistantConfig().model,
        contents: `${tasks[definition.kind]} Student skill focus, if provided: ${JSON.stringify(body.skillFocus || "Choose a relevant skill from the provided context")}. Keep the report practical and under 700 words. Each array item is one unnumbered plain text point; do not add bullet markers, numbering, or markdown.`,
        config: {
          systemInstruction: buildAssistantInstructions(context),
          responseMimeType: "application/json",
          responseJsonSchema: artifactSchema,
          maxOutputTokens: 2500,
          temperature: 0.3,
        },
      }), 35000);
    } catch (error) {
      if (error instanceof AssistantError) throw error;
      if (error instanceof ProviderCapacityError) throw new AssistantError(error.message, error.status);
      const failure = geminiFailure(error);
      throw new AssistantError(failure.message, failure.status);
    }
    let report;
    try {
      report = parseRewardArtifact(JSON.parse(response.text || "null"));
    } catch {
      throw new AssistantError(
        "The AI report was incomplete. Your reward is still available; please try again.",
        502,
      );
    }
    const saved = await rewardRpc("finish_reward_generation", {
      p_user_id: session.user.id,
      p_redemption_id: redemptionId,
      p_key: generationKey,
      p_content: report,
    });
    if (!saved)
      throw new AssistantError(
        "This report could not be saved. Refresh your library before retrying.",
        409,
      );
  } catch (error) {
    await rewardsAdmin().rpc("finish_reward_generation", {
      p_user_id: session.user.id,
      p_redemption_id: redemptionId,
      p_key: generationKey,
      p_content: null,
    });
    throw error;
  }
}

export const rewardsSnapshot = cache(async (userId: string) => {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const [wallet, days, preferences] = await Promise.all([
    admin
      .from("reward_wallets")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("reward_streak_days")
      .select("protected_on")
      .eq("user_id", userId)
      .gte(
        "protected_on",
        new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
      ),
    admin
      .from("reward_preferences")
      .select("theme,avatar,badge")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return {
    balance: wallet.data?.balance,
    protectedDays: (days.data ?? []).map((d) => d.protected_on),
    customized: Boolean(preferences.data),
    preferences: (preferences.data ?? {
      theme: "ocean",
      avatar: "initials",
      badge: "",
    }) as RewardPreferences,
    today: getTodayKey(),
  };
});

// Dates stay on the server. Other students only receive the visible streak count.
export async function rewardProtectionForUsers(ids: string[]) {
  const result = new Map<string, string[]>(),
    admin = getSupabaseAdminClient();
  if (!ids.length || !admin) return result;
  const { data } = await admin
    .from("reward_streak_days")
    .select("user_id,protected_on")
    .in("user_id", [...new Set(ids)])
    .gte(
      "protected_on",
      new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10),
    );
  for (const row of data ?? [])
    result.set(row.user_id, [
      ...(result.get(row.user_id) ?? []),
      row.protected_on,
    ]);
  return result;
}
