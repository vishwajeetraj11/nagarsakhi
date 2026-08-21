import type { SupabaseClient } from "@supabase/supabase-js";

import type { PublicDemoData } from "@/data/demo";
import type {
  Alert,
  DemoSession,
  Escalation,
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
  upvote_count: number;
  downvote_count: number;
  created_at: string;
  updated_at: string;
};
type IssueMediaRow = { id: string; issue_id: string; kind: string; storage_path: string; alt_text: string | null; sort_order: number };
type IssueVoteRow = { issue_id: string; value: number };
type NoticeRow = { id: string; municipality_id: string; ward_id: string | null; author_id: string; body: string; created_at: string };
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

export type LoadLiveDataOptions = {
  /** Signed media URLs are short lived and only generated after RLS has allowed the media row. */
  includeMediaUrls?: boolean;
  firebaseUid?: string;
};

const isRole = (value: string): value is UserRole => (
  value === "citizen" || value === "parshad" || value === "corporation_admin"
);

const isIssueStatus = (value: string): value is IssueStatus => (
  value === "requested" || value === "in_progress" || value === "completed"
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
  supabase: SupabaseClient,
  mediaRows: IssueMediaRow[],
  includeMediaUrls: boolean,
): Promise<Map<string, string>> {
  if (!includeMediaUrls || mediaRows.length === 0) return new Map();

  const paths = mediaRows.map((media) => media.storage_path);
  const { data, error } = await supabase.storage.from("issue-media").createSignedUrls(paths, 10 * 60);

  // A signed URL is a convenience, not a reason to fail an otherwise safe public record.
  if (error || !data) return new Map();

  return new Map(
    data
      .filter((item): item is typeof item & { path: string; signedUrl: string } => Boolean(item.path && item.signedUrl))
      .map((item) => [item.path, item.signedUrl]),
  );
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

  const [
    wardsResult,
    budgetsResult,
    expendituresResult,
    publicProfilesResult,
    visibleProfilesResult,
    officialsResult,
    termsResult,
    issuesResult,
    mediaResult,
    votesResult,
    noticesResult,
    alertsResult,
    alertTargetsResult,
    alertCompletionsResult,
    escalationsResult,
  ] = await Promise.all([
    supabase.from("wards").select("id, municipality_id, ward_number, name").eq("municipality_id", viewer.municipality_id).order("ward_number").limit(LIMITS.wards),
    supabase.from("ward_budgets").select("ward_id, allocated_amount").limit(LIMITS.wards),
    supabase.from("expenditures").select("id, ward_id, amount, description, spent_at").order("spent_at", { ascending: false }).limit(LIMITS.expenditures),
    supabase.from("public_profiles").select("id, name").limit(LIMITS.profiles),
    supabase.from("profiles").select("id, name, role, ward_id").eq("municipality_id", viewer.municipality_id).limit(LIMITS.profiles),
    supabase.from("officials").select("id, municipality_id, name, role_label, department").eq("municipality_id", viewer.municipality_id).limit(LIMITS.officials),
    supabase.from("official_terms").select("id, official_id, ward_id, role_label, won_by_votes, is_current").limit(LIMITS.officialTerms),
    supabase.from("issues").select("id, municipality_id, ward_id, reporter_id, title, description, original_language, status, upvote_count, downvote_count, created_at, updated_at").eq("municipality_id", viewer.municipality_id).order("created_at", { ascending: false }).limit(LIMITS.issues),
    supabase.from("issue_media").select("id, issue_id, kind, storage_path, alt_text, sort_order").order("sort_order").limit(LIMITS.media),
    supabase.from("issue_votes").select("issue_id, value").eq("voter_id", viewer.id).limit(LIMITS.votes),
    supabase.from("notices").select("id, municipality_id, ward_id, author_id, body, created_at").eq("municipality_id", viewer.municipality_id).order("created_at", { ascending: false }).limit(LIMITS.notices),
    supabase.from("alerts").select("id, municipality_id, title, description, due_at, targets_all_wards, created_at").eq("municipality_id", viewer.municipality_id).order("created_at", { ascending: false }).limit(LIMITS.alerts),
    supabase.from("alert_ward_targets").select("alert_id, ward_id").limit(LIMITS.alertTargets),
    supabase.from("alert_completions").select("alert_id").eq("profile_id", viewer.id).limit(LIMITS.alerts),
    supabase.from("escalations").select("id, issue_id, reason, status, created_at").order("created_at", { ascending: false }).limit(LIMITS.escalations),
  ]) as unknown as [
    QueryResult<WardRow[]>, QueryResult<BudgetRow[]>, QueryResult<ExpenditureRow[]>, QueryResult<PublicProfileRow[]>, QueryResult<ProfileRow[]>,
    QueryResult<OfficialRow[]>, QueryResult<OfficialTermRow[]>, QueryResult<IssueRow[]>, QueryResult<IssueMediaRow[]>, QueryResult<IssueVoteRow[]>,
    QueryResult<NoticeRow[]>, QueryResult<AlertRow[]>, QueryResult<AlertTargetRow[]>, QueryResult<AlertCompletionRow[]>, QueryResult<EscalationRow[]>,
  ];

  const failure = queryFailure([
    ["wards", wardsResult], ["budgets", budgetsResult], ["expenditures", expendituresResult], ["public profiles", publicProfilesResult], ["visible profiles", visibleProfilesResult],
    ["officials", officialsResult], ["official terms", termsResult], ["issues", issuesResult], ["issue media", mediaResult], ["votes", votesResult],
    ["notices", noticesResult], ["alerts", alertsResult], ["alert targets", alertTargetsResult], ["alert completions", alertCompletionsResult],
    ["escalations", escalationsResult],
  ]);
  if (failure) return failure;

  const wardRows = rows(wardsResult);
  const issueRows = rows(issuesResult);
  const issueIds = new Set(issueRows.map((issue) => issue.id));
  const visibleMediaRows = rows(mediaResult)
    .filter((media) => issueIds.has(media.issue_id) && (media.kind === "photo" || media.kind === "audio"))
    .slice(0, LIMITS.media);
  const signedMediaUrls = await signVisibleMedia(supabase, visibleMediaRows, options.includeMediaUrls !== false);

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

  const mediaByIssue = new Map<string, IssueMedia[]>();
  for (const media of visibleMediaRows) {
    const url = signedMediaUrls.get(media.storage_path);
    if (!url) continue;
    const mapped: IssueMedia = { id: media.id, kind: media.kind as IssueMedia["kind"], url, alt: media.alt_text ?? undefined };
    mediaByIssue.set(media.issue_id, [...(mediaByIssue.get(media.issue_id) ?? []), mapped]);
  }
  const voteByIssue = new Map(rows(votesResult).map((vote) => [vote.issue_id, vote.value]));
  const escalationRows = rows(escalationsResult).filter((escalation) => issueIds.has(escalation.issue_id));
  const escalatedIssueIds = new Set(escalationRows.map((escalation) => escalation.issue_id));
  const issues: Issue[] = issueRows.map((issue) => ({
    id: issue.id,
    municipalityId: issue.municipality_id,
    wardId: issue.ward_id,
    reporterId: issue.reporter_id,
    reporterName: nameByProfile.get(issue.reporter_id) ?? "Community reporter",
    title: issue.title,
    description: issue.description,
    originalLanguage: issue.original_language === "hi" ? "hi" : "en",
    status: isIssueStatus(issue.status) ? issue.status : "requested",
    upvotes: issue.upvote_count,
    downvotes: issue.downvote_count,
    viewerVote: voteByIssue.get(issue.id) === 1 ? 1 : voteByIssue.get(issue.id) === -1 ? -1 : 0,
    media: mediaByIssue.get(issue.id) ?? [],
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    escalated: escalatedIssueIds.has(issue.id),
  }));

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
