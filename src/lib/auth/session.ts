import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { DemoSession } from "@/lib/domain/types";
import { getRuntimeEnv } from "@/lib/supabase/env";

const COOKIE_NAME = "nagarsakhi_demo_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const DOCUMENTED_SECRET_PLACEHOLDER = "replace-with-at-least-32-random-characters";

type SessionEnvelope = {
  session: DemoSession;
  expiresAt: number;
};

function getSecret() {
  const secret = process.env.DEMO_SESSION_SECRET;

  if (secret && secret.length >= 32 && secret !== DOCUMENTED_SECRET_PLACEHOLDER) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "nagarsakhi-local-development-secret-only";
  }

  throw new Error("DEMO_SESSION_SECRET must be replaced with at least 32 random characters");
}

function sign(value: string) {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function encode(envelope: SessionEnvelope) {
  const payload = Buffer.from(JSON.stringify(envelope)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(value: string): SessionEnvelope | null {
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;

  const payload = value.slice(0, separator);
  const receivedSignature = value.slice(separator + 1);
  const expectedSignature = sign(payload);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);

  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return null;
  }

  try {
    const envelope = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as SessionEnvelope;

    if (!envelope.session?.profileId || envelope.expiresAt <= Date.now()) return null;
    return envelope;
  } catch {
    return null;
  }
}

export async function getDemoSession() {
  if (!getRuntimeEnv().demoAuth) return null;
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  return value ? decode(value)?.session ?? null : null;
}

export async function setDemoSession(session: DemoSession) {
  if (!getRuntimeEnv().demoAuth) {
    throw new Error("Demo authentication is disabled");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    COOKIE_NAME,
    encode({
      session,
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  );
}

export async function clearDemoSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
