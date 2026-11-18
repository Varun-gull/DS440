import { Bot, ClipboardList, Gift, Home, Mail, MessagesSquare, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Section = { href: string; label: string; icon: LucideIcon; match?: string };

export const sections: Section[] = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/postings/internships", label: "Find jobs", icon: Search, match: "/postings" },
  { href: "/applications", label: "Applications", icon: ClipboardList },
  { href: "/coach", label: "AI Coach", icon: Bot },
  { href: "/interview", label: "STAR Builder", icon: MessagesSquare },
  { href: "/messages", label: "Messages", icon: Mail },
  { href: "/rewards", label: "Rewards", icon: Gift }
];

export function sectionIndex(pathname: string) {
  return sections.findIndex(section => pathname.startsWith(section.match ?? section.href));
}
