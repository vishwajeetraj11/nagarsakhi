import { NextResponse } from "next/server";
import { z } from "zod";

import { createR2UploadUrl, isR2Configured } from "@/lib/r2/server";
import { AiJobRouteError, getAuthenticatedAiJobContext } from "@/lib/ai/jobs/server";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  issueId: z.string().uuid(),
  slot: z.number().int().min(1).max(3),
  contentType: z.string().regex(/^(image|video)\/[a-z0-9.+-]+$/i),
  fileName: z.string().trim().min(1).max(160),
  size: z.number().int().positive().max(25 * 1024 * 1024),
});

const errorResponse = (error: unknown) => {
  if (error instanceof AiJobRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid media upload request." }, { status: 400 });
  return NextResponse.json({ error: "Unable to prepare media upload." }, { status: 500 });
};

export async function POST(request: Request) {
  try {
    if (!isR2Configured()) throw new AiJobRouteError("R2 media storage is not configured.", 503);
    const body = requestSchema.parse(await request.json());
    const context = await getAuthenticatedAiJobContext(request);
    const { data: issue, error } = await context.userClient
      .from("issues")
      .select("id, reporter_id")
      .eq("id", body.issueId)
      .eq("reporter_id", context.userId)
      .maybeSingle();

    if (error) throw new AiJobRouteError("Unable to verify the issue owner.", 500);
    if (!issue) throw new AiJobRouteError("Only the issue reporter can upload evidence.", 403);

    const storagePath = `${context.userId}/${body.issueId}/photo-${body.slot}`;
    const uploadUrl = await createR2UploadUrl({ key: storagePath, contentType: body.contentType });
    if (!uploadUrl) throw new AiJobRouteError("R2 media storage is not configured.", 503);

    return NextResponse.json({ uploadUrl, storagePath }, { status: 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
