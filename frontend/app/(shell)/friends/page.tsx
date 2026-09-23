import { PageHero } from "@/components/PageHero";
import { Check, MailPlus, Share2, Trash2, UserPlus, UsersRound } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyInviteLink } from "@/components/CopyInviteLink";
import { ProfileLink } from "@/components/ProfileLink";
import { RankBadge } from "@/components/RankBadge";
import { acceptFriendRequest, removeFriend, sendFriendRequest, sendFriendRequestById } from "@/lib/friends/actions";
import { addGroupMember, createGroup, leaveGroup } from "@/lib/groups/actions";
import { getCurrentUser, getFriends, getGroups } from "@/lib/data";

export default async function FriendsPage({ searchParams }: { searchParams?: { message?: string; invite?: string } }) {
  const [friends, user, groups] = await Promise.all([getFriends(), getCurrentUser(), getGroups()]);
  const acceptedFriends = friends.filter((friend) => friend.status === "accepted");
  const incomingRequests = friends.filter((friend) => friend.status === "pending" && friend.direction === "incoming");
  const outgoingRequests = friends.filter((friend) => friend.status === "pending" && friend.direction === "outgoing");
  const headerList = headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const protocol = headerList.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "";
  const shareLink = user ? `${origin}/u/${user.id}` : `${origin}/friends`;
  const inviteId = searchParams?.invite && searchParams.invite !== user?.id ? searchParams.invite : "";

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Squad"
          title="Friends"
          description="Add classmates, compare progress, and build a leaderboard that feels personal."
          tabs={[
            { label: "Friends", href: "/friends", active: true },
            { label: "Groups", href: "/friends#groups" }
          ]}
        />

        {searchParams?.message && <p className="mt-5 rounded-xl bg-white/90 p-3 text-sm font-bold text-[#2A6384] shadow-sm ring-1 ring-[#2A6384]/20">{searchParams.message}</p>}

        {inviteId && (
          <form action={sendFriendRequestById} className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky/20 bg-white/90 p-4 shadow-soft backdrop-blur">
            <div>
              <p className="font-bold text-[#2A6384]">Friend invite opened</p>
              <p className="text-sm font-bold text-brand">Send a request to add this CareerUp profile.</p>
            </div>
            <input type="hidden" name="profileId" value={inviteId} />
            <button className="primary-button">
              <UserPlus className="mr-2" size={18} /> Add from invite
            </button>
          </form>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_360px]">
          <form action={sendFriendRequest} className="card grid gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
                <UserPlus size={20} />
              </span>
              <div>
                <h2 className="font-bold text-ink">Add a friend</h2>
                <p className="text-sm text-slate-600">Use the email they signed up with.</p>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Email
              <input name="email" type="email" className="field" placeholder="friend@example.com" required />
            </label>
            <button type="submit" className="primary-button w-full sm:w-auto">
              <MailPlus className="mr-2" size={18} /> Send request
            </button>
          </form>

          <div className="card p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Share2 size={20} />
              </span>
              <div>
                <h2 className="font-bold text-ink">Profile invite</h2>
                <p className="text-sm text-slate-600">Share your CareerUp friend link.</p>
              </div>
            </div>
            <CopyInviteLink url={shareLink} />
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <FriendSection title="Incoming" helper="Requests waiting on you" friends={incomingRequests} empty="No incoming requests." action="accept" />
          <FriendSection title="Friends" helper="Included on your friends leaderboard" friends={acceptedFriends} empty="No accepted friends yet." action="remove" />
          <FriendSection title="Sent" helper="Requests waiting on them" friends={outgoingRequests} empty="No sent requests." action="remove" />
        </section>

        <section id="groups" className="mt-6 scroll-mt-28 grid gap-4 lg:grid-cols-[360px_1fr]">
          <form action={createGroup} className="card grid gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
                <UsersRound size={20} />
              </span>
              <div>
                <h2 className="font-bold text-ink">Create a group</h2>
                <p className="text-sm text-slate-600">Build a recruiting squad leaderboard.</p>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Group name
              <input name="name" className="field" placeholder="Summer 2026 grind" required />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Description
              <textarea name="description" rows={3} className="field resize-none" placeholder="Friends applying to SWE and data internships." />
            </label>
            <button className="primary-button">
              <UsersRound className="mr-2" size={18} /> Create group
            </button>
          </form>

          <div className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">Group rankings</p>
                <h2 className="mt-1 text-2xl font-bold text-ink">Your groups</h2>
              </div>
              <Link href="/leaderboard?scope=groups" className="secondary-button min-h-10 px-4 text-sm">
                View group leaderboard
              </Link>
            </div>
            {groups.length > 0 ? (
              <div className="mt-5 grid gap-3">
                {groups.map((group) => (
                  <article key={group.id} className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-ink">{group.name}</h3>
                        <p className="mt-1 text-sm text-slate-600">{group.description || "CareerUp group"}</p>
                        <p className="mt-2 text-sm font-bold text-brand">
                          {group.totalXp.toLocaleString()} XP · {group.memberCount} members
                        </p>
                      </div>
                      <form action={leaveGroup}>
                        <input type="hidden" name="groupId" value={group.id} />
                        <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                          Leave
                        </button>
                      </form>
                    </div>
                    {acceptedFriends.length > 0 && (
                      <form action={addGroupMember} className="mt-4 flex flex-wrap gap-2">
                        <input type="hidden" name="groupId" value={group.id} />
                        <select name="friendId" className="field min-h-10 flex-1 py-2 text-sm">
                          {acceptedFriends.map((friend) => (
                            <option key={friend.userId} value={friend.userId}>
                              {friend.name}
                            </option>
                          ))}
                        </select>
                        <button className="secondary-button min-h-10 px-4 text-sm">Add</button>
                      </form>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {group.members.slice(0, 6).map((member) => (
                        <span key={member.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          {member.name.split(" ")[0]} · {member.xp.toLocaleString()} XP
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white/85 p-5 text-sm font-medium text-slate-500">
                No groups yet. Create one, then add accepted friends.
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function FriendSection({
  title,
  helper,
  friends,
  empty,
  action
}: {
  title: string;
  helper: string;
  friends: Awaited<ReturnType<typeof getFriends>>;
  empty: string;
  action: "accept" | "remove";
}) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-soft backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-ink">{title}</h2>
          <p className="text-sm text-slate-600">{helper}</p>
        </div>
        <span className="flex h-9 min-w-9 items-center justify-center rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-700">
          {friends.length}
        </span>
      </div>

      {friends.length > 0 ? (
        <div className="grid gap-3">
          {friends.map((friend) => (
            <article key={friend.id} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky/25 hover:shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <ProfileLink profileId={friend.userId} name={friend.name} />
                  <p className="text-sm text-slate-500">{friend.school}</p>
                  <p className="mt-1 text-xs font-medium text-slate-600">{friend.email}</p>
                </div>
                <UsersRound size={18} className="text-brand" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-brand">{friend.xp.toLocaleString()} XP</p>
                  <RankBadge xp={friend.xp} />
                </div>
                <div className="flex gap-2">
                  {action === "accept" && (
                    <form action={acceptFriendRequest}>
                      <input type="hidden" name="friendshipId" value={friend.id} />
                      <button className="inline-flex min-h-10 items-center rounded-xl bg-brand px-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand" aria-label={`Accept ${friend.name}`}>
                        <Check size={16} />
                      </button>
                    </form>
                  )}
                  <form action={removeFriend}>
                    <input type="hidden" name="friendshipId" value={friend.id} />
                    <button className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${friend.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </form>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/85 p-4 text-sm font-medium text-slate-500">{empty}</div>
      )}
    </div>
  );
}
