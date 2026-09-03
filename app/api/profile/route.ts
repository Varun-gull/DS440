import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { getSchoolLogoUrl } from "@/lib/schools";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
    : [];
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Connect Supabase before updating your profile." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Log in before updating your profile." }, { status: 401 });
  }

  const body = await request.json();
  const fullName = String(body.fullName ?? "").trim();
  const school = String(body.school ?? "").trim();
  const major = String(body.major ?? "").trim();
  const graduationYear = String(body.graduationYear ?? "").trim();
  const targetRoles = cleanList(body.targetRoles);
  const targetLocations = cleanList(body.targetLocations);
  const shareApplicationBoard = Boolean(body.shareApplicationBoard);

  if (!fullName) {
    return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("profile_completed_awarded")
    .eq("id", user.id)
    .single<{ profile_completed_awarded: boolean | null }>();

  const isComplete = Boolean(school && major && graduationYear && targetRoles.length > 0 && targetLocations.length > 0);
  const shouldAwardProfileXp = isComplete && !currentProfile?.profile_completed_awarded;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      school: school || null,
      school_logo_url: getSchoolLogoUrl(school) || null,
      major: major || null,
      graduation_year: graduationYear || null,
      target_roles: targetRoles,
      target_locations: targetLocations,
      share_application_board: shareApplicationBoard,
      privacy_prompt_answered: true,
      profile_completed_awarded: shouldAwardProfileXp ? true : currentProfile?.profile_completed_awarded ?? false,
    })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (shouldAwardProfileXp) {
    await awardXp({ supabase, userId: user.id, amount: pointValues.completeProfile });
  }
  await awardEligibleChallenges(supabase, user.id);
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");

  return NextResponse.json({
    ok: true,
    message: shouldAwardProfileXp ? "Profile saved. You earned 30 XP and 6 Reward Points for completing it." : "Profile saved.",
  });
}
