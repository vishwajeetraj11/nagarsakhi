/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Supabase Edge Function (Deno): deploy independently from the Next.js app.
import { createClient } from "npm:@supabase/supabase-js@2";

const JOB_FIELDS =
  "id, municipality_id, created_by, issue_id, job_type, status, attempt_count, idempotency_key, input";
const MAX_ATTEMPTS = 10;
const TIMEOUT_MS = 30_000;
const MAX_BATCH_SIZE = 3;

class WorkerError extends Error {
  constructor(message: string, retryable = false) {
    super(message);
    this.name = "WorkerError";
    this.retryable = retryable;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const asString = (value: unknown, max = 5_000) => (typeof value === "string" && value.length <= max ? value : null);
const providerRequestId = (response: Response) =>
  response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? null;

const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : "AI job failed";
  return message.replace(/\s+/g, " ").trim().slice(0, 1_000) || "AI job failed";
};

const retryAt = (attempt: number) => {
  if (attempt >= MAX_ATTEMPTS) return null;
  const delay = Math.min(15 * 60 * 1_000, 5_000 * 2 ** Math.max(0, attempt - 1));
  return new Date(Date.now() + delay).toISOString();
};

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new WorkerError(
        `Provider returned ${response.status}`,
        response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    if (controller.signal.aborted) throw new WorkerError(`Provider timed out after ${TIMEOUT_MS}ms`, true);
    throw new WorkerError(error instanceof Error ? `Provider request failed: ${error.message}` : "Provider request failed", true);
  } finally {
    clearTimeout(timer);
  }
}

async function responseText(apiKey: string, text: string, instruction: string) {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.6-luna",
      reasoning: { effort: "none" },
      instructions: instruction,
      input: text,
    }),
  });
  const body = await response.json().catch(() => null);
  const direct = isRecord(body) ? asString(body.output_text) : null;
  const nested = isRecord(body) && Array.isArray(body.output)
    ? body.output.flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .find((item) => isRecord(item) && item.type === "output_text" && typeof item.text === "string")
    : null;
  const output = direct ?? (isRecord(nested) ? asString(nested.text) : null);
  if (!output?.trim()) throw new WorkerError("OpenAI response did not include text");
  return { text: output.trim(), requestId: providerRequestId(response) };
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

function demoEmbedding(input: string, dimensions: number) {
  const vector = Array.from({ length: dimensions }, () => 0);
  let seed = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    seed ^= input.toLowerCase().charCodeAt(index);
    seed = Math.imul(seed, 16_777_619);
    vector[Math.abs(seed) % dimensions] += (seed & 1) === 0 ? 1 : -1;
  }
  const magnitude = Math.hypot(...vector) || 1;
  return vector.map((value) => value / magnitude);
}

function jobInput(job: Record<string, unknown>) {
  if (!isRecord(job.input)) throw new WorkerError("Job input is invalid");
  return job.input;
}

async function executeJob(job: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const input = jobInput(job);
  const jobType = asString(job.job_type, 40);
  const openAiKey = Deno.env.get("OPENAI_API_KEY");
  const sarvamKey = Deno.env.get("SARVAM_API_KEY");

  if (jobType === "translation") {
    const text = asString(input.text);
    const sourceLanguage = asString(input.sourceLanguage, 16);
    const targetLanguage = asString(input.targetLanguage, 16);
    if (!text || !sourceLanguage || !targetLanguage) throw new WorkerError("Translation input is invalid");
    if (!openAiKey) {
      return { provider: "demo", model: "deterministic-pass-through-v1", mode: "demo", text, sourceLanguage, targetLanguage };
    }
    const result = await responseText(openAiKey, text, `Translate municipal-service text from ${sourceLanguage} to ${targetLanguage}. Return only the translated text.`);
    return { provider: "openai", model: "gpt-5.6-luna", mode: "live", text: result.text, sourceLanguage, targetLanguage, requestId: result.requestId };
  }

  if (jobType === "summarization") {
    const text = asString(input.text);
    const language = asString(input.language, 16) ?? undefined;
    const maxCharacters = typeof input.maxCharacters === "number" && Number.isInteger(input.maxCharacters)
      ? Math.min(1_000, Math.max(1, input.maxCharacters))
      : 240;
    if (!text) throw new WorkerError("Summarization input is invalid");
    if (!openAiKey) {
      const summary = (normalize(text).match(/^.*?[.!?](?:\s|$)/)?.[0] ?? normalize(text)).slice(0, maxCharacters).trim();
      return { provider: "demo", model: "deterministic-summary-v1", mode: "demo", summary, language };
    }
    const result = await responseText(openAiKey, text, `Summarize this municipal issue in ${maxCharacters} characters or fewer${language ? ` in ${language}` : ""}. Return only the summary.`);
    return { provider: "openai", model: "gpt-5.6-luna", mode: "live", summary: result.text.slice(0, maxCharacters), language, requestId: result.requestId };
  }

  if (jobType === "embedding") {
    const inputText = asString(input.input);
    const dimensions = typeof input.dimensions === "number" && Number.isInteger(input.dimensions)
      ? Math.min(1_536, Math.max(1, input.dimensions))
      : 1_536;
    if (!inputText) throw new WorkerError("Embedding input is invalid");
    if (!openAiKey) {
      return { provider: "demo", model: "deterministic-local-embedding-v1", mode: "demo", embedding: demoEmbedding(inputText, dimensions), dimensions };
    }
    const response = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: inputText, dimensions, encoding_format: "float" }),
    });
    const body = await response.json().catch(() => null);
    const first = isRecord(body) && Array.isArray(body.data) ? body.data[0] : null;
    const embedding = isRecord(first) && Array.isArray(first.embedding) ? first.embedding : null;
    if (!embedding || !embedding.every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new WorkerError("OpenAI response did not include a valid embedding");
    }
    return { provider: "openai", model: "text-embedding-3-small", mode: "live", embedding, dimensions: embedding.length, requestId: providerRequestId(response) };
  }

  if (jobType === "transcription") {
    const audioPath = asString(input.audioPath, 512);
    const filename = asString(input.filename, 160) ?? "recording.webm";
    const language = asString(input.language, 16) ?? undefined;
    if (!audioPath) throw new WorkerError("Transcription input is invalid");
    if (!sarvamKey) {
      return { provider: "demo", model: "deterministic-audio-placeholder-v1", mode: "demo", transcript: `[Demo audio: ${filename}]`, language };
    }
    const { data: audio, error: downloadError } = await supabase.storage.from("issue-media").download(audioPath);
    if (downloadError || !audio) throw new WorkerError("Unable to download job audio", true);
    const form = new FormData();
    form.append("file", audio, filename);
    form.append("model", "saaras:v3");
    form.append("mode", "transcribe");
    if (language) form.append("language_code", language);
    const response = await fetchWithTimeout("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": sarvamKey },
      body: form,
    });
    const body = await response.json().catch(() => null);
    const transcript = isRecord(body) ? asString(body.transcript) ?? asString(body.text) : null;
    if (!transcript) throw new WorkerError("Sarvam response did not include a transcript");
    return { provider: "sarvam", model: "saaras:v3", mode: "live", transcript, language, requestId: providerRequestId(response) };
  }

  throw new WorkerError("Unsupported AI job type");
}

async function recoverStaleJobs(supabase: ReturnType<typeof createClient>) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1_000).toISOString();
  const { error: retryError } = await supabase
    .from("ai_jobs")
    .update({ status: "failed", last_error: "Worker lease expired", next_retry_at: new Date().toISOString() })
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .lt("attempt_count", MAX_ATTEMPTS);
  if (retryError) throw new WorkerError("Unable to recover stale jobs", true);
  const { error: terminalError } = await supabase
    .from("ai_jobs")
    .update({ status: "failed", last_error: "Worker lease expired after final attempt", next_retry_at: null })
    .eq("status", "processing")
    .lt("updated_at", staleBefore)
    .eq("attempt_count", MAX_ATTEMPTS);
  if (terminalError) throw new WorkerError("Unable to recover stale jobs", true);
}

async function claimReadyJobs(supabase: ReturnType<typeof createClient>, limit: number) {
  const now = new Date().toISOString();
  const { data: candidates, error } = await supabase
    .from("ai_jobs")
    .select(JOB_FIELDS)
    .or(`status.eq.queued,and(status.eq.failed,next_retry_at.lte.${now})`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new WorkerError("Unable to read queued jobs", true);

  const claimed = [];
  for (const candidate of candidates ?? []) {
    const attempt = Number(candidate.attempt_count) + 1;
    const { data, error: claimError } = await supabase
      .from("ai_jobs")
      .update({ status: "processing", attempt_count: attempt, last_error: null, next_retry_at: null })
      .eq("id", candidate.id)
      .eq("status", candidate.status)
      .select(JOB_FIELDS)
      .maybeSingle();
    if (claimError) throw new WorkerError("Unable to claim queued job", true);
    if (data) claimed.push(data);
  }
  return claimed;
}

async function processJob(job: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const attempt = Number(job.attempt_count);
  try {
    const result = await executeJob(job, supabase);
    const { error } = await supabase
      .from("ai_jobs")
      .update({
        status: "completed",
        result,
        provider_request_id: result.requestId ?? null,
        last_error: null,
        next_retry_at: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "processing");
    if (error) throw new WorkerError("Unable to persist AI result", true);
    return "completed";
  } catch (error) {
    const retryable = error instanceof WorkerError && error.retryable;
    const { error: updateError } = await supabase
      .from("ai_jobs")
      .update({
        status: "failed",
        last_error: errorMessage(error),
        next_retry_at: retryable && attempt < MAX_ATTEMPTS ? retryAt(attempt) : null,
      })
      .eq("id", job.id)
      .eq("status", "processing");
    if (updateError) throw updateError;
    return retryable && attempt < MAX_ATTEMPTS ? "retry" : "failed";
  }
}

Deno.serve(async (request) => {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceRoleKey || !supabaseUrl) return Response.json({ error: "Worker is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${serviceRoleKey}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rawLimit = Number(new URL(request.url).searchParams.get("limit") ?? MAX_BATCH_SIZE);
  const limit = Number.isInteger(rawLimit) ? Math.min(MAX_BATCH_SIZE, Math.max(1, rawLimit)) : MAX_BATCH_SIZE;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    await recoverStaleJobs(supabase);
    const jobs = await claimReadyJobs(supabase, limit);
    const outcomes = [];
    for (const job of jobs) outcomes.push(await processJob(job, supabase));
    return Response.json({ claimed: jobs.length, completed: outcomes.filter((outcome) => outcome === "completed").length, retried: outcomes.filter((outcome) => outcome === "retry").length, failed: outcomes.filter((outcome) => outcome === "failed").length });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
});
