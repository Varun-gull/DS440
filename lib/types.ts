export type ApplicationStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export type Application = {
  id: string;
  company: string;
  role: string;
  location: string;
  source: string;
  status: ApplicationStatus;
  roleKey: string;
  applicationYear: number;
  fitScore: number;
  xp: number;
  deadline: string;
  updatedAt: string;
};

export type InternshipPosting = {
  id: string;
  company: string;
  title: string;
  location: string;
  source: string;
  url: string;
  remote: boolean;
  workMode: "remote" | "hybrid" | "onsite";
  postedAt: string;
  tags: string[];
  description: string;
  fitScore: number;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  completed: boolean;
  tier?: number;
  totalTiers?: number;
};

export type ChallengesData = {
  tiered: Challenge[];
  oneOff: Challenge[];
};

export type Reward = {
  id: string;
  title: string;
  description: string;
  category: string;
  xpCost: number;
  contents: string[];
  unlocked: boolean;
};

export type InterviewAnswer = {
  id: string;
  prompt: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  notes: string;
  createdAt: string;
};

export type LeaderboardUser = {
  id: string;
  name: string;
  school: string;
  schoolLogoUrl: string;
  xp: number;
  streak: number;
  applicationsApplied: number;
};

export type Friend = {
  id: string;
  userId: string;
  name: string;
  email: string;
  school: string;
  schoolLogoUrl: string;
  xp: number;
  streak: number;
  status: "pending" | "accepted" | "blocked";
  direction: "incoming" | "outgoing";
};

export type CareerGroup = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  totalXp: number;
  averageXp: number;
  members: LeaderboardUser[];
};

export type GroupLeaderboardRow = {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  totalXp: number;
  averageXp: number;
  currentUserMember: boolean;
};

export type PublicProfile = {
  id: string;
  name: string;
  school: string;
  schoolLogoUrl: string;
  major: string;
  graduationYear: string;
  targetRoles: string[];
  targetLocations: string[];
  xp: number;
  streak: number;
  applicationsApplied: number;
};

export type MutualFriend = {
  id: string;
  name: string;
  school: string;
  schoolLogoUrl: string;
  xp: number;
};

export type RolePeerInsight = {
  roleKey: string;
  trackedCount: number;
  appliedCount: number;
  interviewedCount: number;
  offerCount: number;
};

export type RolePeerFeatureStatus = {
  ready: boolean;
  missing: string[];
};

export type RolePeerApplicant = {
  applicationId: string;
  profileId: string;
  name: string;
  school: string;
  schoolLogoUrl: string;
  company: string;
  role: string;
  location: string;
  status: ApplicationStatus;
  applicationYear: number;
  updatedAt: string;
  canMessage: boolean;
};

export type PeerMessage = {
  id: string;
  roleKey: string;
  applicationId: string;
  senderId: string;
  recipientId: string;
  otherProfileId: string;
  otherName: string;
  otherSchool: string;
  otherSchoolLogoUrl: string;
  subject: string;
  body: string;
  readAt: string;
  unread: boolean;
  createdAt: string;
  direction: "sent" | "received";
  applicationCompany: string;
  applicationRole: string;
  applicationStatus: ApplicationStatus;
  applicationYear: number;
};

export type CalendarEvent = {
  id: string;
  applicationId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  eventType: "deadline" | "submitted" | "custom" | "interview" | "offer";
  date: string; // YYYY-MM-DD
  time?: string;
  notes?: string;
};

export type Profile = {
  name: string;
  school: string;
  schoolLogoUrl: string;
  major: string;
  graduationYear: string;
  targetRoles: string[];
  targetLocations: string[];
  resumeKeywords: string[];
  resumeFileName: string;
  resumeUpdatedAt: string;
  shareApplicationBoard: boolean;
  privacyPromptAnswered: boolean;
  xp: number;
  totalXp: number;
  rewardPoints: number;
  streak: number;
  streakBroken: boolean;
  streakFreeReviveUsed: boolean;
  streakPaidRevives: number;
  streakReviveRequiredApplications: number;
  applicationsApplied: number;
};
