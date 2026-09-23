import { BookmarkPlus, CheckCircle2, ExternalLink, UsersRound } from "lucide-react";
import Link from "next/link";
import { savePostingApplication } from "@/lib/applications/actions";
import { PostingApplyFollowUpPrompt, PostingApplyLink } from "@/components/PostingApplyFollowUp";
import { SubmitButton } from "@/components/SubmitButton";
import { bandStyle, fitBand, fitLabel, isFreshPosting } from "@/lib/signal";
import { buildRoleKey } from "@/lib/role-key";
import type { InternshipPosting, RolePeerInsight } from "@/lib/types";

const APPLY_BUTTON =
  "inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-[#2A6384] px-3 text-xs font-semibold text-white shadow-sm transition duration-150 hover:bg-[#214E69] active:translate-y-px";

const SAVE_BUTTON =
  "inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-[#5E7681]/35 bg-white px-2 text-xs font-semibold text-[#2A6384] transition duration-150 hover:border-[#2A6384]/45 hover:bg-[#EAF2F8] active:translate-y-px disabled:cursor-progress";

const SAVED_BUTTON =
  "inline-flex min-h-9 w-full cursor-default items-center justify-center rounded-xl bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200";

/** Work mode is a category, not a score, so it stays off the signal ramp. */
function workModeTone(workMode: InternshipPosting["workMode"]) {
  if (workMode === "remote") {
    return "bg-[#EAF2F8] text-[#214E69] ring-[#2A6384]/25";
  }

  if (workMode === "hybrid") {
    return "bg-[#8FB8D4]/25 text-[#214E69] ring-[#2A6384]/20";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

/** Fit is a measurement, so it gets the same readout treatment everywhere. */
function FitMeter({ fitScore }: { fitScore: number }) {
  const band = bandStyle(fitBand(fitScore));

  return (
    <div className="w-full" title={fitLabel(fitScore)}>
      <p className={`metric text-sm font-bold ${band.text}`}>{fitScore}%</p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
        <div className={`h-full rounded-full ${band.fill}`} style={{ width: `${fitScore}%` }} />
      </div>
      <span className="sr-only">{fitLabel(fitScore)}</span>
    </div>
  );
}

function workModeLabel(workMode: InternshipPosting["workMode"]) {
  return workMode === "remote" ? "Remote" : workMode === "hybrid" ? "Hybrid" : "On-site";
}

export function PostingsTable({
  postings,
  returnTo,
  savedSourceUrls,
  peerInsights,
}: {
  postings: InternshipPosting[];
  returnTo: string;
  savedSourceUrls: Set<string>;
  peerInsights: Map<string, RolePeerInsight>;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/85 bg-white/70 shadow-soft backdrop-blur-2xl">
      <PostingApplyFollowUpPrompt />
      <div className="divide-y divide-slate-200 md:hidden">
        {postings.map((posting, index) => {
          const saved = savedSourceUrls.has(posting.url);
          const roleKey = buildRoleKey(posting.company, posting.title);
          const peerInsight = peerInsights.get(roleKey);
          const insightHref = `/postings/insights?${new URLSearchParams({
            roleKey,
            company: posting.company,
            role: posting.title,
            returnTo
          }).toString()}`;

          return (
            <article key={posting.id} className="data-row p-4">
              <div className="flex items-start gap-3">
                <span className="metric mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#EAF2F8] text-xs font-semibold text-[#2A6384]">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight text-ink">{posting.title}</p>
                  <p className="mt-1 text-xs font-semibold text-[#2A6384]">{posting.company}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className={`rounded-full px-2.5 py-1 font-semibold ring-1 ring-inset ${workModeTone(posting.workMode)}`}>{workModeLabel(posting.workMode)}</span>
                    <span className={`metric rounded-full px-2.5 py-1 font-bold ring-1 ring-inset ${bandStyle(fitBand(posting.fitScore)).chip}`}>
                      {posting.fitScore}% · {fitLabel(posting.fitScore)}
                    </span>
                    <span
                      className={
                        isFreshPosting(posting.postedAt)
                          ? "metric rounded-full bg-[#EAF2F8] px-2.5 py-1 font-semibold text-[#214E69]"
                          : "metric rounded-full bg-slate-100 px-2.5 py-1"
                      }
                    >
                      {posting.postedAt}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-slate-600">{posting.location}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <PostingApplyLink
                  posting={{
                    company: posting.company,
                    role: posting.title,
                    location: posting.location,
                    sourceUrl: posting.url,
                    fitScore: posting.fitScore
                  }}
                  returnTo={returnTo}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#2A6384] px-3 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#214E69] active:translate-y-px"
                >
                  <ExternalLink className="mr-1.5" size={15} /> Apply
                </PostingApplyLink>
                <form action={savePostingApplication}>
                  <input type="hidden" name="company" value={posting.company} />
                  <input type="hidden" name="role" value={posting.title} />
                  <input type="hidden" name="location" value={posting.location} />
                  <input type="hidden" name="sourceUrl" value={posting.url} />
                  <input type="hidden" name="fitScore" value={posting.fitScore} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="status" value="saved" />
                  <SubmitButton
                    disabled={saved}
                    pendingLabel="Saving"
                    className={
                      saved
                        ? "inline-flex min-h-10 w-full cursor-default items-center justify-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200"
                        : "inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[#5E7681]/35 bg-white px-3 text-sm font-semibold text-[#2A6384] transition duration-150 hover:border-[#2A6384]/45 hover:bg-[#EAF2F8] active:translate-y-px disabled:cursor-progress"
                    }
                  >
                    <>
                      {saved ? <CheckCircle2 className="mr-1.5" size={15} /> : <BookmarkPlus className="mr-1.5" size={15} />}
                      {saved ? "Saved" : "Save"}
                    </>
                  </SubmitButton>
                </form>
              </div>

              <Link
                href={insightHref}
                className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-[#EAF2F8] px-3 text-xs font-semibold text-[#2A6384] ring-1 ring-inset ring-[#5E7681]/25 transition hover:bg-[#dfeaf3]"
              >
                <UsersRound className="mr-1.5" size={14} />
                {peerInsight?.trackedCount ?? 0} tracked · {peerInsight?.interviewedCount ?? 0} interviewing
              </Link>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden md:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-white/55 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="hidden w-10 px-2 py-4 lg:table-cell">#</th>
              <th className="w-[32%] px-3 py-4">Position</th>
              <th className="hidden w-20 px-2 py-4 xl:table-cell">Date</th>
              <th className="w-24 px-2 py-4">Apply</th>
              <th className="hidden w-28 px-2 py-4 md:table-cell">Mode</th>
              <th className="w-[20%] px-3 py-4">Location</th>
              <th className="hidden w-[16%] px-3 py-4 lg:table-cell">Company</th>
              <th className="hidden w-28 px-2 py-4 xl:table-cell">Peers</th>
              <th className="w-16 px-2 py-4">Fit</th>
              <th className="w-24 px-2 py-4">Save</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {postings.map((posting, index) => {
              const saved = savedSourceUrls.has(posting.url);
              const roleKey = buildRoleKey(posting.company, posting.title);
              const peerInsight = peerInsights.get(roleKey);
              const insightHref = `/postings/insights?${new URLSearchParams({
                roleKey,
                company: posting.company,
                role: posting.title,
                returnTo
              }).toString()}`;

              return (
              <tr key={posting.id} className="data-row-tr align-middle">
                <td className="metric hidden px-2 py-3 text-center font-medium text-slate-500 lg:table-cell">{index + 1}</td>
                <td className="px-3 py-3">
                  <p className="truncate font-semibold text-ink" title={posting.title}>
                    {posting.title}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500" title={`${posting.company} · ${posting.source}`}>
                    {posting.company} · {posting.source}
                  </p>
                </td>
                <td
                  className={
                    isFreshPosting(posting.postedAt)
                      ? "metric hidden whitespace-nowrap px-2 py-3 font-bold text-[#2A6384] xl:table-cell"
                      : "metric hidden whitespace-nowrap px-2 py-3 text-slate-500 xl:table-cell"
                  }
                >
                  {posting.postedAt}
                </td>
                <td className="px-2 py-3">
                  <PostingApplyLink
                    posting={{
                      company: posting.company,
                      role: posting.title,
                      location: posting.location,
                      sourceUrl: posting.url,
                      fitScore: posting.fitScore
                    }}
                    returnTo={returnTo}
                    className={APPLY_BUTTON}
                  >
                    <ExternalLink className="mr-1" size={14} /> Apply
                  </PostingApplyLink>
                </td>
                <td className="hidden whitespace-nowrap px-2 py-3 md:table-cell">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${workModeTone(posting.workMode)}`}>{workModeLabel(posting.workMode)}</span>
                </td>
                <td className="px-3 py-3">
                  <p className="truncate text-slate-600" title={posting.location}>
                    {posting.location}
                  </p>
                </td>
                <td className="hidden px-3 py-3 lg:table-cell">
                  <p className="truncate font-semibold text-[#2A6384]" title={posting.company}>
                    {posting.company}
                  </p>
                </td>
                <td className="hidden px-2 py-3 xl:table-cell">
                  <Link
                    href={insightHref}
                    className="metric inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-[#EAF2F8] px-2 text-xs font-semibold text-[#2A6384] ring-1 ring-inset ring-[#5E7681]/25 transition hover:bg-[#dfeaf3]"
                    title="See who else tracked this role"
                  >
                    <UsersRound className="mr-1" size={14} />
                    {peerInsight?.trackedCount ?? 0}
                    <span className="ml-1 text-[10px] text-[#5E7681]">/{peerInsight?.interviewedCount ?? 0} int</span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-2 py-3">
                  <FitMeter fitScore={posting.fitScore} />
                </td>
                <td className="px-2 py-3">
                  <form action={savePostingApplication}>
                    <input type="hidden" name="company" value={posting.company} />
                    <input type="hidden" name="role" value={posting.title} />
                    <input type="hidden" name="location" value={posting.location} />
                    <input type="hidden" name="sourceUrl" value={posting.url} />
                    <input type="hidden" name="fitScore" value={posting.fitScore} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <input type="hidden" name="status" value="saved" />
                    <SubmitButton disabled={saved} pendingLabel="Saving" className={saved ? SAVED_BUTTON : SAVE_BUTTON}>
                      <>
                        {saved ? <CheckCircle2 className="mr-1" size={14} /> : <BookmarkPlus className="mr-1" size={14} />}
                        {saved ? "Saved" : "Save"}
                      </>
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
