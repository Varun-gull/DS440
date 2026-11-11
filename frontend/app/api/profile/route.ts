import { NextResponse } from "next/server";
import { ownedProfileWriter } from "@/lib/security/session";
import { revalidatePath } from "next/cache";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { getSchoolLogoUrl } from "@/lib/schools";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireSameOrigin, requireScannerUser, readScannerJson, ScannerError } from "@/lib/email-scanner/security";

export const runtime = "nodejs";

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim().slice(0, 120)).filter(Boolean).slice(0, 8)
    : [];
}

export async function POST(request: Request) {
  try { requireSameOrigin(request); await requireScannerUser(); }
  catch (error) { return NextResponse.json({error: error instanceof ScannerError ? error.message : "Sign in to continue."}, {status: error instanceof ScannerError ? error.status : 401}); }
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Connect Supabase before updating your profile." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Log in before updating your profile." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await readScannerJson(request); }
  catch (error) { return NextResponse.json({error: error instanceof ScannerError ? error.message : "Invalid profile request."}, {status: error instanceof ScannerError ? error.status : 400}); }
  const fullName = String(body.fullName ?? "").trim();
  const school = String(body.school ?? "").trim();
  const major = String(body.major ?? "").trim();
  const graduationYear = String(body.graduationYear ?? "").trim();
  const targetRoles = cleanList(body.targetRoles);
  const targetLocations = cleanList(body.targetLocations);
  const shareApplicationBoard = Boolean(body.shareApplicationBoard);

  if (!fullName || fullName.length > 120 || school.length > 160 || major.length > 160 || graduationYear.length > 12) {
    return NextResponse.json({ error: "Add a name up to 120 characters and keep profile fields brief." }, { status: 400 });
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("profile_completed_awarded")
    .eq("id", user.id)
    .single<{ profile_completed_awarded: boolean | null }>();

  const isComplete = Boolean(school && major && graduationYear && targetRoles.length > 0 && targetLocations.length > 0);
  const shouldAwardProfileXp = isComplete && !currentProfile?.profile_completed_awarded;

  const { error } = await (await ownedProfileWriter(user.id))
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
    message: shouldAwardProfileXp ? "Profile saved. You earned 30 XP. Check Rewards for the points recorded from your activity." : "Profile saved.",
  });
}
