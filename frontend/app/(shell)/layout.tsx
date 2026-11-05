import { AppDock } from "@/components/AppDock";
import { FloatingCareerCoach } from "@/components/FloatingCareerCoach";
import { PageBody, PageFlow } from "@/components/PageFlow";
import { TopBar } from "@/components/TopBar";
import { getCurrentUser } from "@/lib/data";
import { rewardsSnapshot } from "@/lib/rewards/server";

export default async function ShellLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  const appearance = user ? await rewardsSnapshot(user.id) : null;
  return (
    <PageFlow>
      <div className="careerup-shell relative min-h-screen" data-theme={appearance?.preferences.theme ?? "ocean"}>
        <TopBar />
        <div className="app-topbar-spacer" aria-hidden />
        <PageBody>{children}</PageBody>
        <AppDock />
        <FloatingCareerCoach />
      </div>
    </PageFlow>
  );
}
