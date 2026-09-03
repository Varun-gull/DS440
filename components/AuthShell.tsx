import { BriefcaseBusiness, CheckCircle2, Search, Trophy } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const highlights = [
  { label: "Live postings", icon: Search },
  { label: "Application board", icon: CheckCircle2 },
  { label: "XP rewards", icon: Trophy },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#F3F4F6] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#173B55] text-white shadow-sm">
              <BriefcaseBusiness size={22} />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight text-[#173B55]">CareerUp</span>
          </Link>
          <Link href="/postings/internships" className="hidden rounded-full border border-[#5E7681]/30 bg-white px-4 py-2 text-sm font-semibold text-[#173B55] shadow-sm sm:inline-flex">
            Browse postings
          </Link>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_27rem]">
          <div className="hero-3d relative isolate overflow-hidden rounded-[2rem] bg-[#173B55] p-6 text-white sm:p-8 lg:min-h-[32rem]">
            <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
            <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div>
                <span className="rise inline-flex rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-inset ring-white/20">
                  Internship operating system
                </span>
                <h1 className="rise rise-1 font-display mt-10 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                  Find roles, track progress, and keep recruiting simple.
                </h1>
                <p className="rise rise-2 mt-5 max-w-xl text-base leading-7 text-white/75">
                  Search live roles, save applications, compare progress with friends, and keep your next move clear.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {highlights.map(({ label, icon: Icon }, index) => (
                  <div
                    key={label}
                    className="rise rounded-2xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 transition duration-200 ease-out hover:bg-white/[0.16]"
                    style={{ ["--rise-delay" as string]: `${240 + index * 70}ms` }}
                  >
                    <Icon size={18} />
                    <p className="mt-3 text-sm font-semibold text-white/90">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <section className="card rise rise-2 bg-white p-6 shadow-strong sm:p-8">
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-ink">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            {children}
          </section>
        </section>
      </div>
    </main>
  );
}
