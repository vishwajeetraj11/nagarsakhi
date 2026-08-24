import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiServices } from "@/lib/ai";
import { AiJobRouteError, getAuthenticatedAiJobContext } from "@/lib/ai/jobs/server";
import { getRuntimeEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const similarityRequest = z.object({
  wardId: z.string().uuid(),
  title: z.string().trim().min(4).max(100),
  description: z.string().trim().min(8).max(5_000),
});

const MATCH_THRESHOLD = 0.82;
const MAX_MATCHES = 3;

type IssueCandidate = {
  id: string;
  title: string;
  description: string;
};

const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator > 0 ? dot / denominator : 0;
};

const reportError = (error: unknown) => {
  if (error instanceof AiJobRouteError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Add a valid title, description, and ward." }, { status: 400 });
  }
  return NextResponse.json({ error: "AI duplicate matching is temporarily unavailable." }, { status: 502 });
};

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 12_000) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }

    const body = similarityRequest.parse(await request.json());
    const env = getRuntimeEnv();
    if (!env.openAiApiKey) {
      throw new AiJobRouteError("OpenAI embeddings are not configured.", 503);
    }

    const context = await getAuthenticatedAiJobContext(request);
    const { data: profile, error: profileError } = await context.userClient
      .from("profiles")
      .select("ward_id, role")
      .eq("id", context.userId)
      .maybeSingle() as { data: { ward_id: string | null; role: string } | null; error: { message: string } | null };
    if (profileError || !profile) {
      throw new AiJobRouteError("Unable to validate the current ward profile.", 500);
    }
    if (profile.role !== "citizen" || profile.ward_id !== body.wardId) {
      throw new AiJobRouteError("Duplicate matching is available for reports in your own ward only.", 403);
    }

    const { data: candidates, error: issuesError } = await context.userClient
      .from("issues")
      .select("id, title, description")
      .eq("municipality_id", context.municipalityId)
      .eq("ward_id", body.wardId)
      .neq("status", "completed")
      .neq("status", "rejected")
      .order("created_at", { ascending: false })
      .limit(100) as { data: IssueCandidate[] | null; error: { message: string } | null };
    if (issuesError) {
      throw new AiJobRouteError("Unable to load existing ward reports.", 500);
    }
    if (!candidates?.length) {
      return NextResponse.json({ matches: [], threshold: MATCH_THRESHOLD });
    }

    const input = [
      `Title: ${body.title}\nDescription: ${body.description}`,
      ...candidates.map((candidate) => `Title: ${candidate.title}\nDescription: ${candidate.description}`),
    ];
    const embeddingResult = await createAiServices({ env }).embeddings.embedMany({
      input,
      dimensions: 1_536,
      signal: request.signal,
    });
    const [queryEmbedding, ...candidateEmbeddings] = embeddingResult.embeddings;
    const matches = candidates
      .map((candidate, index) => ({
        id: candidate.id,
        title: candidate.title,
        similarity: cosineSimilarity(queryEmbedding, candidateEmbeddings[index] ?? []),
      }))
      .filter((match) => match.similarity >= MATCH_THRESHOLD)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, MAX_MATCHES)
      .map((match) => ({ ...match, similarity: Number(match.similarity.toFixed(3)) }));

    return NextResponse.json({ matches, model: embeddingResult.model, threshold: MATCH_THRESHOLD });
  } catch (error) {
    return reportError(error);
  }
}
