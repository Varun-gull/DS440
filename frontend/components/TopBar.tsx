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
    <header className="app-topbar z-40 flex h-[4.5rem] items-center justify-between gap-3 px-4 backdrop-blur-xl sm:px-6 lg:px-7">
      <Link href="/dashboard" className="group rounded-lg leading-none">
        <span className="font-display block text-2xl font-bold tracking-tight text-white transition duration-150 group-hover:text-[#8FB8D4] sm:text-3xl lg:text-[2.25rem]">CareerUp</span>
      </Link>

      <div className="flex items-center gap-3">
        {/* A dead streak should look dead — otherwise zero reads the same as twelve. */}
        <span
          className={
            profile && profile.streak > 0
              ? "metric inline-flex h-11 items-center gap-2 rounded-2xl bg-[#8FB8D4]/18 px-3 text-sm font-bold text-[#CFE2F0] ring-1 ring-inset ring-[#8FB8D4]/35 sm:px-4"
              : "metric inline-flex h-11 items-center gap-2 rounded-2xl bg-white/5 px-3 text-sm font-semibold text-slate-400 ring-1 ring-inset ring-white/10 sm:px-4"
          }
        >
          <Flame size={16} className={profile && profile.streak > 0 ? "fill-[#8FB8D4] text-[#8FB8D4]" : "text-slate-500"} />
          <span>
            {profile?.streak ?? 0}
            <span className="hidden sm:inline"> day streak</span>
          </span>
        </span>
        <Link
          href="/leaderboard"
          className="group hidden min-w-[17rem] rounded-2xl bg-white/5 px-4 py-2 ring-1 ring-inset ring-white/12 transition duration-200 hover:-translate-y-0.5 hover:ring-[#8FB8D4]/45 xl:block"
        >
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-300">
            <span className="inline-flex items-center gap-1">
              <TrendingUp size={13} className="text-[#8FB8D4]" />
              {rankPosition > 0 ? `#${rankPosition}` : "Rank"} · {rank.name}
            </span>
            <span className="metric">
              {currentXp.toLocaleString()}
              {progress.next ? `/${nextXp.toLocaleString()}` : ""}
            </span>
          </div>
          <div className="meter-track meter-segments mt-1.5 h-2 !bg-white/10">
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
