"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Download, Trash2 } from "lucide-react";

export function AccountDataControls() {
  const [action, setAction] = useState<"export" | "delete" | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [deleted, setDeleted] = useState(false);
  const [googleWarning, setGoogleWarning] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, password, confirmation }) });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || "Please try again."); }
      if (action === "export") {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a"); link.href = url; link.download = `careerup-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("Your download is ready. It contains private information; keep it somewhere secure.");
      } else {
        const result = await response.json(); setDeleted(true); setGoogleWarning(result.googleRevocationWarning === true);
      }
      setAction(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Please try again."); }
    finally { setPassword(""); setBusy(false); }
  }

  if (deleted) return <section id="your-data" className="card settings-intro p-6" role="status"><h2 className="text-xl font-bold">Your account has been deleted.</h2><p className="mt-3 text-sm leading-6 text-slate-600">You have been signed out of CareerUp. External applications, provider logs and downloaded copies are not removed by this action.</p>{googleWarning && <p className="mt-3 text-sm">Google revocation could not be confirmed. Remove CareerUp from <a href="https://myaccount.google.com/connections" className="underline">your Google account connections</a>.</p>}<a href="/login" className="primary-button mt-4">Return to login</a></section>;

  return <section id="your-data" className="card settings-intro p-6">
    <p className="eyebrow">Your information</p><h2 className="mt-2 text-xl font-bold text-ink">Your data</h2>
    <p className="mt-2 text-sm leading-6 text-slate-600">Download your profile, resume text, applications, preparation, rewards and relevant social records as JSON. Passwords, connection credentials and other users’ private records are excluded.</p>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="secondary-button" disabled={busy} onClick={() => { setAction("export"); setMessage(""); setPassword(""); setConfirmation(""); }}><Download size={16} aria-hidden />Download my data</button><button type="button" className="account-delete-button" disabled={busy} onClick={() => { setAction("delete"); setMessage(""); setPassword(""); setConfirmation(""); }}><Trash2 size={16} aria-hidden />Delete my account</button></div>
    {action && <form onSubmit={submit} className={`account-confirm-panel mt-5 ${action === "delete" ? "account-confirm-danger" : ""}`} aria-label={action === "delete" ? "Confirm account deletion" : "Confirm data download"}>
      <h3 className="font-bold">{action === "delete" ? "Permanently delete your account?" : "Verify it’s you"}</h3>
      {action === "delete" ? <><p className="mt-2 text-sm leading-6">This removes your account, resume, applications, STAR answers, messages, stored Gmail connection and rewards. Your owned groups and shared goals close. Open pools you belong to are cancelled and other members are refunded. Your unused points are lost. Download your data first.</p><p className="mt-2 text-sm leading-6">This cannot be undone. It does not remove Gmail messages, external applications, other people’s downloads or independent provider logs and backups.</p></> : <p className="mt-2 text-sm leading-6 text-slate-600">Enter your current password before downloading private information. If two factor authentication is enabled, your session must have completed it.</p>}
      <label className="mt-4 grid gap-2 text-sm font-semibold" htmlFor="account-data-password">Current password<input id="account-data-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} disabled={busy} className="field" /></label>
      {action === "delete" && <label className="mt-4 grid gap-2 text-sm font-semibold" htmlFor="account-delete-confirmation">Type DELETE to confirm<input id="account-delete-confirmation" autoComplete="off" required pattern="DELETE" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} className="field" /></label>}
      <div className="mt-4 flex flex-wrap gap-3"><button className={action === "delete" ? "account-delete-button account-delete-filled" : "primary-button"} disabled={busy || (action === "delete" && confirmation !== "DELETE")}>{busy ? "Working…" : action === "delete" ? "Permanently delete account" : "Download JSON"}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setAction(null); setPassword(""); setConfirmation(""); setMessage(""); }}>Cancel</button></div>
    </form>}
    <p className="mt-4 text-xs leading-5 text-slate-500">Forgot your password? <Link href="/forgot-password" className="underline">Reset it first</Link>. Read the <Link href="/privacy-policy" className="underline">Privacy Policy</Link> for retention and provider details.</p>
    {message && <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6">{message}</p>}
  </section>;
}
