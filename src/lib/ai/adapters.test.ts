import { describe, expect, it } from "vitest";

import { createAiServices, OpenAiEmbeddingProvider } from "./adapters";
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

  it("orders OpenAI batch embeddings by index", async () => {
    const provider = new OpenAiEmbeddingProvider("test-key", {
      fetch: async (_input, init) => {
        const request = JSON.parse(String(init?.body)) as { input: string[] };
        expect(request.input).toEqual(["first", "second"]);
        return new Response(JSON.stringify({
          data: [
            { index: 1, embedding: [0, 1] },
            { index: 0, embedding: [1, 0] },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    });

    await expect(provider.embedMany({ input: ["first", "second"], dimensions: 2 })).resolves.toMatchObject({
      mode: "live",
      model: "text-embedding-3-small",
      embeddings: [[1, 0], [0, 1]],
      dimensions: 2,
    });
  });
});
