import { buildRoleKey } from "./role-key";
import type { Application, Challenge, LeaderboardUser, Profile } from "./types";

export const profile: Profile = {
  name: "Varun",
  school: "Student Builder",
  schoolLogoUrl: "",
  major: "Computer Science",
  graduationYear: "2027",
  targetRoles: ["Software Engineering", "Product", "Data"],
  targetLocations: ["New York", "Remote", "San Francisco"],
  resumeKeywords: ["React", "TypeScript", "Python", "Data Analysis"],
  resumeFileName: "sample-resume.txt",
  resumeUpdatedAt: "Sample",
  shareApplicationBoard: false,
  privacyPromptAnswered: true,
  xp: 430,
  totalXp: 430,
  rewardPoints: 430,
  streak: 6,
  streakBroken: false,
  streakFreeReviveUsed: false,
  streakPaidRevives: 0,
  streakReviveRequiredApplications: 0,
  applicationsApplied: 14
};

export const applications: Application[] = [
  {
    id: "1",
    company: "Northstar Labs",
    role: "Software Engineering Intern",
    location: "New York, NY",
    source: "Handshake",
    status: "applied",
    roleKey: buildRoleKey("Northstar Labs", "Software Engineering Intern"),
    applicationYear: 2026,
    fitScore: 92,
    xp: 20,
    deadline: "2026-07-01",
    updatedAt: "Today"
  },
  {
    id: "2",
    company: "BlueGrid AI",
    role: "Product Intern",
    location: "Remote",
    source: "Company site",
    status: "interviewing",
    roleKey: buildRoleKey("BlueGrid AI", "Product Intern"),
    applicationYear: 2026,
    fitScore: 86,
    xp: 35,
    deadline: "2026-06-25",
    updatedAt: "Yesterday"
  },
  {
    id: "3",
    company: "Summit Capital",
    role: "Data Analyst Intern",
    location: "Chicago, IL",
    source: "LinkedIn",
    status: "saved",
    roleKey: buildRoleKey("Summit Capital", "Data Analyst Intern"),
    applicationYear: 2026,
    fitScore: 79,
    xp: 5,
    deadline: "2026-07-10",
    updatedAt: "2 days ago"
  }
];

export const challenges: Challenge[] = [
  {
    id: "daily-apply",
    title: "Daily Apply Sprint",
    description: "Submit one high-quality application today.",
    xp: 40,
    progress: 1,
    target: 1,
    completed: true
  },
  {
    id: "profile-polish",
    title: "Profile Polish",
    description: "Add target roles, locations, and resume keywords.",
    xp: 30,
    progress: 2,
    target: 3,
    completed: false
  },
  {
    id: "pipeline-builder",
    title: "Pipeline Builder",
    description: "Save five internships that match your goals.",
    xp: 60,
    progress: 3,
    target: 5,
    completed: false
  }
];

export const leaderboard: LeaderboardUser[] = [
  { id: "u1", name: "Maya", school: "Rutgers University", schoolLogoUrl: "https://logo.clearbit.com/rutgers.edu", xp: 910, streak: 11, applicationsApplied: 45 },
  { id: "u2", name: "Jordan", school: "New York University", schoolLogoUrl: "https://logo.clearbit.com/nyu.edu", xp: 710, streak: 8, applicationsApplied: 12 },
  { id: "u3", name: "Varun", school: "Student Builder", schoolLogoUrl: "", xp: profile.xp, streak: profile.streak, applicationsApplied: 3 },
  { id: "u4", name: "Ari", school: "Stevens Institute of Technology", schoolLogoUrl: "https://logo.clearbit.com/stevens.edu", xp: 360, streak: 4, applicationsApplied: 0 }
];
