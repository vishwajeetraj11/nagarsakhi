"use client";

import type { ComponentPropsWithoutRef } from "react";

import { useAiJobStatus } from "./use-ai-job-status";

type AiJobStatusProps = Omit<ComponentPropsWithoutRef<"p">, "children"> & {
  jobId: string | null;
  pollIntervalMs?: number;
};

const statusText = (status: "queued" | "processing" | "completed" | "failed") => {
  switch (status) {
    case "queued":
      return "AI request queued.";
    case "processing":
      return "AI request is being processed.";
    case "completed":
      return "AI request completed.";
    case "failed":
      return "AI request could not be completed.";
  }
};

/** A screen-reader-friendly status line for any enqueue caller. */
export function AiJobStatus({ jobId, pollIntervalMs, ...props }: AiJobStatusProps) {
  const { job, loading, error } = useAiJobStatus(jobId, pollIntervalMs);
  const message = error
    ? error
    : loading
      ? "Loading AI request status."
      : job
        ? `${statusText(job.status)}${job.status === "failed" && job.nextRetryAt ? " It will retry automatically." : ""}`
        : "";

  if (!message) return null;
  return (
    <p {...props} role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
