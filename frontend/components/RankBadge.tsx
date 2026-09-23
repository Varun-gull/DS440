import clsx from "clsx";
import { getRank } from "@/lib/rank";

export function RankBadge({ xp }: { xp: number }) {
  const rank = getRank(xp);

  return <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-bold", rank.color)}>{rank.name}</span>;
}
