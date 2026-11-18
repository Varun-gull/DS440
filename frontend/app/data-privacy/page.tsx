import Link from "next/link";
import { ArrowLeft, Bot, FileText, LockKeyhole, Mail, ShieldCheck, UsersRound } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

export const metadata = { title: "Your data & privacy | CareerUp" };
export default function DataPrivacyPage() {
  return <div className="public-policy-page"><header className="public-header"><Link href="/" aria-label="CareerUp home"><BrandMark /></Link><Link href="/" className="public-text-link"><ArrowLeft size={15} aria-hidden />Back to CareerUp</Link></header>
    <main className="privacy-overview"><p className="eyebrow">Your data, your control</p><h1>A clearer picture of your privacy.</h1><p className="privacy-lead">Here is what CareerUp uses, what stays private, and the choices you can make. Connecting Gmail and sharing information with AI are optional.</p>
      <div className="privacy-card-grid">{[
        { icon: FileText, title: "Your resume and applications", text: "Resume text, application notes, STAR answers, and reward balances belong to your account. Other students cannot browse your private records. Uploaded resumes are processed into text; CareerUp does not keep the original document." },
        { icon: UsersRound, title: "What classmates can see", text: "Signed in students can see your profile name, school, career interests, and progress. Your application board starts private. You can choose to share it with accepted friends; private application notes are not shared." },
        { icon: Mail, title: "An optional Gmail connection", text: "The scanner requests read only access after you connect and consent. It stores encrypted connection credentials and status suggestions, which you review before updating an application. Suggestions expire after 30 days when the scanner is loaded. Gmail access currently depends on Google's testing restrictions." },
        { icon: Bot, title: "AI guidance on your terms", text: "AI chat and live interviews send selected context and, for voice practice, microphone audio to Google after your consent. Resume sharing is off by default. Chat and captions stay in the current page's memory; CareerUp does not store raw interview audio. Google handles submitted content under its own service terms." },
        { icon: LockKeyhole, title: "Account protection", text: "Sign in protects your workspace, and you can add authenticator based two factor authentication in Settings. Private records use ownership checks. Keep your password private, and sign out on shared devices." },
        { icon: ShieldCheck, title: "Choices you can change", text: "Update application board sharing in Settings. Manage your resume on your profile. Disconnect Gmail from the email scanner and leave AI sharing disabled when you prefer. A complete self service account export and deletion flow is not available yet." }
      ].map(({ icon: Icon, title, text }) => <section className="card" key={title}><span><Icon size={20} aria-hidden /></span><h2>{title}</h2><p>{text}</p></section>)}</div>
      <section className="privacy-actions card"><h2>Review your choices.</h2><p>Account sharing controls are available after you sign in. Avoid sharing sensitive information with AI and review Google's terms before using optional AI features.</p><div><Link href="/settings#privacy" className="primary-button">Open privacy settings</Link><a href="https://ai.google.dev/gemini-api/terms" className="secondary-button">Google AI terms</a></div></section>
    </main><footer className="public-footer"><span>CareerUp · Privacy overview</span><Link href="/login">Log in</Link></footer></div>;
}
