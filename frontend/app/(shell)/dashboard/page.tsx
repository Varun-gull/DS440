import { ArrowRight, Bot, CheckCircle2, ClipboardList, Flame, Search, Sparkles, Star } from "lucide-react";
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
    <section className="card dashboard-stat">
      <span className="dashboard-stat-icon"><Icon size={20} aria-hidden /></span>
      <div><p>{label}</p><strong><Metric value={value} /></strong></div>
    </section>
  );
}

function TopFitPostings({ postings }: { postings: InternshipPosting[] }) {
  return (
    <section className="card flex h-full flex-col p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Best matches</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Recommended for you</h2>
        </div>
        <Link
          href="/postings/internships?sort=fit"
          className="group inline-flex items-center gap-1 rounded-lg px-1 text-sm font-semibold text-[#23675D] transition hover:text-[#185348]"
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
                  <span className="metric mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#EFF7F3] text-xs font-semibold text-[#23675D]">
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
                  <span className={isFreshPosting(posting.postedAt) ? "metric font-bold text-[#23675D]" : "metric"}>
                    {posting.postedAt}
                  </span>
                </p>
                <a
                  href={posting.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-[#23675D] transition hover:text-[#185348]"
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

export default async function DashboardPage({ searchParams: searchParamsInput }: { searchParams?: Promise<{ message?: string }> }) {
  const searchParams = await searchParamsInput;
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
        eyebrow="Your career, one step at a time"
        title={`Welcome back, ${profile.name.split(/\s+/)[0] || "there"}`}
        description="Find your next role, keep track of applications, and build confidence for the interview."
        actions={<Link href="/postings/internships" className="primary-button gap-2"><Search size={16} aria-hidden />Find a job</Link>}
      />
      <section aria-label="Start your next step" className="next-step-grid">
        {[
          { href: "/postings/internships", icon: Search, title: "Discover your next role", detail: "Search internships and graduate jobs." },
          { href: "/applications", icon: ClipboardList, title: "Keep your search organized", detail: "Save roles and track every application." },
          { href: "/coach/live", icon: Bot, title: "Prepare with your AI Coach", detail: "Practice an interview or get guidance." }
        ].map(({ href, icon: Icon, title, detail }) => <Link href={href} key={href} className="next-step-card"><span><Icon size={18} aria-hidden /></span><div><h2>{title}</h2><p>{detail}</p></div><ArrowRight size={15} aria-hidden /></Link>)}
      </section>
      {searchParams?.message && (
        <p className="rise rounded-2xl border border-[#5E7681]/30 bg-[#F8FBFA] p-3 text-sm font-semibold text-[#23675D]">{searchParams.message}</p>
      )}

      <section className="space-y-5">
        <div className="dashboard-section-heading"><h2>Your progress at a glance</h2><Link href="/rewards" className="text-xs font-semibold text-brand">Explore rewards <span aria-hidden>↗</span></Link></div>
        <div className="dashboard-stats">
          <StatCard icon={Sparkles} label="Lifetime XP" value={profile.xp} tone="bg-[#23675D] text-white" step={1} />
          <StatCard icon={Star} label="Reward Points" value={profile.rewardPoints} tone="bg-[#EFF7F3] text-[#23675D]" step={2} />
          <StatCard icon={Flame} label="Day streak" value={profile.streak} tone="bg-[#5E7681] text-white" step={3} />
          <StatCard
            icon={CheckCircle2}
            label="Applications sent"
            value={appliedCount}
            tone="bg-[#F8FBFA] text-[#23675D] ring-1 ring-[#5E7681]/35"
            step={4}
          />
        </div>

        <div className="rise rise-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(290px,.8fr)] xl:items-stretch">
          <TopFitPostings postings={topFitPostings} />
          <section className="card flex h-full flex-col p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Keep your momentum</p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Small steps, real progress</h2>
              </div>
              <span className="metric rounded-full bg-[#EFF7F3] px-3 py-1 text-xs font-semibold text-[#23675D] ring-1 ring-[#5E7681]/30">
                {dailyChallenges.length} today
              </span>
            </div>
            <div className="mt-4 grid flex-1 content-start gap-4">
              {dailyChallenges.length > 0 ? (
                dailyChallenges.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} />)
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-5">
                  <p className="text-sm font-semibold text-ink">Your next challenge is on its way</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Challenges appear here once your recruiting cycle starts.{" "}
                    <Link href="/challenges" className="font-semibold text-[#23675D] underline decoration-[#23675D]/30 underline-offset-2 hover:decoration-[#23675D]">
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
