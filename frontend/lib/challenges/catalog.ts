export type TieredChallengeDef = {
  key: string;
  baseTitle: string;
  progressType: "applied" | "saved" | "interviewing" | "offer" | "friends" | "messages" | "groups";
  tiers: {
    id: string;
    tierNum: number;
    description: string;
    target: number;
    xp: number;
  }[];
};

export type OneOffChallengeDef = {
  id: string;
  title: string;
  description: string;
  progressType: "applied" | "profile" | "resume" | "interviewing" | "messages" | "groups" | "friends";
  target: number;
  xp: number;
};

export const tieredChallenges: TieredChallengeDef[] = [
  {
    key: "applications-submitted",
    baseTitle: "Applications Submitted",
    progressType: "applied",
    tiers: [
      { id: "00000000-0000-0000-0001-000000000001", tierNum: 1, description: "Submit your very first application and take the first real step in your internship search.", target: 1, xp: 20 },
      { id: "00000000-0000-0000-0001-000000000002", tierNum: 2, description: "Hit 25 applications. You're building serious momentum.", target: 25, xp: 80 },
      { id: "00000000-0000-0000-0001-000000000003", tierNum: 3, description: "100 applications submitted. You're playing the numbers game like a pro.", target: 100, xp: 200 },
      { id: "00000000-0000-0000-0001-000000000004", tierNum: 4, description: "250 applications. Very few people get here — you're in rare company.", target: 250, xp: 350 },
      { id: "00000000-0000-0000-0001-000000000005", tierNum: 5, description: "1,000 applications. Legendary dedication.", target: 1000, xp: 500 },
    ],
  },
];

export const oneOffChallenges: OneOffChallengeDef[] = [
  {
    id: "00000000-0000-0000-0002-000000000001",
    title: "Profile Complete",
    description: "Fill out your school, major, graduation year, target roles, target locations, and resume keywords.",
    progressType: "profile",
    target: 6,
    xp: 30,
  },
  {
    id: "00000000-0000-0000-0002-000000000002",
    title: "Resume Uploaded",
    description: "Upload your resume to CareerUp so your profile is ready to go.",
    progressType: "resume",
    target: 1,
    xp: 40,
  },
  {
    id: "00000000-0000-0000-0002-000000000003",
    title: "Calendar Keeper",
    description: "Schedule your first interview on the CareerUp calendar.",
    progressType: "interviewing",
    target: 1,
    xp: 25,
  },
  {
    id: "00000000-0000-0000-0002-000000000004",
    title: "Networker",
    description: "Send your first peer message to another student.",
    progressType: "messages",
    target: 1,
    xp: 15,
  },
  {
    id: "00000000-0000-0000-0002-000000000005",
    title: "Group Joiner",
    description: "Join a career group and connect with peers on the same track.",
    progressType: "groups",
    target: 1,
    xp: 20,
  },
];

export const allChallengeIds = new Set([
  ...tieredChallenges.flatMap((c) => c.tiers.map((t) => t.id)),
  ...oneOffChallenges.map((c) => c.id),
]);
