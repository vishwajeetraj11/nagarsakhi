"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase";

export function SignOutButton({ dataMode }: { dataMode: "demo" | "supabase" }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    if (dataMode === "supabase") {
      await createBrowserSupabaseClient()?.auth.signOut();
    } else {
      await fetch("/api/demo-auth", { method: "DELETE" });
    }
    router.refresh();
  }

  return (
    <button className="quiet-action" disabled={leaving} onClick={signOut} type="button">
      {leaving ? "Closing…" : dataMode === "demo" ? "Switch role" : "Sign out"}
    </button>
  );
}
