"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildRoleKey } from "@/lib/role-key";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { getDateKeyStartUtcIso, getNextStreak, getTodayKey, isBrokenStreak } from "@/lib/streak";
import type { ApplicationStatus } from "@/lib/types";

function redirectWithMessage(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}message=${encodeURIComponent(message)}`);
}

function getSafePostingsReturnTo(value: FormDataEntryValue | null) {
  const returnTo = String(value ?? "");

  if (returnTo.startsWith("/postings/internships") || returnTo.startsWith("/postings/new-grad")) {
    return returnTo;
  }

  return "/postings/internships";
}

const validStatuses: ApplicationStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];
const PAID_STREAK_REVIVE_COST = 50;
const DAILY_APPLY_CHALLENGE_TITLE = "Daily Apply Sprint";

async function countApplicationsAppliedToday(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, userId: string) {
  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "applied")
    .gte("updated_at", getDateKeyStartUtcIso());

  return count ?? 0;
}

async function updateAppliedStreakAndStats({
  supabase,
  userId,
}: {
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>;
  userId: string;
}) {
  const { data: profile, error: loadError } = await supabase
    .from("profiles")
    .select(
      "xp, streak_count, applications_applied, last_applied_on, streak_free_revive_used, streak_paid_revives, streak_revive_started_on, streak_revive_base_count, streak_revive_required_applications"
    )
    .eq("id", userId)
    .single<{
      xp: number | null;
      streak_count: number | null;
      applications_applied: number | null;
      last_applied_on: string | null;
      streak_free_revive_used: boolean | null;
      streak_paid_revives: number | null;
      streak_revive_started_on: string | null;
      streak_revive_base_count: number | null;
      streak_revive_required_applications: number | null;
    }>();

  if (loadError) {
    return loadError;
  }

  const todayKey = getTodayKey();
  const currentStreak = profile?.streak_count ?? 0;
  const lastAppliedOn = profile?.last_applied_on ?? null;
  const freeReviveUsed = profile?.streak_free_revive_used ?? false;
  const paidRevives = profile?.streak_paid_revives ?? 0;
  const applicationsAppliedToday = await countApplicationsAppliedToday(supabase, userId);
  const inProgressReviveStartedToday = profile?.streak_revive_started_on === todayKey;
  const missedStreak = isBrokenStreak(lastAppliedOn, currentStreak) || inProgressReviveStartedToday;
  const updates: Record<string, string | number | boolean | null> = {
    applications_applied: (profile?.applications_applied ?? 0) + 1,
    last_applied_on: todayKey,
  };

  if (!missedStreak) {
    updates.streak_count = getNextStreak(lastAppliedOn, currentStreak);
    updates.streak_revive_started_on = null;
    updates.streak_revive_base_count = null;
    updates.streak_revive_required_applications = null;
  } else if (!freeReviveUsed) {
    updates.streak_count = currentStreak + 1;
    updates.streak_free_revive_used = true;
    updates.streak_revive_started_on = null;
    updates.streak_revive_base_count = null;
    updates.streak_revive_required_applications = null;
  } else if (paidRevives > 0) {
    const reviveBaseCount = inProgressReviveStartedToday ? profile?.streak_revive_base_count ?? currentStreak : currentStreak;
    const requiredApplications = inProgressReviveStartedToday ? profile?.streak_revive_required_applications ?? 2 : 2;

    if (applicationsAppliedToday >= requiredApplications) {
      updates.streak_count = reviveBaseCount + 1;
      updates.streak_paid_revives = Math.max(0, paidRevives - 1);
      updates.streak_revive_started_on = null;
      updates.streak_revive_base_count = null;
      updates.streak_revive_required_applications = null;
    } else {
      updates.streak_count = 1;
      updates.streak_revive_started_on = todayKey;
      updates.streak_revive_base_count = reviveBaseCount;
      updates.streak_revive_required_applications = requiredApplications;
    }
  } else {
    updates.streak_count = 1;
    updates.streak_revive_started_on = null;
    updates.streak_revive_base_count = null;
    updates.streak_revive_required_applications = null;
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
  return error;
}

async function awardDailyApplyChallenge(supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>, userId: string) {
  const today = getTodayKey();
  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, xp_reward")
    .eq("title", DAILY_APPLY_CHALLENGE_TITLE)
    .eq("active", true)
    .maybeSingle<{ id: string; xp_reward: number }>();

  if (!challenge) {
    return;
  }

  const { data: existing } = await supabase
    .from("completed_challenges")
    .select("id")
    .eq("user_id", userId)
    .eq("challenge_id", challenge.id)
    .eq("completed_on", today)
    .maybeSingle<{ id: string }>();

  if (existing) {
    return;
  }

  const { error: insertError } = await supabase.from("completed_challenges").insert({
    user_id: userId,
    challenge_id: challenge.id,
    completed_on: today
  });

  if (!insertError) {
    await awardXp({ supabase, userId, amount: challenge.xp_reward });
  }
}

export async function createApplication(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/applications/new", "Connect Supabase before saving real applications.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before saving an application.");
  }

  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim() || null;

  if (!company || !role) {
    redirectWithMessage("/applications/new", "Company and role are required.");
  }

  const insertPayload = {
    user_id: user.id,
    company,
    role,
    role_key: buildRoleKey(company, role),
    application_year: new Date().getFullYear(),
    location: location || null,
    source_url: sourceUrl || null,
    deadline,
    status: "saved",
    xp_awarded: pointValues.saveRole
  };

  let { error } = await supabase.from("applications").insert(insertPayload);

  if (error && /role_key|application_year/i.test(error.message)) {
    const { role_key, application_year, ...legacyPayload } = insertPayload;
    const retry = await supabase.from("applications").insert(legacyPayload);
    error = retry.error;
  }

  if (error) {
    redirectWithMessage("/applications/new", error.message);
  }

  await awardXp({ supabase, userId: user.id, amount: pointValues.saveRole });
  await awardEligibleChallenges(supabase, user.id);

  const { data: newApp } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("company", company)
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (newApp) {
    const today = getTodayKey();
    const calEvents = [{ user_id: user.id, application_id: newApp.id, company, role, status: "saved", event_type: "submitted", date: today }];
    if (deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      calEvents.push({ user_id: user.id, application_id: newApp.id, company, role, status: "saved", event_type: "deadline", date: deadline });
    }
    await supabase.from("calendar_events").insert(calEvents);
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath("/calendar");
  redirect("/applications");
}

export async function createApplicationFromCalendar({
  company, role, status, deadline,
}: {
  company: string; role: string; status: ApplicationStatus; deadline: string | null;
}): Promise<{ error?: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { error: "Connect Supabase to save applications." };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Log in to save applications." };

  const submittedFromCalendar = status === "applied" || status === "interviewing" || status === "offer";
  const calendarXpBonus =
    pointValues.saveRole +
    (submittedFromCalendar ? pointValues.applyRole : 0) +
    (status === "interviewing" || status === "offer" ? pointValues.interviewStage : 0) +
    (status === "offer" ? pointValues.offerStage : 0);

  const { error } = await supabase.from("applications").insert({
    user_id: user.id,
    company,
    role,
    deadline: deadline || null,
    status,
    xp_awarded: calendarXpBonus,
  });

  if (error) return { error: error.message };

  if (submittedFromCalendar) {
    const profileError = await updateAppliedStreakAndStats({ supabase, userId: user.id });
    if (profileError) return { error: profileError.message };
  }

  await awardXp({ supabase, userId: user.id, amount: calendarXpBonus });
  await awardEligibleChallenges(supabase, user.id);

  const { data: newApp } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("company", company)
    .eq("role", role)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (newApp) {
    const today = getTodayKey();
    const calEvents: object[] = [
      { user_id: user.id, application_id: newApp.id, company, role, status, event_type: "submitted", date: today },
    ];
    if (deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      calEvents.push({ user_id: user.id, application_id: newApp.id, company, role, status, event_type: "deadline", date: deadline });
    }
    await supabase.from("calendar_events").insert(calEvents);
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return {};
}

export async function savePostingApplication(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/postings", "Connect Supabase before saving postings.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before saving a posting.");
  }

  const company = String(formData.get("company") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const fitScore = Number(formData.get("fitScore") ?? 75);
  const requestedStatus = String(formData.get("status") ?? "saved");
  const status: ApplicationStatus = requestedStatus === "applied" ? "applied" : "saved";
  const returnTo = getSafePostingsReturnTo(formData.get("returnTo"));

  if (!company || !role || !sourceUrl) {
    redirectWithMessage(returnTo, "This posting is missing required details.");
  }

  const { data: existing } = await supabase
    .from("applications")
    .select("id, status, xp_awarded")
    .eq("user_id", user.id)
    .eq("source_url", sourceUrl)
    .maybeSingle<{ id: string; status: ApplicationStatus; xp_awarded: number | null }>();

  if (existing) {
    if (status === "applied" && existing.status === "saved") {
      const updatedXpAwarded = (existing.xp_awarded ?? pointValues.saveRole) + pointValues.applyRole;
      const { error: updateError } = await supabase
        .from("applications")
        .update({ status: "applied", xp_awarded: updatedXpAwarded })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (updateError) {
        redirectWithMessage(returnTo, updateError.message);
      }

      const profileError = await updateAppliedStreakAndStats({ supabase, userId: user.id });
      if (profileError) {
        redirectWithMessage(returnTo, profileError.message);
      }

      await awardXp({ supabase, userId: user.id, amount: pointValues.applyRole });
      await awardEligibleChallenges(supabase, user.id);

      revalidatePath("/applications");
      revalidatePath("/dashboard");
      revalidatePath("/leaderboard");
      revalidatePath("/profile");
      revalidatePath("/calendar");
      revalidatePath("/postings");
      revalidatePath("/postings/internships");
      revalidatePath("/postings/new-grad");
      redirectWithMessage(returnTo, "Nice. That role is now marked as applied.");
    }

    redirectWithMessage(returnTo, "That posting is already in your tracker.");
  }

  const xpAwarded = pointValues.saveRole + (status === "applied" ? pointValues.applyRole : 0);

  const insertPayload = {
    user_id: user.id,
    company,
    role,
    role_key: buildRoleKey(company, role),
    application_year: new Date().getFullYear(),
    location: location || null,
    source_url: sourceUrl,
    fit_score: Number.isFinite(fitScore) ? Math.min(100, Math.max(0, fitScore)) : 75,
    status,
    xp_awarded: xpAwarded
  };

  let { error } = await supabase.from("applications").insert(insertPayload);

  if (error && /role_key|application_year/i.test(error.message)) {
    const { role_key, application_year, ...legacyPayload } = insertPayload;
    const retry = await supabase.from("applications").insert(legacyPayload);
    error = retry.error;
  }

  if (error) {
    redirectWithMessage(returnTo, error.message);
  }

  if (status === "applied") {
    const profileError = await updateAppliedStreakAndStats({ supabase, userId: user.id });
    if (profileError) {
      redirectWithMessage(returnTo, profileError.message);
    }
  }

  await awardXp({ supabase, userId: user.id, amount: xpAwarded });
  await awardEligibleChallenges(supabase, user.id);

  const { data: newApp } = await supabase
    .from("applications")
    .select("id")
    .eq("user_id", user.id)
    .eq("source_url", sourceUrl)
    .maybeSingle<{ id: string }>();

  if (newApp) {
    const today = getTodayKey();
    await supabase.from("calendar_events").insert({
      user_id: user.id,
      application_id: newApp.id,
      company,
      role,
      status,
      event_type: "submitted",
      date: today,
    });
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath("/calendar");
  revalidatePath("/postings");
  revalidatePath("/postings/internships");
  revalidatePath("/postings/new-grad");
  redirectWithMessage(returnTo, status === "applied" ? "Nice. That role was added as applied." : "Posting saved to your tracker. You earned 5 XP and 1 Reward Point.");
}

export async function updateApplicationStatus(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/applications", "Connect Supabase before updating applications.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before updating an application.");
  }

  const applicationId = String(formData.get("applicationId") ?? "");
  const nextStatus = String(formData.get("status") ?? "") as ApplicationStatus;

  if (!applicationId || !validStatuses.includes(nextStatus)) {
    redirectWithMessage("/applications", "Choose a valid application status.");
  }

  const { data: application, error: loadError } = await supabase
    .from("applications")
    .select("id, status, xp_awarded, company, role")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single<{ id: string; status: ApplicationStatus; xp_awarded: number | null; company: string; role: string }>();

  if (loadError || !application) {
    redirectWithMessage("/applications", "Application not found.");
  }

  const nextIsSubmitted = nextStatus === "applied" || nextStatus === "interviewing" || nextStatus === "offer";
  const wasSubmitted = application.status === "applied" || application.status === "interviewing" || application.status === "offer";
  const applyingForFirstTime = !wasSubmitted && nextIsSubmitted;
  const enteringInterview = application.status !== "interviewing" && nextStatus === "interviewing";
  const enteringOffer = application.status !== "offer" && nextStatus === "offer";
  const xpBonus =
    (applyingForFirstTime ? pointValues.applyRole : 0) +
    (enteringInterview ? pointValues.interviewStage : 0) +
    (enteringOffer ? pointValues.offerStage : 0);

  const { error: updateError } = await supabase
    .from("applications")
    .update({
      status: nextStatus,
      xp_awarded: (application.xp_awarded ?? 0) + xpBonus
    })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  if (updateError) {
    redirectWithMessage("/applications", updateError.message);
  }

  if (applyingForFirstTime) {
    const profileError = await updateAppliedStreakAndStats({ supabase, userId: user.id });

    if (profileError) {
      redirectWithMessage("/applications", profileError.message);
    }

    await awardDailyApplyChallenge(supabase, user.id);
  }

  if (xpBonus > 0) {
    await awardXp({ supabase, userId: user.id, amount: xpBonus });
    await awardEligibleChallenges(supabase, user.id);
  }

  if (applyingForFirstTime) {
    const today = getTodayKey();
    await supabase.from("calendar_events").insert({
      user_id: user.id,
      application_id: applicationId,
      company: application.company,
      role: application.role,
      status: nextStatus,
      event_type: "submitted",
      date: today,
    });
  }

  if (nextStatus === "offer" && application.status !== "offer") {
    const today = getTodayKey();
    await supabase.from("calendar_events").insert({
      user_id: user.id,
      application_id: applicationId,
      company: application.company,
      role: application.role,
      status: "offer",
      event_type: "offer",
      date: today,
    });
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/profile");
  revalidatePath("/calendar");
  revalidatePath("/rewards");
}

export async function deleteApplication(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/applications", "Connect Supabase before deleting applications.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before deleting an application.");
  }

  const applicationId = String(formData.get("applicationId") ?? "");

  if (!applicationId) {
    redirectWithMessage("/applications", "Application not found.");
  }

  const { error } = await supabase.from("applications").delete().eq("id", applicationId).eq("user_id", user.id);

  if (error) {
    redirectWithMessage("/applications", error.message);
  }

  revalidatePath("/applications");
  revalidatePath("/dashboard");
}

export async function unlockStreakRevive() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/dashboard", "Connect Supabase before unlocking streak revives.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before unlocking a streak revive.");
  }

  const { data: profile, error: loadError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<{ xp: number | null; reward_points?: number | null; streak_paid_revives: number | null }>();

  if (loadError || !profile) {
    redirectWithMessage("/dashboard", "Profile not found.");
  }

  const currentRewardPoints = profile.reward_points ?? profile.xp ?? 0;

  if (currentRewardPoints < PAID_STREAK_REVIVE_COST) {
    redirectWithMessage("/dashboard", `You need ${PAID_STREAK_REVIVE_COST} Reward Points to unlock another streak revive.`);
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      reward_points: currentRewardPoints - PAID_STREAK_REVIVE_COST,
      streak_paid_revives: (profile.streak_paid_revives ?? 0) + 1,
    })
    .eq("id", user.id);

  if (error) {
    const { error: fallbackError } = await supabase
      .from("profiles")
      .update({
        xp: Math.max(0, (profile.xp ?? 0) - PAID_STREAK_REVIVE_COST),
        streak_paid_revives: (profile.streak_paid_revives ?? 0) + 1,
      })
      .eq("id", user.id);

    if (fallbackError) {
      redirectWithMessage("/dashboard", error.message);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/leaderboard");
  redirectWithMessage("/dashboard", "Streak revive unlocked. Apply to 2 roles in one day to use it.");
}
