import { ArrowRight, CheckCircle2, Flame, Sparkles, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { ChallengeCard } from "@/components/ChallengeCard";
import { Metric } from "@/components/Metric";
import { bandStyle, fitBand, fitLabel, isFreshPosting } from "@/lib/signal";
import { getApplications, getChallenges, getCurrentProfile } from "@/lib/data";
import { searchCachedPostings, searchInternshipPostings } from "@/lib/postings";
import type { PostingKind } from "@/lib/postings";
import type { InternshipPosting } from "@/lib/types";

const DASHBOARD_MATCH_LIMIT = 5;

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  step
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
  step: 1 | 2 | 3 | 4;
}) {
  return (
    <section className={`card card-interactive rise rise-${step} flex min-h-40 flex-col justify-between gap-6 p-5`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ${tone}`}>
        <Icon size={20} />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="font-display mt-1 text-3xl font-bold tracking-tight text-ink">
          <Metric value={value} delay={180 + step * 60} />
        </p>
      </div>
    </section>
  );
}

function TopFitPostings({ postings }: { postings: InternshipPosting[] }) {
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Best matches</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Top postings for you</h2>
        </div>
        <Link
          href="/postings/internships?sort=fit"
          className="group inline-flex items-center gap-1 rounded-lg px-1 text-sm font-semibold text-[#2A6384] transition hover:text-[#214E69]"
        >
          View all
          <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-4 grid flex-1 content-start gap-2.5">
        {postings.length > 0 ? (
          postings.map((posting, index) => (
            <article
              key={posting.id}
              className="data-row group overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="metric mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#EAF2F8] text-xs font-semibold text-[#2A6384]">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-ink">{posting.title}</h3>
                    <p className="mt-0.5 truncate text-sm text-slate-600">
                      {posting.company} · {posting.location}
                    </p>
                  </div>
                </div>
                {/* This list is already sorted by fit, so a band label would read the
                    same on every row — the colour and the bar carry it instead. */}
                <div className="shrink-0 text-right" title={fitLabel(posting.fitScore)}>
                  <p className={`metric font-display text-lg font-bold leading-none ${bandStyle(fitBand(posting.fitScore)).text}`}>
                    {posting.fitScore}%
                  </p>
                  <div className="meter-track ml-auto mt-1.5 h-1.5 w-14">
                    <div
                      className={`h-full origin-left rounded-full ${bandStyle(fitBand(posting.fitScore)).fill} motion-safe:animate-[sweep_900ms_var(--ease-out)_both]`}
                      style={{ width: `${posting.fitScore}%`, animationDelay: `${360 + index * 70}ms` }}
                    />
                  </div>
                  <span className="sr-only">{fitLabel(posting.fitScore)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pl-9">
                <p className="text-xs text-slate-500">
                  {posting.source} ·{" "}
                  <span className={isFreshPosting(posting.postedAt) ? "metric font-bold text-[#2A6384]" : "metric"}>
                    {posting.postedAt}
                  </span>
                </p>
                <a
                  href={posting.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-[#2A6384] transition hover:text-[#214E69]"
                >
                  Open
                  <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600">
            Upload a resume and sync postings to surface your strongest matches here.
          </div>
        )}
      </div>
    </section>
  );
}

async function getDashboardMatches(profile: Awaited<ReturnType<typeof getCurrentProfile>>, kind: PostingKind) {
  const targetedCached = await searchCachedPostings({ profile, kind, sort: "fit", limit: DASHBOARD_MATCH_LIMIT });

  if (targetedCached?.postings.length) {
    return targetedCached.postings;
  }

  const broadCached = await searchCachedPostings({
    profile,
    kind,
    query: "",
    location: "",
    sort: "fit",
    limit: DASHBOARD_MATCH_LIMIT
  });

  if (broadCached?.postings.length) {
    return broadCached.postings;
  }

  const liveMatches = await searchInternshipPostings({
    profile,
    kind,
    query: "",
    location: ""
  });

  return liveMatches.postings
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, DASHBOARD_MATCH_LIMIT);
}

export default async function DashboardPage({ searchParams }: { searchParams?: { message?: string } }) {
  const [profile, challenges, applications] = await Promise.all([
    getCurrentProfile(),
    getChallenges(),
    getApplications()
  ]);
  const [internshipMatches, newGradMatches] = await Promise.all([
    getDashboardMatches(profile, "internship"),
    getDashboardMatches(profile, "new-grad")
  ]);
  const topFitPostings = [...internshipMatches, ...newGradMatches]
    .sort((a, b) => b.fitScore - a.fitScore)
    .slice(0, DASHBOARD_MATCH_LIMIT);

  const appliedCount = applications.filter((application) => application.status !== "saved").length;
  const dailyChallenges = [...challenges.tiered, ...challenges.oneOff].slice(0, 3);

  return (
    <main className="page-shell space-y-5">
      <PageHero
        eyebrow={profile.school || "CareerUp student"}
        title={`Welcome back, ${profile.name}`}
        description="Keep your search focused: review today's quests, move one role forward, and protect your recruiting momentum."
        tabs={[
          { label: "Dashboard", href: "/dashboard", active: true },
          { label: "Applications", href: "/applications" },
          { label: "Postings", href: "/postings/internships" },
          { label: "Messages", href: "/messages" }
        ]}
      />
      {searchParams?.message && (
        <p className="rise rounded-2xl border border-[#5E7681]/30 bg-[#F8FBFA] p-3 text-sm font-semibold text-[#2A6384]">{searchParams.message}</p>
      )}

      <section className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Sparkles} label="Lifetime XP" value={profile.xp} tone="bg-[#2A6384] text-white" step={1} />
          <StatCard icon={Star} label="Reward Points" value={profile.rewardPoints} tone="bg-[#EAF2F8] text-[#2A6384]" step={2} />
          <StatCard icon={Flame} label="Day streak" value={profile.streak} tone="bg-[#5E7681] text-white" step={3} />
          <StatCard
            icon={CheckCircle2}
            label="Applications sent"
            value={appliedCount}
            tone="bg-[#F8FBFA] text-[#2A6384] ring-1 ring-[#5E7681]/35"
            step={4}
          />
        </div>

        <div className="rise rise-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
          <TopFitPostings postings={topFitPostings} />
          <section className="card flex h-full flex-col p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">XP quests</p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Daily challenges</h2>
              </div>
              <span className="metric rounded-full bg-[#EAF2F8] px-3 py-1 text-xs font-semibold text-[#2A6384] ring-1 ring-[#5E7681]/30">
                {dailyChallenges.length} today
              </span>
            </div>
            <div className="mt-4 grid flex-1 content-start gap-4">
              {dailyChallenges.length > 0 ? (
                dailyChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5">
                  <p className="text-sm font-semibold text-ink">No quests loaded</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Challenges appear here once your recruiting cycle starts.{" "}
                    <Link href="/challenges" className="font-semibold text-[#2A6384] underline decoration-[#2A6384]/30 underline-offset-2 hover:decoration-[#2A6384]">
                      Browse all challenges
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
