import { PageHero } from "@/components/PageHero";
import { Save } from "lucide-react";
import { createApplication } from "@/lib/applications/actions";

export default function NewApplicationPage({ searchParams }: { searchParams?: { message?: string } }) {
  return (
    <>
      <main className="page-shell max-w-4xl">
        <PageHero
          compact
          eyebrow="Add role"
          title="Track a new role"
          description="Save the role now, then move it through your pipeline when you apply."
          tabs={[
            { label: "Add role", href: "/applications/new", active: true },
            { label: "Board", href: "/applications" }
          ]}
        />
        {searchParams?.message && <p className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm font-bold text-slate-700">{searchParams.message}</p>}
        <form action={createApplication} className="card mt-8 grid gap-5 p-6">
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Company
            <input name="company" className="field" placeholder="BlueGrid AI" required />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Role
            <input name="role" className="field" placeholder="Software Engineering Intern" required />
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Location
              <input name="location" className="field" placeholder="Remote" />
            </label>
            <label className="grid gap-2 text-sm font-bold text-slate-700">
              Deadline
              <input name="deadline" type="date" className="field" />
            </label>
          </div>
          <label className="grid gap-2 text-sm font-bold text-slate-700">
            Source link
            <input name="sourceUrl" className="field" placeholder="https://..." />
          </label>
          <button type="submit" className="primary-button w-full sm:w-auto">
            <Save className="mr-2" size={18} /> Save and earn 5 XP + 1 RP
          </button>
        </form>
      </main>
    </>
  );
}
