import { getRuntimeEnv, type RuntimeEnv } from "@/lib/supabase/env";

import { ExternalServiceError, fetchWithTimeout, readJson, type FetchLike } from "./fetch";
import type {
  AiServices,
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResult,
  SummarizationProvider,
  SummarizationRequest,
  SummarizationResult,
  TranscriptionProvider,
  TranscriptionRequest,
  TranscriptionResult,
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "./types";

const OPENAI_URL = "https://api.openai.com/v1";
const SARVAM_TRANSCRIBE_URL = "https://api.sarvam.ai/speech-to-text";
const EMBEDDING_MODEL = "text-embedding-3-small";
const TEXT_MODEL = "gpt-5.6-luna";

type AdapterOptions = {
  fetch?: FetchLike;
  timeoutMs?: number;
};

type JsonObject = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonObject => typeof value === "object" && value !== null;

const stringAt = (value: unknown, ...keys: string[]): string | undefined => {
  let current: unknown = value;

  for (const key of keys) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }

  return typeof current === "string" ? current : undefined;
};

const requestId = (response: Response): string | undefined =>
  response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined;

const normalizedText = (text: string): string => text.replace(/\s+/g, " ").trim();

const demoEmbedding = (input: string, dimensions: number): number[] => {
  const vector = Array.from({ length: dimensions }, () => 0);
  const text = normalizedText(input).toLocaleLowerCase();
  let seed = 2_166_136_261;

  for (let index = 0; index < text.length; index += 1) {
    seed ^= text.charCodeAt(index);
    seed = Math.imul(seed, 16_777_619);
    const slot = Math.abs(seed) % dimensions;
    vector[slot] += (seed & 1) === 0 ? 1 : -1;
  }

  const magnitude = Math.hypot(...vector) || 1;
  return vector.map((value) => value / magnitude);
};

export class DemoEmbeddingProvider implements EmbeddingProvider {
  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const dimensions = request.dimensions ?? 1536;
    if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 1536) {
      throw new ExternalServiceError("Embedding dimensions must be an integer from 1 to 1536", undefined, false);
    }

    return {
      provider: "demo",
      model: "deterministic-local-embedding-v1",
      mode: "demo",
      embedding: demoEmbedding(request.input, dimensions),
      dimensions,
    };
  }
}

export class DemoTranslationProvider implements TranslationProvider {
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    return {
      provider: "demo",
      model: "deterministic-pass-through-v1",
      mode: "demo",
      text: request.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
    };
  }
}

export class DemoSummarizationProvider implements SummarizationProvider {
  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const limit = Math.max(1, request.maxCharacters ?? 240);
    const text = normalizedText(request.text);
    const firstSentence = text.match(/^.*?[.!?](?:\s|$)/)?.[0] ?? text;

    return {
      provider: "demo",
      model: "deterministic-summary-v1",
      mode: "demo",
      summary: firstSentence.slice(0, limit).trim(),
      language: request.language,
    };
  }
}

export class DemoTranscriptionProvider implements TranscriptionProvider {
  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    return {
      provider: "demo",
      model: "deterministic-audio-placeholder-v1",
      mode: "demo",
      transcript: `[Demo audio: ${request.filename ?? "recording"}]`,
      language: request.language,
    };
  }
}

class OpenAiTextClient {
  constructor(
    private readonly apiKey: string,
    private readonly options: AdapterOptions,
    private readonly baseUrl = OPENAI_URL,
  ) {}

  async completion(system: string, user: string, signal?: AbortSignal): Promise<{ text: string; requestId?: string }> {
    const response = await fetchWithTimeout(
      `${this.baseUrl}/responses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: TEXT_MODEL,
          reasoning: { effort: "none" },
          instructions: system,
          input: user,
        }),
        signal,
      },
      this.options,
    );
    const body = await readJson<unknown>(response);
    const directText = stringAt(body, "output_text");
    const output = isRecord(body) && Array.isArray(body.output) ? body.output : [];
    let nestedText: string | undefined;

    for (const item of output) {
      if (!isRecord(item) || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") {
          nestedText = content.text;
          break;
        }
      }
      if (nestedText) break;
    }

    const text = directText ?? nestedText;
    if (!text?.trim()) {
      throw new ExternalServiceError("OpenAI response did not include text", response.status, false);
    }

    return { text: text.trim(), requestId: requestId(response) };
  }
}

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    private readonly options: AdapterOptions = {},
    private readonly baseUrl = OPENAI_URL,
  ) {}

  async embed(request: EmbeddingRequest): Promise<EmbeddingResult> {
    const model = request.model ?? EMBEDDING_MODEL;
    const response = await fetchWithTimeout(
      `${this.baseUrl}/embeddings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: request.input,
          ...(request.dimensions ? { dimensions: request.dimensions } : {}),
          encoding_format: "float",
        }),
        signal: request.signal,
      },
      this.options,
    );
    const body = await readJson<unknown>(response);
    const data = isRecord(body) && Array.isArray(body.data) ? body.data[0] : undefined;
    const embedding = isRecord(data) && Array.isArray(data.embedding) ? data.embedding : undefined;

    if (!embedding || !embedding.every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new ExternalServiceError("OpenAI response did not include a valid embedding", response.status, false);
    }

    return {
      provider: "openai",
      model,
      mode: "live",
      embedding: embedding as number[],
      dimensions: embedding.length,
      requestId: requestId(response),
    };
  }
}

export class OpenAiTranslationProvider implements TranslationProvider {
  private readonly client: OpenAiTextClient;

  constructor(apiKey: string, options: AdapterOptions = {}) {
    this.client = new OpenAiTextClient(apiKey, options);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    const result = await this.client.completion(
      `Translate municipal-service text from ${request.sourceLanguage} to ${request.targetLanguage}. Return only the translated text.`,
      request.text,
      request.signal,
    );
    return {
      provider: "openai",
      model: TEXT_MODEL,
      mode: "live",
      text: result.text,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      requestId: result.requestId,
    };
  }
}

export class OpenAiSummarizationProvider implements SummarizationProvider {
  private readonly client: OpenAiTextClient;

  constructor(apiKey: string, options: AdapterOptions = {}) {
    this.client = new OpenAiTextClient(apiKey, options);
  }

  async summarize(request: SummarizationRequest): Promise<SummarizationResult> {
    const limit = Math.max(1, request.maxCharacters ?? 240);
    const result = await this.client.completion(
      `Summarize this municipal issue in ${limit} characters or fewer${request.language ? ` in ${request.language}` : ""}. Return only the summary.`,
      request.text,
      request.signal,
    );
    return {
      provider: "openai",
      model: TEXT_MODEL,
      mode: "live",
      summary: result.text.slice(0, limit),
      language: request.language,
      requestId: result.requestId,
    };
  }
}

export class SarvamTranscriptionProvider implements TranscriptionProvider {
  constructor(
    private readonly apiKey: string,
    private readonly options: AdapterOptions = {},
    private readonly endpoint = SARVAM_TRANSCRIBE_URL,
  ) {}

  async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
    const body = new FormData();
    body.append("file", request.audio, request.filename ?? "recording.webm");
    body.append("model", "saaras:v3");
    body.append("mode", "transcribe");
    if (request.language) {
      body.append("language_code", request.language);
    }

    const response = await fetchWithTimeout(
      this.endpoint,
      {
        method: "POST",
        headers: { "api-subscription-key": this.apiKey },
        body,
        signal: request.signal,
      },
      this.options,
    );
    const result = await readJson<unknown>(response);
    const transcript = stringAt(result, "transcript") ?? stringAt(result, "text");

    if (!transcript) {
      throw new ExternalServiceError("Sarvam response did not include a transcript", response.status, false);
    }

    return {
      provider: "sarvam",
      model: "saaras:v3",
      mode: "live",
      transcript,
      language: request.language,
      requestId: requestId(response),
    };
  }
}

export type CreateAiServicesOptions = AdapterOptions & {
  env?: RuntimeEnv;
};

/** Selects live providers only when their server-side keys are configured. */
export function createAiServices(options: CreateAiServicesOptions = {}): AiServices {
  const env = options.env ?? getRuntimeEnv();
  const adapterOptions: AdapterOptions = { fetch: options.fetch, timeoutMs: options.timeoutMs };

  return {
    embeddings: env.openAiApiKey
      ? new OpenAiEmbeddingProvider(env.openAiApiKey, adapterOptions)
      : new DemoEmbeddingProvider(),
    translation: env.openAiApiKey
      ? new OpenAiTranslationProvider(env.openAiApiKey, adapterOptions)
      : new DemoTranslationProvider(),
    summarization: env.openAiApiKey
      ? new OpenAiSummarizationProvider(env.openAiApiKey, adapterOptions)
      : new DemoSummarizationProvider(),
    transcription: env.sarvamApiKey
      ? new SarvamTranscriptionProvider(env.sarvamApiKey, adapterOptions)
      : new DemoTranscriptionProvider(),
  };
}
