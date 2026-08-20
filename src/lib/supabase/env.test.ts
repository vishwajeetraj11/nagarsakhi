import { describe, expect, it } from "vitest";

import { validateRuntimeEnv } from "./env";

describe("validateRuntimeEnv", () => {
  it("keeps blank local configuration runnable in demo mode", () => {
    const env = validateRuntimeEnv({
      NEXT_PUBLIC_DATA_MODE: "demo",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    });

    expect(env.isDemoMode).toBe(true);
    expect(env.hasSupabaseConfiguration).toBe(false);
    expect(env.issues).toEqual([]);
  });

  it("reports invalid or incomplete live configuration without throwing", () => {
    const env = validateRuntimeEnv({ NEXT_PUBLIC_DATA_MODE: "production" });
    const incomplete = validateRuntimeEnv({ NEXT_PUBLIC_DATA_MODE: "supabase" });

    expect(env.dataMode).toBe("demo");
    expect(env.issues[0]?.variable).toBe("NEXT_PUBLIC_DATA_MODE");
    expect(incomplete.hasSupabaseConfiguration).toBe(false);
    expect(incomplete.issues).toHaveLength(1);
  });

  it("requires an explicit production demo opt-in and disables demo auth in Supabase mode", () => {
    const productionDemo = validateRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_DATA_MODE: "demo",
    });
    const live = validateRuntimeEnv({
      NODE_ENV: "production",
      NEXT_PUBLIC_DATA_MODE: "supabase",
      DEMO_AUTH: "true",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-key",
    });

    expect(productionDemo.demoAuth).toBe(false);
    expect(live.demoAuth).toBe(false);
    expect(live.issues).toContainEqual({
      variable: "DEMO_AUTH",
      message: "Demo authentication is disabled in Supabase mode.",
    });
  });
});
