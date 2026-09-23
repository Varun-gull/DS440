import { AppDock } from "@/components/AppDock";
import { PageBody, PageFlow } from "@/components/PageFlow";
import { TopBar } from "@/components/TopBar";

export default function ShellLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <PageFlow>
      <div className="relative min-h-screen">
        <TopBar />
        <div className="app-topbar-spacer" aria-hidden />
        <PageBody>{children}</PageBody>
        <AppDock />
      </div>
    </PageFlow>
  );
}
