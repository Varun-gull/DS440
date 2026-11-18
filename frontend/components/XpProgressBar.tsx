"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import { getRankProgress, ranks, rankBonuses } from "@/lib/rank";

export function XpProgressBar({ xp }: { xp: number }) {
  const progress = getRankProgress(xp);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function update() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    }
    function handleClickOutside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const dropdown = open && rect ? createPortal(
    <div
      style={{
        position: "fixed",
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
        zIndex: 9999,
        width: 256,
      }}
      className="rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-strong backdrop-blur-xl"
    >
      <div className="grid gap-1.5">
        {ranks.map((rank) => {
          const isCurrent = rank.name === progress.current.name;
          return (
            <div
              key={rank.name}
              className={clsx(
                "flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition",
                isCurrent ? "bg-[#EFF7F3] ring-1 ring-inset ring-[#23675D]/25" : "bg-slate-50"
              )}
            >
              <span className={clsx("text-sm", isCurrent ? "font-bold text-[#23675D]" : "font-semibold text-ink")}>{rank.name}</span>
              <span className="metric text-right text-xs font-semibold text-slate-600">
                {rank.minXp.toLocaleString()} XP
                {rankBonuses.some((b) => b.rankName === rank.name) && (
                  <span className="block text-brand">+{rankBonuses.find((b) => b.rankName === rank.name)?.xp} bonus</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Rank progress</p>
          <h2 className="metric mt-1 font-display text-2xl font-bold tracking-tight text-ink">{xp.toLocaleString()} XP</h2>
        </div>
        <p className="metric rounded-full bg-[#EFF7F3] px-3 py-1 text-sm font-semibold text-[#23675D] ring-1 ring-inset ring-[#23675D]/20">
          {progress.next ? `${progress.remaining} XP to ${progress.next.name}` : "Max rank unlocked"}
        </p>
      </div>
      <div className="meter-track meter-segments mt-5 h-3">
        <div className="game-bar-fill" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-600">{progress.current.name}</p>
        <button
          ref={btnRef}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#23675D] transition duration-150 hover:border-[#23675D]/40 hover:bg-[#EFF7F3] active:translate-y-px"
        >
          {open ? "Hide all ranks" : "Show all ranks"}
        </button>
        {dropdown}
      </div>
    </section>
  );
}
