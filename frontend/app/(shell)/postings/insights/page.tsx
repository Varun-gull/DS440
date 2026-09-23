import { ArrowLeft, BriefcaseBusiness, Mail, MapPin, MessageSquareText, Sparkles, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { ApplicationStatusBadge } from "@/components/ApplicationStatusBadge";
import { ProfileLink } from "@/components/ProfileLink";
import { RolePeerSetupNotice } from "@/components/RolePeerSetupNotice";
import { getRolePeerApplicants, getRolePeerFeatureStatus, getRolePeerInsights } from "@/lib/data";
import { sendPeerMessage } from "@/lib/messages/actions";
import { buildRoleKey } from "@/lib/role-key";
import type { RolePeerApplicant } from "@/lib/types";

function getReturnTo(value?: string) {
  if (value?.startsWith("/postings/internships") || value?.startsWith("/postings/new-grad")) {
    return value;
  }

  return "/postings/internships";
}

function ApplicantAvatar({ applicant }: { applicant: RolePeerApplicant }) {
  if (applicant.schoolLogoUrl) {
    return <img src={applicant.schoolLogoUrl} alt="" className="h-full w-full bg-white object-contain p-2" />;
  }

  return <span>{applicant.name.charAt(0).toUpperCase()}</span>;
}

function buildInsightHref({
  roleKey,
  company,
  role,
  returnTo,
  year,
  signal
}: {
  roleKey: string;
  company: string;
  role: string;
  returnTo: string;
  year: number | "all";
  signal: "all" | "interviewed" | "offers";
}) {
  const params = new URLSearchParams({ roleKey, company, role, returnTo, signal });
  params.set("year", String(year));
  return `/postings/insights?${params.toString()}`;
}

export default async function PostingInsightsPage({
  searchParams,
}: {
  searchParams?: {
    roleKey?: string;
    company?: string;
    role?: string;
    returnTo?: string;
    year?: string;
    signal?: "all" | "interviewed" | "offers";
    message?: string;
  };
}) {
  const roleKey = searchParams?.roleKey || buildRoleKey(searchParams?.company ?? "", searchParams?.role ?? "");
  const company = searchParams?.company ?? "This company";
  const role = searchParams?.role ?? "this role";
  const returnTo = getReturnTo(searchParams?.returnTo);
  const [applicants, insightMap, peerFeatureStatus] = await Promise.all([getRolePeerApplicants(roleKey), getRolePeerInsights([roleKey]), getRolePeerFeatureStatus()]);
  const insight = insightMap.get(roleKey);
  const interviewed = applicants.filter((applicant) => applicant.status === "interviewing" || applicant.status === "offer");
  const applied = applicants.filter((applicant) => applicant.status === "applied" || applicant.status === "interviewing" || applicant.status === "offer");
  const years = Array.from(new Set(applicants.map((applicant) => applicant.applicationYear))).sort((a, b) => b - a);
  const requestedYear = searchParams?.year === "all" ? "all" : Number(searchParams?.year);
  const selectedYear: number | "all" = requestedYear === "all" ? "all" : years.includes(requestedYear) ? requestedYear : "all";
  const selectedSignal = searchParams?.signal === "interviewed" || searchParams?.signal === "offers" ? searchParams.signal : "all";
  const yearApplicants = selectedYear === "all" ? applicants : applicants.filter((applicant) => applicant.applicationYear === selectedYear);
  const visibleApplicants = yearApplicants.filter((applicant) => {
    if (selectedSignal === "interviewed") {
      return applicant.status === "interviewing" || applicant.status === "offer";
    }

    if (selectedSignal === "offers") {
      return applicant.status === "offer";
    }

    return true;
  });
  const signalTabs = [
    { value: "all" as const, label: "All peers", icon: UsersRound, count: yearApplicants.length },
    { value: "interviewed" as const, label: "Interviewed", icon: BriefcaseBusiness, count: yearApplicants.filter((applicant) => applicant.status === "interviewing" || applicant.status === "offer").length },
    { value: "offers" as const, label: "Offers", icon: Trophy, count: yearApplicants.filter((applicant) => applicant.status === "offer").length }
  ];

  return (
    <>
      <main className="page-shell">
        <Link href={returnTo} className="inline-flex items-center text-sm font-bold text-slate-600 hover:text-brand">
          <ArrowLeft className="mr-2" size={16} /> Back to postings
        </Link>

        <section className="page-hero mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="eyebrow">Peer insights</p>
            <h1 className="font-display mt-2 text-4xl font-bold tracking-tight text-ink sm:text-5xl">{role}</h1>
            <p className="mt-2 text-lg font-semibold text-slate-600">{company}</p>
            <p className="mt-3 max-w-3xl text-slate-600">
              See CareerUp users who have tracked this role, whether they reached interviews or offers, and reach out for advice when their profile is visible.
            </p>
          </div>

          <div className="card grid gap-3 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#2A6384] text-white">
                <UsersRound size={24} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">CareerUp signal</p>
                <p className="metric font-display text-2xl font-bold tracking-tight text-ink">{insight?.trackedCount ?? applicants.length} tracked</p>
              </div>
            </div>
            {/* A funnel should look like one: the three tiles deepen along the
                pipeline so the drop-off from applied to offer is visible. */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-100 p-3 ring-1 ring-inset ring-slate-200">
                <p className="metric text-xl font-bold text-slate-600">{insight?.appliedCount ?? applied.length}</p>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">Applied</p>
              </div>
              <div className="rounded-2xl bg-[#EAF2F8] p-3 ring-1 ring-inset ring-[#2A6384]/25">
                <p className="metric text-xl font-bold text-[#214E69]">{insight?.interviewedCount ?? interviewed.length}</p>
                <p className="mt-0.5 text-xs font-semibold text-[#2A6384]">Interviewed</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-200">
                <p className="metric text-xl font-bold text-emerald-700">{insight?.offerCount ?? applicants.filter((a) => a.status === "offer").length}</p>
                <p className="mt-0.5 text-xs font-semibold text-emerald-700">Offers</p>
              </div>
            </div>
          </div>
        </section>

        {searchParams?.message && <p className="mt-5 rounded-2xl bg-white/90 p-3 text-sm font-bold text-[#2A6384] shadow-sm ring-1 ring-[#2A6384]/20">{searchParams.message}</p>}
        <RolePeerSetupNotice status={peerFeatureStatus} />

        <section className="mt-8 grid gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-ink">Applicants and interview signal</h2>
              <p className="mt-1 text-sm font-medium text-slate-500">Visible profiles come from users who allow board sharing, accepted friends, or your own board.</p>
            </div>
          </div>

          {applicants.length > 0 ? (
            <div className="grid gap-4">
              <div className="card grid gap-4 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Recruiting cycle</p>
                    <p className="text-xs font-medium text-slate-600">Filter visible peers by application year.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={buildInsightHref({ roleKey, company, role, returnTo, year: "all", signal: selectedSignal })}
                      className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                        selectedYear === "all" ? "bg-white text-white shadow-lg shadow-slate-950/20" : "border border-slate-200 bg-white text-slate-600 hover:border-[#2A6384]/40 hover:text-brand"
                      }`}
                    >
                      All years
                    </Link>
                    {years.map((year) => (
                      <Link
                        key={year}
                        href={buildInsightHref({ roleKey, company, role, returnTo, year, signal: selectedSignal })}
                        className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                          selectedYear === year ? "bg-sky text-white shadow-lg shadow-sky/10" : "border border-slate-200 bg-white text-slate-600 hover:border-[#2A6384]/40 hover:text-brand"
                        }`}
                      >
                        {year}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {signalTabs.map((tab) => {
                    const Icon = tab.icon;

                    return (
                      <Link
                        key={tab.value}
                        href={buildInsightHref({ roleKey, company, role, returnTo, year: selectedYear, signal: tab.value })}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                          selectedSignal === tab.value ? "border-brand bg-sky text-white shadow-lg shadow-sky/10" : "border-slate-200 bg-white text-slate-600 hover:border-[#2A6384]/40 hover:text-brand"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon size={16} /> {tab.label}
                        </span>
                        <span>{tab.count}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {visibleApplicants.length > 0 ? (
                visibleApplicants.map((applicant) => (
                <article key={applicant.applicationId} className="card grid gap-5 p-5 lg:grid-cols-[1fr_360px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <Link
                          href={`/u/${applicant.profileId}`}
                          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-bold text-[#2A6384] transition hover:ring-2 hover:ring-sky/40"
                          aria-label={`Open ${applicant.name}'s profile`}
                        >
                          <ApplicantAvatar applicant={applicant} />
                        </Link>
                        <div className="min-w-0">
                          <ProfileLink profileId={applicant.profileId} name={applicant.name} />
                          <p className="truncate text-sm font-medium text-slate-500">{applicant.school}</p>
                        </div>
                      </div>
                      <ApplicationStatusBadge status={applicant.status} />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600 sm:grid-cols-3">
                      <span className="inline-flex items-center gap-2">
                        <MapPin size={16} /> {applicant.location}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Sparkles size={16} /> {applicant.applicationYear} cycle
                      </span>
                      <span>Updated {applicant.updatedAt}</span>
                    </div>
                  </div>

                  {applicant.canMessage ? (
                    <form action={sendPeerMessage} className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <input type="hidden" name="recipientId" value={applicant.profileId} />
                      <input type="hidden" name="applicationId" value={applicant.applicationId} />
                      <input type="hidden" name="roleKey" value={roleKey} />
                      <input type="hidden" name="returnTo" value={`/postings/insights?${new URLSearchParams({ roleKey, company, role, returnTo }).toString()}`} />
                      <label className="grid gap-1 text-xs font-medium uppercase text-slate-500">
                        Subject
                        <input
                          name="subject"
                          defaultValue={`Question about ${company}`}
                          className="field text-sm normal-case"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-medium uppercase text-slate-500">
                        Message
                        <textarea
                          name="body"
                          rows={3}
                          className="field text-sm normal-case"
                          defaultValue={`Hey ${applicant.name.split(" ")[0]}, I saw you tracked ${role} at ${company}. Would you be open to sharing any application or interview advice?`}
                        />
                      </label>
                      <button type="submit" className="primary-button justify-center">
                        <Mail className="mr-2" size={16} /> Send message
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                      <MessageSquareText className="mb-2 text-brand" size={22} />
                      This is your own application, so messaging is disabled here.
                    </div>
                  )}
                </article>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-white/90 p-8 text-center">
                  <UsersRound className="mx-auto text-brand" size={34} />
                  <h2 className="mt-3 text-xl font-bold text-ink">No peers match this filter</h2>
                  <p className="mt-2 text-sm font-medium text-slate-500">Try all years or all peers to broaden the signal.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white/90 p-8 text-center">
              <UsersRound className="mx-auto text-brand" size={34} />
              <h2 className="mt-3 text-xl font-bold text-ink">No visible peers yet</h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                The role may still have aggregate interest, but no users with visible boards are available to message yet.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
