import { NextResponse } from "next/server";

import { createR2DownloadUrl, isR2Configured } from "@/lib/r2/server";
import { AiJobRouteError, getAuthenticatedAiJobContext } from "@/lib/ai/jobs/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isR2Configured()) throw new AiJobRouteError("R2 media storage is not configured.", 503);
    const path = new URL(request.url).searchParams.get("path")?.trim();
    if (!path || path.length > 300 || path.includes("..")) {
      throw new AiJobRouteError("A valid media path is required.", 400);
    }

    const context = await getAuthenticatedAiJobContext(request);
    const { data: media, error } = await context.userClient
      .from("issue_media")
      .select("storage_path")
      .eq("storage_path", path)
      .maybeSingle();
    if (error) throw new AiJobRouteError("Unable to verify media access.", 500);
    if (!media) throw new AiJobRouteError("Media not found.", 404);

    const signedUrl = await createR2DownloadUrl(path);
    if (!signedUrl) throw new AiJobRouteError("R2 media storage is not configured.", 503);
    return NextResponse.redirect(signedUrl, { status: 307 });
  } catch (error) {
    if (error instanceof AiJobRouteError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Unable to load media." }, { status: 500 });
  }
}
