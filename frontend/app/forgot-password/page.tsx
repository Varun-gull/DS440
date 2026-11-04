import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { AuthSubmitButton } from "@/components/AuthSubmitButton";
import { requestPasswordReset } from "@/lib/auth/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams?: Promise<{ message?: string; sent?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Account recovery" title="Reset your password" description="Use the email address you registered with. We’ll help you get back to your applications.">
    {params?.message && <p role="alert" className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">{params.message}</p>}
    {params?.sent === "1" && <p role="status" className="mt-5 rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8] p-4 text-sm leading-6 text-[#15314A]">If an account exists for this email, a reset link has been requested. Check your inbox and spam folder. Open the most recent link in this browser.</p>}
    <form action={requestPasswordReset} className="mt-6 grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">Account email<input name="email" className="field min-h-12" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required /></label>
      <AuthSubmitButton label="Send reset link" pendingLabel="Requesting reset link…" />
    </form>
    <p className="mt-4 text-xs leading-5 text-slate-500">Requesting a link does not change your password. Only you choose the new password after opening the link.</p>
    <Link href="/login" className="mt-5 inline-block text-sm font-bold text-[#2A6384]">Back to log in</Link>
  </AuthShell>;
}
