export type RewardKind = "voice" | "resume" | "interview" | "skill" | "insights" | "appearance" | "shield" | "challenge" | "pool" | "workshop";
export type StoreReward = { id: string; title: string; description: string; category: "AI & preparation" | "Personalize & protect" | "Together"; cost: number; kind: RewardKind; repeatable: boolean; includes: string[]; available: boolean };

export const storeRewards: StoreReward[] = [
  { id: "extra-voice-session", title: "One more practice round", description: "An extra five minute AI interview when your daily sessions run out.", category: "AI & preparation", cost: 25, kind: "voice", repeatable: true, available: true, includes: ["One additional live interview session", "Credits stay available until used", "Free daily sessions are used first"] },
  { id: "deep-resume-review", title: "A second look at your resume", description: "Get a detailed, evidence based review for a role you care about.", category: "AI & preparation", cost: 35, kind: "resume", repeatable: true, available: true, includes: ["Compare your saved resume with a job description", "Specific strengths, gaps, and honest bullet improvements", "A saved report you can revisit"] },
  { id: "personal-interview-pack", title: "Walk in prepared", description: "Build a question pack around a company and its actual job description.", category: "AI & preparation", cost: 25, kind: "interview", repeatable: true, available: true, includes: ["Role specific technical and behavioral questions", "Follow up prompts and answer checkpoints", "A personal preparation pack saved to your library"] },
  { id: "personal-skill-challenge", title: "Turn a gap into a strength", description: "Choose a skill and get a practical exercise with a clear finish line.", category: "AI & preparation", cost: 20, kind: "skill", repeatable: true, available: true, includes: ["A focused exercise tailored to the job", "Steps, deliverables, and a self review rubric", "Save a reflection to record your progress"] },
  { id: "career-insights", title: "See your search clearly", description: "Unlock a live progress report built from your own application activity.", category: "AI & preparation", cost: 30, kind: "insights", repeatable: false, available: true, includes: ["Four weeks of activity and current application stages", "Your most active companies and locations", "A downloadable personal report, refreshed when you return"] },
  { id: "profile-studio", title: "Make CareerUp yours", description: "A collection of calm themes, distinctive avatars, and a featured achievement.", category: "Personalize & protect", cost: 30, kind: "appearance", repeatable: false, available: true, includes: ["Ocean, Forest, and Plum app themes", "Initials, Compass, Rocket, and Graduate avatars", "Choose an earned badge to feature on your profile"] },
  { id: "streak-day-pass", title: "A little breathing room", description: "Plan a day off while keeping the streak you worked for.", category: "Personalize & protect", cost: 12, kind: "shield", repeatable: true, available: true, includes: ["Protect one day today or in the next week", "Up to two protected days in any seven day period", "Protected days preserve your streak without adding XP"] },
  { id: "friend-challenge-pass", title: "Bring a friend along", description: "Create a friendly goal around preparation, saved roles, or applications.", category: "Together", cost: 20, kind: "challenge", repeatable: true, available: true, includes: ["Host one challenge for up to six friends", "Choose a goal, target, and seven or fourteen day window", "Friends join by choice; only shared progress counts are visible"] },
  { id: "shared-reward-pool", title: "Make it an interview night", description: "Pool points with friends and unlock a practice session and prep pack for everyone.", category: "Together", cost: 0, kind: "pool", repeatable: true, available: true, includes: ["Create a pool for two to six people", "A shared goal of 20 points per participant", "Unused contributions are returned if the pool is cancelled"] },
  { id: "career-workshop-pass", title: "Take the next step, together", description: "Use points for career workshops and campus experiences when partners become available.", category: "Together", cost: 0, kind: "workshop", repeatable: false, available: false, includes: ["Future interviewing, networking, and career workshops", "Dates, hosts, and redemption details will appear here", "Coming soon; no points are charged"] },
];

export const themeOptions = [
  { id: "ocean", label: "Ocean", color: "#2A6384", canvas: "#CBD7E3" },
  { id: "forest", label: "Forest", color: "#276657", canvas: "#DEE9E2" },
  { id: "plum", label: "Plum", color: "#71537D", canvas: "#E9E1EC" },
] as const;
export const avatarOptions = ["initials", "compass", "rocket", "graduate"] as const;
export const challengeMetrics = [
  { id: "practice", label: "STAR answers saved", description: "Complete the prompt and all four STAR sections." },
  { id: "save", label: "Roles thoughtfully saved", description: "Each distinct role counts once." },
  { id: "apply", label: "Applications recorded", description: "Self reported application activity; each role counts once." },
  { id: "skill", label: "Skill exercises completed", description: "Finish an unlocked exercise and save your reflection." },
] as const;
export type RewardArtifact = { title: string; summary: string; sections: Array<{ title: string; items: string[] }> };
export type Redemption = { id: string; reward_id: string; cost: number; status: "available" | "generating" | "ready" | "used" | "refunded"; created_at: string; content: RewardArtifact | null; hasContent?: boolean; details: Record<string, unknown>; };
export type RewardPreferences = { theme: "ocean" | "forest" | "plum"; avatar: typeof avatarOptions[number]; badge: string };
export type CommunityMember = { userId: string; name: string; state: string; progress: number; contribution: number };
export type FriendGoal = { id: string; title: string; metric: string; target: number; endsAt: string; ownerId: string; state: string; members: CommunityMember[] };
export type RewardPool = { id: string; title: string; target: number; raised: number; endsAt: string; ownerId: string; status: "open" | "funded" | "cancelled"; members: CommunityMember[] };
export type RewardInsights = { total: number; stages: Array<{ label: string; value: number }>; weeks: Array<{ label: string; saved: number; applied: number; practice: number; skill: number }>; locations: Array<{ label: string; value: number }>; companies: Array<{ label: string; value: number }>; practice: number; generatedAt: string };
export type RewardsState = { userId: string; name: string; xp: number; applicationsApplied: number; balance: number; earned: number; spent: number; voiceCredits: number; shieldDays: string[]; hasResume: boolean; aiConfigured: boolean; preferences: RewardPreferences; redemptions: Redemption[]; ledger: Array<{ id: string; delta: number; balance_after: number; reason: string; kind: string; created_at: string }>; friends: Array<{ id: string; name: string }>; goals: FriendGoal[]; pools: RewardPool[]; insights: RewardInsights | null; legacy: Array<{ id: string; title: string; contents: string[] }>; };

export function rewardById(id: string) { return storeRewards.find((reward) => reward.id === id); }
export function isOwned(state: Pick<RewardsState, "redemptions">, id: string) { return state.redemptions.some((item) => item.reward_id === id && item.status !== "refunded"); }
export function canRefund(item: Redemption, now = Date.now()) { return item.cost > 0 && item.status === "available" && now - Date.parse(item.created_at) < 7 * 86400000; }
export function pointsToGo(cost: number, balance: number) { return Math.max(0, cost - balance); }
