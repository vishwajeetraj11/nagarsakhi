"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, browserSessionPersistence, getAuth, indexedDBLocalPersistence, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getRuntimeEnv } from "@/lib/supabase/env";
export function getFirebaseAuth() {
  const env = getRuntimeEnv();
  if (!env.hasFirebaseConfiguration) return null;
  const app = getApps().length ? getApp() : initializeApp(env.firebase);
  try {
    // Phone OTP does not use popup/redirect sign-in. Avoid its cross-origin
    // startup work, and let restricted browsers fall back to in-memory auth.
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
    });
  } catch (error) {
    // Preserve the existing instance during Fast Refresh or repeat calls.
    if (error && typeof error === "object" && "code" in error && error.code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw error;
  }
}

export async function getFirebaseAuthorizationHeader(): Promise<Record<string, string>> {
  const token = await getFirebaseAuth()?.currentUser?.getIdToken(false);
  return token ? { authorization: `Bearer ${token}` } : {};
}
