import { z } from "zod";

import { AI_JOB_TYPES, type CreateAiJobRequest } from "./contracts";

const uuid = z.string().uuid();
const language = z.string().trim().min(2).max(16).regex(/^[A-Za-z0-9-]+$/);
const text = z.string().trim().min(1).max(5_000);
const storagePath = z
  .string()
  .trim()
  .min(3)
  .max(512)
  .regex(/^(?!.*(?:^|\/)\.\.?\/)[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Invalid storage path");

const transcriptionInput = z
  .object({
    audioPath: storagePath,
    filename: z.string().trim().min(1).max(160).optional(),
    language: language.optional(),
  })
  .strict();
const translationInput = z
  .object({ text, sourceLanguage: language, targetLanguage: language })
  .strict();
const summarizationInput = z
  .object({ text, language: language.optional(), maxCharacters: z.number().int().min(1).max(1_000).optional() })
  .strict();
const embeddingInput = z
  .object({ input: text, dimensions: z.number().int().min(1).max(1_536).optional() })
  .strict();

const payloadSchema = z
  .object({
    jobType: z.enum(AI_JOB_TYPES),
    issueId: uuid,
    idempotencyKey: z.string().trim().min(16).max(160).regex(/^[A-Za-z0-9._:-]+$/),
    input: z.unknown(),
  })
  .strict()
  .superRefine((value, context) => {
    const schema = {
      transcription: transcriptionInput,
      translation: translationInput,
      summarization: summarizationInput,
      embedding: embeddingInput,
    }[value.jobType];
    const parsed = schema.safeParse(value.input);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({ ...issue, path: ["input", ...issue.path] });
      }
    }
  });

/** Validates the bounded, serializable contract accepted by the enqueue API. */
export function parseCreateAiJobRequest(value: unknown): CreateAiJobRequest {
  const serialized = JSON.stringify(value);
  if (!serialized || serialized.length > 12_000) {
    throw new z.ZodError([{ code: "custom", path: [], message: "Request body is too large" }]);
  }

  const parsed = payloadSchema.parse(value);
  const input = {
    transcription: transcriptionInput,
    translation: translationInput,
    summarization: summarizationInput,
    embedding: embeddingInput,
  }[parsed.jobType].parse(parsed.input);

  return { ...parsed, input } as CreateAiJobRequest;
}

export const createAiJobRequestSchema = payloadSchema;
