import { z } from "zod";

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const dataMode = z.enum(["demo", "supabase"]);
const booleanFlag = z.enum(["true", "false", "1", "0"]);

/**
 * The raw variables accepted by NagarSakhi. Validation is intentionally safe:
 * an incomplete local .env must leave the app usable in demo mode.
 */
export const runtimeEnvSchema = z
  .object({
    NEXT_PUBLIC_DATA_MODE: optionalString,
    NEXT_PUBLIC_SUPABASE_URL: optionalString,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    OPENAI_API_KEY: optionalString,
    SARVAM_API_KEY: optionalString,
    DEMO_AUTH: optionalString,
    DEMO_OTP: optionalString,
  })
  .passthrough();

export type EnvIssue = {
  variable: string;
  message: string;
};

export type RuntimeEnv = {
  dataMode: "demo" | "supabase";
  demoAuth: boolean;
  demoOtp: string;
  supabase: {
    url?: string;
    publishableKey?: string;
    serviceRoleKey?: string;
  };
  openAiApiKey?: string;
  sarvamApiKey?: string;
  issues: EnvIssue[];
  isDemoMode: boolean;
  hasSupabaseConfiguration: boolean;
};

type EnvSource = Record<string, string | undefined>;

const parseBooleanFlag = (value: string | undefined, fallback: boolean): boolean => {
  const parsed = booleanFlag.safeParse(value);

  if (!parsed.success) {
    return fallback;
  }

  return parsed.data === "true" || parsed.data === "1";
};

/**
 * Safely validates environment input. It never throws so that a fresh checkout
 * with the blank values from .env.example automatically remains runnable.
 */
export function validateRuntimeEnv(source: EnvSource = process.env): RuntimeEnv {
  const parsed = runtimeEnvSchema.safeParse(source);
  // Parsing an empty object is guaranteed to succeed because every variable is optional.
  // This preserves a typed, safe fallback even if a caller passes malformed input.
  const values = parsed.success ? parsed.data : runtimeEnvSchema.parse({});
  const issues: EnvIssue[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        variable: issue.path.join(".") || "environment",
        message: issue.message,
      });
    }
  }

  const requestedMode = values.NEXT_PUBLIC_DATA_MODE;
  const modeResult = dataMode.safeParse(requestedMode ?? "demo");
  const selectedMode = modeResult.success ? modeResult.data : "demo";

  if (!modeResult.success) {
    issues.push({
      variable: "NEXT_PUBLIC_DATA_MODE",
      message: "Expected 'demo' or 'supabase'; using demo mode.",
    });
  }

  if (values.DEMO_AUTH && !booleanFlag.safeParse(values.DEMO_AUTH).success) {
    issues.push({
      variable: "DEMO_AUTH",
      message: "Expected true, false, 1, or 0; using the default.",
    });
  }

  const supabase = {
    url: values.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    serviceRoleKey: values.SUPABASE_SERVICE_ROLE_KEY,
  };
  const hasValidSupabaseUrl = !supabase.url || z.string().url().safeParse(supabase.url).success;
  if (!hasValidSupabaseUrl) {
    issues.push({
      variable: "NEXT_PUBLIC_SUPABASE_URL",
      message: "Expected an absolute Supabase URL.",
    });
  }

  const hasSupabaseConfiguration = Boolean(
    supabase.url && supabase.publishableKey && hasValidSupabaseUrl,
  );

  if (selectedMode === "supabase" && !hasSupabaseConfiguration) {
    issues.push({
      variable: "NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      message: "Supabase mode needs a URL and publishable key; clients will be unavailable.",
    });
  }

  const requestedDemoAuth = parseBooleanFlag(
    values.DEMO_AUTH,
    source.NODE_ENV !== "production",
  );
  const demoAuth = selectedMode === "demo" && requestedDemoAuth;

  if (selectedMode === "supabase" && values.DEMO_AUTH && requestedDemoAuth) {
    issues.push({
      variable: "DEMO_AUTH",
      message: "Demo authentication is disabled in Supabase mode.",
    });
  }

  return {
    dataMode: selectedMode,
    demoAuth,
    demoOtp: values.DEMO_OTP ?? "123456",
    supabase,
    openAiApiKey: values.OPENAI_API_KEY,
    sarvamApiKey: values.SARVAM_API_KEY,
    issues,
    isDemoMode: selectedMode === "demo",
    hasSupabaseConfiguration,
  };
}

export const getRuntimeEnv = (): RuntimeEnv => validateRuntimeEnv(process.env);
