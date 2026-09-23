export const ranks = [
  { name: "Associate", minXp: 0, color: "bg-slate-200 text-slate-800" },
  { name: "Manager", minXp: 250, color: "bg-slate-300 text-slate-900" },
  { name: "Director", minXp: 750, color: "bg-amber-100 text-amber-900" },
  { name: "Vice President", minXp: 1500, color: "bg-blue-100 text-blue-900" },
  { name: "CEO", minXp: 3000, color: "bg-ink text-white" }
] as const;

export function getRank(xp: number) {
  return [...ranks].reverse().find((rank) => xp >= rank.minXp) ?? ranks[0];
}

export function getNextRank(xp: number) {
  return ranks.find((rank) => rank.minXp > xp) ?? null;
}

export function getRankProgress(xp: number) {
  const current = getRank(xp);
  const next = getNextRank(xp);

  if (!next) {
    return { current, next, percent: 100, remaining: 0 };
  }

  const earnedInLevel = xp - current.minXp;
  const levelSize = next.minXp - current.minXp;

  return {
    current,
    next,
    percent: Math.round((earnedInLevel / levelSize) * 100),
    remaining: next.minXp - xp
  };
}
