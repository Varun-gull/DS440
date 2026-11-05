import Link from "next/link";
import { redirect } from "next/navigation";
import { RewardsStudio } from "@/components/rewards/RewardsStudio";
import { assistantUser, AssistantError } from "@/lib/assistant/server";
import { rewardState } from "@/lib/rewards/server";

export const dynamic = "force-dynamic";
export default async function RewardsPage({ searchParams }: { searchParams?: Promise<{ tab?: string; category?: string; message?: string }> }) {
  const query = await searchParams;
  let state;
  try { state = await rewardState(await assistantUser()); }
  catch (error) {
    if (error instanceof AssistantError && error.status === 401) redirect("/login");
    if (error instanceof AssistantError && error.status === 403) redirect("/mfa?next=%2Frewards");
    return <main className="page-shell reward-studio"><div className="reward-empty"><h1>Your rewards will be right here.</h1><p>We couldn’t load your balance. Please refresh in a moment.</p><Link className="reward-primary" href="/rewards">Try again</Link></div></main>;
  }
  return <RewardsStudio initialState={state} initialTab={query?.tab} initialCategory={query?.category} initialMessage={query?.message} />;
}
