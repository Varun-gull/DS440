"use server";

import { redirect } from "next/navigation";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

export async function signUp(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const shareApplicationBoard = formData.get("shareApplicationBoard") === "on";

  if (!supabase) {
    redirectWithMessage("/signup", "Connect Supabase env vars before creating real accounts.");
  }

  if (!fullName || !email || password.length < 6) {
    redirectWithMessage("/signup", "Add your name, email, and a password with at least 6 characters.");
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        share_application_board: shareApplicationBoard,
        privacy_prompt_answered: true
      }
    }
  });

  if (error) {
    redirectWithMessage("/signup", error.message);
  }

  redirectWithMessage("/login", "Account created. Check your email if confirmation is enabled, then log in.");
}

export async function logIn(formData: FormData) {
  const supabase = await getSupabaseServerClient();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!supabase) {
    redirectWithMessage("/login", "Connect Supabase env vars before logging in.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirectWithMessage("/login", error.message);
  }

  const userId = data.user?.id;

  let destination = "/dashboard";

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("privacy_prompt_answered")
      .eq("id", userId)
      .maybeSingle<{ privacy_prompt_answered: boolean | null }>();

    if (!profile?.privacy_prompt_answered) {
      destination = "/privacy";
    }
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (assurance && requiresMfaChallenge(assurance.currentLevel, assurance.nextLevel)) {
    redirect(`/mfa?next=${encodeURIComponent(destination)}`);
  }

  redirect(destination);
}

export async function logOut() {
  const supabase = await getSupabaseServerClient();

  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect("/login?message=You have been logged out.");
}
