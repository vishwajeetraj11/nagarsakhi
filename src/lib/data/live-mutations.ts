import type { SupabaseClient } from "@supabase/supabase-js";

import type { IssueStatus } from "@/lib/domain/types";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export type LiveMutationErrorCode = "NOT_CONFIGURED" | "UNAUTHENTICATED" | "VALIDATION" | "REQUEST_FAILED";

export type LiveMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: LiveMutationErrorCode; message: string; detail?: string } };

type MutationClient = SupabaseClient;

const getClient = (client?: MutationClient): LiveMutationResult<MutationClient> => {
  const resolved = client ?? createBrowserSupabaseClient();
  return resolved
    ? { ok: true, data: resolved }
    : { ok: false, error: { code: "NOT_CONFIGURED", message: "Live NagarSakhi is not configured in this browser." } };
};

async function requireUser(client: MutationClient): Promise<LiveMutationResult<{ id: string }>> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again before making this change.", detail: error?.message } };
  }
  return { ok: true, data: { id: data.user.id } };
}

const requestFailure = (message: string, detail?: string): LiveMutationResult<never> => ({
  ok: false,
  error: { code: "REQUEST_FAILED", message, detail },
});

export async function setIssueVote(issueId: string, value: -1 | 1, client?: MutationClient): Promise<LiveMutationResult> {
  if (!issueId) return { ok: false, error: { code: "VALIDATION", message: "Choose an issue before voting." } };
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { error } = await configured.data.from("issue_votes").upsert(
    { issue_id: issueId, voter_id: user.data.id, value },
    { onConflict: "issue_id,voter_id" },
  );
  return error ? requestFailure("Your support could not be recorded.", error.message) : { ok: true, data: undefined };
}

export async function deleteIssueVote(issueId: string, client?: MutationClient): Promise<LiveMutationResult> {
  if (!issueId) return { ok: false, error: { code: "VALIDATION", message: "Choose an issue before removing a vote." } };
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { error } = await configured.data.from("issue_votes").delete().eq("issue_id", issueId).eq("voter_id", user.data.id);
  return error ? requestFailure("Your vote could not be removed.", error.message) : { ok: true, data: undefined };
}

export type CreateLiveIssueInput = {
  municipalityId: string;
  wardId: string;
  title: string;
  description: string;
  originalLanguage: "en" | "hi";
};

export async function createLiveIssue(input: CreateLiveIssueInput, client?: MutationClient): Promise<LiveMutationResult<{ id: string }>> {
  if (!input.municipalityId || !input.wardId || input.title.trim().length < 4 || input.description.trim().length < 8) {
    return { ok: false, error: { code: "VALIDATION", message: "Add a title and description before submitting the issue." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.from("issues").insert({
    municipality_id: input.municipalityId,
    ward_id: input.wardId,
    reporter_id: user.data.id,
    title: input.title.trim(),
    description: input.description.trim(),
    original_language: input.originalLanguage,
    status: "requested",
  }).select("id").single();
  return error || !data ? requestFailure("Your issue could not be submitted.", error?.message) : { ok: true, data: { id: data.id as string } };
}

export async function transitionLiveIssue(
  issueId: string,
  status: Exclude<IssueStatus, "requested">,
  note?: string,
  client?: MutationClient,
): Promise<LiveMutationResult<IssueStatus>> {
  if (!issueId || (status !== "in_progress" && status !== "completed")) {
    return { ok: false, error: { code: "VALIDATION", message: "Choose a valid next issue status." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.rpc("transition_issue_status", {
    target_issue_id: issueId,
    target_status: status,
    transition_note: note?.trim() || null,
  });
  return error ? requestFailure("The issue status could not be updated.", error.message) : { ok: true, data: data as IssueStatus };
}

export type PublishNoticeInput = { municipalityId: string; wardId?: string | null; body: string };

export async function publishLiveNotice(input: PublishNoticeInput, client?: MutationClient): Promise<LiveMutationResult<{ id: string }>> {
  if (!input.municipalityId || input.body.trim().length < 2) {
    return { ok: false, error: { code: "VALIDATION", message: "Write a notice before publishing it." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.from("notices").insert({
    municipality_id: input.municipalityId,
    ward_id: input.wardId ?? null,
    author_id: user.data.id,
    body: input.body.trim(),
  }).select("id").single();
  return error || !data ? requestFailure("The notice could not be published.", error?.message) : { ok: true, data: { id: data.id as string } };
}

export async function transitionLiveEscalation(
  escalationId: string,
  status: "acknowledged" | "resolved",
  client?: MutationClient,
): Promise<LiveMutationResult<"acknowledged" | "resolved">> {
  if (!escalationId || (status !== "acknowledged" && status !== "resolved")) {
    return { ok: false, error: { code: "VALIDATION", message: "Choose a valid next escalation status." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.rpc("transition_escalation_status", {
    target_escalation_id: escalationId,
    target_status: status,
  });
  return error ? requestFailure("The escalation status could not be updated.", error.message) : { ok: true, data: data as "acknowledged" | "resolved" };
}

export async function setLiveAlertCompletion(alertId: string, completed: boolean, client?: MutationClient): Promise<LiveMutationResult> {
  if (!alertId) return { ok: false, error: { code: "VALIDATION", message: "Choose an alert before updating it." } };
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const query = completed
    ? configured.data.from("alert_completions").upsert({ alert_id: alertId, profile_id: user.data.id }, { onConflict: "alert_id,profile_id" })
    : configured.data.from("alert_completions").delete().eq("alert_id", alertId).eq("profile_id", user.data.id);
  const { error } = await query;
  return error ? requestFailure("The alert completion could not be updated.", error.message) : { ok: true, data: undefined };
}
