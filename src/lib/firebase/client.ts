"use client";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getRuntimeEnv } from "@/lib/supabase/env";
export function getFirebaseAuth() {
  const env = getRuntimeEnv();
  if (!env.hasFirebaseConfiguration) return null;
  const app = getApps().length ? getApp() : initializeApp(env.firebase);
  return getAuth(app);
}

export async function getFirebaseAuthorizationHeader(): Promise<Record<string, string>> {
  const token = await getFirebaseAuth()?.currentUser?.getIdToken(false);
  return token ? { authorization: `Bearer ${token}` } : {};
}
