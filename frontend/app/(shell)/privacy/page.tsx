import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/data";
import { updatePrivacySettings } from "@/lib/profile/actions";

export default async function PrivacyPage({ searchParams }: { searchParams?: { message?: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?message=Log in before choosing privacy settings.");
  }

  const profile = await getCurrentProfile();

  if (profile.privacyPromptAnswered) {
    redirect("/dashboard");
  }

  return (
    <>
      <main className="page-shell grid min-h-[calc(100vh-96px)] place-items-center">
        <section className="card w-full max-w-xl p-6">
          <p className="eyebrow">Privacy setup</p>
          <h1 className="mt-2 text-3xl font-bold text-ink">Who can view your application board?</h1>
          <p className="mt-3 leading-7 text-slate-600">
            CareerUp can let accepted friends view your application pipeline on your profile. They can only see it if you allow it, and they cannot edit your roles.
          </p>
          {searchParams?.message && <p className="mt-4 rounded-2xl bg-[#EAF2F8] p-3 text-sm font-bold text-[#2A6384]">{searchParams.message}</p>}
          <form action={updatePrivacySettings} className="mt-6 grid gap-4">
            <input type="hidden" name="returnTo" value="/privacy" />
            <label className="flex gap-3 rounded-2xl border border-sky/20 bg-[#EAF2F8] p-4 text-sm font-bold text-slate-700">
              <input name="shareApplicationBoard" type="checkbox" defaultChecked={profile.shareApplicationBoard} className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              <span>
                Let accepted friends view my application board.
                <span className="mt-1 block text-xs font-semibold text-slate-500">You can change this later from Settings.</span>
              </span>
            </label>
            <button type="submit" className="primary-button w-full">Save and continue</button>
          </form>
        </section>
      </main>
    </>
  );
}
