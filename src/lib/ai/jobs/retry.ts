import { MAX_AI_JOB_ATTEMPTS } from "./contracts";

export const RETRY_BASE_DELAY_MS = 5_000;
export const RETRY_MAX_DELAY_MS = 15 * 60 * 1_000;

/** Exponential backoff with a deterministic cap; attempt one waits five seconds. */
export function retryDelayMs(attemptCount: number): number {
  const exponent = Math.max(0, Math.min(MAX_AI_JOB_ATTEMPTS - 1, attemptCount - 1));
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** exponent);
}

export function nextRetryAt(attemptCount: number, now = new Date()): string | null {
  if (attemptCount >= MAX_AI_JOB_ATTEMPTS) return null;
  return new Date(now.getTime() + retryDelayMs(attemptCount)).toISOString();
}

export function shouldRetry(error: { retryable?: boolean }, attemptCount: number): boolean {
  return Boolean(error.retryable) && attemptCount < MAX_AI_JOB_ATTEMPTS;
}
