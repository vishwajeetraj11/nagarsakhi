import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("ward") !== "7") {
    return NextResponse.json({ error: "Only the Ward 7 public showcase is available." }, { status: 404 });
  }
  const supabase = createServerSupabaseClient({ getAll: () => [] });
  if (!supabase) return NextResponse.json({ error: "The public data connection is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("get_public_ward_demo", { target_ward_number: 7 });
  if (error) return NextResponse.json({ error: "The public Ward 7 record is temporarily unavailable." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "The public Ward 7 record could not be found." }, { status: 404 });
  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}
