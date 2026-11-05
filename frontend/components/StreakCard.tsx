import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import { getTodayKey } from "@/lib/streak";

export function StreakCard({ streak, streakBroken, freeReviveUsed, paidRevives, reviveRequiredApplications, protectedDays = [] }: {
  streak: number; rewardPoints?: number; xp?: number; streakBroken: boolean; freeReviveUsed: boolean; paidRevives: number; reviveRequiredApplications: number; protectedDays?: string[];
}) {
  const today = getTodayKey();
  const planned = protectedDays.filter((d) => d >= today);
  return <section className="hero-3d relative isolate overflow-hidden rounded-3xl bg-[#173B55] p-5 text-white">
    <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
    <div className="relative flex items-center gap-4"><div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#2A6384] shadow-lg shadow-black/20"><Zap size={32} fill="currentColor" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Current streak</p><p className="metric font-display mt-1 text-4xl font-bold leading-none">{streak} days</p></div></div>
    <p className="relative mt-5 rounded-2xl bg-white/10 p-3 text-sm leading-6 text-white/85 ring-1 ring-inset ring-white/20">{planned.includes(today) ? "Today is protected. Take the space you need; your streak stays yours." : streak > 0 ? "Keep making thoughtful moves. Record an application today, or plan a protected day off." : "Start fresh with your next thoughtful application."}</p>
    <div className="relative mt-4 rounded-2xl bg-white p-4 text-[#2A6384]"><h3 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} />A little breathing room</h3><p className="mt-2 text-xs leading-6 text-slate-600">Plan a day off with a 12 RP day pass. It preserves your streak without adding XP. Up to two protected days in any seven day period.</p>
      {planned.length > 0 && <p className="mt-2 text-xs font-semibold">Protected: {planned.map((d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })).join(", ")}</p>}
      {streakBroken && !freeReviveUsed && <p className="mt-2 text-xs leading-6 text-slate-500">Your existing free revive is still available when you next record an application.</p>}
      {paidRevives > 0 && <p className="mt-2 text-xs leading-6 text-slate-500">Your {paidRevives} previously purchased {paidRevives === 1 ? "revive remains" : "revives remain"} available under the existing restore rules.</p>}
      {reviveRequiredApplications > 0 && <p className="mt-2 text-xs text-slate-500">An earlier revive is in progress.</p>}
      <Link className="mt-3 inline-flex items-center gap-2 text-xs font-bold" href="/rewards?category=Personalize%20%26%20protect">Explore day passes <ArrowRight size={14} /></Link>
    </div>
  </section>;
}
