"use client";

import { useCallback, useEffect, useState } from "react";

import { parseAiJobRecord } from "@/lib/ai/jobs/record";
import type { AiJobRecord } from "@/lib/ai/types";
import { createBrowserSupabaseClient } from "@/lib/supabase";

export type AiJobStatusState = {
  job: AiJobRecord | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Observes one durable job. Realtime makes status changes immediate; periodic
 * scoped API reads keep the UI correct if a websocket cannot stay connected.
 */
export function useAiJobStatus(jobId: string | null, pollIntervalMs = 10_000): AiJobStatusState {
  const [job, setJob] = useState<AiJobRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(jobId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) return;
    const response = await fetch(`/api/ai-jobs/${encodeURIComponent(jobId)}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const body = (await response.json().catch(() => null)) as { job?: unknown; error?: string } | null;
    const parsed = parseAiJobRecord(body?.job);
    if (!response.ok || !parsed) {
      throw new Error(body?.error ?? "Unable to load AI job status.");
    }
    setJob(parsed);
    setError(null);
  }, [jobId]);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        await refresh();
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load AI job status.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      ?.channel(`ai-job:${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const next = parseAiJobRecord(payload.new);
          if (next) {
            setJob(next);
            setLoading(false);
            setError(null);
          }
        },
      )
      .subscribe();

    const poll = async () => {
      await load();
      if (!cancelled) {
        timeout = setTimeout(poll, pollIntervalMs);
      }
    };
    timeout = setTimeout(poll, pollIntervalMs);

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (channel) void channel.unsubscribe();
    };
  }, [jobId, pollIntervalMs, refresh]);

  const currentJob = job?.id === jobId ? job : null;
  return { job: currentJob, loading: Boolean(jobId) && (loading || !currentJob), error: jobId ? error : null, refresh };
}
