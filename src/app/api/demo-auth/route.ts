import { NextResponse } from "next/server";
import { z } from "zod";

import { getDemoAccountByPhone } from "@/lib/auth/demo-accounts";
import { clearDemoSession, setDemoSession } from "@/lib/auth/session";
import { getRuntimeEnv } from "@/lib/supabase";

const loginSchema = z.object({
  phone: z.string().trim().min(10).max(16),
  otp: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  const env = getRuntimeEnv();
  if (!env.demoAuth) {
    return NextResponse.json({ error: "Demo authentication is disabled." }, { status: 404 });
  }

  if (process.env.NODE_ENV === "production" && env.demoOtp === "123456") {
    return NextResponse.json(
      { error: "The production demo OTP must be configured before sign-in is enabled." },
      { status: 503 },
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid demo phone number and six-digit OTP." }, { status: 400 });
  }

  if (parsed.data.otp !== env.demoOtp) {
    return NextResponse.json({ error: "Incorrect demo OTP." }, { status: 401 });
  }

  const account = getDemoAccountByPhone(parsed.data.phone);
  if (!account) {
    return NextResponse.json({ error: "This account is not in the synthetic municipality dataset." }, { status: 404 });
  }

  await setDemoSession(account.session);
  return NextResponse.json({ session: account.session });
}

export async function DELETE() {
  await clearDemoSession();
  return NextResponse.json({ ok: true });
}
