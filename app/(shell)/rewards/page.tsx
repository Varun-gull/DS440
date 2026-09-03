import { PageHero } from "@/components/PageHero";
import { ArrowRight, Gift, LockKeyhole, Sparkles, UnlockKeyhole } from "lucide-react";
import Link from "next/link";
import { RankBadge } from "@/components/RankBadge";
import { XpProgressBar } from "@/components/XpProgressBar";
import { unlockReward } from "@/lib/rewards/actions";
import { getCurrentProfile, getRewards } from "@/lib/data";

export default async function RewardsPage({ searchParams }: { searchParams?: { message?: string } }) {
  const [profile, rewards] = await Promise.all([getCurrentProfile(), getRewards()]);
  const unlockedCount = rewards.filter((reward) => reward.unlocked).length;

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Unlocks"
          title="Rewards"
          description="Spend Reward Points on practical job-search tools. Your lifetime XP still powers ranks and leaderboards."
          tabs={[
            { label: "Rewards", href: "/rewards", active: true },
            { label: "Challenges", href: "/challenges" }
          ]}
        />

        {searchParams?.message && <p className="mt-5 rounded-2xl bg-white/90 p-3 text-sm font-bold text-[#2A6384] shadow-sm ring-1 ring-[#2A6384]/20">{searchParams.message}</p>}

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="card p-5">
            <Sparkles size={22} className="text-brand" />
            <p className="mt-4 text-sm font-bold text-slate-500">Reward Points</p>
            <p className="mt-1 text-3xl font-bold text-ink">{profile.rewardPoints.toLocaleString()}</p>
          </div>
          <div className="card p-5">
            <Gift size={22} className="text-brand" />
            <p className="mt-4 text-sm font-bold text-slate-500">Rewards unlocked</p>
            <p className="mt-1 text-3xl font-bold text-ink">
              {unlockedCount}/{rewards.length}
            </p>
          </div>
        </section>

        <section className="mt-6">
          <XpProgressBar xp={profile.xp} />
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Spend Reward Points</p>
              <h2 className="mt-2 text-2xl font-bold text-ink">Job-search rewards</h2>
              <p className="mt-2 max-w-2xl text-slate-600">
                Unlock focused tools you can use while applying, networking, interviewing, and comparing offers.
              </p>
            </div>
            <div className="rounded-2xl bg-[#EAF2F8] px-4 py-3 text-sm font-bold text-[#2A6384] ring-1 ring-[#5E7681]/25">
              <RankBadge xp={profile.xp} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {rewards.map((reward) => {
              const canUnlock = profile.rewardPoints >= reward.xpCost;
              const rewardHref =
                reward.id === "behavioral-interview-pack"
                  ? "/interview"
                  : reward.id === "resume-bullet-scorer"
                    ? "/profile"
                    : reward.id === "application-quality-audit"
                      ? "/applications"
                      : reward.id === "follow-up-calendar-system"
                        ? "/calendar"
                        : null;

              return (
                <article key={reward.id} className="card flex min-h-full flex-col p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold text-brand">{reward.category}</p>
                      <h2 className="mt-1 text-xl font-bold text-ink">{reward.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{reward.description}</p>
                    </div>
                    {/* The cost chip answers "can I afford this?" before you read
                        the button: green when you can, amber when you cannot. */}
                    <span
                      className={
                        reward.unlocked
                          ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200"
                          : canUnlock
                            ? "metric rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-bold text-[#214E69] ring-1 ring-inset ring-[#2A6384]/25"
                            : "metric rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-inset ring-amber-200"
                      }
                    >
                      {reward.unlocked ? "Unlocked" : `${reward.xpCost} RP`}
                    </span>
                  </div>

                  {reward.unlocked ? (
                    <div className="mt-5 flex flex-1 flex-col rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8]/70 p-4">
                      <div className="mb-3 flex items-center gap-2 font-bold text-[#214E69]">
                        <UnlockKeyhole size={18} /> Unlocked tool
                      </div>
                      <ul className="grid gap-2 text-sm leading-6 text-slate-700">
                        {reward.contents.map((item) => (
                          <li key={item} className="rounded-2xl bg-white/90 px-3 py-2">
                            {item}
                          </li>
                        ))}
                      </ul>
                      {rewardHref && (
                        <Link href={rewardHref} className="primary-button mt-4 self-start">
                          Open tool <ArrowRight className="ml-2" size={18} />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                      <p className={`metric inline-flex items-center gap-2 text-sm font-bold ${canUnlock ? "text-emerald-700" : "text-amber-800"}`}>
                        {canUnlock ? <UnlockKeyhole size={16} /> : <LockKeyhole size={16} />}
                        {canUnlock
                          ? "Ready to unlock"
                          : `${Math.max(0, reward.xpCost - profile.rewardPoints).toLocaleString()} RP to go`}
                      </p>
                      <form action={unlockReward}>
                        <input type="hidden" name="rewardId" value={reward.id} />
                        <button className="primary-button disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none" disabled={!canUnlock}>
                          <UnlockKeyhole className="mr-2" size={18} /> Unlock
                        </button>
                      </form>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
