import { Mail } from "lucide-react";
import Link from "next/link";
import { CalendarTile } from "@/components/CalendarTile";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { NavLinks } from "@/components/NavLinks";
import { getCurrentProfile, getCurrentUser, getUnreadPeerMessageCount } from "@/lib/data";

function MessageButton({ unreadMessages }: { unreadMessages: number }) {
  return (
    <Link
      href="/messages"
      className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#2A6384]/50 hover:text-[#2A6384] hover:shadow-md"
      aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : "Messages"}
    >
      <Mail size={19} />
      {unreadMessages > 0 && (
        <span className="metric absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2A6384] px-1 text-[10px] font-semibold text-white ring-2 ring-white">
          {unreadMessages > 9 ? "9+" : unreadMessages}
        </span>
      )}
    </Link>
  );
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "CU";
}

function getFirstName(name: string) {
  return name.split(/\s+/).filter(Boolean)[0] ?? "";
}

export async function Navbar() {
  const user = await getCurrentUser();
  const [profile, unreadMessages] = user ? await Promise.all([getCurrentProfile(), getUnreadPeerMessageCount()]) : [null, 0];
  const profileName = profile?.name ?? user?.email ?? "CareerUp";
  const initials = user ? getInitials(profileName) : "";
  const firstName = user ? getFirstName(profile?.name ?? "") : "";

  return (
    <header className="sticky top-0 z-30 border-b border-[#5E7681]/30 bg-[#F8FBFA]/92 shadow-sm backdrop-blur-xl">
      <nav className="grid w-full grid-cols-[auto_auto] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link href="/dashboard" className="font-display shrink-0 justify-self-start rounded-lg text-2xl font-bold tracking-tight text-[#2A6384] transition duration-150 hover:text-[#214E69]">
          CareerUp
        </Link>
        <NavLinks />
        <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-2 justify-self-end lg:col-start-3">
          {user && <MessageButton unreadMessages={unreadMessages} />}
          <CalendarTile />
          <ProfileDropdown
            initials={initials}
            displayName={firstName}
            loggedIn={!!user}
            schoolLogoUrl={profile?.schoolLogoUrl ?? ""}
            unreadMessages={unreadMessages}
          />
        </div>
      </nav>
    </header>
  );
}
