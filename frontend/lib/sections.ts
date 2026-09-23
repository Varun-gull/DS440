import { CalendarDays, ClipboardList, Gift, Home, Mail, MessagesSquare, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Section = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefix that counts as "you are here", when it differs from href. */
  match?: string;
};

/**
 * The app read as one document, top to bottom: check the day, work the board,
 * find new roles, answer people, prepare, look ahead, then spend what you earned.
 * This order is the dock's order and the order you travel by scrolling.
 */
export const sections: Section[] = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/postings/internships", label: "Postings", icon: Search, match: "/postings" },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/interview", label: "Prep", icon: MessagesSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/rewards", label: "Rewards", icon: Gift }
];

export function sectionIndex(pathname: string) {
  return sections.findIndex((section) => pathname.startsWith(section.match ?? section.href));
}
