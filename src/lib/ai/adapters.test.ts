import { describe, expect, it } from "vitest";

import { createAiServices } from "./adapters";
import { validateRuntimeEnv } from "../supabase/env";

describe("AI adapters", () => {
  it("uses deterministic local providers when API keys are absent", async () => {
    const services = createAiServices({ env: validateRuntimeEnv({}) });
    const first = await services.embeddings.embed({ input: "Drain blocked near ward office" });
    const second = await services.embeddings.embed({ input: "Drain blocked near ward office" });

    expect(first.mode).toBe("demo");
    expect(first.embedding).toEqual(second.embedding);
    await expect(
      services.translation.translate({ text: "नाली बंद है", sourceLanguage: "hi", targetLanguage: "en" }),
    ).resolves.toMatchObject({ mode: "demo", text: "नाली बंद है" });
  });
});
