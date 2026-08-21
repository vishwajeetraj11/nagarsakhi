import { NextResponse } from "next/server";
import { z } from "zod";

import {
  parseCreateAiJobRequest,
  toAiJobRecord,
} from "@/lib/ai/jobs";
import { AiJobRouteError, getAuthenticatedAiJobContext } from "@/lib/ai/jobs/server";

export const dynamic = "force-dynamic";

const jobFields =
  "id, municipality_id, created_by, issue_id, job_type, status, attempt_count, idempotency_key, input, result, provider_request_id, last_error, next_retry_at, created_at, updated_at, completed_at";
const jobIdSchema = z.string().uuid();

const errorResponse = (error: unknown) => {
  if (error instanceof AiJobRouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid AI job request.", details: error.flatten() }, { status: 400 });
  }
  return NextResponse.json({ error: "Unable to process AI job request." }, { status: 500 });
};

const safeJobOptions = (request: ReturnType<typeof parseCreateAiJobRequest>) => {
  switch (request.jobType) {
    case "summarization":
      return "maxCharacters" in request.input ? { maxCharacters: request.input.maxCharacters } : {};
    case "translation":
      return "targetLanguage" in request.input ? { targetLanguage: request.input.targetLanguage } : {};
    case "embedding":
      return "dimensions" in request.input ? { dimensions: request.input.dimensions } : {};
    case "transcription":
      return request.input;
  }
};

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 12_000) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }

    const body = await request.json().catch(() => {
      throw new AiJobRouteError("Request body must be valid JSON.", 400);
    });
    const createRequest = parseCreateAiJobRequest(body);
    const context = await getAuthenticatedAiJobContext(request);
    const { data, error } = await context.userClient.rpc("enqueue_ai_job", {
      target_issue_id: createRequest.issueId,
      target_job_type: createRequest.jobType,
      target_idempotency_key: createRequest.idempotencyKey,
      target_options: safeJobOptions(createRequest),
    });
    if (error || !data) {
      const message = error?.message ?? "Unable to enqueue AI job.";
      if (/quota|too many active/i.test(message)) throw new AiJobRouteError("AI processing limit reached. Please try again later.", 429);
      if (/only the issue reporter/i.test(message)) throw new AiJobRouteError("Only the issue reporter can request AI processing.", 403);
      if (/idempotency key/i.test(message)) throw new AiJobRouteError(message, 409);
      throw new AiJobRouteError("Unable to enqueue AI job.", 500);
    }

    return NextResponse.json({ job: toAiJobRecord(data) }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Convenience status endpoint for clients that prefer /api/ai-jobs?jobId=<uuid>. */
export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  const parsed = jobIdSchema.safeParse(jobId);
  if (!parsed.success) return NextResponse.json({ error: "A valid jobId is required." }, { status: 400 });

  try {
    const context = await getAuthenticatedAiJobContext(request);
    const { data, error } = await context.userClient.from("ai_jobs").select(jobFields).eq("id", parsed.data).maybeSingle();
    if (error) throw new AiJobRouteError("Unable to load AI job.", 500);
    if (!data) throw new AiJobRouteError("AI job not found.", 404);
    return NextResponse.json({ job: toAiJobRecord(data) });
  } catch (error) {
    return errorResponse(error);
  }
}
