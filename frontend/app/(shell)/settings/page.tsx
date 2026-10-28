import { PageHero } from "@/components/PageHero";
import { TwoFactorSettings } from "@/components/TwoFactorSettings";
import { Lock, ShieldCheck, UsersRound } from "lucide-react";
import { getCurrentProfile } from "@/lib/data";
import { updatePrivacySettings } from "@/lib/profile/actions";
import Link from "next/link";

export default async function SettingsPage({ searchParams: searchParamsInput }: { searchParams?: Promise<{ message?: string }> }) {
  const searchParams = await searchParamsInput;
  const profile = await getCurrentProfile();

  return (
    <>
      <main className="page-shell">
        <PageHero
          compact
          eyebrow="Account controls"
          title="Settings"
          description="Control what friends can see and how your CareerUp profile behaves."
          tabs={[
            { label: "Settings", href: "/settings", active: true },
            { label: "Profile", href: "/profile" },
            { label: "Privacy", href: "/privacy" }
          ]}
        />

        {searchParams?.message && <p className="mt-5 rounded-2xl bg-white/90 p-3 text-sm font-bold text-[#2A6384] shadow-sm ring-1 ring-[#2A6384]/20">{searchParams.message}</p>}

        <section className="card mt-6 max-w-3xl p-6">
          <h2 className="text-xl font-bold text-ink">Career assistant and voice practice</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use career chat, resume evidence explanations, and optional live interview practice. You choose the context shared with the AI provider.</p>
          <Link href="/interview/assistant" className="primary-button mt-4 w-fit">Open career assistant</Link>
        </section>

        <section className="card mt-6 max-w-3xl p-6">
          <h2 className="text-xl font-bold text-ink">Application email scanner</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Connect Gmail or preview a pasted email to find application updates. Every status change needs your confirmation.</p>
          <Link href="/applications/email-scanner" className="primary-button mt-4 w-fit">Open email scanner</Link>
        </section>

        <section className="card mt-8 max-w-3xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">Two factor authentication</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Protect your resume, saved jobs, and application history with a second sign in step.
              </p>
            </div>
          </div>
          <TwoFactorSettings />
        </section>

        <section className="card mt-6 max-w-3xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF2F8] text-brand">
              {profile.shareApplicationBoard ? <UsersRound size={20} /> : <Lock size={20} />}
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">Application board visibility</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                When this is enabled, accepted friends can open your profile and view a read-only version of your application board.
              </p>
            </div>
          </div>

          <form action={updatePrivacySettings} className="mt-5 grid gap-4">
            <input type="hidden" name="returnTo" value="/settings" />
            <label className="flex gap-3 rounded-2xl border border-sky/20 bg-[#EAF2F8] p-4 text-sm font-bold text-slate-700">
              <input name="shareApplicationBoard" type="checkbox" defaultChecked={profile.shareApplicationBoard} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              <span>
                Let accepted friends view my application board.
                <span className="mt-1 block text-xs font-semibold text-slate-500">Friends can see statuses, roles, companies, fit scores, and posting links, but cannot edit anything.</span>
              </span>
            </label>
            <button type="submit" className="primary-button w-fit">Save settings</button>
          </form>
        </section>
      </main>
    </>
  );
}
