"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, ChevronRight, FileText, Inbox, LoaderCircle, Mail, RefreshCw, ShieldCheck, Unplug, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { analyzeEmail } from "@/lib/email-scanner/scanner";
import type { EmailAnalysis, EmailUpdate, ScannerState, TrackedApplication } from "@/lib/email-scanner/types";

const statusLabel: Record<string, string> = { saved: "Saved", applied: "Applied", interviewing: "Interviewing", offer: "Offer", rejected: "Rejected" };
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-[#2A6384] focus:outline-none focus:ring-2 focus:ring-[#2A6384]/20 disabled:bg-slate-100";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown date";
}

type Act = (body: Record<string, unknown>) => Promise<boolean>;

function SuggestionCard({ update, applications, busy, act }: { update: EmailUpdate; applications: TrackedApplication[]; busy: boolean; act: Act }) {
  const [selected, setSelected] = useState(update.suggested_application_id ?? "");
  const [acknowledgeOlder, setAcknowledgeOlder] = useState(false);
  const app = applications.find((item) => item.id === selected);
  const older = Boolean(app && Date.parse(update.received_at) < Date.parse(app.updated_at));
  return <article className="card overflow-hidden p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-[#EAF2F8] px-2.5 py-1 text-[#2A6384]">{update.source === "gmail" ? "Gmail" : "Pasted email"}</span>
          <span className="text-slate-500">{displayDate(update.received_at)}</span>
        </div>
        <h3 className="mt-3 break-words text-lg font-bold text-slate-950">{update.subject || "Untitled email"}</h3>
        <p className="mt-1 break-words text-xs text-slate-500">{update.sender || "Sender not provided"}</p>
      </div>
      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">Suggests {statusLabel[update.proposed_status]}</span>
    </div>
    <div className="mt-4 rounded-2xl border border-[#2A6384]/15 bg-[#EAF2F8]/70 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-[#2A6384]">Supporting text</p>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{update.evidence}</p>
      {update.action_date_text && <p className="mt-2 text-xs text-slate-600">Possible date: {update.action_date_text}. Verify it in the original email. No calendar event is created automatically.</p>}
    </div>
    <div className="mt-4 grid gap-3">
      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Application to update
        <select value={selected} onChange={(event) => { setSelected(event.target.value); setAcknowledgeOlder(false); }} className={inputClass} disabled={busy}>
          <option value="">Choose an application</option>
          {applications.map((item) => <option key={item.id} value={item.id}>{item.company} · {item.role} · {statusLabel[item.status]}</option>)}
        </select>
      </label>
      {!update.suggested_application_id && <p className="text-xs leading-5 text-amber-800">No unique application match. Choose the correct company and role yourself.</p>}
      {!applications.length && <p className="text-sm text-slate-600"><Link className="font-semibold text-[#2A6384] underline" href="/applications/new">Add a tracked application</Link> before confirming.</p>}
      {app && <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">{statusLabel[app.status]} <ChevronRight size={16} /> <strong className="text-[#2A6384]">{statusLabel[update.proposed_status]}</strong></p>}
      {older && <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
        <input type="checkbox" checked={acknowledgeOlder} onChange={(event) => setAcknowledgeOlder(event.target.checked)} className="mt-1" />
        This email is older than the application’s latest update. I checked the original message and still want to apply this status.
      </label>}
      <p className="text-xs leading-5 text-slate-500">Check the original email before confirming. A matching phrase does not verify the sender or guarantee an offer.</p>
      <div className="flex flex-wrap gap-2">
        <button className="primary-button gap-2 disabled:opacity-50" disabled={busy || !app || (older && !acknowledgeOlder)} onClick={() => app && void act({ action: "confirm", updateId: update.id,
          applicationId: app.id, expectedStatus: app.status, expectedUpdatedAt: app.updated_at, acknowledgeOlder })}><Check size={16} />Confirm update</button>
        <button className={secondary} disabled={busy} onClick={() => void act({ action: "dismiss", updateId: update.id })}><X size={16} />Dismiss</button>
      </div>
    </div>
  </article>;
}

export function EmailScanner({ initialMessage = "" }: { initialMessage?: string }) {
  const router = useRouter();
  const [state, setState] = useState<ScannerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(initialMessage);
  const [gmailConsent, setGmailConsent] = useState(false);
  const [pasteConsent, setPasteConsent] = useState(false);
  const [days, setDays] = useState(30);
  const [subject, setSubject] = useState("");
  const [sender, setSender] = useState("");
  const [body, setBody] = useState("");
  const [receivedAt, setReceivedAt] = useState("");
  const [preview, setPreview] = useState<EmailAnalysis | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/email-scanner", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Could not load email settings.");
    setState(result);
    if (result.connection) setDays(result.connection.scanDays);
  }, []);
  useEffect(() => {
    let active = true;
    load().catch((failure: Error) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const act: Act = async (payload) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/email-scanner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not complete the request.");
      setMessage(result.message);
      await load();
      if (payload.action === "confirm") router.refresh();
      return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Request failed. Try again."); return false; }
    finally { setBusy(false); }
  };

  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/email-scanner/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: gmailConsent }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Connection failed.");
      const url = new URL(result.url);
      if (url.origin !== "https://accounts.google.com") throw new Error("Unexpected sign in address.");
      window.location.assign(url.toString());
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Connection failed."); setBusy(false); }
  }

  function previewEmail(event: FormEvent) {
    event.preventDefault();
    setPreview(analyzeEmail({ subject, sender, body, receivedAt: receivedAt ? new Date(receivedAt).toISOString() : new Date().toISOString() }, state?.applications ?? []));
  }

  function sample() {
    setSubject("Interview invitation: AI Engineer Internship at ExampleCo");
    setSender("ExampleCo Recruiting <recruiting@example.com>");
    setBody("Hello,\n\nThank you for applying to ExampleCo. We would like to invite you to interview for the AI Engineer Internship position. Please reply with your availability.\n\nExampleCo Recruiting");
    setReceivedAt(""); setPreview(null); setPasteConsent(false);
  }

  const pending = state?.updates.filter((update) => update.decision === "pending") ?? [];
  const history = state?.updates.filter((update) => update.decision !== "pending") ?? [];
  const storageReady = Boolean(state?.databaseReady);

  return <div className="mt-6 grid gap-6">
    <div aria-live="polite" className="grid gap-3">
      {message && <p role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
      {busy && <p role="status" className="flex items-center gap-2 text-sm font-semibold text-[#2A6384]"><LoaderCircle size={16} className="animate-spin" />Working. Keep this page open.</p>}
    </div>

    <section className="grid gap-4 sm:grid-cols-3" aria-label="How email scanning works">
      {[{ icon: Mail, title: "1. Find updates", text: "Scan recent Gmail messages or paste one email." },
        { icon: FileText, title: "2. Review the evidence", text: "Check the status phrase, company, role, and date." },
        { icon: ShieldCheck, title: "3. You decide", text: "Nothing changes until you confirm the application." }].map((item) => <div key={item.title} className="card p-5">
        <item.icon size={20} className="text-[#2A6384]" /><h2 className="mt-3 font-bold text-slate-900">{item.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
      </div>)}
    </section>

    <section className="card p-5 sm:p-6" aria-labelledby="gmail-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 id="gmail-heading" className="text-xl font-bold text-slate-950">Gmail connection</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Optional reading access. CareerUp cannot send, delete, or mark your emails as read through this connection.</p></div>
        <span className="rounded-full bg-[#EAF2F8] px-3 py-1.5 text-xs font-bold text-[#2A6384]">{state?.connection ? "Connected" : "Not connected"}</span>
      </div>
      {loading ? <p className="mt-4 text-sm text-slate-500">Checking connection settings…</p> : state?.connection ? <div className="mt-5 grid gap-4">
        <div className="rounded-2xl bg-slate-50 p-4"><p className="break-all font-semibold text-slate-800">{state.connection.email}</p>
          <p className="mt-1 text-xs text-slate-500">Last completed batch: {state.connection.lastScannedAt ? displayDate(state.connection.lastScannedAt) : "Not scanned yet"}</p>
          {state.connection.reconnectRequired && <p className="mt-2 text-sm text-amber-800">Google access is no longer available. Disconnect, then connect again.</p>}</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Search window<select className={inputClass} value={days} disabled={busy} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
          <button className="primary-button gap-2 disabled:opacity-50" disabled={busy || !state.gmailReady || state.connection.reconnectRequired} onClick={() => void act({ action: "scan", days, continue: false })}><RefreshCw size={16} />Scan recent emails</button>
          {state.connection.hasMore && days === state.connection.scanDays && <button className={secondary} disabled={busy || !state.gmailReady || state.connection.reconnectRequired} onClick={() => void act({ action: "scan", days, continue: true })}>Scan next batch</button>}
          <button className={secondary} disabled={busy} onClick={() => {
            if (window.confirm("Disconnect Gmail and delete imported Gmail records? Confirmed changes on your application board will remain.")) void act({ action: "disconnect" });
          }}><Unplug size={16} />Disconnect</button>
        </div>
        <p className="text-xs leading-5 text-slate-500">Each batch checks up to 20 matching messages. Continue until the window is complete. Scanning is manual and does not run in the background.</p>
      </div> : <div className="mt-5 grid gap-4">
        <label className="flex max-w-3xl items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          <input type="checkbox" checked={gmailConsent} onChange={(event) => setGmailConsent(event.target.checked)} className="mt-1.5" disabled={busy} />
          <span>I agree to connect Gmail for application tracking. Google grants broad mailbox reading access. CareerUp limits its requests using application searches, processes matching messages on its server, and stores only review fields and short evidence excerpts. It does not send email content to an external AI model.</span>
        </label>
        <button className="primary-button w-fit gap-2 disabled:opacity-50" disabled={busy || !gmailConsent || !storageReady || !state?.gmailReady} onClick={() => void connect()}><Mail size={16} />Connect Gmail</button>
      </div>}
      {!loading && (!storageReady || !state?.gmailReady) && <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <p className="font-semibold">Gmail setup is not complete.</p><p>{state?.error || "Add Google OAuth settings and apply the email scanner database migration before connecting."}</p>
        {Boolean(state?.missingSettings.length) && <p className="mt-2 break-words text-xs">Missing or invalid server settings: {state?.missingSettings.join(", ")}</p>}
        <p className="mt-2">You can preview a sample below without connecting Gmail. Setup instructions are in the repository’s email scanner guide.</p>
      </div>}
    </section>

    <section className="card p-5 sm:p-6" aria-labelledby="paste-heading">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="paste-heading" className="text-xl font-bold text-slate-950">Try one email</h2><p className="mt-2 text-sm text-slate-600">Preview stays in this browser. Saving sends the message to CareerUp for extraction.</p></div>
        <button type="button" className={secondary} disabled={busy} onClick={sample}>Use sample email</button></div>
      <form onSubmit={previewEmail} className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-slate-700">Subject<input required maxLength={300} className={inputClass} value={subject} onChange={(event) => { setSubject(event.target.value); setPreview(null); }} placeholder="Interview invitation" /></label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">Sender, optional<input maxLength={300} className={inputClass} value={sender} onChange={(event) => { setSender(event.target.value); setPreview(null); }} placeholder="Recruiting team" /></label></div>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Received date, optional<input type="datetime-local" className={`${inputClass} max-w-sm`} value={receivedAt} onChange={(event) => { setReceivedAt(event.target.value); setPreview(null); }} /><span className="text-xs font-normal text-slate-500">Enter your local time. If omitted, the saved record uses the time you paste it.</span></label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Message text<textarea required maxLength={24000} rows={7} className={inputClass} value={body} onChange={(event) => { setBody(event.target.value); setPreview(null); }} placeholder="Paste only the relevant application message. Remove unrelated personal information." /></label>
        <button type="submit" className={`${secondary} w-fit`} disabled={busy}>Preview status suggestion</button>
      </form>
      {preview && <div className="mt-5 rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8]/60 p-4">
        <p className="font-bold text-[#2A6384]">{preview.status ? `Suggested status: ${statusLabel[preview.status]}` : "Manual review needed"}</p>
        {preview.evidence && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{preview.evidence}</p>}
        <p className="mt-2 text-sm leading-6 text-slate-600">{preview.explanation}</p>
        {preview.status && <><label className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-700"><input type="checkbox" className="mt-1" checked={pasteConsent} onChange={(event) => setPasteConsent(event.target.checked)} />I have permission to process this message and agree to store the review fields and evidence excerpt for up to 30 days.</label>
          <button className="primary-button mt-3 disabled:opacity-50" disabled={busy || !pasteConsent || !storageReady} onClick={async () => {
            if (await act({ action: "paste", subject, sender, body, receivedAt: receivedAt ? new Date(receivedAt).toISOString() : "", consent: pasteConsent })) {
              setBody(""); setSubject(""); setSender(""); setReceivedAt(""); setPreview(null); setPasteConsent(false);
            }
          }}>Save for review</button></>}
      </div>}
    </section>

    <section aria-labelledby="review-heading"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 id="review-heading" className="text-xl font-bold text-slate-950">Ready for review <span className="ml-2 text-base text-slate-500">{pending.length}</span></h2><p className="mt-2 text-sm text-slate-600">Review up to 80 pending suggestions, newest first. Confirmed updates appear on your application board.</p></div>
      <button className={secondary} disabled={busy || loading} onClick={async () => { setError(""); setLoading(true); try { await load(); } catch { setError("Could not refresh. Try again."); } finally { setLoading(false); } }}><RefreshCw size={16} />Refresh</button></div>
      <div className="grid gap-4">{pending.map((update) => <SuggestionCard key={update.id} update={update} applications={state?.applications ?? []} busy={busy} act={act} />)}
        {!pending.length && <div className="card p-8 text-center"><Inbox size={26} className="mx-auto text-[#2A6384]" /><p className="mt-3 font-bold text-slate-800">No pending suggestions</p><p className="mt-2 text-sm text-slate-500">Scan Gmail or save a pasted email. CareerUp never changes a status just because an email arrived.</p></div>}</div>
    </section>

    {history.length > 0 && <section className="card p-5 sm:p-6"><h2 className="text-lg font-bold text-slate-950">Recent decisions</h2><div className="mt-3 divide-y divide-slate-100">{history.map((update) => <div key={update.id} className="py-3"><p className="break-words text-sm font-semibold text-slate-800">{update.subject}</p><p className="mt-1 text-xs text-slate-500">{update.decision === "confirmed" ? `Confirmed: ${statusLabel[update.previous_status ?? ""] ?? "Previous status"} → ${statusLabel[update.proposed_status]}` : "Dismissed"} · {displayDate(update.reviewed_at ?? update.created_at)}</p></div>)}</div></section>}
    <section className="rounded-2xl border border-slate-300 bg-white/60 p-5 text-sm leading-6 text-slate-600"><h2 className="font-bold text-slate-800">Your data and control</h2>
      <p className="mt-2">No full email bodies or attachments are stored. Subjects, senders, dates, and short evidence excerpts are private scanner records. Records older than 30 days are removed when you next load the scanner. Disconnect removes stored Gmail credentials and imported Gmail records. Confirmed application changes remain, and existing board sharing preferences still apply.</p>
      <p className="mt-2">Scanning does not grant XP, change streaks, send replies, or add calendar events. You can correct any status from your application board.</p>
      <button className={`${secondary} mt-3`} disabled={busy || !storageReady} onClick={() => {
        if (window.confirm("Delete all saved email suggestions and review history? Application statuses will not be undone.")) void act({ action: "clear", confirm: true });
      }}>Delete scanner records</button>
    </section>
  </div>;
}
