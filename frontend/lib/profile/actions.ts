"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { extractResumeKeywords, extractResumeTextFromFile, normalizeResumeText } from "@/lib/resume";
import { getSchoolLogoUrl } from "@/lib/schools";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function parseList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      "size" in value &&
      "arrayBuffer" in value &&
      "text" in value &&
      typeof value.arrayBuffer === "function" &&
      typeof value.text === "function" &&
      Number(value.size) > 0
  );
}

export async function updateProfile(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/profile", "Connect Supabase before updating your profile.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before updating your profile.");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const school = String(formData.get("school") ?? "").trim();
  const schoolLogoUrl = getSchoolLogoUrl(school);
  const major = String(formData.get("major") ?? "").trim();
  const graduationYear = String(formData.get("graduationYear") ?? "").trim();
  const targetRoles = parseList(formData.get("targetRoles"));
  const targetLocations = parseList(formData.get("targetLocations"));
  const shareApplicationBoard = formData.get("shareApplicationBoard") === "on";

  if (!fullName) {
    redirectWithMessage("/profile", "Your name is required.");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("xp, profile_completed_awarded")
    .eq("id", user.id)
    .single<{ xp: number | null; profile_completed_awarded: boolean | null }>();

  const isComplete = Boolean(school && major && graduationYear && targetRoles.length > 0 && targetLocations.length > 0);
  const shouldAwardProfileXp = isComplete && !currentProfile?.profile_completed_awarded;

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      school: school || null,
      school_logo_url: schoolLogoUrl || null,
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
    redirectWithMessage("/profile", error.message);
  }

  if (shouldAwardProfileXp) {
    await awardXp({ supabase, userId: user.id, amount: pointValues.completeProfile });
  }
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  redirectWithMessage("/profile", shouldAwardProfileXp ? "Profile saved. You earned 30 XP and 6 Reward Points for completing it." : "Profile saved.");
}

export async function updatePrivacySettings(formData: FormData) {
  const supabase = getSupabaseServerClient();
  const returnTo = String(formData.get("returnTo") ?? "/settings");

  if (!supabase) {
    redirectWithMessage(returnTo, "Connect Supabase before updating privacy settings.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before updating privacy settings.");
  }

  const shareApplicationBoard = formData.get("shareApplicationBoard") === "on";
  const { error } = await supabase
    .from("profiles")
    .update({
      share_application_board: shareApplicationBoard,
      privacy_prompt_answered: true
    })
    .eq("id", user.id);

  if (error) {
    redirectWithMessage(returnTo, error.message);
  }

  revalidatePath("/settings");
  revalidatePath("/privacy");
  revalidatePath("/profile");
  revalidatePath("/friends");
  revalidatePath("/dashboard");
  redirectWithMessage(returnTo, shareApplicationBoard ? "Friends can view your application board." : "Your application board is private.");
}

export async function saveResumeProfile(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/profile", "Connect Supabase before saving your resume.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before saving your resume.");
  }

  const resumeFile = formData.get("resumeFile");
  const pastedText = String(formData.get("resumeText") ?? "");
  let resumeText = pastedText;
  let fileName = "";
  let fileReadFailed = false;
  let uploadedFile = false;

  if (isUploadedFile(resumeFile)) {
    fileName = resumeFile.name;
    uploadedFile = true;

    if (Number(resumeFile.size) > 8 * 1024 * 1024) {
      redirectWithMessage("/profile", "Resume file is too large. Upload a file under 8 MB or paste the text instead.");
    }

    try {
      resumeText = await extractResumeTextFromFile(resumeFile);
    } catch {
      fileReadFailed = true;
      resumeText = pastedText;
    }
  }

  const normalizedText = normalizeResumeText(resumeText);
  const keywords = extractResumeKeywords(normalizedText);

  if (!normalizedText && !uploadedFile) {
    redirectWithMessage(
      "/profile",
      "Upload a resume file or paste resume text before saving."
    );
  }

  let { data: currentProfile, error: resumeAwardColumnError } = await supabase
    .from("profiles")
    .select("resume_file_name, resume_uploaded_awarded")
    .eq("id", user.id)
    .single<{ resume_file_name: string | null; resume_uploaded_awarded: boolean | null }>();

  if (resumeAwardColumnError) {
    const fallback = await supabase.from("profiles").select("resume_file_name").eq("id", user.id).single<{ resume_file_name: string | null }>();
    currentProfile = fallback.data ? { ...fallback.data, resume_uploaded_awarded: Boolean(fallback.data.resume_file_name) } : null;
  }

  const shouldAwardResumeXp = !currentProfile?.resume_uploaded_awarded && Boolean(normalizedText);

  const updatePayload = {
    resume_text: normalizedText,
    resume_keywords: keywords,
    resume_file_name: fileName || "Pasted resume",
    resume_updated_at: new Date().toISOString(),
    resume_uploaded_awarded: shouldAwardResumeXp ? true : currentProfile?.resume_uploaded_awarded ?? false,
  };

  let { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error && /resume_uploaded_awarded/i.test(error.message)) {
    const { resume_uploaded_awarded, ...legacyPayload } = updatePayload;
    const retry = await supabase.from("profiles").update(legacyPayload).eq("id", user.id);
    error = retry.error;
  }

  if (error) {
    redirectWithMessage("/profile", error.message);
  }

  if (shouldAwardResumeXp) {
    await awardXp({ supabase, userId: user.id, amount: pointValues.uploadResume });
  }
  await awardEligibleChallenges(supabase, user.id);

  revalidatePath("/profile");
  revalidatePath("/postings");
  redirectWithMessage(
    "/profile",
    fileReadFailed
      ? normalizedText
        ? "Resume text saved from the pasted box because the file could not be read."
        : "Resume file saved, but CareerUp could not read the text. Paste the resume text later to improve matching."
      : shouldAwardResumeXp
        ? "Resume saved. You earned 40 XP and 8 Reward Points."
        : "Resume saved."
  );
}
