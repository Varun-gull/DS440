"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const tabs = [
  { label: "Overview", href: "/dashboard" },
  { label: "Applications", href: "/applications" },
  { label: "Messages", href: "/messages" },
  { label: "Profile", href: "/profile" }
];

export function TopBarTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "rounded-xl px-4 py-2 text-sm font-semibold transition",
              active ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
