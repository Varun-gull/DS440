import { Coins, Flame } from "lucide-react";
import Link from "next/link";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { getCurrentProfile, getCurrentUser, getUnreadPeerMessageCount } from "@/lib/data";
import { BrandMark } from "@/components/BrandMark";
import { rewardsSnapshot } from "@/lib/rewards/server";

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

export async function TopBar() {
  const user = await getCurrentUser();
  const appearance = user ? await rewardsSnapshot(user.id) : null;
  const [profile, unreadMessages] = user ? await Promise.all([getCurrentProfile(), getUnreadPeerMessageCount()]) : [null, 0];
  const profileName = profile?.name ?? user?.email ?? "CareerUp";
  const initials = user ? getInitials(profileName) : "";
  const firstName = user ? getFirstName(profile?.name ?? "") : "";

  return (
    <header className="app-topbar">
      <Link href="/dashboard" aria-label="CareerUp home"><BrandMark /></Link>
      <span className="topbar-purpose">Your next opportunity starts here.</span>
      <div className="topbar-account">
        {user && <Link href="/rewards" aria-label={`${profile?.rewardPoints ?? 0} Reward Points. Open rewards`} className="topbar-points"><Coins size={16} aria-hidden /><span>{(profile?.rewardPoints ?? 0).toLocaleString()}<span className="hidden sm:inline"> points</span></span></Link>}
        {profile && profile.streak > 0 && <span className="topbar-streak"><Flame size={15} aria-hidden />{profile.streak}<span className="hidden lg:inline"> day streak</span></span>}
        <ProfileDropdown
          initials={initials}
          displayName={firstName}
          loggedIn={!!user}
          schoolLogoUrl={profile?.schoolLogoUrl ?? ""}
          unreadMessages={unreadMessages}
          avatar={appearance?.customized ? appearance.preferences.avatar : undefined}
        />
      </div>
    </header>
  );
}
