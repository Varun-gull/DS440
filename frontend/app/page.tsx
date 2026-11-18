import { LegalLinks } from "@/components/LegalPage";
import { ArrowRight, Bookmark, Bot, Check, CheckCircle2, ClipboardList, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { getCurrentUser } from "@/lib/data";

export default async function HomePage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <div className="landing-page">
    <header className="public-header"><Link href="/" aria-label="CareerUp home"><BrandMark /></Link><nav aria-label="Welcome navigation"><Link href="/postings/internships" className="public-explore">Explore jobs</Link><Link href="/login" className="public-text-link">Log in</Link><Link href="/signup" className="primary-button">Get started<ArrowRight size={15} className="ml-2" aria-hidden /></Link></nav></header>
    <main>
      <section className="landing-hero">
        <div className="landing-intro"><span className="landing-tag"><Sparkles size={14} aria-hidden />A fresh approach to your job search</span><h1>Your next move.<br /><span>A little clearer.</span></h1><p>An AI powered, gamified job board for students. Find your next role, organize your applications, and prepare with confidence.</p><div className="landing-actions"><Link href="/signup" className="primary-button">Create your free account<ArrowRight size={16} className="ml-2" aria-hidden /></Link><Link href="/postings/internships" className="public-text-link">Explore opportunities<ArrowRight size={16} aria-hidden /></Link></div><div className="landing-assurance"><CheckCircle2 size={15} aria-hidden />Free to start. Gmail connection is optional.</div></div>
        <div className="landing-preview" aria-label="Illustrative CareerUp workspace preview">
          <div className="preview-top"><span><span className="preview-dot" />Your next chapter</span><span>Workspace preview</span></div>
          <div className="preview-greeting"><p>A little progress goes a long way.</p><h2>Make your next move.</h2></div>
          <div className="preview-search"><Search size={17} /><span>Search roles, skills, or companies</span><ArrowRight size={16} /></div>
          <div className="preview-label">Your search, organized</div>
          <div className="preview-board">{[
            { label: "Saved", icon: Bookmark, role: "Data Science Intern", company: "An opportunity to explore", tone: "saved" },
            { label: "Applied", icon: Check, role: "Software Engineer", company: "Your next step is tracked", tone: "applied" },
            { label: "Interview", icon: Bot, role: "Time to practice", company: "Your coach is ready", tone: "interview" }
          ].map(({label,icon:Icon,role,company,tone}) => <div key={label} className={`preview-column preview-${tone}`}><p><span />{label}</p><div><Icon size={18} aria-hidden /><h3>{role}</h3><span>{company}</span></div></div>)}</div>
          <div className="preview-bottom"><span><Trophy size={17} aria-hidden />Every meaningful step counts.</span><span>Keep growing<ArrowRight size={13} aria-hidden /></span></div>
        </div>
      </section>
      <section className="landing-features" aria-labelledby="landing-features-title"><div className="landing-section-title"><p className="eyebrow">One workspace. A clearer path.</p><h2 id="landing-features-title">From finding a role to feeling ready.</h2><p>CareerUp brings the pieces together so you can focus on the next step.</p></div><div className="landing-feature-grid">{[
        { icon: Search, title: "Find opportunities that fit", text: "Explore internships and graduate roles, filter your search, and review how your resume aligns." },
        { icon: ClipboardList, title: "Keep every application in view", text: "Save interesting roles and track them from your first application to the next conversation." },
        { icon: Bot, title: "Build confidence through practice", text: "Draft STAR answers, ask your AI Coach a question, or practice a live interview." }
      ].map(({icon:Icon,title,text}) => <article key={title}><span><Icon size={22} aria-hidden /></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="landing-closing"><div><p className="eyebrow">Small steps. Real progress.</p><h2>Give your job search a place to grow.</h2><p>Build a routine with challenges, progress tracking, and rewards you can use.</p></div><Link href="/signup" className="primary-button">Start your next chapter<ArrowRight size={16} className="ml-2" aria-hidden /></Link></section>
    </main>
    <footer className="public-footer"><span><ShieldCheck size={15} aria-hidden />Your data, your control.</span><LegalLinks /></footer>
  </div>;
}
