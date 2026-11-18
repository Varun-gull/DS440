import { FileCheck2, FileText, Share2 } from "lucide-react";
import Link from "next/link";
import { ProfileAutosaveForm } from "@/components/ProfileAutosaveForm";
import { RankBadge } from "@/components/RankBadge";
import { ResumeUploadField } from "@/components/ResumeUploadField";
import { BadgeShelf } from "@/components/BadgeDisplay";
import { XpProgressBar } from "@/components/XpProgressBar";
import { getCurrentProfile, getCurrentUser } from "@/lib/data";
import { rewardsSnapshot } from "@/lib/rewards/server";
import { RewardAvatar } from "@/components/rewards/RewardUI";
import { applicationBadges } from "@/lib/badges/catalog";
import { schoolOptions } from "@/lib/schools";

export const runtime = "nodejs";

const targetRoleOptions = [
  "Software Engineering Intern",
  "Data Science Intern",
  "AI / ML Intern",
  "Product Management Intern",
  "Business Analyst Intern",
  "Cybersecurity Intern",
  "Quant Intern",
  "UX Design Intern",
  "Software Engineer New Grad",
  "Data Analyst New Grad",
  "Associate Product Manager",
  "Business Analyst New Grad"
].map((value) => ({ label: value, value }));

const targetLocationOptions = [
  "Remote",
  "Hybrid",
  "New York, NY",
  "San Francisco, CA",
  "Seattle, WA",
  "Austin, TX",
  "Boston, MA",
  "Chicago, IL",
  "Washington, DC",
  "Atlanta, GA",
  "Los Angeles, CA",
  "Dallas, TX"
].map((value) => ({ label: value, value }));

export default async function ProfilePage({ searchParams: searchParamsInput }: { searchParams?: Promise<{ message?: string }> }) {
  const searchParams = await searchParamsInput;
  const profile = await getCurrentProfile();
  const user = await getCurrentUser();
  const appearance = user ? await rewardsSnapshot(user.id) : null;
  const featuredBadge = applicationBadges.find((b) => b.id === appearance?.preferences.badge && profile.applicationsApplied >= b.threshold);
  const profileDetails = [
    profile.school && profile.school !== "CareerUp Student" ? profile.school : "",
    profile.major,
    profile.graduationYear ? `Class of ${profile.graduationYear}` : ""
  ].filter(Boolean);

  return (
    <>
      <main className="page-shell">
        <section className="card overflow-hidden">
          <div className="profile-banner relative isolate overflow-hidden border-b border-white/10 bg-[#142b49] px-6 py-10 text-white">
            <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
            <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
            <div className="relative flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="font-display flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white text-2xl font-bold text-[#2456a6] sm:h-20 sm:w-20">
                  {appearance?.customized ? <RewardAvatar avatar={appearance.preferences.avatar} name={profile.name} size={36} /> : profile.schoolLogoUrl ? <img src={profile.schoolLogoUrl} alt="" className="h-full w-full bg-white object-contain p-2" /> : profile.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">Student profile</p>
                  {featuredBadge && <p className="mt-2 text-xs font-semibold text-[#BBE5CE]">{featuredBadge.emoji} {featuredBadge.label}</p>}
                  <h1 className="font-display mt-1 text-4xl font-bold tracking-tight">{profile.name}</h1>
                  {profileDetails.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profileDetails.map((detail) => (
                        <span key={detail} className="rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white ring-1 ring-inset ring-white/20">
                          {detail}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-white/70">Add your school, major, and graduation year.</p>
                  )}
                </div>
              </div>
              <Link
                href="/friends"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/20 px-5 font-semibold transition duration-200 ease-out hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
              >
                <Share2 className="mr-2" size={18} /> Share profile
              </Link>
            </div>
          </div>
          <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <h2 className="text-xl font-bold text-ink">Profile setup</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Help CareerUp recommend relevant roles. Your resume stays private and AI sharing is always optional.</p>
              {searchParams?.message && <p className="mt-4 rounded-2xl bg-[#eef3fc] p-3 text-sm font-bold text-[#2456a6]">{searchParams.message}</p>}
              <ProfileAutosaveForm
                profile={profile}
                schools={schoolOptions}
                targetRoleOptions={targetRoleOptions}
                targetLocationOptions={targetLocationOptions}
              />
            </div>
            <aside className="space-y-4">
              <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
                <p className="mb-2 text-sm font-bold text-slate-500">Current rank</p>
                <RankBadge xp={profile.xp} />
              </div>
              <XpProgressBar xp={profile.xp} />
              <BadgeShelf applicationsApplied={profile.applicationsApplied} />
              <div className="rounded-3xl border border-slate-200 bg-white/85 p-4">
                <div className="rounded-2xl border border-[#5E7681]/30 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef3fc] text-brand">
                      {profile.resumeFileName ? <FileCheck2 size={21} /> : <FileText size={21} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-500">Resume</p>
                      <p className="mt-1 truncate text-lg font-bold text-ink">{profile.resumeFileName || "No resume saved"}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {profile.resumeUpdatedAt ? `Updated ${profile.resumeUpdatedAt}` : "Upload or paste resume text to improve matching."}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <ResumeUploadField />
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>
    </>
  );
}
