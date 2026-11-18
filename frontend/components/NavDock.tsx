"use client";

import { ArrowUpRight, CheckCircle2, Ellipsis, Settings2, ShieldCheck, Trophy, UserRound, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePageFlow } from "@/components/PageFlow";
import { sections, type Section } from "@/lib/sections";

const community: Section[] = [
  { href: "/challenges", label: "Challenges", icon: CheckCircle2 },
  { href: "/friends", label: "Friends & groups", icon: UsersRound },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];
const account: Section[] = [
  { href: "/profile", label: "My profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings2 },
];
const mobilePaths = ["/dashboard", "/postings/internships", "/applications", "/coach"];

export function NavDock({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  const { travelTo } = usePageFlow();
  const menu = useRef<HTMLDialogElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { menu.current?.close(); setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen]);
  function active(section: Section) { return pathname.startsWith(section.match ?? section.href); }
  const inMainMobilePage = sections.some(section => mobilePaths.includes(section.href) && active(section));
  function navLink(section: Section, mobile = false) {
    const Icon = section.icon;
    const badge = section.href === "/messages" ? unreadMessages : 0;
    return <Link key={section.href} href={section.href} className={mobile ? "mobile-nav-link" : "workspace-nav-link"} aria-current={active(section) ? "page" : undefined} onClick={event => { menu.current?.close(); if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; event.preventDefault(); travelTo(section.href); }}>
      <Icon size={mobile ? 21 : 19} strokeWidth={1.8} aria-hidden />
      <span>{section.label}</span>
      {badge > 0 && <span className="nav-unread">{badge > 9 ? "9+" : badge}</span>}
    </Link>;
  }
  return <>
    <aside className="workspace-sidebar" aria-label="Workspace sidebar">
      <div className="sidebar-content">
        <p className="nav-group-label">Your workspace</p>
        <nav aria-label="Main navigation">{sections.map(section => navLink(section))}</nav>
        <p className="nav-group-label">Keep growing</p>
        <nav aria-label="Community navigation">{community.map(section => navLink(section))}</nav>
        <div className="sidebar-bottom">
          <nav aria-label="Account navigation">{account.map(section => navLink(section))}</nav>
          <Link href="/settings#privacy" className="sidebar-privacy"><ShieldCheck size={15} aria-hidden />Your data, your control<ArrowUpRight size={13} aria-hidden /></Link>
        </div>
      </div>
    </aside>
    <nav className="mobile-navigation" aria-label="Mobile navigation">
      {mobilePaths.map(path => sections.find(section => section.href === path)!).map(section => navLink(section, true))}
      <button ref={moreButton} className="mobile-nav-link" data-active={!inMainMobilePage} onClick={() => { menu.current?.showModal(); setMenuOpen(true); }} aria-label="More navigation" aria-haspopup="dialog" aria-expanded={menuOpen}><Ellipsis size={21} aria-hidden /><span>More</span></button>
    </nav>
    <dialog ref={menu} className="workspace-mobile-menu" aria-label="All CareerUp pages" onClose={() => { setMenuOpen(false); moreButton.current?.focus({ preventScroll: true }); }} onClick={event => { if (event.target === event.currentTarget) menu.current?.close(); }}>
      <header><div><p className="nav-group-label">Your workspace</p><h2>Where would you like to go?</h2></div><button type="button" aria-label="Close navigation" onClick={() => menu.current?.close()}><X size={21} /></button></header>
      <nav aria-label="All pages">{[...sections, ...community, ...account].map(section => navLink(section))}</nav>
      <Link href="/settings#privacy" className="sidebar-privacy" onClick={() => menu.current?.close()}><ShieldCheck size={15} />Privacy & data controls</Link>
    </dialog>
  </>;
}
