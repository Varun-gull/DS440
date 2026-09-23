import Link from "next/link";
import clsx from "clsx";
import type { ReactNode } from "react";

export type HeroTab = { label: string; href: string; active?: boolean };

export function PageHero({
  eyebrow,
  title,
  description,
  tabs,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  tabs?: HeroTab[];
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="hero-3d relative isolate overflow-hidden rounded-[1.75rem] bg-[#173B55] text-white">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
        <div className="min-w-0">
          {eyebrow && (
            <span className="rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80 ring-1 ring-inset ring-white/20 backdrop-blur">
              {eyebrow}
            </span>
          )}

          <h1
            className={clsx(
              "rise rise-1 font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl",
              eyebrow && "mt-4"
            )}
          >
            {title}
          </h1>

          {description && (
            <p className="rise rise-2 mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base sm:leading-7">
              {description}
            </p>
          )}

          {tabs && tabs.length > 0 && (
            <nav className="rise rise-3 nav-scroll mt-6 flex items-center gap-1 overflow-x-auto rounded-2xl bg-black/20 p-1 ring-1 ring-inset ring-white/10 lg:w-fit">
              {tabs.map((tab) => (
                <Link
                  key={tab.href + tab.label}
                  href={tab.href}
                  aria-current={tab.active ? "page" : undefined}
                  className={clsx(
                    "hero-tab shrink-0",
                    tab.active
                      ? "bg-white text-[#173B55] shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {actions && <div className="rise rise-2 flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  );
}
