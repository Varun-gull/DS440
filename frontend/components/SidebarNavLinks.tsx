"use client";

import {
  CalendarDays,
  ClipboardList,
  Gift,
  Home,
  Mail,
  MessagesSquare,
  Search
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

type SidebarLink = { href: string; label: string; icon: LucideIcon; badge?: number };

const mainLinks: SidebarLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/postings/internships", label: "Postings", icon: Search },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/interview", label: "Interview Prep", icon: MessagesSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays }
];

const progressLinks: SidebarLink[] = [
  { href: "/rewards", label: "Rewards", icon: Gift }
];

function RailItem({ link, active }: { link: SidebarLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      title={link.label}
      aria-label={link.label}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group relative flex h-11 w-11 items-center overflow-hidden rounded-2xl px-3 hover:w-40 hover:justify-start hover:gap-3 focus-visible:w-40 focus-visible:justify-start focus-visible:gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2A6384]/20 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out",
        active
          ? "bg-[#2A6384] text-white shadow-strong"
          : "bg-[#F8FBFA]/85 text-[#5E7681] shadow-sm ring-1 ring-[#5E7681]/30 hover:bg-white hover:text-[#2A6384] hover:ring-[#2A6384]/35"
      )}
    >
      <Icon size={19} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
      <span className="whitespace-nowrap text-sm font-semibold opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        {link.label}
      </span>
      {link.badge !== undefined && link.badge > 0 && (
        <span className="metric absolute -right-1 -top-1 flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-[#2A6384] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
          {link.badge > 9 ? "9+" : link.badge}
        </span>
      )}
    </Link>
  );
}

export function SidebarNavLinks({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  const links = mainLinks.map((link) => (link.href === "/messages" ? { ...link, badge: unreadMessages } : link));

  function isActive(href: string) {
    if (href === "/postings/internships") return pathname.startsWith("/postings");
    return pathname.startsWith(href);
  }

  return (
    <div className="flex h-full flex-col justify-end">
      <nav className="flex flex-col items-start gap-2 pb-1">
        {links.map((link) => (
          <RailItem key={link.href} link={link} active={isActive(link.href)} />
        ))}
        {progressLinks.map((link) => (
          <RailItem key={link.href} link={link} active={isActive(link.href)} />
        ))}
      </nav>
    </div>
  );
}
