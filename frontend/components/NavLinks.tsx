"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/postings/internships", label: "Postings" },
  { href: "/interview", label: "Interview Prep" },
  { href: "/rewards", label: "Rewards" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="nav-scroll col-span-2 row-start-2 -mx-1 flex min-w-0 items-center gap-2.5 overflow-x-auto pb-1 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:justify-center lg:overflow-visible lg:pb-0 xl:gap-3">
      {navItems.map((item) => {
        const active = item.label === "Postings" ? pathname.startsWith("/postings") : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition duration-150 sm:text-[15px]",
              active
                ? "bg-[#2A6384] text-white shadow-glow"
                : "text-slate-600 hover:bg-[#EAF2F8] hover:text-[#2A6384]"
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
