import { ArrowLeft, Flame, Lock, Mail, MapPin, Sparkles, Target, Trophy, UserPlus, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ProfileLink } from "@/components/ProfileLink";
import { PublicApplicationBoard } from "@/components/PublicApplicationBoard";
import { RankBadge } from "@/components/RankBadge";
import { BadgeShelf } from "@/components/BadgeDisplay";
import { XpProgressBar } from "@/components/XpProgressBar";
import { sendFriendRequestById } from "@/lib/friends/actions";
import { getCurrentUser, getFriendshipWith, getMutualFriends, getPublicProfile, getSharedApplicationBoard } from "@/lib/data";
import { sendPeerMessage } from "@/lib/messages/actions";

export default async function PublicProfilePage({
  params,
  searchParams
}: {
  params: { profileId: string };
  searchParams?: { message?: string; year?: string };
}) {
  const [profile, user, friendship, sharedBoard, mutualFriends] = await Promise.all([
    getPublicProfile(params.profileId),
    getCurrentUser(),
    getFriendshipWith(params.profileId),
    getSharedApplicationBoard(params.profileId),
    getMutualFriends(params.profileId)
  ]);
  const isOwnProfile = user?.id === params.profileId;
  const isAcceptedFriend = friendship?.status === "accepted";
  const boardYears = Array.from(new Set(sharedBoard.applications.map((application) => application.applicationYear))).sort((a, b) => b - a);
  const requestedBoardYear = searchParams?.year === "all" ? "all" : Number(searchParams?.year);
  const selectedBoardYear: number | "all" =
    requestedBoardYear === "all" ? "all" : boardYears.includes(requestedBoardYear) ? requestedBoardYear : boardYears[0] ?? new Date().getFullYear();
  const visibleBoardApplications =
    selectedBoardYear === "all" ? sharedBoard.applications : sharedBoard.applications.filter((application) => application.applicationYear === selectedBoardYear);

  return (
    <>
      <main className="page-shell">
        <Link href="/friends" className="inline-flex items-center text-sm font-bold text-slate-600 hover:text-brand">
          <ArrowLeft className="mr-2" size={16} /> Friends
        </Link>

        {searchParams?.message && <p className="mt-5 rounded-2xl bg-white/90 p-3 text-sm font-bold text-[#2A6384] shadow-sm ring-1 ring-[#2A6384]/20">{searchParams.message}</p>}

        {!profile ? (
          <section className="card mt-6 p-8 text-center">
            <h1 className="text-3xl font-bold text-ink">Profile not available</h1>
            <p className="mt-2 text-slate-600">This profile may be private until the public profile database policy is enabled.</p>
          </section>
        ) : (
          <section className="card mt-6 overflow-hidden">
            <div className="relative isolate overflow-hidden bg-[#173B55] px-6 py-10 text-white">
              <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
              <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
              <div className="relative flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="font-display flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white text-2xl font-bold text-[#2A6384] shadow-glow">
                    {profile.schoolLogoUrl ? <img src={profile.schoolLogoUrl} alt="" className="h-full w-full bg-white object-contain p-2" /> : profile.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">CareerUp profile</p>
                    <h1 className="font-display mt-1 text-3xl font-bold tracking-tight">{profile.name}</h1>
                    <p className="text-white/75">{[profile.school, profile.major, profile.graduationYear].filter(Boolean).join(" · ") || "CareerUp Student"}</p>
                  </div>
                </div>

                {isOwnProfile ? (
                  <Link href="/profile" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10">
                    Edit profile
                  </Link>
                ) : friendship ? (
                  <span
                    className={
                      friendship.status === "accepted"
                        ? "inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-400/15 px-5 font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-300/40"
                        : "inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-5 font-semibold text-white/85 ring-1 ring-inset ring-white/25"
                    }
                  >
                    {friendship.status === "accepted" ? "Friends" : friendship.direction === "incoming" ? "Request received" : "Request sent"}
                  </span>
                ) : user ? (
                  <form action={sendFriendRequestById}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <button className="primary-button">
                      <UserPlus className="mr-2" size={18} /> Add friend
                    </button>
                  </form>
                ) : (
                  <Link href={`/login?message=${encodeURIComponent("Log in to add this profile as a friend.")}`} className="primary-button">
                    Log in to add
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px]">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard icon={Sparkles} label="XP" value={profile.xp.toLocaleString()} />
                <StatCard icon={Flame} label="Streak" value={`${profile.streak} days`} />
                <StatCard icon={Trophy} label="Applied" value={profile.applicationsApplied.toString()} />
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
                  <p className="mb-2 text-sm font-bold text-slate-500">Current rank</p>
                  <RankBadge xp={profile.xp} />
                </div>
                <XpProgressBar xp={profile.xp} />
                <BadgeShelf applicationsApplied={profile.applicationsApplied} />
                {!isOwnProfile && user && (
                  <form action={sendPeerMessage} className="rounded-3xl border border-sky/20 bg-[#EAF2F8] p-4">
                    <div className="flex items-center gap-2">
                      <Mail size={18} className="text-brand" />
                      <h2 className="font-bold text-ink">Message {profile.name.split(" ")[0]}</h2>
                    </div>
                    <input type="hidden" name="recipientId" value={profile.id} />
                    <input type="hidden" name="applicationId" value="" />
                    <input type="hidden" name="roleKey" value={`profile::${profile.id}`} />
                    <input type="hidden" name="returnTo" value={`/u/${profile.id}`} />
                    <label className="mt-4 grid gap-1 text-xs font-bold uppercase text-slate-500">
                      Subject
                      <input
                        name="subject"
                        defaultValue="CareerUp question"
                        className="field text-sm normal-case"
                      />
                    </label>
                    <label className="mt-3 grid gap-1 text-xs font-bold uppercase text-slate-500">
                      Message
                      <textarea
                        name="body"
                        rows={4}
                        className="field resize-none text-sm normal-case"
                        placeholder="Ask about applications, interviews, classes, or recruiting advice."
                      />
                    </label>
                    <button type="submit" className="primary-button mt-3 w-full justify-center">
                      <Mail className="mr-2" size={16} /> Send message
                    </button>
                  </form>
                )}
                {!isOwnProfile && !user && (
                  <Link href={`/login?message=${encodeURIComponent("Log in to message this profile.")}`} className="secondary-button w-full justify-center">
                    Log in to message
                  </Link>
                )}
                {!isOwnProfile && (
                  <div className="rounded-3xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex items-center gap-2">
                      <UsersRound size={18} className="text-brand" />
                      <h2 className="font-bold text-ink">Mutual friends</h2>
                    </div>
                    {isAcceptedFriend ? (
                      mutualFriends.length > 0 ? (
                        <div className="mt-4 grid gap-3">
                          {mutualFriends.map((friend) => (
                            <div key={friend.id} className="rounded-2xl border border-slate-200 p-3 transition hover:border-sky/25 hover:bg-[#EAF2F8]">
                              <ProfileLink profileId={friend.id} name={friend.name} />
                              <p className="mt-1 text-xs font-bold text-slate-500">{friend.school}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm font-bold text-slate-500">No mutual friends yet.</p>
                      )
                    ) : (
                      <p className="mt-4 text-sm font-bold text-slate-500">Become friends to compare mutuals.</p>
                    )}
                  </div>
                )}
              </aside>

              <div className="lg:col-span-2 grid gap-4 md:grid-cols-2">
                <ProfileTags icon={Target} title="Target roles" values={profile.targetRoles} empty="No target roles yet." />
                <ProfileTags icon={MapPin} title="Target locations" values={profile.targetLocations} empty="No target locations yet." />
              </div>

              <div className="lg:col-span-2">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow">Application board</p>
                    <h2 className="mt-2 text-2xl font-bold text-ink">Pipeline</h2>
                  </div>
                  {sharedBoard.canView && <p className="text-sm font-bold text-slate-500">{visibleBoardApplications.length} visible roles</p>}
                </div>

                {sharedBoard.canView ? (
                  sharedBoard.applications.length > 0 ? (
                    <>
                      <div className="mb-4 flex flex-wrap gap-2">
                        {boardYears.map((year) => (
                          <Link
                            key={year}
                            href={`/u/${params.profileId}?year=${year}`}
                            className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                              selectedBoardYear === year ? "bg-brand text-white shadow-glow" : "border border-slate-200 bg-white/90 text-slate-600 hover:border-brand/30 hover:text-brand"
                            }`}
                            aria-current={selectedBoardYear === year ? "page" : undefined}
                          >
                            {year}
                          </Link>
                        ))}
                        <Link
                          href={`/u/${params.profileId}?year=all`}
                          className={`rounded-2xl px-4 py-2 text-sm font-bold transition ${
                            selectedBoardYear === "all" ? "bg-white text-white shadow-lg shadow-slate-950/20" : "border border-slate-200 bg-white/90 text-slate-600 hover:border-brand/30 hover:text-brand"
                          }`}
                          aria-current={selectedBoardYear === "all" ? "page" : undefined}
                        >
                          All years
                        </Link>
                      </div>
                      <PublicApplicationBoard applications={visibleBoardApplications} />
                    </>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-white/90 p-6 text-sm font-bold text-slate-500">No applications are on this board yet.</div>
                  )
                ) : isOwnProfile ? (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-white/90 p-6 text-sm font-bold text-slate-500">Add roles to your board from the postings page.</div>
                ) : isAcceptedFriend ? (
                  <div className="rounded-3xl border border-slate-200 bg-white/90 p-6">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
                        <Lock size={18} />
                      </span>
                      <div>
                        <h3 className="font-bold text-ink">Application board is private</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">This friend has not enabled board sharing.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white/90 p-6">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
                        <Lock size={18} />
                      </span>
                      <div>
                        <h3 className="font-bold text-ink">Friends only</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">Add this profile as a friend to see a shared application board when they allow it.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-4">
      <Icon size={20} className="text-brand" />
      <p className="mt-4 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function ProfileTags({ icon: Icon, title, values, empty }: { icon: LucideIcon; title: string; values: string[]; empty: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-4">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-brand" />
        <h2 className="font-bold text-ink">{title}</h2>
      </div>
      {values.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {values.map((value) => (
            <span key={value} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm font-bold text-slate-500">{empty}</p>
      )}
    </div>
  );
}
