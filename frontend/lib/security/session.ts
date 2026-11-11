import "server-only";
import { cache } from "react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requiresMfaChallenge } from "@/lib/auth/mfa";

export const verifiedSession = cache(async () => {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new Error("Account services are temporarily unavailable.");
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in to continue.");
  const { data: assurance, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mfaError || !assurance || requiresMfaChallenge(assurance.currentLevel, assurance.nextLevel)) {
    throw new Error("Complete two factor authentication to continue.");
  }
  const { data: active, error: sessionError } = await supabase.rpc("careerup_session_valid");
  if (sessionError || active !== true) throw new Error("Your session expired. Sign in again.");
  return { supabase, user };
});

// Only trusted server code may read the explicit public profile fields. The
// underlying profiles table is owner only, including for direct REST requests.
export const publicProfileReader = cache(async () => {
  await verifiedSession();
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Account services are temporarily unavailable.");
  return admin;
});

export async function ownedProfileWriter(userId: string) {
  const { user } = await verifiedSession();
  if (user.id !== userId) throw new Error("This record belongs to another account.");
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Account services are temporarily unavailable.");
  return admin;
}
