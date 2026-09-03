import { BookmarkPlus, CalendarDays, ExternalLink, MapPin, Radio } from "lucide-react";
import { savePostingApplication } from "@/lib/applications/actions";
import { bandStyle, fitBand, fitLabel, isFreshPosting } from "@/lib/signal";
import type { InternshipPosting } from "@/lib/types";

export function PostingCard({ posting }: { posting: InternshipPosting }) {
  const fit = bandStyle(fitBand(posting.fitScore));
  const workModeLabel = posting.workMode === "remote" ? "Remote" : posting.workMode === "hybrid" ? "Hybrid" : "On-site";

  return (
    <article className="card card-interactive p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#2A6384]">{posting.company}</p>
          <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-ink">{posting.title}</h3>
        </div>
        <span className={`metric inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${fit.chip}`}>
          {posting.fitScore}% · {fitLabel(posting.fitScore)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm font-medium text-slate-600">
        <span className="inline-flex items-center gap-2">
          <MapPin size={16} /> {posting.location}
        </span>
        <span className="inline-flex items-center gap-2">
          <Radio size={16} /> {workModeLabel}
        </span>
        <span className={isFreshPosting(posting.postedAt) ? "metric inline-flex items-center gap-2 text-[#2A6384]" : "metric inline-flex items-center gap-2"}>
          <CalendarDays size={16} /> {posting.postedAt}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-600">{posting.description || "Open the posting to review role details and application requirements."}</p>

      {posting.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {posting.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <a href={posting.url} target="_blank" rel="noreferrer" className="secondary-button">
          <ExternalLink className="mr-2" size={18} /> Open posting
        </a>
        <div className="flex flex-wrap justify-end gap-3">
          <form action={savePostingApplication}>
            <input type="hidden" name="company" value={posting.company} />
            <input type="hidden" name="role" value={posting.title} />
            <input type="hidden" name="location" value={posting.location} />
            <input type="hidden" name="sourceUrl" value={posting.url} />
            <input type="hidden" name="fitScore" value={posting.fitScore} />
            <input type="hidden" name="returnTo" value="/postings/internships?sort=newest" />
            <button type="submit" className="primary-button">
              <BookmarkPlus className="mr-2" size={18} /> Save +5 XP +1 RP
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}
