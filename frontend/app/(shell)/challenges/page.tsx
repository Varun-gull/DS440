import { ChallengeCard } from "@/components/ChallengeCard";
import { PageHero } from "@/components/PageHero";
import { getChallenges } from "@/lib/data";

export default async function ChallengesPage() {
  const { tiered, oneOff } = await getChallenges();

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="XP quests"
          title="Challenges"
          description="Small missions turn the internship search into daily progress instead of a giant vague task."
          tabs={[
            { label: "Rewards", href: "/rewards" },
            { label: "Challenges", href: "/challenges", active: true }
          ]}
        />

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-ink">Core Challenges</h2>
            <p className="mt-1 text-sm text-slate-500">Each challenge has tiers — complete the current tier to unlock the next.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tiered.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-ink">One-time Challenges</h2>
            <p className="mt-1 text-sm text-slate-500">Complete each once to earn the XP.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...oneOff].sort((a, b) => Number(a.completed) - Number(b.completed)).map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
