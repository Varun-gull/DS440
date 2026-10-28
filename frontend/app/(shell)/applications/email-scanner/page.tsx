import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHero } from "@/components/PageHero";
import { EmailScanner } from "@/components/EmailScanner";

export const dynamic = "force-dynamic";

export default async function EmailScannerPage({ searchParams: searchParamsInput }: { searchParams?: Promise<{ notice?: string; message?: string }> }) {
  const searchParams = await searchParamsInput;
  return <main className="page-shell">
    <PageHero eyebrow="Application assistant" title="Email scanner"
      description="Turn application emails into clear status suggestions. Review the evidence and stay in control of every update."
      actions={<Link href="/applications" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#2A6384]"><ArrowLeft size={16} />Application board</Link>} />
    <EmailScanner initialMessage={searchParams?.notice === "connected" ? "Gmail connected. Choose a date range and scan when you are ready." : searchParams?.message?.slice(0, 300) ?? ""} />
  </main>;
}
