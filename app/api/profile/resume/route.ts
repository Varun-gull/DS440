import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { awardEligibleChallenges, awardXp, pointValues } from "@/lib/gamification";
import { extractResumeKeywords, extractResumeTextFromFile, normalizeResumeText } from "@/lib/resume";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      "size" in value &&
      "arrayBuffer" in value &&
      typeof value.arrayBuffer === "function" &&
      Number(value.size) > 0
  );
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({ error: "Connect Supabase before saving your resume." }, { status: 500 });
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Log in before saving your resume." }, { status: 401 });
  }

  const formData = await request.formData();
  const resumeFile = formData.get("resumeFile");

  if (!isUploadedFile(resumeFile)) {
    return NextResponse.json({ error: "Choose a resume file before saving." }, { status: 400 });
  }

  if (Number(resumeFile.size) > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Resume file is too large. Upload a file under 8 MB." }, { status: 400 });
  }

  let fileReadFailed = false;
  let resumeText = "";

  try {
    resumeText = await extractResumeTextFromFile(resumeFile);
  } catch {
    fileReadFailed = true;
  }

  const normalizedText = normalizeResumeText(resumeText);
  const keywords = extractResumeKeywords(normalizedText);

  let { data: currentProfile, error: resumeAwardColumnError } = await supabase
    .from("profiles")
    .select("resume_file_name, resume_uploaded_awarded")
    .eq("id", user.id)
    .single<{ resume_file_name: string | null; resume_uploaded_awarded: boolean | null }>();

  if (resumeAwardColumnError) {
    const fallback = await supabase.from("profiles").select("resume_file_name").eq("id", user.id).single<{ resume_file_name: string | null }>();
    currentProfile = fallback.data ? { ...fallback.data, resume_uploaded_awarded: Boolean(fallback.data.resume_file_name) } : null;
  }

  const shouldAwardResumeXp = !currentProfile?.resume_uploaded_awarded;
  const updatePayload = {
    resume_text: normalizedText,
    resume_keywords: keywords,
    resume_file_name: resumeFile.name,
    resume_updated_at: new Date().toISOString(),
    resume_uploaded_awarded: shouldAwardResumeXp ? true : currentProfile?.resume_uploaded_awarded ?? false,
  };

  let { error } = await supabase.from("profiles").update(updatePayload).eq("id", user.id);

  if (error && /resume_uploaded_awarded/i.test(error.message)) {
    const { resume_uploaded_awarded, ...legacyPayload } = updatePayload;
    const retry = await supabase.from("profiles").update(legacyPayload).eq("id", user.id);
    error = retry.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (shouldAwardResumeXp) {
    await awardXp({ supabase, userId: user.id, amount: pointValues.uploadResume });
  }
  await awardEligibleChallenges(supabase, user.id);
  revalidatePath("/profile");
  revalidatePath("/postings");
  revalidatePath("/dashboard");

  return NextResponse.json({
    ok: true,
    fileName: resumeFile.name,
    extractedText: normalizedText.length > 0,
    keywords,
    message: fileReadFailed || !normalizedText
      ? "Resume file saved, but CareerUp could not read the text for matching."
      : shouldAwardResumeXp
        ? "Resume saved. You earned 40 XP and 8 Reward Points."
        : "Resume saved.",
  });
}
