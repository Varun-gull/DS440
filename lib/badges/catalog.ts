export type Badge = {
  id: string;
  label: string;
  description: string;
  threshold: number; // applications_applied needed
  color: string;     // tailwind classes for bg + text + ring
  emoji: string;
};

export const applicationBadges: Badge[] = [
  { id: "apps-bronze",   label: "First Application",      description: "Submitted 1 application",    threshold: 1,    color: "bg-amber-50 text-amber-700 ring-amber-300",   emoji: "🥉" },
  { id: "apps-silver",   label: "Consistent Applicant",   description: "Submitted 25 applications",  threshold: 25,   color: "bg-slate-100 text-slate-600 ring-slate-300",  emoji: "🥈" },
  { id: "apps-gold",     label: "High-Volume Applicant",  description: "Submitted 100 applications", threshold: 100,  color: "bg-yellow-50 text-yellow-700 ring-yellow-300", emoji: "🥇" },
  { id: "apps-platinum", label: "Advanced Searcher",      description: "Submitted 250 applications", threshold: 250,  color: "bg-sky-50 text-sky-700 ring-sky-300",         emoji: "💎" },
  { id: "apps-diamond",  label: "Power User",             description: "Submitted 1000 applications",threshold: 1000, color: "bg-violet-50 text-violet-700 ring-violet-300", emoji: "👑" },
];

export function getEarnedBadges(applicationsApplied: number): Badge[] {
  return applicationBadges.filter((b) => applicationsApplied >= b.threshold);
}

export function getTopBadge(applicationsApplied: number): Badge | null {
  const earned = getEarnedBadges(applicationsApplied);
  return earned[earned.length - 1] ?? null;
}
