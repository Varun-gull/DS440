"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, KeyRound, LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { normalizeOtpCode } from "@/lib/auth/mfa";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type FactorSummary = {
  id: string;
  name: string;
  createdAt: string;
};

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type MfaFactor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
};

function qrCodeSource(value: string) {
  return value.startsWith("data:") ? value : `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`;
}

export function TwoFactorSettings() {
  const router = useRouter();
  const [factors, setFactors] = useState<FactorSummary[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadFactors() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not connected.");
      setLoading(false);
      return;
    }

    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setLoading(false);
      return;
    }

    setFactors(data.totp.map((factor: MfaFactor, index: number) => ({
      id: factor.id,
      name: factor.friendly_name || `Authenticator ${index + 1}`,
      createdAt: factor.created_at
    })));
    setLoading(false);
  }

  useEffect(() => {
    void loadFactors();
  }, []);

  async function beginEnrollment() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setWorking(true);
    setError("");
    setMessage("");

    const { data: existing, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message);
      setWorking(false);
      return;
    }

    const unfinishedFactors = existing.all.filter((factor: MfaFactor) => factor.factor_type === "totp" && factor.status === "unverified");
    for (const factor of unfinishedFactors) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: factors.length === 0 ? "CareerUp authenticator" : `CareerUp authenticator ${factors.length + 1}`,
      issuer: "CareerUp"
    });

    if (enrollError) {
      setError(enrollError.message);
      setWorking(false);
      return;
    }

    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setWorking(false);
  }

  async function cancelEnrollment() {
    const supabase = getSupabaseBrowserClient();
    if (supabase && enrollment) {
      await supabase.auth.mfa.unenroll({ factorId: enrollment.factorId });
    }
    setEnrollment(null);
    setCode("");
    setError("");
  }

  async function verifyEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || code.length !== 6) {
      setError("Enter the six digit code shown in your authenticator application.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setWorking(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code
    });

    if (verifyError) {
      setError(verifyError.message);
      setWorking(false);
      return;
    }

    setEnrollment(null);
    setCode("");
    setMessage("Two factor authentication is now active.");
    await loadFactors();
    router.refresh();
    setWorking(false);
  }

  async function removeFactor(factor: FactorSummary) {
    if (!window.confirm(`Remove ${factor.name}? You will no longer be able to use it to verify your sign in.`)) {
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setWorking(true);
    setError("");
    setMessage("");
    const { error: removeError } = await supabase.auth.mfa.unenroll({ factorId: factor.id });

    if (removeError) {
      setError(removeError.message);
      setWorking(false);
      return;
    }

    await supabase.auth.refreshSession();
    setMessage("Authenticator removed.");
    await loadFactors();
    router.refresh();
    setWorking(false);
  }

  async function copySecret() {
    if (!enrollment) return;
    await navigator.clipboard.writeText(enrollment.secret);
    setMessage("Setup key copied.");
  }

  if (loading) {
    return <div className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-600"><LoaderCircle className="animate-spin" size={18} />Loading security settings</div>;
  }

  return (
    <div className="mt-5 grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${factors.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {factors.length > 0 ? <ShieldCheck size={20} /> : <KeyRound size={20} />}
          </span>
          <div>
            <p className="font-bold text-ink">{factors.length > 0 ? "Two factor authentication is active" : "Two factor authentication is off"}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">Uses a timed code from an authenticator application.</p>
          </div>
        </div>
        {!enrollment && (
          <button type="button" className="primary-button gap-2" onClick={beginEnrollment} disabled={working}>
            <Plus size={17} /> {factors.length > 0 ? "Add backup authenticator" : "Set up authenticator"}
          </button>
        )}
      </div>

      {factors.length > 0 && (
        <div className="grid gap-3">
          {factors.map((factor) => (
            <div key={factor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-emerald-600" size={19} />
                <div>
                  <p className="text-sm font-bold text-slate-800">{factor.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Added {new Date(factor.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button type="button" onClick={() => removeFactor(factor)} disabled={working} className="secondary-button min-h-10 gap-2 px-3 text-sm text-red-700">
                <Trash2 size={16} /> Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {enrollment && (
        <form onSubmit={verifyEnrollment} className="grid gap-5 rounded-2xl border border-[#2A6384]/25 bg-[#EAF2F8] p-5 sm:grid-cols-[13rem_1fr]">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <Image src={qrCodeSource(enrollment.qrCode)} alt="CareerUp authenticator setup QR code" width={184} height={184} unoptimized className="h-auto w-full" />
          </div>
          <div>
            <p className="text-lg font-bold text-ink">Connect your authenticator</p>
            <ol className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
              <li>1. Open Google Authenticator, Microsoft Authenticator, Authy, or another TOTP application.</li>
              <li>2. Scan the QR code, then enter the six digit code it displays.</li>
            </ol>
            <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Manual setup key</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs font-bold text-slate-700">{enrollment.secret}</code>
                <button type="button" onClick={copySecret} className="secondary-button min-h-9 shrink-0 px-3" aria-label="Copy setup key"><Copy size={15} /></button>
              </div>
            </div>
            <label className="mt-4 grid gap-2 text-sm font-bold text-slate-700">
              Verification code
              <input className="field max-w-xs text-center text-lg font-bold tracking-[0.3em]" value={code} onChange={(event) => setCode(normalizeOtpCode(event.target.value))} placeholder="000000" inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="submit" className="primary-button" disabled={working}>{working ? "Verifying" : "Verify and enable"}</button>
              <button type="button" className="secondary-button" onClick={cancelEnrollment} disabled={working}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{message}</p>}

      <p className="text-xs font-semibold leading-5 text-slate-500">
        CareerUp does not generate recovery codes. Add a second authenticator as a backup before removing access to your main device.
      </p>
    </div>
  );
}
