"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

  if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 128) {
    redirectWithMessage("/signup", "Add your name, a valid email, and a password between 8 and 128 characters.");
  }

  const origin = new URL(process.env.APP_BASE_URL || "https://careerup-smoky.vercel.app").origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
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

  if (data.session) {
    redirect("/dashboard");
  }

  redirectWithMessage("/login", "If this email is new, check your inbox and spam folder for a confirmation link. Open the latest link in this browser. If you already registered, log in with your existing password. Signing up again does not reset it.");
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

export async function logOut(_previousState: { error: string }, _formData: FormData) {
  try {
    const supabase = await getSupabaseServerClient();

    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) return { error: "We could not log you out. Please try again." };
    }
  } catch {
    return { error: "We could not log you out. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/login?message=You have been logged out.");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    redirectWithMessage("/forgot-password", "Enter a valid account email address.");
  }
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirectWithMessage("/forgot-password", "Account recovery is temporarily unavailable. Please try again later.");
  const origin = new URL(process.env.APP_BASE_URL || "https://careerup-smoky.vercel.app").origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) {
    const message = error.status === 429
      ? "Too many email requests. Please wait a few minutes before requesting another link."
      : "The reset email could not be sent. Please contact the CareerUp project owner for help restoring access.";
    redirectWithMessage("/forgot-password", message);
  }
  redirect("/forgot-password?sent=1");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8 || password.length > 128) redirectWithMessage("/reset-password", "Choose a password between 8 and 128 characters.");
  if (password !== confirmation) redirectWithMessage("/reset-password", "The passwords do not match. Please enter them again.");
  const supabase = await getSupabaseServerClient();
  if (!supabase) redirectWithMessage("/forgot-password", "Account recovery is temporarily unavailable.");
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirectWithMessage("/forgot-password", "Your recovery session has expired. Please open a new reset link.");
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || !assurance) redirectWithMessage("/reset-password", "We could not verify your security settings. Please try again.");
  if (requiresMfaChallenge(assurance.currentLevel, assurance.nextLevel)) redirect("/mfa?next=%2Freset-password");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const message = error.code === "same_password"
      ? "Choose a different password from the one you used before."
      : "Your password could not be updated. Try a stronger password or request a new reset link.";
    redirectWithMessage("/reset-password", message);
  }
  await supabase.auth.signOut({ scope: "global" });
  revalidatePath("/", "layout");
  redirectWithMessage("/login", "Password updated. Sign in with your new password.");
}
