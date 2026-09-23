import { getRank, ranks } from "@/lib/rank";
import { getDateKeyStartUtcIso, getTodayKey } from "@/lib/streak";
import type { ApplicationStatus } from "@/lib/types";
import type { getSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServer = NonNullable<ReturnType<typeof getSupabaseServerClient>>;

export const pointValues = {
  saveRole: 5,
  applyRole: 20,
  interviewStage: 15,
  offerStage: 50,
  completeProfile: 30,
  uploadResume: 40,
  sendFriendRequest: 10,
  acceptFriendRequest: 15,
  createGroup: 25,
  sendMessage: 10,
} as const;

export function getRewardPointsForXp(amount: number) {
  const safeAmount = Math.max(0, Math.round(amount));
  return safeAmount === 0 ? 0 : Math.max(1, Math.round(safeAmount * 0.2));
}

export const rankBonuses = [
  { rankName: "Manager", legacyNames: ["Active Applicant", "Silver Strategist"], xp: 50 },
  { rankName: "Director", legacyNames: ["Qualified Candidate", "Gold Climber"], xp: 100 },
  { rankName: "Vice President", legacyNames: ["Interview Ready", "Platinum Candidate"], xp: 175 },
  { rankName: "CEO", legacyNames: ["Offer Ready", "Elite Intern"], xp: 300 },
] as const;

type DbChallenge = {
  id: string;
  title: string;
  xp_reward: number;
  target: number;
};

function isDailyChallenge(title: string) {
  return title.toLowerCase().includes("daily");
}

function getNewlyReachedRankNames(previousXp: number, nextXp: number, alreadyAwarded: string[]) {
  const alreadyAwardedSet = new Set(alreadyAwarded);
  return ranks
    .filter((rank) => {
      const bonus = rankBonuses.find((item) => item.rankName === rank.name);
      const bonusAlreadyAwarded = Boolean(bonus && [bonus.rankName, ...bonus.legacyNames].some((name) => alreadyAwardedSet.has(name)));

      return rank.minXp > 0 && previousXp < rank.minXp && nextXp >= rank.minXp && !bonusAlreadyAwarded;
    })
    .map((rank) => rank.name);
}

export async function awardXp({
  supabase,
  userId,
  amount,
  rewardPoints,
}: {
  supabase: SupabaseServer;
  userId: string;
  amount: number;
  rewardPoints?: number;
}) {
  const safeAmount = Math.max(0, Math.round(amount));
  const safeRewardPoints = Math.max(0, Math.round(rewardPoints ?? getRewardPointsForXp(safeAmount)));

  if (safeAmount === 0) {
    return { awarded: 0, rankBonus: 0, reachedRanks: [] as string[] };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single<{ xp: number | null; total_xp?: number | null; reward_points?: number | null; rank_bonus_awarded?: string[] | null }>();

  if (error || !profile) {
    await supabase.rpc("award_xp", { amount: safeAmount });
    return { awarded: safeAmount, rankBonus: 0, reachedRanks: [] as string[] };
  }

  const previousPermanentXp = Math.max(profile.xp ?? 0, profile.total_xp ?? profile.xp ?? 0);
  const previousRewardPoints = profile.reward_points ?? profile.xp ?? 0;
  const rankBonusAwarded = profile.rank_bonus_awarded ?? [];
  const reachedRanks = getNewlyReachedRankNames(previousPermanentXp, previousPermanentXp + safeAmount, rankBonusAwarded);
  const rankBonus = reachedRanks.reduce((sum, rankName) => sum + (rankBonuses.find((bonus) => bonus.rankName === rankName)?.xp ?? 0), 0);
  const rankBonusRewardPoints = getRewardPointsForXp(rankBonus);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      xp: previousPermanentXp + safeAmount + rankBonus,
      total_xp: previousPermanentXp + safeAmount + rankBonus,
      reward_points: previousRewardPoints + safeRewardPoints + rankBonusRewardPoints,
      rank_bonus_awarded: Array.from(new Set([...rankBonusAwarded, ...reachedRanks])),
    })
    .eq("id", userId);

  if (updateError) {
    await supabase
      .from("profiles")
      .update({
        xp: previousPermanentXp + safeAmount + rankBonus,
        total_xp: previousPermanentXp + safeAmount + rankBonus,
        rank_bonus_awarded: Array.from(new Set([...rankBonusAwarded, ...reachedRanks])),
      })
      .eq("id", userId);
  }

  return { awarded: safeAmount, rankBonus, reachedRanks };
}

async function countApplications(supabase: SupabaseServer, userId: string, status?: ApplicationStatus, sinceToday = false) {
  let query = supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", userId);

  if (status) {
    query = query.eq("status", status);
  }

  if (sinceToday) {
    query = query.gte("updated_at", getDateKeyStartUtcIso());
  }

  const { count } = await query;
  return count ?? 0;
}

async function getChallengeProgress(supabase: SupabaseServer, userId: string, title: string) {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("daily apply")) return countApplications(supabase, userId, "applied", true);
  if (lowerTitle.includes("two-a-day") || lowerTitle.includes("apply duo")) return countApplications(supabase, userId, "applied", true);
  if (lowerTitle.includes("save") || lowerTitle.includes("watchlist")) return countApplications(supabase, userId, "saved");
  if (lowerTitle.includes("pipeline")) return countApplications(supabase, userId);
  if (lowerTitle.includes("interview")) return countApplications(supabase, userId, "interviewing");
  if (lowerTitle.includes("offer")) return countApplications(supabase, userId, "offer");

  if (lowerTitle.includes("resume")) {
    const { data } = await supabase.from("profiles").select("resume_file_name").eq("id", userId).single<{ resume_file_name: string | null }>();
    return data?.resume_file_name ? 1 : 0;
  }

  if (lowerTitle.includes("profile")) {
    const { data } = await supabase
      .from("profiles")
      .select("school, major, graduation_year, target_roles, target_locations, resume_keywords")
      .eq("id", userId)
      .single<{
        school: string | null;
        major: string | null;
        graduation_year: string | null;
        target_roles: string[] | null;
        target_locations: string[] | null;
        resume_keywords: string[] | null;
      }>();

    return [data?.school, data?.major, data?.graduation_year, data?.target_roles?.length, data?.target_locations?.length, data?.resume_keywords?.length].filter(Boolean).length;
  }

  if (lowerTitle.includes("friend")) {
    const { count } = await supabase
      .from("friends")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    return count ?? 0;
  }

  if (lowerTitle.includes("group")) {
    const { count } = await supabase.from("career_group_members").select("id", { count: "exact", head: true }).eq("user_id", userId);
    return count ?? 0;
  }

  if (lowerTitle.includes("message")) {
    const { count } = await supabase.from("peer_messages").select("id", { count: "exact", head: true }).eq("sender_id", userId);
    return count ?? 0;
  }

  return 0;
}

export async function awardEligibleChallenges(supabase: SupabaseServer, userId: string) {
  const today = getTodayKey();
  const { data: challenges, error } = await supabase.from("challenges").select("id, title, xp_reward, target").eq("active", true).returns<DbChallenge[]>();

  if (error || !challenges?.length) {
    return [];
  }

  const { data: completed } = await supabase.from("completed_challenges").select("challenge_id, completed_on").eq("user_id", userId);
  const completedAny = new Set((completed ?? []).map((challenge) => challenge.challenge_id));
  const completedToday = new Set((completed ?? []).filter((challenge) => challenge.completed_on === today).map((challenge) => challenge.challenge_id));
  const newlyCompleted: string[] = [];

  for (const challenge of challenges) {
    const daily = isDailyChallenge(challenge.title);
    if ((daily && completedToday.has(challenge.id)) || (!daily && completedAny.has(challenge.id))) {
      continue;
    }

    const progress = await getChallengeProgress(supabase, userId, challenge.title);
    if (progress < challenge.target) {
      continue;
    }

    const { error: insertError } = await supabase.from("completed_challenges").insert({
      user_id: userId,
      challenge_id: challenge.id,
      completed_on: today,
    });

    if (!insertError) {
      await awardXp({ supabase, userId, amount: challenge.xp_reward });
      newlyCompleted.push(challenge.title);
    }
  }

  return newlyCompleted;
}

export function getRankBonusForDisplay(rankName: string) {
  return rankBonuses.find((bonus) => bonus.rankName === rankName)?.xp ?? 0;
}

function isRankBonusAwarded(bonus: (typeof rankBonuses)[number], awarded: string[]) {
  return [bonus.rankName, ...bonus.legacyNames].some((name) => awarded.includes(name));
}

export function getCurrentRankBonusStatus(xp: number, awarded: string[]) {
  const currentRank = getRank(xp);
  return rankBonuses.map((bonus) => ({
    ...bonus,
    reached: currentRank.name === bonus.rankName || ranks.find((rank) => rank.name === currentRank.name)!.minXp >= ranks.find((rank) => rank.name === bonus.rankName)!.minXp,
    awarded: isRankBonusAwarded(bonus, awarded),
  }));
}
