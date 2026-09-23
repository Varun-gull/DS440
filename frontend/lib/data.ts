import { applications as mockApplications, challenges as mockChallenges, leaderboard as mockLeaderboard, profile as mockProfile } from "./mock-data";
import { rewardCatalog } from "./rewards/catalog";
import { tieredChallenges, oneOffChallenges } from "./challenges/catalog";
import { buildRoleKey } from "./role-key";
import { getSchoolLogoUrl } from "./schools";
import type { Application, CalendarEvent, CareerGroup, Challenge, ChallengesData, Friend, GroupLeaderboardRow, InterviewAnswer, LeaderboardUser, MutualFriend, PeerMessage, Profile, PublicProfile, Reward, RolePeerApplicant, RolePeerFeatureStatus, RolePeerInsight } from "./types";
import { getSupabaseServerClient } from "./supabase/server";
import { getDateKeyStartUtcIso, getTodayKey, getVisibleStreak, isBrokenStreak } from "./streak";

type DbApplication = {
  id: string;
  company: string;
  role: string;
  location: string | null;
  source_url: string | null;
  status: Application["status"];
  role_key?: string | null;
  application_year?: number | null;
  fit_score: number | null;
  xp_awarded: number | null;
  deadline: string | null;
  updated_at: string;
};

type DbProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  school: string | null;
  school_logo_url: string | null;
  major: string | null;
  graduation_year: string | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  resume_text: string | null;
  resume_keywords: string[] | null;
  resume_file_name: string | null;
  resume_updated_at: string | null;
  share_application_board: boolean | null;
  privacy_prompt_answered: boolean | null;
  xp: number | null;
  total_xp: number | null;
  reward_points?: number | null;
  streak_count: number | null;
  last_applied_on: string | null;
  streak_free_revive_used: boolean | null;
  streak_paid_revives: number | null;
  streak_revive_required_applications: number | null;
  applications_applied: number | null;
};

type DbFriend = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: Friend["status"];
};

type DbCareerGroup = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
};

type DbCareerGroupMember = {
  id: string;
  group_id: string;
  user_id: string;
};

function resolveSchoolLogoUrl(school: string | null | undefined, storedLogoUrl: string | null | undefined) {
  const derivedLogoUrl = school ? getSchoolLogoUrl(school) : "";
  return derivedLogoUrl || storedLogoUrl || "";
}

function mapDbApplication(application: DbApplication): Application {
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    location: application.location ?? "Remote",
    source: application.source_url ?? "Saved manually",
    status: application.status,
    roleKey: application.role_key ?? buildRoleKey(application.company, application.role),
    applicationYear: application.application_year ?? new Date(application.updated_at).getFullYear(),
    fitScore: application.fit_score ?? 75,
    xp: application.xp_awarded ?? 0,
    deadline: application.deadline ?? "No deadline",
    updatedAt: new Date(application.updated_at).toLocaleDateString()
  };
}

function getLeaderboardXp(profile: Pick<DbProfile, "xp" | "total_xp">) {
  return profile.total_xp ?? profile.xp ?? 0;
}

function getOptionalTotalXp(profile: object) {
  return "total_xp" in profile && typeof profile.total_xp === "number" ? profile.total_xp : null;
}

type DbRolePeerInsight = {
  role_key: string;
  tracked_count: number | null;
  applied_count: number | null;
  interviewed_count: number | null;
  offer_count: number | null;
};

type DbRolePeerApplicant = {
  application_id: string;
  profile_id: string;
  full_name: string | null;
  school: string | null;
  school_logo_url: string | null;
  company: string;
  role: string;
  location: string | null;
  status: Application["status"];
  application_year: number | null;
  updated_at: string;
  can_message: boolean | null;
};

type DbPeerMessage = {
  id: string;
  role_key: string;
  application_id: string | null;
  sender_id: string;
  recipient_id: string;
  subject: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

type DbPeerMessageWithContext = DbPeerMessage & {
  other_profile_id: string | null;
  other_full_name: string | null;
  other_school: string | null;
  other_school_logo_url: string | null;
  application_company: string | null;
  application_role: string | null;
  application_status: Application["status"] | null;
  application_year: number | null;
};

type DbUserReward = {
  reward_id: string;
};

type DbChallenge = {
  id: string;
  title: string;
  description: string;
  xp_reward: number;
  target: number;
};

type DbCompletedChallenge = {
  challenge_id: string;
  completed_on: string | null;
};

type DbInterviewAnswer = {
  id: string;
  prompt: string;
  situation: string | null;
  task: string | null;
  action_taken: string | null;
  result_outcome: string | null;
  notes: string | null;
  created_at: string;
};

export async function getCurrentUser() {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentProfile(): Promise<Profile> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return mockProfile;
  }

  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single<DbProfile>();

  if (!data) {
    return mockProfile;
  }

  const permanentXp = Math.max(data.xp ?? 0, data.total_xp ?? data.xp ?? 0);
  const rewardPoints = data.reward_points ?? data.xp ?? 0;

  return {
    name: data.full_name ?? user.email ?? "Student",
    school: data.school ?? "CareerUp Student",
    schoolLogoUrl: resolveSchoolLogoUrl(data.school, data.school_logo_url),
    major: data.major ?? "",
    graduationYear: data.graduation_year ?? "",
    targetRoles: data.target_roles ?? [],
    targetLocations: data.target_locations ?? [],
    resumeKeywords: data.resume_keywords ?? [],
    resumeFileName: data.resume_file_name ?? "",
    resumeUpdatedAt: data.resume_updated_at ? new Date(data.resume_updated_at).toLocaleDateString() : "",
    shareApplicationBoard: data.share_application_board ?? false,
    privacyPromptAnswered: data.privacy_prompt_answered ?? false,
    xp: permanentXp,
    totalXp: permanentXp,
    rewardPoints,
    streak: getVisibleStreak(data.last_applied_on ?? null, data.streak_count ?? 0),
    streakBroken: isBrokenStreak(data.last_applied_on ?? null, data.streak_count ?? 0),
    streakFreeReviveUsed: data.streak_free_revive_used ?? false,
    streakPaidRevives: data.streak_paid_revives ?? 0,
    streakReviveRequiredApplications: data.streak_revive_required_applications ?? 0,
    applicationsApplied: data.applications_applied ?? 0
  };
}

export async function getCurrentResumeForOptimization() {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return {
      resumeText: "",
      resumeKeywords: [],
      resumeFileName: "",
    };
  }

  const { data } = await supabase
    .from("profiles")
    .select("resume_text, resume_keywords, resume_file_name")
    .eq("id", user.id)
    .single<Pick<DbProfile, "resume_text" | "resume_keywords" | "resume_file_name">>();

  return {
    resumeText: data?.resume_text ?? "",
    resumeKeywords: data?.resume_keywords ?? [],
    resumeFileName: data?.resume_file_name ?? "",
  };
}

export async function getApplications(): Promise<Application[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return mockApplications;
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .returns<DbApplication[]>();

  if (error || !data) {
    return [];
  }

  return data.map(mapDbApplication);
}

export async function getRolePeerFeatureStatus(): Promise<RolePeerFeatureStatus> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return { ready: true, missing: [] };
  }

  const checks = await Promise.all([
    supabase.from("applications").select("role_key, application_year").limit(1),
    supabase.from("peer_messages").select("id", { count: "exact", head: true }),
    supabase.rpc("get_role_peer_summaries", { role_keys: ["careerup_setup_check"] }),
    supabase.rpc("get_role_peer_applicants", { target_role_key: "careerup_setup_check" }),
    supabase.rpc("get_peer_messages")
  ]);

  const missing = [
    checks[0].error ? "application year tracking columns" : "",
    checks[1].error ? "peer message table" : "",
    checks[2].error ? "peer summary function" : "",
    checks[3].error ? "peer applicant function" : "",
    checks[4].error ? "message inbox function" : ""
  ].filter(Boolean);

  return {
    ready: missing.length === 0,
    missing
  };
}

export async function getRolePeerInsights(roleKeys: string[]): Promise<Map<string, RolePeerInsight>> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();
  const uniqueRoleKeys = Array.from(new Set(roleKeys.filter(Boolean)));

  if (!supabase || !user || uniqueRoleKeys.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase.rpc("get_role_peer_summaries", { role_keys: uniqueRoleKeys });

  if (error || !data) {
    return new Map();
  }

  const insights = data as DbRolePeerInsight[];

  return new Map(
    insights.map((insight) => [
      insight.role_key,
      {
        roleKey: insight.role_key,
        trackedCount: insight.tracked_count ?? 0,
        appliedCount: insight.applied_count ?? 0,
        interviewedCount: insight.interviewed_count ?? 0,
        offerCount: insight.offer_count ?? 0
      }
    ])
  );
}

export async function getRolePeerApplicants(roleKey: string): Promise<RolePeerApplicant[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user || !roleKey) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_role_peer_applicants", { target_role_key: roleKey });

  if (error || !data) {
    return [];
  }

  const applicants = data as DbRolePeerApplicant[];

  return applicants.map((applicant) => ({
    applicationId: applicant.application_id,
    profileId: applicant.profile_id,
    name: applicant.full_name ?? "CareerUp Student",
    school: applicant.school ?? "Student",
    schoolLogoUrl: resolveSchoolLogoUrl(applicant.school, applicant.school_logo_url),
    company: applicant.company,
    role: applicant.role,
    location: applicant.location ?? "Remote",
    status: applicant.status,
    applicationYear: applicant.application_year ?? new Date(applicant.updated_at).getFullYear(),
    updatedAt: new Date(applicant.updated_at).toLocaleDateString(),
    canMessage: applicant.can_message ?? false
  }));
}

export async function getPeerMessages(): Promise<PeerMessage[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return [];
  }

  const { data: rpcMessages, error: rpcError } = await supabase.rpc("get_peer_messages");

  if (!rpcError && rpcMessages) {
    return (rpcMessages as DbPeerMessageWithContext[]).map((message) => {
      const direction = message.sender_id === user.id ? "sent" : "received";

      return {
        id: message.id,
        roleKey: message.role_key,
        applicationId: message.application_id ?? "",
        senderId: message.sender_id,
        recipientId: message.recipient_id,
        otherProfileId: message.other_profile_id ?? (direction === "sent" ? message.recipient_id : message.sender_id),
        otherName: message.other_full_name ?? "CareerUp Student",
        otherSchool: message.other_school ?? "Student",
        otherSchoolLogoUrl: resolveSchoolLogoUrl(message.other_school, message.other_school_logo_url),
        subject: message.subject,
        body: message.body,
        readAt: message.read_at ? new Date(message.read_at).toLocaleDateString() : "",
        unread: direction === "received" && !message.read_at,
        createdAt: new Date(message.created_at).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        }),
        direction,
        applicationCompany: message.application_company ?? "Role",
        applicationRole: message.application_role ?? "CareerUp role",
        applicationStatus: message.application_status ?? "saved",
        applicationYear: message.application_year ?? new Date(message.created_at).getFullYear()
      };
    });
  }

  const { data: messages, error } = await supabase
    .from("peer_messages")
    .select("id, role_key, application_id, sender_id, recipient_id, subject, body, read_at, created_at")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .returns<DbPeerMessage[]>();

  if (error || !messages?.length) {
    return [];
  }

  const profileIds = Array.from(new Set(messages.flatMap((message) => [message.sender_id, message.recipient_id]).filter((id) => id !== user.id)));
  const applicationIds = Array.from(new Set(messages.map((message) => message.application_id).filter(Boolean)));

  const [{ data: profiles }, { data: applications }] = await Promise.all([
    profileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, school, school_logo_url")
          .in("id", profileIds)
          .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url">>>()
      : Promise.resolve({ data: [] }),
    applicationIds.length > 0
      ? supabase
          .from("applications")
          .select("*")
          .in("id", applicationIds)
          .returns<DbApplication[]>()
      : Promise.resolve({ data: [] })
  ]);

  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const applicationsById = new Map((applications ?? []).map((application) => [application.id, mapDbApplication(application)]));

  return messages.map((message) => {
    const direction = message.sender_id === user.id ? "sent" : "received";
    const otherProfileId = direction === "sent" ? message.recipient_id : message.sender_id;
    const otherProfile = profilesById.get(otherProfileId);
    const application = message.application_id ? applicationsById.get(message.application_id) : undefined;

    return {
      id: message.id,
      roleKey: message.role_key,
      applicationId: message.application_id ?? "",
      senderId: message.sender_id,
      recipientId: message.recipient_id,
      otherProfileId,
      otherName: otherProfile?.full_name ?? "CareerUp Student",
      otherSchool: otherProfile?.school ?? "Student",
      otherSchoolLogoUrl: resolveSchoolLogoUrl(otherProfile?.school, otherProfile?.school_logo_url),
      subject: message.subject,
      body: message.body,
      readAt: message.read_at ? new Date(message.read_at).toLocaleDateString() : "",
      unread: direction === "received" && !message.read_at,
      createdAt: new Date(message.created_at).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      }),
      direction,
      applicationCompany: application?.company ?? "Role",
      applicationRole: application?.role ?? "CareerUp role",
      applicationStatus: application?.status ?? "saved",
      applicationYear: application?.applicationYear ?? new Date(message.created_at).getFullYear()
    };
  });
}

export async function getUnreadPeerMessageCount(): Promise<number> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return 0;
  }

  const { count, error } = await supabase
    .from("peer_messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function getLeaderboard(): Promise<LeaderboardUser[]> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return mockLeaderboard;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, school, school_logo_url, xp, total_xp, streak_count, last_applied_on, applications_applied")
    .order("total_xp", { ascending: false })
    .limit(25)
    .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "total_xp" | "streak_count" | "last_applied_on" | "applications_applied">>>();

  const rows =
    error || !data
      ? (
          await supabase
            .from("profiles")
            .select("id, full_name, school, school_logo_url, xp, streak_count, last_applied_on, applications_applied")
            .order("xp", { ascending: false })
            .limit(25)
            .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "streak_count" | "last_applied_on" | "applications_applied">>>()
        ).data
      : data;

  if (!rows) {
    return mockLeaderboard;
  }

  return rows.map((user) => ({
    id: user.id,
    name: user.full_name ?? "CareerUp Student",
    school: user.school ?? "Student",
    schoolLogoUrl: resolveSchoolLogoUrl(user.school, user.school_logo_url),
    xp: getLeaderboardXp({ xp: user.xp, total_xp: getOptionalTotalXp(user) }),
    streak: getVisibleStreak(user.last_applied_on ?? null, user.streak_count ?? 0),
    applicationsApplied: user.applications_applied ?? 0,
  }));
}

export async function getFriends(): Promise<Friend[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return [];
  }

  const { data: friendships, error } = await supabase
    .from("friends")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .returns<DbFriend[]>();

  if (error || !friendships?.length) {
    return [];
  }

  const profileIds = Array.from(new Set(friendships.map((friendship) => (friendship.requester_id === user.id ? friendship.addressee_id : friendship.requester_id))));

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, school, school_logo_url, xp, total_xp, streak_count, last_applied_on")
    .in("id", profileIds)
    .returns<Array<Pick<DbProfile, "id" | "full_name" | "email" | "school" | "school_logo_url" | "xp" | "total_xp" | "streak_count" | "last_applied_on">>>();

  if (profilesError || !profiles) {
    return [];
  }

  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));

  return friendships
    .map((friendship) => {
      const friendId = friendship.requester_id === user.id ? friendship.addressee_id : friendship.requester_id;
      const profile = profilesById.get(friendId);

      if (!profile) {
        return null;
      }

      return {
        id: friendship.id,
        userId: friendId,
        name: profile.full_name ?? profile.email ?? "CareerUp Student",
        email: profile.email ?? "",
        school: profile.school ?? "Student",
        schoolLogoUrl: resolveSchoolLogoUrl(profile.school, profile.school_logo_url),
        xp: getLeaderboardXp({ xp: profile.xp, total_xp: getOptionalTotalXp(profile) }),
        streak: getVisibleStreak(profile.last_applied_on ?? null, profile.streak_count ?? 0),
        status: friendship.status,
        direction: friendship.requester_id === user.id ? "outgoing" : "incoming"
      } satisfies Friend;
    })
    .filter((friend): friend is Friend => Boolean(friend));
}

export async function getFriendLeaderboard(): Promise<LeaderboardUser[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return mockLeaderboard;
  }

  const friends = await getFriends();
  const acceptedFriendIds = friends.filter((friend) => friend.status === "accepted").map((friend) => friend.userId);
  const ids = [user.id, ...acceptedFriendIds];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, school, school_logo_url, xp, total_xp, streak_count, last_applied_on, applications_applied")
    .in("id", ids)
    .order("total_xp", { ascending: false })
    .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "total_xp" | "streak_count" | "last_applied_on" | "applications_applied">>>();

  const rows =
    error || !data
      ? (
          await supabase
            .from("profiles")
            .select("id, full_name, school, school_logo_url, xp, streak_count, last_applied_on, applications_applied")
            .in("id", ids)
            .order("xp", { ascending: false })
            .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "streak_count" | "last_applied_on" | "applications_applied">>>()
        ).data
      : data;

  if (!rows) {
    return [];
  }

  return rows.map((profile) => ({
    id: profile.id,
    name: profile.full_name ?? "CareerUp Student",
    school: profile.school ?? "Student",
    schoolLogoUrl: resolveSchoolLogoUrl(profile.school, profile.school_logo_url),
    xp: getLeaderboardXp({ xp: profile.xp, total_xp: getOptionalTotalXp(profile) }),
    streak: getVisibleStreak(profile.last_applied_on ?? null, profile.streak_count ?? 0),
    applicationsApplied: profile.applications_applied ?? 0,
  }));
}

export async function getGroups(): Promise<CareerGroup[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return [];
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("career_group_members")
    .select("id, group_id, user_id")
    .eq("user_id", user.id)
    .returns<DbCareerGroupMember[]>();

  if (membershipsError || !memberships?.length) {
    return [];
  }

  const groupIds = memberships.map((membership) => membership.group_id);
  const [{ data: groups, error: groupsError }, { data: allMembers, error: membersError }] = await Promise.all([
    supabase.from("career_groups").select("id, name, description, owner_id").in("id", groupIds).returns<DbCareerGroup[]>(),
    supabase.from("career_group_members").select("id, group_id, user_id").in("group_id", groupIds).returns<DbCareerGroupMember[]>()
  ]);

  if (groupsError || membersError || !groups || !allMembers) {
    return [];
  }

  const memberIds = Array.from(new Set(allMembers.map((member) => member.user_id)));
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, school, school_logo_url, xp, total_xp, streak_count, last_applied_on, applications_applied")
    .in("id", memberIds)
    .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "total_xp" | "streak_count" | "last_applied_on" | "applications_applied">>>();

  const profileRows =
    profilesError || !profiles
      ? (
          await supabase
            .from("profiles")
            .select("id, full_name, school, school_logo_url, xp, streak_count, last_applied_on, applications_applied")
            .in("id", memberIds)
            .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "streak_count" | "last_applied_on" | "applications_applied">>>()
        ).data
      : profiles;

  if (!profileRows) {
    return [];
  }

  const profilesById = new Map(
    profileRows.map((profile) => [
      profile.id,
      {
        id: profile.id,
        name: profile.full_name ?? "CareerUp Student",
        school: profile.school ?? "Student",
        schoolLogoUrl: resolveSchoolLogoUrl(profile.school, profile.school_logo_url),
        xp: getLeaderboardXp({ xp: profile.xp, total_xp: getOptionalTotalXp(profile) }),
        streak: getVisibleStreak(profile.last_applied_on ?? null, profile.streak_count ?? 0),
        applicationsApplied: profile.applications_applied ?? 0,
      } satisfies LeaderboardUser
    ])
  );

  return groups.map((group) => {
    const members = allMembers
      .filter((member) => member.group_id === group.id)
      .map((member) => profilesById.get(member.user_id))
      .filter((member): member is LeaderboardUser => Boolean(member))
      .sort((a, b) => b.xp - a.xp);
    const totalXp = members.reduce((sum, member) => sum + member.xp, 0);

    return {
      id: group.id,
      name: group.name,
      description: group.description ?? "",
      ownerId: group.owner_id,
      memberCount: members.length,
      totalXp,
      averageXp: members.length ? Math.round(totalXp / members.length) : 0,
      members
    };
  });
}

export async function getGroupLeaderboard(): Promise<GroupLeaderboardRow[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return [];
  }

  const groups = await getGroups();

  return groups
    .map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.memberCount,
      totalXp: group.totalXp,
      averageXp: group.averageXp,
      currentUserMember: group.members.some((member) => member.id === user.id)
    }))
    .sort((a, b) => b.totalXp - a.totalXp);
}

export async function getPublicProfile(profileId: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, school, school_logo_url, major, graduation_year, target_roles, target_locations, xp, total_xp, streak_count, last_applied_on, applications_applied")
    .eq("id", profileId)
    .maybeSingle<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "major" | "graduation_year" | "target_roles" | "target_locations" | "xp" | "total_xp" | "streak_count" | "last_applied_on" | "applications_applied">>();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.full_name ?? "CareerUp Student",
    school: data.school ?? "Student",
    schoolLogoUrl: resolveSchoolLogoUrl(data.school, data.school_logo_url),
    major: data.major ?? "",
    graduationYear: data.graduation_year ?? "",
    targetRoles: data.target_roles ?? [],
    targetLocations: data.target_locations ?? [],
    xp: getLeaderboardXp({ xp: data.xp, total_xp: getOptionalTotalXp(data) }),
    streak: getVisibleStreak(data.last_applied_on ?? null, data.streak_count ?? 0),
    applicationsApplied: data.applications_applied ?? 0
  };
}

export async function getFriendshipWith(profileId: string): Promise<Pick<Friend, "status" | "direction"> | null> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user || user.id === profileId) {
    return null;
  }

  const { data, error } = await supabase
    .from("friends")
    .select("requester_id, status")
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${user.id})`)
    .maybeSingle<Pick<DbFriend, "requester_id" | "status">>();

  if (error || !data) {
    return null;
  }

  return {
    status: data.status,
    direction: data.requester_id === user.id ? "outgoing" : "incoming"
  };
}

export async function getSharedApplicationBoard(profileId: string): Promise<{ applications: Application[]; canView: boolean; shareEnabled: boolean }> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return { applications: [], canView: false, shareEnabled: false };
  }

  const isOwnProfile = user.id === profileId;
  const friendship = isOwnProfile ? null : await getFriendshipWith(profileId);

  if (!isOwnProfile && friendship?.status !== "accepted") {
    return { applications: [], canView: false, shareEnabled: false };
  }

  let shareEnabled = isOwnProfile;

  if (!isOwnProfile) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("share_application_board")
      .eq("id", profileId)
      .maybeSingle<Pick<DbProfile, "share_application_board">>();

    if (profileError || !profile?.share_application_board) {
      return { applications: [], canView: false, shareEnabled: false };
    }

    shareEnabled = true;
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", profileId)
    .order("updated_at", { ascending: false })
    .returns<DbApplication[]>();

  if (error || !data) {
    return { applications: [], canView: false, shareEnabled };
  }

  return { applications: data.map(mapDbApplication), canView: true, shareEnabled };
}

export async function getMutualFriends(profileId: string): Promise<MutualFriend[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user || user.id === profileId) {
    return [];
  }

  const [currentFriendships, profileFriendships] = await Promise.all([
    supabase
      .from("friends")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted")
      .returns<Array<Pick<DbFriend, "requester_id" | "addressee_id" | "status">>>(),
    supabase
      .from("friends")
      .select("requester_id, addressee_id, status")
      .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
      .eq("status", "accepted")
      .returns<Array<Pick<DbFriend, "requester_id" | "addressee_id" | "status">>>()
  ]);

  if (currentFriendships.error || profileFriendships.error || !currentFriendships.data || !profileFriendships.data) {
    return [];
  }

  const currentFriendIds = new Set(currentFriendships.data.map((friendship) => (friendship.requester_id === user.id ? friendship.addressee_id : friendship.requester_id)));
  const profileFriendIds = new Set(profileFriendships.data.map((friendship) => (friendship.requester_id === profileId ? friendship.addressee_id : friendship.requester_id)));
  const mutualIds = Array.from(currentFriendIds).filter((id) => id !== user.id && id !== profileId && profileFriendIds.has(id));

  if (mutualIds.length === 0) {
    return [];
  }

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name, school, school_logo_url, xp, total_xp")
    .in("id", mutualIds)
    .returns<Array<Pick<DbProfile, "id" | "full_name" | "school" | "school_logo_url" | "xp" | "total_xp">>>();

  if (error || !profiles) {
    return [];
  }

  return profiles.map((profile) => ({
    id: profile.id,
    name: profile.full_name ?? "CareerUp Student",
    school: profile.school ?? "Student",
    schoolLogoUrl: resolveSchoolLogoUrl(profile.school, profile.school_logo_url),
    xp: getLeaderboardXp({ xp: profile.xp, total_xp: getOptionalTotalXp(profile) })
  }));
}

export async function getChallenges(): Promise<ChallengesData> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  const emptyData: ChallengesData = { tiered: [], oneOff: [] };

  if (!supabase || !user) {
    return emptyData;
  }

  const [
    { data: completedAny },
    { count: appliedCount },
    { count: interviewCount },
    { count: messageCount },
    { count: groupCount },
    { count: friendCount },
    { data: profileData },
  ] = await Promise.all([
    supabase.from("completed_challenges").select("challenge_id").eq("user_id", user.id),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "applied"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "interviewing"),
    supabase.from("peer_messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id),
    supabase.from("career_group_members").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("friends").select("id", { count: "exact", head: true }).eq("status", "accepted").or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`),
    supabase.from("profiles").select("school, major, graduation_year, target_roles, target_locations, resume_keywords, resume_file_name").eq("id", user.id).single<Pick<DbProfile, "school" | "major" | "graduation_year" | "target_roles" | "target_locations" | "resume_keywords" | "resume_file_name">>(),
  ]);

  const completedIds = new Set((completedAny ?? []).map((c) => c.challenge_id));

  function getRawCount(type: string): number {
    switch (type) {
      case "applied": return appliedCount ?? 0;
      case "interviewing": return interviewCount ?? 0;
      case "messages": return messageCount ?? 0;
      case "groups": return groupCount ?? 0;
      case "friends": return friendCount ?? 0;
      case "resume": return profileData?.resume_file_name ? 1 : 0;
      case "profile": {
        const fields = [profileData?.school, profileData?.major, profileData?.graduation_year, profileData?.target_roles?.length, profileData?.target_locations?.length, profileData?.resume_keywords?.length];
        return fields.filter(Boolean).length;
      }
      default: return 0;
    }
  }

  // Tiered: use live count to determine active tier so it advances as soon as the threshold is crossed
  const tiered: Challenge[] = tieredChallenges.map((def) => {
    const rawCount = getRawCount(def.progressType);
    const lastTier = def.tiers[def.tiers.length - 1];
    const activeTier = def.tiers.find((t) => rawCount < t.target) ?? lastTier;
    const completed = activeTier === lastTier && rawCount >= lastTier.target;
    const progress = Math.min(rawCount, activeTier.target);
    return {
      id: activeTier.id,
      title: def.baseTitle,
      description: activeTier.description,
      xp: activeTier.xp,
      progress,
      target: activeTier.target,
      completed,
      tier: activeTier.tierNum,
      totalTiers: def.tiers.length,
    };
  });

  // One-off
  const oneOff: Challenge[] = oneOffChallenges.map((def) => {
    const rawCount = getRawCount(def.progressType);
    const completed = completedIds.has(def.id) || rawCount >= def.target;
    const progress = Math.min(rawCount, def.target);
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      xp: def.xp,
      progress,
      target: def.target,
      completed,
    };
  });

  return { tiered, oneOff };
}

export async function getRewards(): Promise<Reward[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return rewardCatalog.map((reward) => ({ ...reward, unlocked: false }));
  }

  const { data, error } = await supabase.from("user_rewards").select("reward_id").eq("user_id", user.id).returns<DbUserReward[]>();

  if (error || !data) {
    return rewardCatalog.map((reward) => ({ ...reward, unlocked: false }));
  }

  const unlockedIds = new Set(data.map((reward) => reward.reward_id));

  return rewardCatalog.map((reward) => ({
    ...reward,
    unlocked: unlockedIds.has(reward.id)
  }));
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    const today = new Date().toISOString().slice(0, 10);
    return mockApplications.flatMap((a) => {
      const events: CalendarEvent[] = [
        { id: `mock-sub-${a.id}`, applicationId: a.id, company: a.company, role: a.role, status: a.status, eventType: "submitted", date: today },
      ];
      if (a.deadline && /^\d{4}-\d{2}-\d{2}$/.test(a.deadline)) {
        events.push({ id: `mock-dl-${a.id}`, applicationId: a.id, company: a.company, role: a.role, status: a.status, eventType: "deadline", date: a.deadline });
      }
      return events;
    });
  }

  let { data, error } = await supabase
    .from("calendar_events")
    .select("id, application_id, company, role, status, event_type, date, time, notes")
    .eq("user_id", user.id)
    .order("date", { ascending: true })
    .returns<Array<{ id: string; application_id: string; company: string; role: string; status: string; event_type: string; date: string; time: string | null; notes: string | null }>>();

  // Fallback if time/notes columns don't exist yet in Supabase
  if (error) {
    const fallback = await supabase
      .from("calendar_events")
      .select("id, application_id, company, role, status, event_type, date")
      .eq("user_id", user.id)
      .order("date", { ascending: true })
      .returns<Array<{ id: string; application_id: string; company: string; role: string; status: string; event_type: string; date: string }>>();
    if (fallback.error || !fallback.data) return [];
    data = fallback.data.map((e) => ({ ...e, time: null, notes: null }));
    error = null;
  }

  if (!data) return [];

  return data.map((e) => ({
    id: e.id,
    applicationId: e.application_id,
    company: e.company,
    role: e.role,
    status: e.status as CalendarEvent["status"],
    eventType: e.event_type as CalendarEvent["eventType"],
    date: e.date,
    time: e.time ?? undefined,
    notes: e.notes ?? undefined,
  }));
}

export async function getInterviewAnswers(): Promise<InterviewAnswer[]> {
  const supabase = getSupabaseServerClient();
  const user = await getCurrentUser();

  if (!supabase || !user) {
    return [];
  }

  const { data, error } = await supabase
    .from("interview_answers")
    .select("id, prompt, situation, task, action_taken, result_outcome, notes, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<DbInterviewAnswer[]>();

  if (error || !data) {
    return [];
  }

  return data.map((answer) => ({
    id: answer.id,
    prompt: answer.prompt,
    situation: answer.situation ?? "",
    task: answer.task ?? "",
    action: answer.action_taken ?? "",
    result: answer.result_outcome ?? "",
    notes: answer.notes ?? "",
    createdAt: new Date(answer.created_at).toLocaleDateString()
  }));
}
