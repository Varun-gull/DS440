import clsx from "clsx";
import type { ApplicationStatus } from "@/lib/types";

const labels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected"
};

/**
 * A pipeline is a real sequence, so the palette deepens as a role advances:
 * neutral while saved, brand blue once it is live, emerald at an offer, and
 * quiet slate when it closes.
 */
const styles: Record<ApplicationStatus, string> = {
  saved: "bg-slate-100 text-slate-600 ring-slate-200",
  applied: "bg-[#eef3fc] text-[#2456a6] ring-[#2456a6]/25",
  interviewing: "bg-[#2456a6] text-white ring-[#2456a6]",
  offer: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-slate-50 text-slate-500 ring-slate-200"
};

/** Stage accents shared by the pipeline board columns and the summary cards. */
export const statusAccents: Record<ApplicationStatus, { dot: string; column: string }> = {
  saved: { dot: "bg-slate-400", column: "ring-slate-200" },
  applied: { dot: "bg-[#8FB8D4]", column: "ring-[#8FB8D4]/50" },
  interviewing: { dot: "bg-[#2456a6]", column: "ring-[#2456a6]/35" },
  offer: { dot: "bg-emerald-500", column: "ring-emerald-300/60" },
  rejected: { dot: "bg-slate-300", column: "ring-slate-200" }
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset", styles[status])}>
      {labels[status]}
    </span>
  );
}
