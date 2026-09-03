import { Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { getCurrentProfile, getCurrentUser, getLeaderboard, getUnreadPeerMessageCount } from "@/lib/data";
import { getRank, getRankProgress } from "@/lib/rank";

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "CU";
}

function getFirstName(name: string) {
  return name.split(/\s+/).filter(Boolean)[0] ?? "";
}

export async function TopBar() {
  const user = await getCurrentUser();
  const [profile, unreadMessages, leaderboard] = user ? await Promise.all([getCurrentProfile(), getUnreadPeerMessageCount(), getLeaderboard()]) : [null, 0, []];
  const rank = getRank(profile?.xp ?? 0);
  const progress = getRankProgress(profile?.xp ?? 0);
  const rankPosition = user ? leaderboard.findIndex((leader) => leader.id === user.id) + 1 : 0;
  const profileName = profile?.name ?? user?.email ?? "CareerUp";
  const initials = user ? getInitials(profileName) : "";
  const firstName = user ? getFirstName(profile?.name ?? "") : "";
  const currentXp = profile?.xp ?? 0;
  const nextXp = progress.next?.minXp ?? currentXp;

  return (
    <header className="sticky top-0 z-40 hidden items-center justify-between gap-4 border-b border-[#5E7681]/30 bg-[#F8FBFA]/92 px-7 py-3 backdrop-blur-xl lg:flex">
      <Link href="/dashboard" className="group rounded-lg leading-none">
        <span className="font-display block text-4xl font-bold tracking-tight text-[#2A6384] transition duration-150 group-hover:text-[#214E69]">CareerUp</span>
      </Link>

      <div className="flex items-center gap-3">
        {/* A dead streak should look dead — otherwise zero reads the same as twelve. */}
        <span
          className={
            profile && profile.streak > 0
              ? "metric inline-flex h-11 items-center gap-2 rounded-2xl bg-[#EAF2F8] px-4 text-sm font-bold text-[#214E69] shadow-sm ring-1 ring-inset ring-[#2A6384]/30"
              : "metric inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-inset ring-slate-200"
          }
        >
          <Flame size={16} className={profile && profile.streak > 0 ? "fill-[#2A6384] text-[#2A6384]" : "text-slate-400"} />
          {profile?.streak ?? 0} day streak
        </span>
        <Link
          href="/leaderboard"
          className="group hidden min-w-[17rem] rounded-2xl bg-[#F8FBFA] px-4 py-2 shadow-sm ring-1 ring-inset ring-[#5E7681]/30 transition duration-200 hover:-translate-y-0.5 hover:ring-[#2A6384]/45 xl:block"
        >
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={13} className="text-[#2A6384]" />
              {rankPosition > 0 ? `#${rankPosition}` : "Rank"} · {rank.name}
            </span>
            <span className="metric">
              {currentXp.toLocaleString()}
              {progress.next ? `/${nextXp.toLocaleString()}` : ""}
            </span>
          </div>
          <div className="meter-track meter-segments mt-1.5 h-2">
            <div className="game-bar-fill" style={{ width: `${progress.percent}%` }} />
          </div>
        </Link>
        <ProfileDropdown
          initials={initials}
          displayName={firstName}
          loggedIn={!!user}
          schoolLogoUrl={profile?.schoolLogoUrl ?? ""}
          unreadMessages={unreadMessages}
        />
      </div>
    </header>
  );
}
