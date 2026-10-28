import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { CareerAssistant } from "@/components/CareerAssistant";

export const dynamic = "force-dynamic";
export default function CareerAssistantPage() {
  return <main className="page-shell"><PageHero eyebrow="Career guidance" title="Your career copilot"
    description="Understand your fit, strengthen your resume, and practice interviews through chat or live voice."
    tabs={[{ label: "AI coach", href: "/interview/assistant", active: true }, { label: "STAR builder", href: "/interview" }]}
    actions={<Link href="/applications/email-scanner" className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white">Email scanner</Link>} />
    <CareerAssistant /></main>;
}
