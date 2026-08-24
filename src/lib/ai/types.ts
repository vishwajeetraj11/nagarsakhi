/** Values mirror the `public.job_type` and `public.job_status` database enums. */
export type AiJobType = "transcription" | "translation" | "summarization" | "embedding";
export type AiJobStatus = "queued" | "processing" | "completed" | "failed";
export type AdapterMode = "demo" | "live";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type ProviderMetadata = {
  provider: "openai" | "sarvam" | "demo";
  model: string;
  mode: AdapterMode;
  requestId?: string;
};

export type EmbeddingRequest = {
  input: string;
  model?: string;
  dimensions?: number;
  signal?: AbortSignal;
};

export type EmbeddingBatchRequest = {
  input: string[];
  model?: string;
  dimensions?: number;
  signal?: AbortSignal;
};

export type EmbeddingResult = ProviderMetadata & {
  embedding: number[];
  dimensions: number;
};

export type EmbeddingBatchResult = ProviderMetadata & {
  embeddings: number[][];
  dimensions: number;
};

export type TranslationRequest = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  signal?: AbortSignal;
};

export type TranslationResult = ProviderMetadata & {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
};

export type SummarizationRequest = {
  text: string;
  language?: string;
  maxCharacters?: number;
  signal?: AbortSignal;
};

export type SummarizationResult = ProviderMetadata & {
  summary: string;
  language?: string;
};

export type TranscriptionRequest = {
  audio: Blob;
  filename?: string;
  language?: string;
  signal?: AbortSignal;
};

export type TranscriptionResult = ProviderMetadata & {
  transcript: string;
  language?: string;
};

export interface EmbeddingProvider {
  embed(request: EmbeddingRequest): Promise<EmbeddingResult>;
  embedMany(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult>;
}

export interface TranslationProvider {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface SummarizationProvider {
  summarize(request: SummarizationRequest): Promise<SummarizationResult>;
}

export interface TranscriptionProvider {
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export type AiServices = {
  embeddings: EmbeddingProvider;
  translation: TranslationProvider;
  summarization: SummarizationProvider;
  transcription: TranscriptionProvider;
};

export type AiJobResult =
  | EmbeddingResult
  | TranslationResult
  | SummarizationResult
  | TranscriptionResult;

/** Serializable representation of the fields the browser may observe on ai_jobs. */
export type AiJobRecord = {
  id: string;
  municipalityId: string;
  createdBy: string;
  issueId: string | null;
  type: AiJobType;
  status: AiJobStatus;
  attemptCount: number;
  idempotencyKey: string;
  input: JsonValue;
  result: AiJobResult | null;
  providerRequestId: string | null;
  lastError: string | null;
  nextRetryAt: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};
