import type { AiJobRecord, AiJobStatus, AiJobType, JsonValue } from "../types";

export const AI_JOB_TYPES = ["transcription", "translation", "summarization", "embedding"] as const;
export const AI_JOB_STATUSES = ["queued", "processing", "completed", "failed"] as const;
export const MAX_AI_JOB_ATTEMPTS = 10;

export type AiJobInput =
  | { audioPath: string; filename?: string; language?: string }
  | { text: string; sourceLanguage: string; targetLanguage: string }
  | { text: string; language?: string; maxCharacters?: number }
  | { input: string; dimensions?: number };

export type CreateAiJobRequest = {
  jobType: AiJobType;
  issueId: string;
  idempotencyKey: string;
  input: AiJobInput;
};

export type AiJobResponse = {
  job: AiJobRecord;
};

export const isAiJobStatus = (value: unknown): value is AiJobStatus =>
  typeof value === "string" && (AI_JOB_STATUSES as readonly string[]).includes(value);

export const isAiJobType = (value: unknown): value is AiJobType =>
  typeof value === "string" && (AI_JOB_TYPES as readonly string[]).includes(value);

export const asJsonValue = (value: unknown): JsonValue => value as JsonValue;
