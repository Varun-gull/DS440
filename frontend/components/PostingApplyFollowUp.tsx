"use client";

import { CheckCircle2, Clock3, ExternalLink, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { savePostingApplication } from "@/lib/applications/actions";

const STORAGE_KEY = "careerup-pending-apply";

type PendingApply = {
  company: string;
  role: string;
  location: string;
  sourceUrl: string;
  fitScore: number;
  returnTo: string;
  openedAt: number;
};

function readPendingApply(): PendingApply | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingApply;
    if (!parsed.company || !parsed.role || !parsed.sourceUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingApply() {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function rememberApplyClick(posting: PendingApply) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...posting, openedAt: Date.now() }));
}

export function PostingApplyLink({
  posting,
  returnTo,
  className,
  children,
}: {
  posting: Omit<PendingApply, "returnTo" | "openedAt">;
  returnTo: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <a
      href={posting.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => rememberApplyClick({ ...posting, returnTo, openedAt: Date.now() })}
    >
      {children}
    </a>
  );
}

export function PostingApplyFollowUpPrompt() {
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState<PendingApply | null>(null);
  const roleLabel = useMemo(() => {
    if (!pending) return "";
    return `${pending.role} at ${pending.company}`;
  }, [pending]);

  useEffect(() => {
    setMounted(true);

    let sawAway = false;

    function maybeShowPrompt() {
      const saved = readPendingApply();
      if (!saved) return;
      const waitedLongEnough = Date.now() - saved.openedAt > 1500;
      if (sawAway || waitedLongEnough) {
        setPending(saved);
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        sawAway = true;
        return;
      }
      maybeShowPrompt();
    }

    function handleFocus() {
      maybeShowPrompt();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  if (!mounted || !pending) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-xl rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-strong ring-1 ring-slate-950/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#2A6384]">Application check-in</p>
            <h2 className="mt-2 text-2xl font-bold text-ink">Did you apply?</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              You opened <span className="font-semibold text-slate-900">{roleLabel}</span>. Tell CareerUp what happened so your tracker stays accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearPendingApply();
              setPending(null);
            }}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close application check-in"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <form action={savePostingApplication}>
            <PostingHiddenFields pending={pending} status="applied" />
            <button
              type="submit"
              onClick={clearPendingApply}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <CheckCircle2 className="mr-2" size={18} /> Yes, applied
            </button>
          </form>
          <form action={savePostingApplication}>
            <PostingHiddenFields pending={pending} status="saved" />
            <button
              type="submit"
              onClick={clearPendingApply}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-sky px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand"
            >
              <Clock3 className="mr-2" size={18} /> Save for later
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              clearPendingApply();
              setPending(null);
            }}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            No
          </button>
        </div>

        <a
          href={pending.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-bold text-[#2A6384] hover:text-brand"
        >
          <ExternalLink className="mr-1.5" size={16} /> Reopen posting
        </a>
      </div>
    </div>,
    document.body
  );
}

function PostingHiddenFields({ pending, status }: { pending: PendingApply; status: "applied" | "saved" }) {
  return (
    <>
      <input type="hidden" name="company" value={pending.company} />
      <input type="hidden" name="role" value={pending.role} />
      <input type="hidden" name="location" value={pending.location} />
      <input type="hidden" name="sourceUrl" value={pending.sourceUrl} />
      <input type="hidden" name="fitScore" value={pending.fitScore} />
      <input type="hidden" name="returnTo" value={pending.returnTo} />
      <input type="hidden" name="status" value={status} />
    </>
  );
}
