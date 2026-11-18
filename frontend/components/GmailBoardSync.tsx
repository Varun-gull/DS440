"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, RefreshCw } from "lucide-react";

type SyncState = { connected: boolean; enabled: boolean; reconnectRequired: boolean; lastScannedAt: string | null; hasMore: boolean };

export function GmailBoardSync() {
  const router = useRouter();
  const [state, setState] = useState<SyncState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true, running = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    let force = retry > 0;
    async function run() {
      if (running || document.visibilityState !== "visible") return;
      running = true;
      clearTimeout(timer);
      let hasMore = false;
      try {
        const response = await fetch("/api/email-scanner?view=board", { cache: "no-store", signal: controller.signal });
        const current = await response.json();
        if (!response.ok) throw new Error(current.error || "Gmail sync settings could not load.");
        if (!active) return;
        setState(current);
        if (current.connected && current.enabled && !current.reconnectRequired) {
          setBusy(true);
          const synced = await fetch("/api/email-scanner", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "auto-sync", force }), signal: controller.signal });
          const result = await synced.json();
          if (!synced.ok) {
            if (synced.status === 429) hasMore = true;
            throw new Error(synced.status === 429 ? "A Gmail sync is running or just finished. Checking again in 30 seconds." : result.error || "Gmail sync could not finish.");
          }
          force = false;
          if (!active) return;
          setMessage(result.message);
          hasMore = result.hasMore === true;
          if (result.added > 0 || result.updated > 0) router.refresh();
        }
      } catch (error) { if (active) setMessage(error instanceof Error ? error.message : "Gmail sync is temporarily unavailable."); }
      finally {
        running = false;
        if (active) { setBusy(false); timer = setTimeout(() => void run(), hasMore ? 30000 : 300000); }
      }
    }
    const focus = () => { router.refresh(); void run(); };
    void run();
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    return () => { active = false; clearTimeout(timer); controller.abort(); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", focus); };
  }, [router, retry]);

  return <section className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-5" aria-label="Gmail application sync">
    <div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Mail size={17} className="text-[#23675D]" />Gmail application sync{state?.enabled && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800">Automatic</span>}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{state?.reconnectRequired ? "Reconnect Gmail to resume automatic updates." : state?.enabled ? "Reads application emails while this board is open. Clear matches add cards and update statuses; uncertain emails stay for review." : "Connect Gmail and enable automatic sync to add applications and keep their statuses up to date."}</p>
      {message && <p className="mt-2 text-xs leading-5 text-slate-500" role="status">{message}</p>}
    </div>
    <div className="flex flex-wrap gap-2">{state?.enabled && !state.reconnectRequired && <button type="button" className="secondary-button" disabled={busy} onClick={() => setRetry(value => value + 1)}><RefreshCw size={15} className={busy ? "animate-spin" : ""} />{busy ? "Syncing…" : "Sync Gmail"}</button>}<Link href="/applications/email-scanner" className="secondary-button">{state?.enabled ? "Review & settings" : "Set up Gmail sync"}</Link></div>
  </section>;
}
