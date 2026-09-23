import { Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import type { GroupLeaderboardRow } from "@/lib/types";

export function GroupLeaderboardTable({ groups }: { groups: GroupLeaderboardRow[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-[#5E7681]/30 bg-[#F8FBFA] p-8 text-center text-[#0F172A] shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF2F8] text-[#2A6384] ring-1 ring-[#5E7681]/25">
          <UsersRound size={22} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-[#0F172A]">No groups yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[#5E7681]">Create a group with friends, then group rankings will show up here.</p>
        <Link href="/friends" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#2A6384] px-5 font-semibold text-white shadow-sm transition hover:bg-[#214E69]">
          Create group
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-[#5E7681]/30 bg-[#F8FBFA] text-[#0F172A] shadow-soft">
      <div className="grid grid-cols-[56px_1fr_130px] gap-4 border-b border-[#5E7681]/20 bg-[#EAF2F8]/55 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-[#5E7681] sm:grid-cols-[56px_1fr_140px_140px]">
        <span>#</span>
        <span>Group</span>
        <span>Total XP</span>
        <span className="hidden sm:block">Members</span>
      </div>
      {groups.map((group, index) => (
        <div key={group.id} className="grid grid-cols-[56px_1fr_130px] gap-4 border-b border-[#5E7681]/15 px-5 py-4 transition last:border-0 hover:bg-[#EAF2F8]/45 sm:grid-cols-[56px_1fr_140px_140px]">
          <span className="flex items-center gap-1 text-lg font-bold text-[#5E7681]">
            {index < 3 && <Trophy size={16} className={index === 0 ? "text-[#2A6384]" : index === 1 ? "text-[#8FB8D4]" : "text-[#5E7681]"} />}
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#0F172A]">
              {group.name}
              {group.currentUserMember && <span className="ml-2 rounded-full bg-[#EAF2F8] px-2 py-0.5 text-xs font-semibold text-[#2A6384] ring-1 ring-[#5E7681]/25">Your group</span>}
            </p>
            <p className="truncate text-sm text-slate-500">{group.description || "CareerUp squad"}</p>
          </div>
          <div>
            <p className="font-semibold text-[#2A6384]">{group.totalXp.toLocaleString()} XP</p>
            <p className="text-xs font-semibold text-[#5E7681]">{group.averageXp.toLocaleString()} avg</p>
          </div>
          <span className="hidden items-center gap-1 font-semibold text-[#5E7681] sm:inline-flex">
            <UsersRound size={16} className="text-[#2A6384]" /> {group.memberCount}
          </span>
        </div>
      ))}
    </div>
  );
}
