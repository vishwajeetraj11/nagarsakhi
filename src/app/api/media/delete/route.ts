import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Issue records are immutable after submission; attachment deletion is disabled too. */
export async function POST() {
  return NextResponse.json({ error: "Issue deletion is not available after a report is submitted." }, { status: 403 });
}
