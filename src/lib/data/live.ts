import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicDemoData } from "@/data/demo";
import type {
  Alert,
  DemoSession,
  Escalation,
  EscalationStatus,
  Expenditure,
  Issue,
  IssueMedia,
  IssueStatus,
  Municipality,
  Notice,
  Official,
  PublicProfile,
  UserRole,
  Ward,
} from "@/lib/domain/types";

const LIMITS = {
  alerts: 100,
  alertTargets: 300,
  expenditures: 500,
  issues: 100,
  media: 300,
  notices: 100,
  officials: 100,
  officialTerms: 300,
  profiles: 1_000,
  votes: 100,
  wards: 100,
  escalations: 100,
} as const;

type QueryError = { message: string; code?: string | null };
type QueryResult<T> = { data: T | null; error: QueryError | null };

type ProfileRow = {
  id: string;
  firebase_uid?: string | null;
  municipality_id: string;
  ward_id: string | null;
  name: string;
  role: string;
  onboarding_completed?: boolean;
};
type MunicipalityRow = { id: string; name: string; district: string; state: string };
type WardRow = { id: string; municipality_id: string; ward_number: number; name: string };
type BudgetRow = { ward_id: string; allocated_amount: number | string };
type ExpenditureRow = { id: string; ward_id: string; amount: number | string; description: string; spent_at: string };
type PublicProfileRow = { id: string; name: string };
type OfficialRow = { id: string; municipality_id: string; name: string; role_label: string; department: string | null };
type OfficialTermRow = {
  id: string;
  official_id: string;
  ward_id: string | null;
  role_label: string;
  won_by_votes: number | null;
  is_current: boolean;
};
type IssueRow = {
  id: string;
  municipality_id: string;
  ward_id: string;
  reporter_id: string;
  title: string;
  description: string;
  original_language: string;
  status: string;
  rejection_reason: string | null;
  upvote_count: number;
  downvote_count: number;
  created_at: string;
  updated_at: string;
};
type IssueStatusEventRow = {
  issue_id: string;
  to_status: string;
  changed_by: string;
  created_at: string;
};
type IssueMediaRow = { id: string; issue_id: string; kind: string; storage_path: string; alt_text: string | null; sort_order: number };
type IssueVoteRow = { issue_id: string; value: number };
type NoticeRow = { id: string; municipality_id: string; ward_id: string | null; author_id: string; title: string; body: string; created_at: string };
type AlertRow = {
  id: string;
  municipality_id: string;
  title: string;
  description: string;
  due_at: string | null;
  targets_all_wards: boolean;
  created_at: string;
};
type AlertTargetRow = { alert_id: string; ward_id: string };
type AlertCompletionRow = { alert_id: string };
type EscalationRow = { id: string; issue_id: string; reason: string; status: string; created_at: string };

export type LiveDataErrorCode = "UNAUTHENTICATED" | "PROFILE_NOT_FOUND" | "INVALID_PROFILE" | "QUERY_FAILED";

export type LiveDataFailure = {
  ok: false;
  error: { code: LiveDataErrorCode; message: string; detail?: string };
};

export type LiveDataSuccess = {
  ok: true;
  data: PublicDemoData;
  session: DemoSession;
  needsOnboarding: boolean;
};

export type LiveDataResult = LiveDataSuccess | LiveDataFailure;

export type WardIssuesResult =
  | { ok: true; data: Issue[] }
  | LiveDataFailure;

export type LoadLiveDataOptions = {
  /** Signed media URLs are short lived and only generated after RLS has allowed the media row. */
  includeMediaUrls?: boolean;
  firebaseUid?: string;
};

const isRole = (value: string): value is UserRole => (
  value === "citizen" || value === "parshad" || value === "corporation_admin"
);

const isIssueStatus = (value: string): value is IssueStatus => (
  value === "requested" || value === "in_progress" || value === "completed" || value === "rejected"
);

const isEscalationStatus = (value: string): value is EscalationStatus => (
  value === "open" || value === "acknowledged" || value === "resolved"
);

const asNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const rows = <T>(result: QueryResult<T[]>): T[] => result.data ?? [];

function queryFailure(queries: Array<[string, QueryResult<unknown>]>) {
  const failed = queries.find(([, result]) => result.error);
  if (!failed) return null;

  return {
    ok: false as const,
    error: {
      code: "QUERY_FAILED" as const,
      message: `Unable to load ${failed[0]}. Please refresh and try again.`,
      detail: failed[1].error?.message,
    },
  };
}

async function signVisibleMedia(
  mediaRows: IssueMediaRow[],
  includeMediaUrls: boolean,
): Promise<Map<string, string>> {
  // R2 signs media through /api/media/file. Keep this map empty so the client
  // never falls back to Supabase Storage for issue evidence.
  if (!includeMediaUrls || mediaRows.length === 0) return new Map();
  return new Map();
}

function mapIssueRows(
  issueRows: IssueRow[],
  mediaRows: IssueMediaRow[],
  voteRows: IssueVoteRow[],
  escalationRows: EscalationRow[],
  statusEventRows: IssueStatusEventRow[],
  nameByProfile: Map<string, string>,
  mediaUrlByPath: Map<string, string> = new Map(),
): Issue[] {
  const mediaByIssue = new Map<string, IssueMedia[]>();
  for (const media of mediaRows) {
    const url = mediaUrlByPath.get(media.storage_path) ?? `/api/media/file?path=${encodeURIComponent(media.storage_path)}`;
    const mapped: IssueMedia = { id: media.id, kind: media.kind as IssueMedia["kind"], url, alt: media.alt_text ?? undefined };
    mediaByIssue.set(media.issue_id, [...(mediaByIssue.get(media.issue_id) ?? []), mapped]);
  }

  const voteByIssue = new Map(voteRows.map((vote) => [vote.issue_id, vote.value]));
  const escalationByIssue = new Map(escalationRows.map((escalation) => [escalation.issue_id, escalation]));
  const rejectionByIssue = new Map(
    statusEventRows
      .filter((event) => event.to_status === "rejected")
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((event) => [event.issue_id, event]),
  );

  return issueRows.map((issue) => {
    const rejection = rejectionByIssue.get(issue.id);
    const escalation = escalationByIssue.get(issue.id);
    const escalationStatus = escalation && isEscalationStatus(escalation.status) ? escalation.status : undefined;
    return {
      id: issue.id,
      municipalityId: issue.municipality_id,
      wardId: issue.ward_id,
      reporterId: issue.reporter_id,
      reporterName: nameByProfile.get(issue.reporter_id) ?? "Community reporter",
      title: issue.title,
      description: issue.description,
      originalLanguage: issue.original_language === "hi" ? "hi" : "en",
      status: isIssueStatus(issue.status) ? issue.status : "requested",
      rejectionReason: issue.rejection_reason ?? undefined,
      rejectionActorName: rejection ? nameByProfile.get(rejection.changed_by) ?? "Ward representative" : undefined,
      rejectionAt: rejection?.created_at,
      upvotes: issue.upvote_count,
      downvotes: issue.downvote_count,
      viewerVote: voteByIssue.get(issue.id) === 1 ? 1 : voteByIssue.get(issue.id) === -1 ? -1 : 0,
      media: mediaByIssue.get(issue.id) ?? [],
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      escalated: Boolean(escalation),
      escalationStatus,
    };
  });
}

export async function loadWardIssues(
  supabase: SupabaseClient,
  input: { municipalityId: string; wardId: string; viewerId: string },
): Promise<WardIssuesResult> {
  const issuesResult = await supabase
    .from("issues")
    .select("id, municipality_id, ward_id, reporter_id, title, description, original_language, status, rejection_reason, upvote_count, downvote_count, created_at, updated_at")
    .eq("municipality_id", input.municipalityId)
    .eq("ward_id", input.wardId)
    .order("created_at", { ascending: false })
    .limit(LIMITS.issues) as unknown as QueryResult<IssueRow[]>;

  if (issuesResult.error) {
    return { ok: false, error: { code: "QUERY_FAILED", message: "Unable to load this ward's issues.", detail: issuesResult.error.message } };
  }

  const issueRows = rows(issuesResult);
  if (issueRows.length === 0) return { ok: true, data: [] };

  const issueIds = issueRows.map((issue) => issue.id);
  const reporterIds = [...new Set(issueRows.map((issue) => issue.reporter_id))];
  const [mediaResult, votesResult, escalationsResult, statusEventsResult] = await Promise.all([
    supabase.from("issue_media").select("id, issue_id, kind, storage_path, alt_text, sort_order").in("issue_id", issueIds).order("sort_order").limit(LIMITS.media),
    supabase.from("issue_votes").select("issue_id, value").eq("voter_id", input.viewerId).in("issue_id", issueIds).limit(LIMITS.votes),
    supabase.from("escalations").select("id, issue_id, reason, status, created_at").in("issue_id", issueIds).order("created_at", { ascending: false }).limit(LIMITS.escalations),
    supabase.from("issue_status_events").select("issue_id, to_status, changed_by, created_at").in("issue_id", issueIds).eq("to_status", "rejected").order("created_at", { ascending: false }).limit(LIMITS.issues),
  ]) as unknown as [
    QueryResult<IssueMediaRow[]>, QueryResult<IssueVoteRow[]>, QueryResult<EscalationRow[]>, QueryResult<IssueStatusEventRow[]>,
  ];

  const actorIds = rows(statusEventsResult).map((event) => event.changed_by);
  const profilesResult = await supabase
    .from("public_profiles")
    .select("id, name")
    .in("id", [...new Set([...reporterIds, ...actorIds])])
    .limit(LIMITS.profiles) as unknown as QueryResult<PublicProfileRow[]>;

  const failure = queryFailure([
    ["issue media", mediaResult], ["votes", votesResult], ["escalations", escalationsResult], ["issue history", statusEventsResult], ["reporters", profilesResult],
  ]);
  if (failure) return failure;

  const visibleMediaRows = rows(mediaResult)
    .filter((media) => media.kind === "photo" || media.kind === "video" || media.kind === "audio")
    .slice(0, LIMITS.media);
  const nameByProfile = new Map(rows(profilesResult).map((profile) => [profile.id, profile.name]));
  const signedMediaUrls = await signVisibleMedia(visibleMediaRows, true);

  return {
    ok: true,
    data: mapIssueRows(issueRows, visibleMediaRows, rows(votesResult), rows(escalationsResult), rows(statusEventsResult), nameByProfile, signedMediaUrls),
  };
}

/**
 * Loads the live municipality view through the caller's authenticated, request-scoped
 * client. Every database call is made with that user's JWT, so the migration's RLS
 * policies remain the authorization boundary. This module only selects public tables
 * and the public_profiles view; it intentionally has no path to citizen contact data.
 */
export async function loadLiveData(
  supabase: SupabaseClient,
  options: LoadLiveDataOptions = {},
): Promise<LiveDataResult> {
  const firebaseUid = options.firebaseUid?.trim();
  let profileQuery = supabase
    .from("profiles")
    .select("id, firebase_uid, municipality_id, ward_id, name, role, onboarding_completed");

  if (firebaseUid) {
    profileQuery = profileQuery.eq("firebase_uid", firebaseUid);
  } else {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return {
        ok: false,
        error: { code: "UNAUTHENTICATED", message: "Please sign in to view your municipality.", detail: authError?.message },
      };
    }
    profileQuery = profileQuery.eq("id", authData.user.id);
  }

  const profileResult = await profileQuery.maybeSingle() as unknown as QueryResult<ProfileRow>;

  if (profileResult.error) {
    return {
      ok: false,
      error: { code: "QUERY_FAILED", message: "Unable to load your account profile.", detail: profileResult.error.message },
    };
  }
  if (!profileResult.data) {
    return { ok: false, error: { code: "PROFILE_NOT_FOUND", message: "This account does not have a NagarSakhi profile yet." } };
  }
  if (!isRole(profileResult.data.role)) {
    return { ok: false, error: { code: "INVALID_PROFILE", message: "This account has an unsupported NagarSakhi role." } };
  }

  const viewer = profileResult.data;
  const municipalityResult = await supabase
    .from("municipalities")
    .select("id, name, district, state")
    .eq("id", viewer.municipality_id)
    .maybeSingle() as unknown as QueryResult<MunicipalityRow>;

  if (municipalityResult.error || !municipalityResult.data) {
    return {
      ok: false,
      error: {
        code: "QUERY_FAILED",
        message: "Unable to load your municipality.",
        detail: municipalityResult.error?.message,
      },
    };
  }

  let issuesQuery = supabase
    .from("issues")
    .select("id, municipality_id, ward_id, reporter_id, title, description, original_language, status, rejection_reason, upvote_count, downvote_count, created_at, updated_at")
    .eq("municipality_id", viewer.municipality_id);

  if (viewer.role !== "corporation_admin") {
    issuesQuery = viewer.ward_id
      ? issuesQuery.eq("ward_id", viewer.ward_id)
      : issuesQuery.is("ward_id", null);
  }

  const [
    wardsResult,
    budgetsResult,
    expendituresResult,
    publicProfilesResult,
    visibleProfilesResult,
    officialsResult,
    termsResult,
    issuesResult,
    noticesResult,
    alertsResult,
    alertTargetsResult,
    alertCompletionsResult,
  ] = await Promise.all([
    supabase.from("wards").select("id, municipality_id, ward_number, name").eq("municipality_id", viewer.municipality_id).order("ward_number").limit(LIMITS.wards),
    supabase.from("ward_budgets").select("ward_id, allocated_amount").limit(LIMITS.wards),
    supabase.from("expenditures").select("id, ward_id, amount, description, spent_at").order("spent_at", { ascending: false }).limit(LIMITS.expenditures),
    supabase.from("public_profiles").select("id, name").limit(LIMITS.profiles),
    supabase.from("profiles").select("id, name, role, ward_id").eq("municipality_id", viewer.municipality_id).limit(LIMITS.profiles),
    supabase.from("officials").select("id, municipality_id, name, role_label, department").eq("municipality_id", viewer.municipality_id).limit(LIMITS.officials),
    supabase.from("official_terms").select("id, official_id, ward_id, role_label, won_by_votes, is_current").limit(LIMITS.officialTerms),
    issuesQuery.order("created_at", { ascending: false }).limit(LIMITS.issues),
    supabase.from("notices").select("id, municipality_id, ward_id, author_id, title, body, created_at").eq("municipality_id", viewer.municipality_id).order("created_at", { ascending: false }).limit(LIMITS.notices),
    supabase.from("alerts").select("id, municipality_id, title, description, due_at, targets_all_wards, created_at").eq("municipality_id", viewer.municipality_id).order("created_at", { ascending: false }).limit(LIMITS.alerts),
    supabase.from("alert_ward_targets").select("alert_id, ward_id").limit(LIMITS.alertTargets),
    supabase.from("alert_completions").select("alert_id").eq("profile_id", viewer.id).limit(LIMITS.alerts),
  ]) as unknown as [
    QueryResult<WardRow[]>, QueryResult<BudgetRow[]>, QueryResult<ExpenditureRow[]>, QueryResult<PublicProfileRow[]>, QueryResult<ProfileRow[]>,
    QueryResult<OfficialRow[]>, QueryResult<OfficialTermRow[]>, QueryResult<IssueRow[]>, QueryResult<NoticeRow[]>, QueryResult<AlertRow[]>,
    QueryResult<AlertTargetRow[]>, QueryResult<AlertCompletionRow[]>,
  ];

  const failure = queryFailure([
    ["wards", wardsResult], ["budgets", budgetsResult], ["expenditures", expendituresResult], ["public profiles", publicProfilesResult], ["visible profiles", visibleProfilesResult],
    ["officials", officialsResult], ["official terms", termsResult], ["issues", issuesResult], ["notices", noticesResult], ["alerts", alertsResult],
    ["alert targets", alertTargetsResult], ["alert completions", alertCompletionsResult],
  ]);
  if (failure) return failure;

  const wardRows = rows(wardsResult);
  const issueRows = rows(issuesResult);
  const issueIds = new Set(issueRows.map((issue) => issue.id));
  const issueIdList = [...issueIds];
  const emptyRows = { data: [], error: null };
  const [mediaResult, votesResult, escalationsResult, statusEventsResult] = issueIdList.length > 0
    ? await Promise.all([
      supabase.from("issue_media").select("id, issue_id, kind, storage_path, alt_text, sort_order").in("issue_id", issueIdList).order("sort_order").limit(LIMITS.media),
      supabase.from("issue_votes").select("issue_id, value").eq("voter_id", viewer.id).in("issue_id", issueIdList).limit(LIMITS.votes),
      supabase.from("escalations").select("id, issue_id, reason, status, created_at").in("issue_id", issueIdList).order("created_at", { ascending: false }).limit(LIMITS.escalations),
      supabase.from("issue_status_events").select("issue_id, to_status, changed_by, created_at").in("issue_id", issueIdList).eq("to_status", "rejected").order("created_at", { ascending: false }).limit(LIMITS.issues),
    ]) as unknown as [QueryResult<IssueMediaRow[]>, QueryResult<IssueVoteRow[]>, QueryResult<EscalationRow[]>, QueryResult<IssueStatusEventRow[]>]
    : [emptyRows, emptyRows, emptyRows, emptyRows] as [QueryResult<IssueMediaRow[]>, QueryResult<IssueVoteRow[]>, QueryResult<EscalationRow[]>, QueryResult<IssueStatusEventRow[]>];

  const issueDetailFailure = queryFailure([
    ["issue media", mediaResult], ["votes", votesResult], ["escalations", escalationsResult], ["issue history", statusEventsResult],
  ]);
  if (issueDetailFailure) return issueDetailFailure;

  const visibleMediaRows = rows(mediaResult)
    .filter((media) => issueIds.has(media.issue_id) && (media.kind === "photo" || media.kind === "video" || media.kind === "audio"))
    .slice(0, LIMITS.media);
  const signedMediaUrls = await signVisibleMedia(visibleMediaRows, options.includeMediaUrls !== false);

  const municipality: Municipality = { ...municipalityResult.data, wardCount: wardRows.length };
  const session: DemoSession = {
    profileId: viewer.id,
    name: viewer.name,
    role: viewer.role as UserRole,
    wardId: viewer.ward_id,
    municipalityId: viewer.municipality_id,
  };

  const expenditures: Expenditure[] = rows(expendituresResult).map((expense) => ({
    id: expense.id,
    wardId: expense.ward_id,
    amount: asNumber(expense.amount),
    description: expense.description,
    spentAt: expense.spent_at,
  }));
  const budgetByWard = new Map(rows(budgetsResult).map((budget) => [budget.ward_id, asNumber(budget.allocated_amount)]));
  const spentByWard = new Map<string, number>();
  for (const expenditure of expenditures) {
    spentByWard.set(expenditure.wardId, (spentByWard.get(expenditure.wardId) ?? 0) + expenditure.amount);
  }
  const wards: Ward[] = wardRows.map((ward) => ({
    id: ward.id,
    municipalityId: ward.municipality_id,
    number: ward.ward_number,
    name: ward.name,
    allocatedBudget: budgetByWard.get(ward.id) ?? 0,
    spentBudget: spentByWard.get(ward.id) ?? 0,
  }));
  const wardById = new Map(wards.map((ward) => [ward.id, ward]));

  const reporterWardByProfile = new Map(issueRows.map((issue) => [issue.reporter_id, issue.ward_id]));
  const visibleProfileById = new Map(rows(visibleProfilesResult).map((profile) => [profile.id, profile]));
  const nameByProfile = new Map(rows(publicProfilesResult).map((profile) => [profile.id, profile.name]));
  nameByProfile.set(viewer.id, viewer.name);
  const publicProfiles: PublicProfile[] = rows(publicProfilesResult).map((profile) => {
    const visibleProfile = visibleProfileById.get(profile.id);
    return {
      id: profile.id,
      name: profile.name,
      role: visibleProfile && isRole(visibleProfile.role) ? visibleProfile.role : "citizen",
      wardId: visibleProfile?.ward_id ?? reporterWardByProfile.get(profile.id) ?? null,
    };
  });
  if (!publicProfiles.some((profile) => profile.id === viewer.id)) {
    publicProfiles.push({ id: viewer.id, name: viewer.name, role: viewer.role as UserRole, wardId: viewer.ward_id });
  }

  const escalationRows = rows(escalationsResult).filter((escalation) => issueIds.has(escalation.issue_id));
  const issues = mapIssueRows(issueRows, visibleMediaRows, rows(votesResult), escalationRows, rows(statusEventsResult), nameByProfile, signedMediaUrls);

  const officialById = new Map(rows(officialsResult).map((official) => [official.id, official]));
  const officials: Official[] = rows(termsResult)
    .filter((term) => officialById.has(term.official_id))
    .map((term) => {
      const official = officialById.get(term.official_id)!;
      return {
        id: term.id,
        municipalityId: official.municipality_id,
        wardId: term.ward_id,
        name: official.name,
        roleLabel: term.role_label,
        department: official.department ?? undefined,
        wonByVotes: term.won_by_votes ?? undefined,
        current: term.is_current,
      };
    });
  for (const official of rows(officialsResult)) {
    if (!officials.some((candidate) => candidate.name === official.name)) {
      officials.push({ id: official.id, municipalityId: official.municipality_id, wardId: null, name: official.name, roleLabel: official.role_label, department: official.department ?? undefined, current: true });
    }
  }

  const notices: Notice[] = rows(noticesResult).map((notice) => ({
    id: notice.id,
    municipalityId: notice.municipality_id,
    wardId: notice.ward_id,
    authorName: nameByProfile.get(notice.author_id) ?? "Municipal office",
    title: notice.title,
    body: notice.body,
    createdAt: notice.created_at,
  }));
  const visibleAlertIds = new Set(rows(alertsResult).map((alert) => alert.id));
  const targetWardsByAlert = new Map<string, string[]>();
  for (const target of rows(alertTargetsResult)) {
    if (visibleAlertIds.has(target.alert_id) && wardById.has(target.ward_id)) {
      targetWardsByAlert.set(target.alert_id, [...(targetWardsByAlert.get(target.alert_id) ?? []), target.ward_id]);
    }
  }
  const completedAlertIds = new Set(rows(alertCompletionsResult).map((completion) => completion.alert_id));
  const alerts: Alert[] = rows(alertsResult).map((alert) => ({
    id: alert.id,
    title: alert.title,
    description: alert.description,
    dueAt: alert.due_at ?? alert.created_at,
    wardIds: alert.targets_all_wards ? wards.map((ward) => ward.id) : targetWardsByAlert.get(alert.id) ?? [],
    completed: completedAlertIds.has(alert.id),
  }));

  const issueById = new Map(issues.map((issue) => [issue.id, issue]));
  const currentParshadByWard = new Map(
    officials.filter((official) => official.current && official.wardId).map((official) => [official.wardId!, official.name]),
  );
  const escalations: Escalation[] = escalationRows.flatMap((escalation) => {
    const issue = issueById.get(escalation.issue_id);
    const ward = issue ? wardById.get(issue.wardId) : undefined;
    if (!issue || !ward || (escalation.status !== "open" && escalation.status !== "acknowledged" && escalation.status !== "resolved")) return [];
    return [{
      id: escalation.id,
      issueId: issue.id,
      issueTitle: issue.title,
      wardId: ward.id,
      wardNumber: ward.number,
      parshadName: currentParshadByWard.get(ward.id) ?? "Ward representative",
      reason: escalation.reason,
      status: escalation.status,
      createdAt: escalation.created_at,
    }];
  });

  return {
    ok: true,
    data: { municipality, wards, publicProfiles, officials, issues, notices, alerts, expenditures, escalations },
    session,
    needsOnboarding: profileResult.data.onboarding_completed === false,
  };
}
