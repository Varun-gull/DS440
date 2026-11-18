import { Crown, Gem, List, Rocket, Trophy, UserPlus } from "lucide-react";
import Link from "next/link";
import { ProfileLink } from "./ProfileLink";
import { TopBadge } from "./BadgeDisplay";
import { getRank, getRankProgress } from "@/lib/rank";
import type { LeaderboardUser } from "@/lib/types";

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || "C";
}

function getLevel(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 1);
}

function leagueLabel(xp: number) {
  return getRank(xp).name.toUpperCase();
}

function Avatar({ user, size = "md" }: { user: LeaderboardUser; size?: "md" | "lg" }) {
  return (
    <div
      className={
        size === "lg"
          ? "flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#8FB8D4] bg-[#EFF7F3] shadow-glow"
          : "flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#5E7681]/35 bg-[#EFF7F3]"
      }
    >
      {user.schoolLogoUrl ? (
        <img src={user.schoolLogoUrl} alt="" className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className={size === "lg" ? "font-display text-2xl font-bold tracking-tight text-[#23675D]" : "text-sm font-semibold text-[#23675D]"}>{getInitial(user.name)}</span>
      )}
    </div>
  );
}

function PodiumCard({ user, place }: { user: LeaderboardUser; place: 1 | 2 | 3 }) {
  return (
    <article className="leader-highlight" data-place={place}>
      <div className="leader-highlight-label"><span>{place === 1 ? <Crown size={15} aria-hidden /> : <Trophy size={15} aria-hidden />} #{place}</span><span>{leagueLabel(user.xp)}</span></div>
      <div className="leader-highlight-person">
        <Avatar user={user} />
        <ProfileLink profileId={user.id} name={user.name} className="truncate font-semibold text-ink">{user.name}</ProfileLink>
      </div>
      <p className="leader-highlight-xp"><Gem size={16} aria-hidden /> {user.xp.toLocaleString()} <span>XP earned</span></p>
    </article>
  );
}

export function LeaderboardTable({ users, currentUserId, emptyMode = "global" }: { users: LeaderboardUser[]; currentUserId?: string; emptyMode?: "global" | "friends" }) {
  const sorted = [...users].sort((a, b) => b.xp - a.xp);
  const topThree = sorted.slice(0, 3);
  const podium = topThree;
  const rest = sorted.slice(3);
  const currentIndex = currentUserId ? sorted.findIndex((user) => user.id === currentUserId) : -1;
  const currentUser = currentIndex >= 0 ? sorted[currentIndex] : null;
  const nextUser = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const currentProgress = currentUser ? getRankProgress(currentUser.xp) : null;

  if (sorted.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFF7F3] text-brand">
          <UserPlus size={22} />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-ink">{emptyMode === "friends" ? "No friends on the board yet" : "No leaderboard data yet"}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          {emptyMode === "friends" ? "Add a friend, accept a request, and this board will turn into your personal competition." : "Once students start earning XP, rankings will appear here."}
        </p>
        {emptyMode === "friends" && (
          <Link href="/friends" className="primary-button mt-5">
            Add friends
          </Link>
        )}
      </div>
    );
  }

  return (
    <section className="leaderboard-surface card overflow-hidden text-slate-900">
      {podium.length > 0 && (
        <div className="leader-highlights">
          {podium.map((user) => {
            const place = (sorted.findIndex((candidate) => candidate.id === user.id) + 1) as 1 | 2 | 3;
            return <PodiumCard key={user.id} user={user} place={place} />;
          })}
        </div>
      )}

      <div className="border-t border-[#5E7681]/20">
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <List size={20} className="text-[#23675D]" />
            <h2 className="font-display text-lg font-bold text-[#0F172A]">Top contributors</h2>
          </div>
          <span className="rounded-lg bg-[#EFF7F3] px-3 py-2 text-xs font-semibold text-[#23675D]">Lifetime XP</span>
        </div>

        <div className="leaderboard-columns leaderboard-column-head border-y border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <span>Rank</span>
          <span>Student</span>
          <span className="leaderboard-level">Level</span>
          <span>Total XP</span>
          <span className="leaderboard-badge text-right">Badge</span>
        </div>

        {(rest.length > 0 ? rest : sorted).map((user, index) => {
          const rankNumber = rest.length > 0 ? index + 4 : index + 1;
          return (
            <div
              key={user.id}
              className="data-row leaderboard-columns border-b border-slate-100 last:border-0"
            >
              <span className="metric flex items-center font-display text-lg font-bold text-[#5E7681]">{String(rankNumber).padStart(2, "0")}</span>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar user={user} />
                <div className="min-w-0">
                  <ProfileLink profileId={user.id} name={user.name} className="block truncate text-base font-semibold text-[#0F172A]">
                    {user.name}
                  </ProfileLink>
                  <p className="truncate text-[11px] font-semibold uppercase text-slate-500">{leagueLabel(user.xp)}</p>
                  {currentUserId === user.id && <span className="mt-1 inline-flex rounded-full bg-[#EFF7F3] px-2 py-0.5 text-[10px] font-semibold text-[#23675D] ring-1 ring-[#5E7681]/25">You</span>}
                </div>
              </div>
              <span className="leaderboard-level metric items-center text-sm font-semibold text-[#23675D]">LVL {getLevel(user.xp)}</span>
              <span className="metric flex items-center font-semibold text-slate-800">{user.xp.toLocaleString()} XP</span>
              <div className="leaderboard-badge items-center justify-end">
                <TopBadge applicationsApplied={user.applicationsApplied} />
              </div>
            </div>
          );
        })}
      </div>

      {currentUser && currentProgress && (
        <div className="leaderboard-footer grid gap-5 border-t border-slate-200 bg-[#EFF7F3]/65 px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <span className="font-display text-xl font-bold text-[#23675D]">{currentIndex + 1}</span>
            <Avatar user={currentUser} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#23675D]">{currentUser.name} <span className="text-slate-500">(You)</span></p>
              <p className="text-xs font-semibold uppercase text-[#5E7681]">{leagueLabel(currentUser.xp)} · Top {Math.max(1, Math.round(((currentIndex + 1) / sorted.length) * 100))}%</p>
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#5E7681]">
              <span>{nextUser ? `Next Rank: ${currentIndex} (${nextUser.name})` : "You are at the top"}</span>
              <span>{nextUser ? `${Math.max(0, nextUser.xp - currentUser.xp).toLocaleString()} XP to pass` : "Leader"}</span>
            </div>
            <div className="meter-track meter-segments mt-2 h-2 bg-white">
              <div className="game-bar-fill" style={{ width: `${currentProgress.percent}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap">
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-semibold uppercase text-[#5E7681]">Current XP</p>
              <p className="metric font-display text-xl font-bold text-[#0F172A]">{currentUser.xp.toLocaleString()}</p>
            </div>
            <Link href="/rewards" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-[#23675D]/20 bg-[#23675D] px-5 text-sm font-semibold text-white transition hover:bg-[#185348]">
              <Rocket size={16} /> Boost Rank
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
