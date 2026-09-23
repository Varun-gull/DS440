import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/data";
import { signUp } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function SignupPage({ searchParams }: { searchParams?: { message?: string } }) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const supabaseReady = isSupabaseConfigured();

  return (
    <AuthShell
      eyebrow="Create account"
      title="Start your search"
      description="Build a profile, save your first roles, and unlock the application board."
    >
      {!supabaseReady && (
        <p className="mt-5 rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8] p-3 text-sm font-bold text-[#173B55]">
          Supabase env vars are not connected yet. Account creation will be wired in the database step.
        </p>
      )}
      {searchParams?.message && <p className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">{searchParams.message}</p>}
      <form action={signUp} className="mt-6 grid gap-4">
        <input name="fullName" className="field min-h-12" placeholder="Name" required />
        <input name="email" className="field min-h-12" placeholder="Email" type="email" required />
        <input name="password" className="field min-h-12" placeholder="Password" type="password" minLength={6} required />
        <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-700">
          <input name="shareApplicationBoard" type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-600 text-[#2A6384] focus:ring-[#2A6384]" />
          <span>
            Let accepted friends view my application board.
            <span className="mt-1 block text-xs font-semibold text-slate-500">You can change this later from settings.</span>
          </span>
        </label>
        <button type="submit" className="primary-button mt-1 w-full">Create account</button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-[#2A6384]">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
