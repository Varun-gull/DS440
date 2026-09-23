import { PageHero } from "@/components/PageHero";
import { BriefcaseBusiness, CheckCircle2, Clock3, MessageSquareText, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { ApplicationPipelineBoard } from "@/components/ApplicationPipelineBoard";
import { ApplicationsFilterForm } from "@/components/ApplicationsFilterForm";
import { DashboardCard } from "@/components/DashboardCard";
import { EmptyState } from "@/components/EmptyState";
import { getApplications } from "@/lib/data";
import type { Application, ApplicationStatus } from "@/lib/types";

const pipelineColumns: Array<{
  status: ApplicationStatus;
  title: string;
  helper: string;
}> = [
  { status: "saved", title: "Saved", helper: "Ready to review" },
  { status: "applied", title: "Applied", helper: "Submitted" },
  { status: "interviewing", title: "Interviewing", helper: "Active loops" },
  { status: "offer", title: "Offer", helper: "Wins" },
  { status: "rejected", title: "Rejected", helper: "Closed" }
];

function matchesSearch(application: Application, query: string) {
  if (!query) {
    return true;
  }

  const haystack = `${application.company} ${application.role} ${application.location}`.toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function getYearHref(year: number | "all", query: string, status: ApplicationStatus | "all") {
  const params = new URLSearchParams();

  if (year !== "all") {
    params.set("year", String(year));
  } else {
    params.set("year", "all");
  }

  if (query) {
    params.set("q", query);
  }

  if (status !== "all") {
    params.set("status", status);
  }

  return `/applications?${params.toString()}`;
}

export default async function ApplicationsPage({
  searchParams
}: {
  searchParams?: {
    q?: string;
    status?: ApplicationStatus | "all";
    year?: string;
    message?: string;
  };
}) {
  const applications = await getApplications();
  const query = searchParams?.q?.trim() ?? "";
  const statusFilter: ApplicationStatus | "all" = pipelineColumns.some((column) => column.status === searchParams?.status) ? (searchParams?.status as ApplicationStatus) : "all";
  const years = Array.from(new Set(applications.map((application) => application.applicationYear))).sort((a, b) => b - a);
  const requestedYear = searchParams?.year === "all" ? "all" : Number(searchParams?.year);
  const selectedYear: number | "all" =
    requestedYear === "all" ? "all" : years.includes(requestedYear) ? requestedYear : years[0] ?? new Date().getFullYear();
  const yearApplications = selectedYear === "all" ? applications : applications.filter((application) => application.applicationYear === selectedYear);
  const visibleApplications = yearApplications.filter((application) => matchesSearch(application, query) && (statusFilter === "all" || application.status === statusFilter));
  const savedCount = yearApplications.filter((application) => application.status === "saved").length;
  const appliedCount = yearApplications.filter((application) => application.status !== "saved").length;
  const interviewingCount = yearApplications.filter((application) => application.status === "interviewing").length;
  const offerCount = yearApplications.filter((application) => application.status === "offer").length;

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Pipeline"
          title="Applications"
          description="Track every role from saved to offer without losing momentum."
          actions={
            <Link
              href="/applications/new"
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#2A6384] shadow-sm transition duration-150 hover:bg-[#EAF2F8] active:translate-y-px"
            >
              <Plus size={16} className="transition-transform duration-200 group-hover:rotate-90" /> Add role
            </Link>
          }
        />
        {searchParams?.message && <p className="rise mt-5 rounded-2xl border border-[#2A6384]/20 bg-[#EAF2F8] p-3 text-sm font-semibold text-[#2A6384]">{searchParams.message}</p>}
        {applications.length > 0 ? (
          <>
            <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-slate-950">Application history</h2>
                <p className="text-sm text-slate-600">Switch between recruiting cycles without losing your older boards.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {years.map((year) => (
                  <Link
                    key={year}
                    href={getYearHref(year, query, statusFilter)}
                    className={`metric rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 ${
                      selectedYear === year
                        ? "bg-[#2A6384] text-white shadow-glow"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#2A6384]/40 hover:bg-[#EAF2F8] hover:text-[#2A6384]"
                    }`}
                    aria-current={selectedYear === year ? "page" : undefined}
                  >
                    {year}
                  </Link>
                ))}
                <Link
                  href={getYearHref("all", query, statusFilter)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 ${
                    selectedYear === "all"
                      ? "bg-[#2A6384] text-white shadow-glow"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-[#2A6384]/40 hover:bg-[#EAF2F8] hover:text-[#2A6384]"
                  }`}
                  aria-current={selectedYear === "all" ? "page" : undefined}
                >
                  All years
                </Link>
              </div>
            </section>

            {/* Tones track the pipeline stages: neutral while saved, brand blue
                once live, emerald at an offer. */}
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <DashboardCard title="Tracked" value={yearApplications.length.toString()} helper="Total roles in this cycle." icon={BriefcaseBusiness} tone="bg-[#2A6384] text-white" step={0} />
              <DashboardCard title="Saved" value={savedCount.toString()} helper="Review and apply when ready." icon={Clock3} tone="bg-slate-100 text-slate-600 ring-1 ring-slate-200" step={1} />
              <DashboardCard title="Applied" value={appliedCount.toString()} helper="Roles moved beyond saved." icon={CheckCircle2} tone="bg-[#EAF2F8] text-[#2A6384] ring-1 ring-[#2A6384]/25" step={2} />
              <DashboardCard title="Interviewing" value={interviewingCount.toString()} helper="Active interview loops." icon={MessageSquareText} tone="bg-[#8FB8D4]/35 text-[#214E69] ring-1 ring-[#2A6384]/30" step={3} />
              <DashboardCard title="Offers" value={offerCount.toString()} helper="Unlocked wins." icon={Trophy} tone="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" step={4} />
            </section>

            <ApplicationsFilterForm
              defaultQuery={query}
              defaultStatus={statusFilter}
              selectedYear={selectedYear}
              columns={pipelineColumns}
            />

            <ApplicationPipelineBoard applications={visibleApplications} columns={pipelineColumns} />
          </>
        ) : (
          <div className="mt-8">
            <EmptyState icon={Plus} title="No applications yet" description="Add your first internship to start earning XP and building your streak." actionHref="/applications/new" actionLabel="Add first role" />
          </div>
        )}
      </main>
    </>
  );
}
