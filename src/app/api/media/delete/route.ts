import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteR2Objects, isR2Configured } from "@/lib/r2/server";
import { AiJobRouteError, getAuthenticatedAiJobContext } from "@/lib/ai/jobs/server";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ issueId: z.string().uuid() });

const errorResponse = (error: unknown) => {
  if (error instanceof AiJobRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid media deletion request." }, { status: 400 });
  return NextResponse.json({ error: "Unable to remove issue media." }, { status: 500 });
};

export async function POST(request: Request) {
  try {
    if (!isR2Configured()) throw new AiJobRouteError("R2 media storage is not configured.", 503);
    const { issueId } = requestSchema.parse(await request.json());
    const context = await getAuthenticatedAiJobContext(request);
    const { data: issue, error: issueError } = await context.userClient
      .from("issues")
      .select("id")
      .eq("id", issueId)
      .eq("reporter_id", context.userId)
      .eq("status", "requested")
      .maybeSingle();
    if (issueError) throw new AiJobRouteError("Unable to verify the issue owner.", 500);
    if (!issue) throw new AiJobRouteError("Only your own unassigned issue can be deleted.", 403);

    const { data: mediaRows, error: mediaError } = await context.userClient
      .from("issue_media")
      .select("storage_path")
      .eq("issue_id", issueId);
    if (mediaError) throw new AiJobRouteError("Unable to load issue media.", 500);
    const deleted = await deleteR2Objects((mediaRows ?? []).map((row) => row.storage_path as string).filter(Boolean));
    if (deleted !== true) throw new AiJobRouteError("Unable to remove issue media from R2.", 502);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
