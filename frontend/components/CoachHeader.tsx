import Link from "next/link";
import { ArrowUpRight, MessageCircle, Mic } from "lucide-react";

export function CoachHeader({ active }: { active: "chat" | "live" }) {
  return <header className="coach-header">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#2456a6]">Your career companion</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#142b49] sm:text-4xl">{active === "live" ? "Live interview practice" : "AI Coach"}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{active === "live" ? "Meet your AI interviewer. Practice out loud, get feedback, and build confidence." : "A space to ask questions, strengthen your resume, and prepare for your next opportunity."}</p>
    </div>
    <div className="coach-header-actions">
      <nav className="coach-mode-nav" aria-label="AI Coach tools">
        <Link href="/coach" aria-current={active === "chat" ? "page" : undefined}><MessageCircle size={17} aria-hidden />Chat</Link>
        <Link href="/coach/live" aria-current={active === "live" ? "page" : undefined}><Mic size={17} aria-hidden />Live interview</Link>
      </nav>
      <Link href="/interview" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#142b49]">STAR answer builder<ArrowUpRight size={14} aria-hidden /></Link>
    </div>
  </header>;
}
