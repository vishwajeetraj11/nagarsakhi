import { describe, expect, it } from "vitest";

import { parseCreateAiJobRequest } from "./validation";

const base = {
  issueId: "ea23b0ca-2a0e-4e9c-b1fa-304091d60fab",
  idempotencyKey: "translation:ea23b0ca-2a0e-4e9c-b1fa-304091d60fab:12345678",
};

describe("AI job request validation", () => {
  it("accepts a bounded translation request", () => {
    expect(
      parseCreateAiJobRequest({
        ...base,
        jobType: "translation",
        input: { text: "नाली बंद है", sourceLanguage: "hi", targetLanguage: "en" },
      }),
    ).toMatchObject({ jobType: "translation", input: { targetLanguage: "en" } });
  });

  it("rejects mismatched input and unsafe storage paths", () => {
    expect(() =>
      parseCreateAiJobRequest({ ...base, jobType: "embedding", input: { text: "wrong field" } }),
    ).toThrow();
    expect(() =>
      parseCreateAiJobRequest({
        ...base,
        jobType: "transcription",
        input: { audioPath: "user/issue/../secrets.wav" },
      }),
    ).toThrow();
  });
});
