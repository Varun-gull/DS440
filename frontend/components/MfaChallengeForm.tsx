"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";
import { normalizeOtpCode } from "@/lib/auth/mfa";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type FactorOption = {
  id: string;
  name: string;
};

type TotpFactor = {
  id: string;
  friendly_name?: string;
};

export function MfaChallengeForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [factors, setFactors] = useState<FactorOption[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function prepareChallenge() {
      const supabase = getSupabaseBrowserClient();

      if (!supabase) {
        if (active) {
          setError("Supabase is not connected.");
          setLoading(false);
        }
        return;
      }

      const [{ data: assurance, error: assuranceError }, { data, error: factorError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors()
      ]);

      if (!active) return;

      if (assuranceError || factorError) {
        setError(assuranceError?.message ?? factorError?.message ?? "Unable to load your security settings.");
        setLoading(false);
        return;
      }

      if (assurance.currentLevel === "aal2" || assurance.nextLevel !== "aal2") {
        router.replace(nextPath);
        router.refresh();
        return;
      }

      const options = data.totp.map((factor: TotpFactor, index: number) => ({
        id: factor.id,
        name: factor.friendly_name || `Authenticator ${index + 1}`
      }));

      if (options.length === 0) {
        setError("No verified authenticator was found. Sign out and contact support if this continues.");
      } else {
        setFactors(options);
        setFactorId(options[0].id);
      }

      setLoading(false);
    }

    void prepareChallenge();

    return () => {
      active = false;
    };
  }, [nextPath, router]);

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (code.length !== 6 || !factorId) {
      setError("Enter the six digit code from your authenticator application.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not connected.");
      return;
    }

    setSubmitting(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });

    if (verifyError) {
      setError(verifyError.message);
      setSubmitting(false);
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl bg-[#EAF2F8] p-4 text-sm font-semibold text-[#173B55]">
        <LoaderCircle className="animate-spin" size={18} />
        Loading your authenticator settings
      </div>
    );
  }

  return (
    <form onSubmit={verifyCode} className="mt-6 grid gap-4">
      <div className="flex items-start gap-3 rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8] p-4">
        <KeyRound className="mt-0.5 shrink-0 text-[#2A6384]" size={20} />
        <p className="text-sm leading-6 text-slate-700">
          Open the authenticator application connected to CareerUp and enter its current six digit code.
        </p>
      </div>

      {factors.length > 1 && (
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Authenticator
          <select className="field min-h-12" value={factorId} onChange={(event) => setFactorId(event.target.value)}>
            {factors.map((factor) => (
              <option key={factor.id} value={factor.id}>{factor.name}</option>
            ))}
          </select>
        </label>
      )}

      <label className="grid gap-2 text-sm font-bold text-slate-700">
        Verification code
        <input
          className="field min-h-12 text-center text-xl font-bold tracking-[0.35em]"
          value={code}
          onChange={(event) => setCode(normalizeOtpCode(event.target.value))}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
        />
      </label>

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}

      <button type="submit" className="primary-button w-full" disabled={submitting || factors.length === 0}>
        {submitting ? "Verifying code" : "Verify and continue"}
      </button>
    </form>
  );
}
