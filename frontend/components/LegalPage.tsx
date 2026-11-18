import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LEGAL_DATE, PROJECT_CONTACT } from "@/lib/legal";

export function LegalLinks() {
  return <nav aria-label="Legal information" className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/data-privacy">Data controls</Link><Link href="/privacy-policy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link></nav>;
}

export function LegalPage({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return <div className="public-policy-page">
    <header className="public-header"><Link href="/" aria-label="CareerUp home"><BrandMark /></Link><Link href="/settings" className="public-text-link">Your settings</Link></header>
    <main className="legal-document"><p className="eyebrow">CareerUp student project team</p><h1>{title}</h1><p className="legal-date">Effective {LEGAL_DATE} · Version 2026-11-17</p><p className="legal-summary">{summary}</p><LegalLinks />{children}
      <section id="contact"><h2>Questions or privacy requests</h2><p>Contact the CareerUp student project team at <a href={`mailto:${PROJECT_CONTACT}`}>{PROJECT_CONTACT}</a>. Use your account email so we can verify ownership. Never send your password, authentication codes, API keys, or your full mailbox. Tell us if a request concerns access, correction, deletion, or a security problem.</p></section>
    </main><footer className="public-footer"><span>CareerUp · Your next step.</span><LegalLinks /></footer>
  </div>;
}
