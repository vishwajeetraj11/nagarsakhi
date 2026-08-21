import "server-only";

import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createFirebaseSupabaseClient,
  createServerSupabaseClient,
  createServiceRoleSupabaseClient,
  getRuntimeEnv,
} from "@/lib/supabase";

export class AiJobRouteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiJobRouteError";
  }
}

export type AuthenticatedAiJobContext = {
  userId: string;
  municipalityId: string;
  userClient: SupabaseClient;
  serviceClient?: SupabaseClient;
};

const requestCookies = async () => {
  const cookieStore = await cookies();
  return {
    getAll: () => cookieStore.getAll(),
    setAll: (entries: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
      for (const entry of entries) {
        try {
          cookieStore.set(entry.name, entry.value, entry.options as never);
        } catch {
          // Server Components cannot always persist refreshed auth cookies. Route handlers can.
        }
      }
    },
  };
};

/** Authenticates a Supabase cookie session and obtains the caller's RLS-scoped profile. */
export async function getAuthenticatedAiJobContext(
  request?: Request,
  options: { serviceRole?: boolean } = {},
): Promise<AuthenticatedAiJobContext> {
  const env = getRuntimeEnv();
  if (env.isDemoMode) {
    throw new AiJobRouteError("Durable AI jobs require Supabase mode.", 503);
  }

  const bearerToken = request?.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
  const userClient = bearerToken
    ? createFirebaseSupabaseClient(async () => bearerToken, env)
    : createServerSupabaseClient(await requestCookies(), env);
  if (!userClient) {
    throw new AiJobRouteError("Supabase is not configured.", 503);
  }

  const { data: profileId, error: profileIdError } = await userClient.rpc("current_profile_id");
  if (profileIdError || !profileId) {
    throw new AiJobRouteError("Authentication required.", 401);
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("id, municipality_id")
    .eq("id", profileId as string)
    .maybeSingle();
  if (profileError) {
    throw new AiJobRouteError("Unable to validate the current profile.", 500);
  }
  if (!profile) {
    throw new AiJobRouteError("Profile not found.", 403);
  }

  const serviceClient = options.serviceRole ? createServiceRoleSupabaseClient(env) ?? undefined : undefined;
  if (options.serviceRole && !serviceClient) {
    throw new AiJobRouteError("AI jobs are not configured.", 503);
  }

  return {
    userId: profile.id,
    municipalityId: profile.municipality_id,
    userClient,
    serviceClient,
  };
}
