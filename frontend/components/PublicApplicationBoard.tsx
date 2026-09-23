import clsx from "clsx";
import { CalendarDays, ExternalLink, MapPin, Sparkles } from "lucide-react";
import { statusAccents } from "@/components/ApplicationStatusBadge";
import { bandStyle, deadlinePrefix, deadlineStyle, deadlineUrgency, fitBand } from "@/lib/signal";
import type { Application, ApplicationStatus } from "@/lib/types";

const columns: Array<{ status: ApplicationStatus; title: string; helper: string }> = [
  { status: "saved", title: "Saved", helper: "Ready to review" },
  { status: "applied", title: "Applied", helper: "Submitted" },
  { status: "interviewing", title: "Interviewing", helper: "Active loops" },
  { status: "offer", title: "Offer", helper: "Wins" },
  { status: "rejected", title: "Rejected", helper: "Closed" }
];

export function PublicApplicationBoard({ applications }: { applications: Application[] }) {
  const groupedApplications = columns.map((column) => ({
    ...column,
    applications: applications.filter((application) => application.status === column.status)
  }));

  return (
    <section className="overflow-x-auto pb-3">
      <div className="grid min-w-[1040px] gap-4 xl:grid-cols-5">
        {groupedApplications.map((column) => (
          <div key={column.status} className={clsx("min-w-0 rounded-3xl bg-white/85 p-3 shadow-sm ring-1 ring-inset backdrop-blur", statusAccents[column.status].column)}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={clsx("h-2 w-2 shrink-0 rounded-full", statusAccents[column.status].dot)} aria-hidden />
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-ink">{column.title}</h3>
                  <p className="truncate text-xs text-slate-500">{column.helper}</p>
                </div>
              </div>
              <span className="metric rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{column.applications.length}</span>
            </div>

            {column.applications.length > 0 ? (
              <div className="grid gap-3">
                {column.applications.map((application) => {
                  const sourceIsUrl = application.source.startsWith("http://") || application.source.startsWith("https://");
                  const fit = bandStyle(fitBand(application.fitScore));
                  const urgency = deadlineUrgency(application.deadline);

                  return (
                    <article key={application.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="truncate text-xs font-semibold uppercase tracking-wide text-[#2A6384]">{application.company}</p>
                      <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{application.role}</h4>
                      <p className="mt-2 flex items-center gap-2 truncate text-xs text-slate-500">
                        <MapPin size={14} /> {application.location}
                      </p>
                      <div className="mt-3 grid gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
                        <span className={clsx("metric inline-flex items-center gap-2 font-semibold", deadlineStyle(urgency))}>
                          <CalendarDays size={14} /> {deadlinePrefix(urgency)} {application.deadline}
                        </span>
                        <span className={clsx("metric inline-flex items-center gap-2 font-bold", fit.text)}>
                          <Sparkles size={14} /> {application.fitScore}% fit
                        </span>
                        {sourceIsUrl && (
                          <a href={application.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-semibold text-[#2A6384] hover:text-[#214E69]">
                            <ExternalLink size={14} /> Posting
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/85 p-4 text-sm text-slate-500">No roles here.</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
