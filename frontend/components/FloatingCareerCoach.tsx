"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, MessageCircle, Sparkles, X } from "lucide-react";

const CareerCoachChat = dynamic(() => import("@/components/CareerCoachChat"), {
  loading: () => <p role="status" className="p-5 text-sm text-slate-500">Opening your coach…</p>,
});

export function FloatingCareerCoach() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    launcher.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (pathname.startsWith("/interview/assistant")) return null;

  return (
    <div className="career-coach-widget">
      {hasOpened && (
        <section
          id="careerup-coach-popup"
          className="career-coach-panel"
          hidden={!open}
          role={open ? "dialog" : undefined}
          aria-modal={open ? false : undefined}
          aria-labelledby="careerup-coach-title"
          data-blocks-flow={open ? "true" : undefined}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2F8] text-[#2A6384]">
                <Sparkles size={20} aria-hidden />
              </span>
              <div>
                <h2 id="careerup-coach-title" className="font-bold text-slate-950">CareerUp coach</h2>
                <p className="text-xs text-slate-500">A little guidance. Your next step.</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link href="/interview/assistant" onClick={close} className="career-coach-icon-button" aria-label="Open full AI coach" title="Open full coach">
                <ArrowUpRight size={19} aria-hidden />
              </Link>
              <button ref={closeButton} type="button" onClick={close} className="career-coach-icon-button" aria-label="Close AI coach">
                <X size={19} aria-hidden />
              </button>
            </div>
          </header>
          <CareerCoachChat />
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        className="career-coach-launcher"
        aria-label={open ? "Minimize AI coach" : "Open AI coach"}
        aria-expanded={open}
        aria-controls={hasOpened ? "careerup-coach-popup" : undefined}
        onClick={() => {
          if (open) close();
          else { setHasOpened(true); setOpen(true); }
        }}
      >
        {open ? <X size={22} aria-hidden /> : <MessageCircle size={23} aria-hidden />}
        <span className="hidden sm:inline">AI coach</span>
        {!open && <span className="career-coach-badge sm:hidden" aria-hidden>AI</span>}
      </button>
    </div>
  );
}
