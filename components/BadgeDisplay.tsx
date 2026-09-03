import clsx from "clsx";
import { applicationBadges, getEarnedBadges, getTopBadge } from "@/lib/badges/catalog";

export function TopBadge({ applicationsApplied }: { applicationsApplied: number }) {
  const badge = getTopBadge(applicationsApplied);
  if (!badge) return null;
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ring-1", badge.color)}>
      {badge.emoji} {badge.label}
    </span>
  );
}

export function BadgeShelf({ applicationsApplied }: { applicationsApplied: number }) {
  const earned = getEarnedBadges(applicationsApplied);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
      <p className="mb-3 text-sm font-bold text-slate-500">Challenge badges</p>
      {earned.length === 0 ? (
        <p className="text-sm text-slate-400">Submit your first application to earn your first badge.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {earned.map((badge) => (
            <span
              key={badge.id}
              title={badge.description}
              className={clsx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1", badge.color)}
            >
              {badge.emoji} {badge.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
