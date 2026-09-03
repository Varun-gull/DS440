import { PageHero } from "@/components/PageHero";
import { GroupLeaderboardTable } from "@/components/GroupLeaderboardTable";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { getCurrentUser, getFriendLeaderboard, getGroupLeaderboard, getLeaderboard } from "@/lib/data";

export default async function LeaderboardPage({ searchParams }: { searchParams?: { scope?: string } }) {
  const scope = searchParams?.scope === "friends" ? "friends" : searchParams?.scope === "groups" ? "groups" : "global";
  const [leaderboard, groupLeaderboard, user] = await Promise.all([
    scope === "friends" ? getFriendLeaderboard() : scope === "groups" ? Promise.resolve([]) : getLeaderboard(),
    scope === "groups" ? getGroupLeaderboard() : Promise.resolve([]),
    getCurrentUser()
  ]);

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Friendly competition"
          title="Leaderboard"
          description="Compare XP with friends and stay accountable during recruiting season."
          tabs={[
            { label: "All users", href: "/leaderboard", active: scope === "global" },
            { label: "Friends", href: "/leaderboard?scope=friends", active: scope === "friends" },
            { label: "Groups", href: "/leaderboard?scope=groups", active: scope === "groups" }
          ]}
        />
        <section className="mt-6">
          {scope === "groups" ? (
            <GroupLeaderboardTable groups={groupLeaderboard} />
          ) : (
            <LeaderboardTable users={leaderboard} currentUserId={user?.id} emptyMode={scope} />
          )}
        </section>
      </main>
    </>
  );
}
