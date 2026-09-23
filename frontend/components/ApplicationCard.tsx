"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ExternalLink, MapPin, Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { StatusUpdateForm } from "./StatusUpdateForm";
import { deleteApplication } from "@/lib/applications/actions";
import { bandStyle, deadlinePrefix, deadlineStyle, deadlineUrgency, fitBand, fitLabel } from "@/lib/signal";
import type { Application } from "@/lib/types";

export function ApplicationCard({ application, compact = false }: { application: Application; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const sourceIsUrl = application.source.startsWith("http://") || application.source.startsWith("https://");
  const fit = bandStyle(fitBand(application.fitScore));
  const urgency = deadlineUrgency(application.deadline);
  const isPressing = urgency === "overdue" || urgency === "today";

  if (compact) {
    return (
      <article className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2A6384]/40 hover:shadow-soft">
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-3 text-left transition duration-150 hover:bg-[#EAF2F8]/60"
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-[#2A6384]">{application.company}</p>
            <h3 className="mt-0.5 truncate text-sm font-semibold text-ink">{application.role}</h3>
            <p className="mt-1 truncate text-xs text-slate-500">{application.location}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Deadline pressure has to be visible before the card is opened. */}
            {(isPressing || urgency === "soon") && (
              <span
                className={clsx(
                  "h-2 w-2 rounded-full",
                  isPressing ? "bg-rose-600" : "bg-amber-600"
                )}
                title={`${deadlinePrefix(urgency)} ${application.deadline}`}
                aria-label={`${deadlinePrefix(urgency)} ${application.deadline}`}
              />
            )}
            <ChevronDown
              className={`text-slate-500 transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`}
              size={18}
            />
          </div>
        </button>

        {expanded && (
          <div className="rise border-t border-slate-200 px-3 py-3">
            <div className="grid gap-3 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} /> {application.location}
              </span>
              <span className={clsx("metric inline-flex items-center gap-2", deadlineStyle(urgency), isPressing && "font-bold")}>
                <CalendarDays size={16} /> {deadlinePrefix(urgency)} {application.deadline}
              </span>
              {sourceIsUrl ? (
                <a className="inline-flex items-center gap-2 font-semibold text-[#2A6384] hover:text-[#214E69]" href={application.source} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Posting
                </a>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <ExternalLink size={16} /> {application.source}
                </span>
              )}
              <span className={clsx("metric inline-flex items-center gap-2 font-bold", fit.text)}>
                <Sparkles size={16} /> {application.fitScore}% · {fitLabel(application.fitScore)}
              </span>
            </div>
            <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
              <StatusUpdateForm application={application} compact />
              <form action={deleteApplication} className="justify-self-end">
                <input type="hidden" name="applicationId" value={application.id} />
                <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-500 transition duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${application.company} application`}>
                  <Trash2 size={16} />
                </button>
              </form>
            </div>
          </div>
        )}
      </article>
    );
  }

  return (
    <article className="card card-interactive p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#2A6384]">{application.company}</p>
          <h3 className="mt-1 font-display text-lg font-bold tracking-tight text-ink">{application.role}</h3>
        </div>
        <ApplicationStatusBadge status={application.status} />
      </div>
      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <span className="inline-flex items-center gap-2">
          <MapPin size={16} /> {application.location}
        </span>
        <span className={clsx("metric inline-flex items-center gap-2", deadlineStyle(urgency), isPressing && "font-bold")}>
          <CalendarDays size={16} /> {deadlinePrefix(urgency)} {application.deadline}
        </span>
        {sourceIsUrl ? (
          <a className="inline-flex items-center gap-2 font-semibold text-[#2A6384] hover:text-[#214E69]" href={application.source} target="_blank" rel="noreferrer">
            <ExternalLink size={16} /> Posting
          </a>
        ) : (
          <span className="inline-flex items-center gap-2">
            <ExternalLink size={16} /> {application.source}
          </span>
        )}
        <span className={clsx("metric inline-flex items-center gap-2 font-bold", fit.text)}>
          <Sparkles size={16} /> {application.fitScore}% · {fitLabel(application.fitScore)}
        </span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <StatusUpdateForm application={application} />
        <form action={deleteApplication}>
          <input type="hidden" name="applicationId" value={application.id} />
          <button type="submit" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-500 transition duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${application.company} application`}>
            <Trash2 size={16} />
          </button>
        </form>
      </div>
    </article>
  );
}
