import { AppSidebar } from "@/components/AppSidebar";
import { Navbar } from "@/components/Navbar";
import { TopBar } from "@/components/TopBar";

export default function ShellLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className="lg:hidden">
        <Navbar />
      </div>
      <div className="min-h-screen">
        <TopBar />
        <div className="lg:grid lg:grid-cols-[76px_minmax(0,1fr)]">
          <AppSidebar />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </>
  );
}
