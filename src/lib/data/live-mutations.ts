import type { SupabaseClient } from "@supabase/supabase-js";

import type { IssueStatus } from "@/lib/domain/types";
import { getFirebaseAuth, getFirebaseAuthorizationHeader } from "@/lib/firebase";
import { createBrowserSupabaseClient, createFirebaseSupabaseClient } from "@/lib/supabase";

export type LiveMutationErrorCode = "NOT_CONFIGURED" | "UNAUTHENTICATED" | "VALIDATION" | "REQUEST_FAILED";

export type LiveMutationResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: LiveMutationErrorCode; message: string; detail?: string } };

type MutationClient = SupabaseClient;

const getClient = (client?: MutationClient): LiveMutationResult<MutationClient> => {
  const firebaseUser = getFirebaseAuth()?.currentUser;
  const resolved = client
    ?? (firebaseUser ? createFirebaseSupabaseClient(() => firebaseUser.getIdToken(false)) : createBrowserSupabaseClient());
  return resolved
    ? { ok: true, data: resolved }
    : { ok: false, error: { code: "NOT_CONFIGURED", message: "Live NagarSakhi is not configured in this browser." } };
};

async function requireUser(client: MutationClient): Promise<LiveMutationResult<{ id: string }>> {
  const { data, error } = await client.rpc("current_profile_id");
  if (error || !data) {
    return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again before making this change.", detail: error?.message } };
  }
  return { ok: true, data: { id: data as string } };
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

/** Uploads up to three photo/video files after the issue row exists. */
export async function uploadLiveIssueMedia(
  issueId: string,
  files: File[],
  client?: MutationClient,
): Promise<LiveMutationResult> {
  if (!issueId || files.length === 0) return { ok: true, data: undefined };
  const supported = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/")).slice(0, 3);
  if (supported.length !== files.length) {
    return { ok: false, error: { code: "VALIDATION", message: "Attach image or video files only." } };
  }

  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  for (const [index, file] of supported.entries()) {
    let presignResponse: Response;
    try {
      presignResponse = await fetch("/api/media/presign", {
        method: "POST",
        headers: { "content-type": "application/json", ...(await getFirebaseAuthorizationHeader()) },
        body: JSON.stringify({ issueId, slot: index + 1, contentType: file.type, fileName: file.name, size: file.size }),
      });
    } catch {
      return requestFailure("The issue was saved, but its media could not be prepared.", "The upload service could not be reached.");
    }
    const presignBody = (await presignResponse.json().catch(() => null)) as { uploadUrl?: string; storagePath?: string; error?: string } | null;
    if (!presignResponse.ok || !presignBody?.uploadUrl || !presignBody.storagePath) {
      return requestFailure("The issue was saved, but its media could not be prepared.", presignBody?.error);
    }

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(presignBody.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
    } catch {
      return requestFailure("The issue was saved, but its media could not be uploaded.", "The browser could not reach media storage.");
    }
    if (!uploadResponse.ok) return requestFailure("The issue was saved, but its media could not be uploaded.", `R2 upload returned ${uploadResponse.status}.`);

    const storagePath = presignBody.storagePath;
    const { error: mediaError } = await configured.data.from("issue_media").insert({
      issue_id: issueId,
      kind: file.type.startsWith("video/") ? "video" : "photo",
      storage_path: storagePath,
      alt_text: file.name,
      sort_order: index,
    });
    if (mediaError) return requestFailure("The issue was saved, but its media record could not be created.", mediaError.message);
  }

  return { ok: true, data: undefined };
}

export async function transitionLiveIssue(
  issueId: string,
  status: Exclude<IssueStatus, "requested" | "rejected">,
  note?: string,
  client?: MutationClient,
): Promise<LiveMutationResult<IssueStatus>> {
  if (!issueId || (status !== "acknowledged" && status !== "in_progress" && status !== "completed")) {
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

export async function rejectLiveIssue(issueId: string, reason: string, client?: MutationClient): Promise<LiveMutationResult<IssueStatus>> {
  const normalizedReason = reason.trim();
  if (!issueId || normalizedReason.length < 8 || normalizedReason.length > 500) {
    return { ok: false, error: { code: "VALIDATION", message: "Add a clear rejection reason between 8 and 500 characters." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.rpc("transition_issue_status", {
    target_issue_id: issueId,
    target_status: "rejected",
    transition_note: normalizedReason,
  });
  return error ? requestFailure("The issue could not be rejected.", error.message) : { ok: true, data: data as IssueStatus };
}

export async function createLiveEscalation(
  issueId: string,
  reason: string,
  client?: MutationClient,
): Promise<LiveMutationResult<{ id: string }>> {
  const normalizedReason = reason.trim();
  if (!issueId || normalizedReason.length < 3 || normalizedReason.length > 1000) {
    return { ok: false, error: { code: "VALIDATION", message: "Add an escalation reason between 3 and 1,000 characters." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.from("escalations").insert({
    issue_id: issueId,
    escalated_by: user.data.id,
    reason: normalizedReason,
    status: "open",
  }).select("id").single();
  return error || !data ? requestFailure("The issue could not be escalated.", error?.message) : { ok: true, data: { id: data.id as string } };
}

export type PublishNoticeInput = { municipalityId: string; wardId?: string | null; title: string; body: string };

export async function publishLiveNotice(input: PublishNoticeInput, client?: MutationClient): Promise<LiveMutationResult<{ id: string }>> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!input.municipalityId || title.length < 3 || title.length > 160 || body.length < 2 || body.length > 3000) {
    return { ok: false, error: { code: "VALIDATION", message: "Add a title and notice description before publishing." } };
  }
  const configured = getClient(client);
  if (!configured.ok) return configured;
  const user = await requireUser(configured.data);
  if (!user.ok) return user;

  const { data, error } = await configured.data.from("notices").insert({
    municipality_id: input.municipalityId,
    ward_id: input.wardId ?? null,
    author_id: user.data.id,
    title,
    body,
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
