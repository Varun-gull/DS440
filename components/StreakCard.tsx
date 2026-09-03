import { ShieldCheck, Zap } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { unlockStreakRevive } from "@/lib/applications/actions";

const PAID_STREAK_REVIVE_COST = 50;

export function StreakCard({
  streak,
  rewardPoints,
  xp,
  streakBroken,
  freeReviveUsed,
  paidRevives,
  reviveRequiredApplications,
}: {
  streak: number;
  rewardPoints?: number;
  xp?: number;
  streakBroken: boolean;
  freeReviveUsed: boolean;
  paidRevives: number;
  reviveRequiredApplications: number;
}) {
  const spendablePoints = rewardPoints ?? xp ?? 0;
  const hasFreeRevive = !freeReviveUsed;
  const canUnlockPaidRevive = freeReviveUsed && spendablePoints >= PAID_STREAK_REVIVE_COST;
  const showReviveInfo = streakBroken || reviveRequiredApplications > 0;
  const reviveHelper = hasFreeRevive
    ? "Your first streak revive is free. If you miss a day, apply to 1 role that day to restore it."
    : paidRevives > 0
      ? "Paid revive ready. Apply to 2 roles in one day after a miss to restore your streak."
      : `Your free revive has been used. Unlock another for ${PAID_STREAK_REVIVE_COST} Reward Points when you want a backup.`;

  return (
    <section className="hero-3d relative isolate overflow-hidden rounded-3xl bg-[#173B55] p-5 text-white">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#2A6384] shadow-lg shadow-black/20">
          <Zap size={32} fill="currentColor" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/65">Current streak</p>
          <p className="metric font-display mt-1 text-4xl font-bold leading-none">{streak} days</p>
        </div>
      </div>

      <div className="relative mt-5 rounded-2xl bg-white/10 p-3 ring-1 ring-inset ring-white/20 backdrop-blur">
        <p className="text-sm leading-6 text-white/85">
          {streak > 0 ? "You are charged up. Apply to one role today to keep the streak alive." : "Start the streak by applying to one role today."}
        </p>
      </div>

      {showReviveInfo && (
        <div className="relative mt-4 rounded-2xl bg-white p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2A6384]">
            <ShieldCheck size={16} /> Streak revive
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">{reviveHelper}</p>
          {reviveRequiredApplications > 0 && (
            <p className="metric mt-2 rounded-xl bg-[#EAF2F8] px-3 py-2 text-xs font-semibold text-[#2A6384]">
              Revive in progress: apply to {reviveRequiredApplications} roles today.
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-700">
            <span className="rounded-full bg-slate-100 px-3 py-1">Free: {hasFreeRevive ? "available" : "used"}</span>
            <span className="metric rounded-full bg-slate-100 px-3 py-1">Paid: {paidRevives}</span>
          </div>
          {freeReviveUsed && (
            <form action={unlockStreakRevive} className="mt-3">
              <SubmitButton
                disabled={!canUnlockPaidRevive}
                pendingLabel="Unlocking"
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#2A6384] px-3 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#214E69] active:translate-y-px disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
              >
                <>Unlock revive — {PAID_STREAK_REVIVE_COST} RP</>
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
