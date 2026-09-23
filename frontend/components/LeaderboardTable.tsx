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
          ? "flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-[#8FB8D4] bg-[#EAF2F8] shadow-glow"
          : "flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-[#5E7681]/35 bg-[#EAF2F8]"
      }
    >
      {user.schoolLogoUrl ? (
        <img src={user.schoolLogoUrl} alt="" className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className={size === "lg" ? "font-display text-2xl font-bold tracking-tight text-[#2A6384]" : "text-sm font-semibold text-[#2A6384]"}>{getInitial(user.name)}</span>
      )}
    </div>
  );
}

/* The podium is genuinely a ranking, so height carries the rank and the three
   cards arrive bottom-up: third, second, then the leader. */
const podiumStyles = {
  1: {
    order: "md:order-2",
    minHeight: "min-h-[17rem] md:min-h-[24rem]",
    border: "border-amber-300",
    badge: "bg-amber-300 text-[#2A6384]",
    nameColor: "text-[#2A6384]",
    nameSize: "text-2xl md:text-3xl",
    delay: "320ms"
  },
  2: {
    order: "md:order-1",
    minHeight: "min-h-[15rem] md:min-h-[20rem]",
    border: "border-[#8FB8D4]",
    badge: "bg-[#8FB8D4] text-[#0F172A]",
    nameColor: "text-slate-800",
    nameSize: "text-2xl",
    delay: "180ms"
  },
  3: {
    order: "md:order-3",
    minHeight: "min-h-[14rem] md:min-h-[17rem]",
    border: "border-[#5E7681]/55",
    badge: "bg-[#5E7681] text-white",
    nameColor: "text-slate-800",
    nameSize: "text-2xl",
    delay: "60ms"
  }
} as const;

function PodiumCard({ user, place }: { user: LeaderboardUser; place: 1 | 2 | 3 }) {
  const style = podiumStyles[place];
  const isFirst = place === 1;

  return (
    <article
      style={{ ["--rise-delay" as string]: style.delay }}
      className={`card-interactive rise relative flex w-full flex-col items-center justify-center self-end rounded-3xl border bg-[#F8FBFA] p-6 text-center shadow-soft md:flex-1 ${style.border} ${style.order} ${style.minHeight}`}
    >
      {isFirst && (
        <span className="absolute right-5 top-5 rounded-full border border-amber-300 bg-amber-50 p-2 text-amber-500">
          <Crown size={18} />
        </span>
      )}
      <div className="relative">
        <Avatar user={user} size="lg" />
        <span className={`metric absolute -bottom-3 left-1/2 flex h-10 min-w-10 -translate-x-1/2 items-center justify-center gap-1 rounded-full px-2 text-sm font-semibold shadow-sm ${style.badge}`}>
          <Trophy size={16} />
          {place}
        </span>
      </div>
      <ProfileLink
        profileId={user.id}
        name={user.name}
        className={`mt-7 block truncate font-display font-bold tracking-tight ${style.nameSize} ${style.nameColor}`}
      >
        {user.name}
      </ProfileLink>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#5E7681]">{leagueLabel(user.xp)}</p>
      <div className="metric mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#EAF2F8] px-4 py-2 font-display text-lg font-bold text-[#2A6384] ring-1 ring-inset ring-[#5E7681]/25">
        <Gem size={18} /> {user.xp.toLocaleString()} XP
      </div>
    </article>
  );
}

export function LeaderboardTable({ users, currentUserId, emptyMode = "global" }: { users: LeaderboardUser[]; currentUserId?: string; emptyMode?: "global" | "friends" }) {
  const sorted = [...users].sort((a, b) => b.xp - a.xp);
  const topThree = sorted.slice(0, 3);
  const podium = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  const rest = sorted.slice(3);
  const currentIndex = currentUserId ? sorted.findIndex((user) => user.id === currentUserId) : -1;
  const currentUser = currentIndex >= 0 ? sorted[currentIndex] : null;
  const nextUser = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const currentProgress = currentUser ? getRankProgress(currentUser.xp) : null;

  if (sorted.length === 0) {
    return (
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
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
    <section className="overflow-hidden rounded-3xl border border-[#5E7681]/30 bg-[#F8FBFA] text-slate-900 shadow-soft">
      {podium.length > 0 && (
        <div className="flex flex-col items-center gap-6 bg-gradient-to-b from-[#EAF2F8]/60 to-transparent p-6 md:flex-row md:items-end md:justify-center md:gap-6 md:p-8">
          {podium.map((user) => {
            const place = (sorted.findIndex((candidate) => candidate.id === user.id) + 1) as 1 | 2 | 3;
            return <PodiumCard key={user.id} user={user} place={place} />;
          })}
        </div>
      )}

      <div className="border-t border-[#5E7681]/20">
        <div className="flex items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <List size={20} className="text-[#2A6384]" />
            <h2 className="font-display text-lg font-bold text-[#0F172A]">Top contributors</h2>
          </div>
          <span className="rounded-xl bg-[#EAF2F8] px-4 py-2 text-xs font-semibold text-[#2A6384] ring-1 ring-[#5E7681]/25">Monthly</span>
        </div>

        <div className="grid grid-cols-[64px_minmax(0,1fr)_86px_120px] gap-4 border-y border-[#5E7681]/20 bg-[#EAF2F8]/55 px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-[#5E7681] md:grid-cols-[80px_minmax(0,1fr)_140px_160px_140px]">
          <span>Rank</span>
          <span>Username</span>
          <span>Level</span>
          <span>Total XP</span>
          <span className="hidden md:block text-right">Badge</span>
        </div>

        {(rest.length > 0 ? rest : sorted).map((user, index) => {
          const rankNumber = rest.length > 0 ? index + 4 : index + 1;
          return (
            <div
              key={user.id}
              className="data-row grid grid-cols-[64px_minmax(0,1fr)_86px_120px] gap-4 border-b border-[#5E7681]/15 px-6 py-4 last:border-0 md:grid-cols-[80px_minmax(0,1fr)_140px_160px_140px]"
            >
              <span className="metric flex items-center font-display text-lg font-bold text-[#5E7681]">{String(rankNumber).padStart(2, "0")}</span>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar user={user} />
                <div className="min-w-0">
                  <ProfileLink profileId={user.id} name={user.name} className="block truncate text-base font-semibold text-[#0F172A]">
                    {user.name}
                  </ProfileLink>
                  <p className="truncate text-[11px] font-semibold uppercase text-slate-500">{leagueLabel(user.xp)}</p>
                  {currentUserId === user.id && <span className="mt-1 inline-flex rounded-full bg-[#EAF2F8] px-2 py-0.5 text-[10px] font-semibold text-[#2A6384] ring-1 ring-[#5E7681]/25">You</span>}
                </div>
              </div>
              <span className="metric flex items-center text-base font-semibold text-[#2A6384]">LVL {getLevel(user.xp)}</span>
              <span className="metric flex items-center font-semibold text-slate-800">{user.xp.toLocaleString()} XP</span>
              <div className="hidden items-center justify-end md:flex">
                <TopBadge applicationsApplied={user.applicationsApplied} />
              </div>
            </div>
          );
        })}
      </div>

      {currentUser && currentProgress && (
        <div className="grid gap-5 border-t border-[#5E7681]/25 bg-[#EAF2F8]/65 px-6 py-5 xl:grid-cols-[minmax(360px,1fr)_minmax(420px,620px)_auto] xl:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className="font-display text-xl font-bold text-[#2A6384]">{currentIndex + 1}</span>
            <Avatar user={currentUser} />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#2A6384]">{currentUser.name} <span className="text-slate-500">(You)</span></p>
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
          <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap xl:min-w-[260px] xl:justify-end">
            <div className="shrink-0 text-left sm:text-right">
              <p className="text-xs font-semibold uppercase text-[#5E7681]">Current XP</p>
              <p className="metric font-display text-xl font-bold text-[#0F172A]">{currentUser.xp.toLocaleString()}</p>
            </div>
            <Link href="/rewards" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-2xl border border-[#2A6384]/20 bg-[#2A6384] px-5 text-sm font-semibold text-white transition hover:bg-[#214E69]">
              <Rocket size={16} /> Boost Rank
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
