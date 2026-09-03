import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/data";
import { logIn } from "@/lib/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage({ searchParams }: { searchParams?: { message?: string } }) {
  const user = await getCurrentUser();

  if (user) {
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
