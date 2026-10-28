import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/data";
import { logIn } from "@/lib/auth/actions";
import { requiresMfaChallenge } from "@/lib/auth/mfa";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function LoginPage({ searchParams: searchParamsInput }: { searchParams?: Promise<{ message?: string }> }) {
  const searchParams = await searchParamsInput;
  const user = await getCurrentUser();

  if (user) {
    const supabase = await getSupabaseServerClient();
    const { data: assurance } = supabase
      ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      : { data: null };

    if (assurance && requiresMfaChallenge(assurance.currentLevel, assurance.nextLevel)) {
      redirect("/mfa?next=%2Fdashboard");
    }

    redirect("/dashboard");
  }

  const supabaseReady = isSupabaseConfigured();

  return (
    <AuthShell
      eyebrow="Log in"
      title="Welcome back"
      description="Pick up where you left off and keep your application pipeline moving."
    >
      {!supabaseReady && (
        <p className="mt-5 rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8] p-3 text-sm font-bold text-[#173B55]">
          Supabase env vars are not connected yet. This form is ready for the next setup step.
        </p>
      )}
      {searchParams?.message && <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">{searchParams.message}</p>}
      <form action={logIn} className="mt-6 grid gap-4">
        <input name="email" className="field min-h-12" placeholder="Email" type="email" required />
        <input name="password" className="field min-h-12" placeholder="Password" type="password" required />
        <button type="submit" className="primary-button mt-1 w-full">Log in</button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        New here?{" "}
        <Link href="/signup" className="font-bold text-[#2A6384]">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
