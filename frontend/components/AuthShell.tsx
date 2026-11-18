import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LegalLinks } from "@/components/LegalPage";

export function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <main className="auth-page">
    <header className="public-header"><Link href="/" aria-label="CareerUp home"><BrandMark /></Link><Link href="/postings/internships" className="public-text-link">Explore jobs<ArrowRight size={15} aria-hidden /></Link></header>
    <div className="auth-layout">
      <section className="auth-story">
        <p className="eyebrow">A little progress, every day</p>
        <h2>Your next chapter.<br /><span>All in one place.</span></h2>
        <p>Find opportunities that fit. Keep your applications organized. Walk into your next interview with more confidence.</p>
        <div className="auth-benefits">{["Internships and graduate jobs", "A clear view of every application", "Your own AI interview coach"].map(text => <p key={text}><CheckCircle2 size={18} aria-hidden />{text}</p>)}</div>
        <div className="auth-note"><ShieldCheck size={17} aria-hidden /><span>Your resume stays private. You choose what to share.</span></div>
      </section>
      <section className="auth-form-card card">
        <p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="auth-description">{description}</p>
        {children}
      </section>
    </div>
    <footer className="public-footer"><span>CareerUp · Built for your next step.</span><LegalLinks /></footer>
  </main>;
}
