import { BriefcaseBusiness, LogIn, UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/data";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="page-shell grid min-h-screen place-items-center">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/95 p-6 text-center shadow-strong backdrop-blur-xl sm:p-10">
        <Link href="/" className="mx-auto flex w-fit items-center gap-3 font-bold text-ink">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy text-white shadow-glow">
            <BriefcaseBusiness size={24} />
          </span>
          <span className="text-2xl">CareerUp</span>
        </Link>

        <p className="mt-10 text-xs font-bold uppercase text-[#2A6384]">Internship tracker</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight text-ink sm:text-5xl">Track applications without the clutter.</h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-7 text-slate-600">
          Search roles, save applications, earn XP, and keep your recruiting progress organized in one place.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link href="/login" className="primary-button">
            <LogIn className="mr-2" size={18} /> Log in
          </Link>
          <Link href="/signup" className="secondary-button">
            <UserPlus className="mr-2" size={18} /> Create account
          </Link>
        </div>

        <p className="mt-6 text-sm font-bold text-slate-500">Live postings · Application board · XP rewards</p>
      </section>
    </main>
  );
}
