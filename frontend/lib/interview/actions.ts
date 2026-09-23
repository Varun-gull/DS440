"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function getField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveInterviewAnswer(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/interview", "Connect Supabase before saving interview answers.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before saving interview answers.");
  }

  const prompt = getField(formData, "prompt");
  const situation = getField(formData, "situation");
  const task = getField(formData, "task");
  const actionTaken = getField(formData, "actionTaken");
  const resultOutcome = getField(formData, "resultOutcome");
  const notes = getField(formData, "notes");

  if (!prompt || !situation || !task || !actionTaken || !resultOutcome) {
    redirectWithMessage("/interview", "Fill out the prompt and all four STAR sections before saving.");
  }

  const { error } = await supabase.from("interview_answers").insert({
    user_id: user.id,
    prompt,
    situation,
    task,
    action_taken: actionTaken,
    result_outcome: resultOutcome,
    notes
  });

  if (error) {
    redirectWithMessage("/interview", error.message);
  }

  revalidatePath("/interview");
  redirectWithMessage("/interview", "Interview answer saved.");
}

export async function deleteInterviewAnswer(formData: FormData) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    redirectWithMessage("/interview", "Connect Supabase before deleting interview answers.");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirectWithMessage("/login", "Log in before deleting interview answers.");
  }

  const answerId = getField(formData, "answerId");

  if (!answerId) {
    redirectWithMessage("/interview", "Interview answer not found.");
  }

  const { error } = await supabase.from("interview_answers").delete().eq("id", answerId).eq("user_id", user.id);

  if (error) {
    redirectWithMessage("/interview", error.message);
  }

  revalidatePath("/interview");
  redirectWithMessage("/interview", "Interview answer deleted.");
}
