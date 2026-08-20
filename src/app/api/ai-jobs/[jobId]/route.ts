import { NextResponse } from "next/server";
import { z } from "zod";

import { toAiJobRecord } from "@/lib/ai/jobs";
import { AiJobRouteError, getAuthenticatedAiJobContext } from "@/lib/ai/jobs/server";

export const dynamic = "force-dynamic";

const jobFields =
  "id, municipality_id, created_by, issue_id, job_type, status, attempt_count, idempotency_key, input, result, provider_request_id, last_error, next_retry_at, created_at, updated_at, completed_at";
const jobIdSchema = z.string().uuid();

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const parsed = jobIdSchema.safeParse(jobId);
  if (!parsed.success) return NextResponse.json({ error: "AI job not found." }, { status: 404 });

  try {
    const auth = await getAuthenticatedAiJobContext();
    // No service-role client here: the table's ai_jobs_read_scoped policy is the authorization boundary.
    const { data, error } = await auth.userClient.from("ai_jobs").select(jobFields).eq("id", parsed.data).maybeSingle();
    if (error) throw new AiJobRouteError("Unable to load AI job.", 500);
    if (!data) throw new AiJobRouteError("AI job not found.", 404);
    return NextResponse.json({ job: toAiJobRecord(data) });
  } catch (error) {
    if (error instanceof AiJobRouteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to load AI job." }, { status: 500 });
  }
}
