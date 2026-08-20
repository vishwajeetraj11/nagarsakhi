import type { AiJobRecord, AiJobResult, AiJobStatus, AiJobType, JsonValue } from "../types";

import { asJsonValue, isAiJobStatus, isAiJobType } from "./contracts";

type DatabaseJob = {
  id: string;
  municipality_id: string;
  created_by: string;
  issue_id: string | null;
  job_type: AiJobType;
  status: AiJobStatus;
  attempt_count: number;
  idempotency_key: string;
  input: JsonValue;
  result: AiJobResult | null;
  provider_request_id: string | null;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

/** Converts database snake_case without exposing fields outside the public job contract. */
export function toAiJobRecord(value: DatabaseJob): AiJobRecord {
  return {
    id: value.id,
    municipalityId: value.municipality_id,
    createdBy: value.created_by,
    issueId: value.issue_id,
    type: value.job_type,
    status: value.status,
    attemptCount: value.attempt_count,
    idempotencyKey: value.idempotency_key,
    input: value.input,
    result: value.result,
    providerRequestId: value.provider_request_id,
    lastError: value.last_error,
    nextRetryAt: value.next_retry_at,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    completedAt: value.completed_at,
  };
}

/** Rejects malformed Realtime payloads before they reach client UI state. */
export function parseAiJobRecord(value: unknown): AiJobRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.municipality_id !== "string" ||
    typeof row.created_by !== "string" ||
    !isAiJobType(row.job_type) ||
    !isAiJobStatus(row.status) ||
    typeof row.attempt_count !== "number" ||
    typeof row.idempotency_key !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return toAiJobRecord({
    id: row.id,
    municipality_id: row.municipality_id,
    created_by: row.created_by,
    issue_id: typeof row.issue_id === "string" ? row.issue_id : null,
    job_type: row.job_type,
    status: row.status,
    attempt_count: row.attempt_count,
    idempotency_key: row.idempotency_key,
    input: asJsonValue(row.input),
    result: (row.result ?? null) as AiJobResult | null,
    provider_request_id: typeof row.provider_request_id === "string" ? row.provider_request_id : null,
    last_error: typeof row.last_error === "string" ? row.last_error : null,
    next_retry_at: typeof row.next_retry_at === "string" ? row.next_retry_at : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
  });
}
