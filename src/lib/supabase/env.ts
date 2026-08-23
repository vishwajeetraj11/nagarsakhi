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
 * an incomplete environment should show a live-configuration error instead of
 * falling back to the old civic demo login.
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
    NEXT_PUBLIC_FIREBASE_API_KEY: optionalString,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalString,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalString,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: optionalString,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: optionalString,
    NEXT_PUBLIC_FIREBASE_APP_ID: optionalString,
    R2_ACCOUNT_ID: optionalString,
    R2_BUCKET_NAME: optionalString,
    R2_ENDPOINT: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
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
  firebase: {
    apiKey?: string;
    authDomain?: string;
    projectId?: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
  hasFirebaseConfiguration: boolean;
  r2: {
    accountId?: string;
    bucketName?: string;
    endpoint?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  };
  hasR2Configuration: boolean;
};

type EnvSource = Record<string, string | undefined>;

const getBrowserPublicEnv = (): EnvSource => ({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
});

const parseBooleanFlag = (value: string | undefined, fallback: boolean): boolean => {
  const parsed = booleanFlag.safeParse(value);

  if (!parsed.success) {
    return fallback;
  }

  return parsed.data === "true" || parsed.data === "1";
};

/**
 * Safely validates environment input. It never throws so the app can render a
 * useful configuration error instead of crashing during boot.
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
  const modeResult = dataMode.safeParse(requestedMode ?? "supabase");
  const selectedMode = modeResult.success ? modeResult.data : "supabase";

  if (!modeResult.success) {
    issues.push({
      variable: "NEXT_PUBLIC_DATA_MODE",
      message: "Expected 'demo' or 'supabase'; using live Supabase mode.",
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

  const firebase = {
    apiKey: values.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: values.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: values.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: values.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: values.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: values.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const hasFirebaseConfiguration = Object.values(firebase).every(Boolean);

  const r2 = {
    accountId: values.R2_ACCOUNT_ID,
    bucketName: values.R2_BUCKET_NAME,
    endpoint: values.R2_ENDPOINT,
    accessKeyId: values.R2_ACCESS_KEY_ID,
    secretAccessKey: values.R2_SECRET_ACCESS_KEY,
  };
  const hasR2Configuration = Object.values(r2).every(Boolean);

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
    firebase,
    hasFirebaseConfiguration,
    r2,
    hasR2Configuration,
  };
}

export const getRuntimeEnv = (): RuntimeEnv =>
  validateRuntimeEnv(typeof window === "undefined" ? process.env : getBrowserPublicEnv());
