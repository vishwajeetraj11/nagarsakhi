import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRuntimeEnv, type RuntimeEnv } from "./env";

export type ServerCookie = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

/** A small adapter so route handlers can pass Next's cookie store without coupling this module to a framework API. */
export type ServerCookieAdapter = {
  getAll(): Array<Pick<ServerCookie, "name" | "value">>;
  setAll?(cookies: ServerCookie[]): void;
};

const configuredClientValues = (env: RuntimeEnv): { url: string; key: string } | null => {
  const { url, publishableKey } = env.supabase;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, key: publishableKey };
};

/**
 * Returns null when Supabase is not configured, which keeps the browser safe
 * to render in the repository's default demo mode.
 */
export function createBrowserSupabaseClient(env: RuntimeEnv = getRuntimeEnv()): SupabaseClient | null {
  const config = configuredClientValues(env);

  if (!config) {
    return null;
  }

  return createBrowserClient(config.url, config.key, {
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

export function createFirebaseSupabaseClient(
  accessToken: () => Promise<string | null>,
  env: RuntimeEnv = getRuntimeEnv(),
): SupabaseClient | null {
  const config = configuredClientValues(env);

  if (!config) {
    return null;
  }

  return createClient(config.url, config.key, {
    accessToken,
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a request-scoped server client. Callers should pass a cookie adapter
 * backed by `cookies()` so auth refreshes can be persisted in route handlers.
 */
export function createServerSupabaseClient(
  cookies: ServerCookieAdapter,
  env: RuntimeEnv = getRuntimeEnv(),
): SupabaseClient | null {
  const config = configuredClientValues(env);

  if (!config) {
    return null;
  }

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookies.getAll(),
      setAll: (entries) => cookies.setAll?.(entries as unknown as ServerCookie[]),
    },
    cookieOptions: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  });
}

/**
 * Service-role access is deliberately server-only. Do not import this factory
 * from a Client Component or expose its result to the browser.
 */
export function createServiceRoleSupabaseClient(
  env: RuntimeEnv = getRuntimeEnv(),
): SupabaseClient | null {
  const { url, serviceRoleKey } = env.supabase;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
