import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { AuthSubmitButton } from "@/components/AuthSubmitButton";
import { updatePassword } from "@/lib/auth/actions";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams?: Promise<{ message?: string }> }) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const user = supabase ? await supabase.auth.getUser() : null;
  if (!user?.data.user) redirect("/forgot-password?message=Open%20the%20reset%20link%20from%20your%20email%20first%2C%20or%20request%20a%20new%20one.");
  const { data: assurance, error } = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !assurance) redirect("/forgot-password?message=We%20could%20not%20verify%20your%20session.%20Please%20open%20a%20new%20reset%20link.");
  if (requiresMfaChallenge(assurance.currentLevel, assurance.nextLevel)) redirect("/mfa?next=%2Freset-password");

  return <AuthShell eyebrow="Account recovery" title="Choose a new password" description="Your recovery session is verified. Choose a password you haven’t used before.">
    {params?.message && <p role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{params.message}</p>}
    <form action={updatePassword} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">New password<input name="password" className="field min-h-12" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <label className="grid gap-2 text-sm font-semibold text-slate-700">Confirm new password<input name="confirmPassword" className="field min-h-12" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
      <p className="text-xs leading-5 text-slate-500">Use at least 8 characters. After saving, sign in with your new password.</p>
      <AuthSubmitButton label="Save new password" pendingLabel="Saving your password…" />
    </form>
    <Link href="/login" className="mt-5 inline-block text-sm font-bold text-[#2A6384]">Back to log in</Link>
  </AuthShell>;
}
