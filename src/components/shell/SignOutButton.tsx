"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase";
import { getFirebaseAuth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";

export function SignOutButton({ dataMode }: { dataMode: "demo" | "supabase" }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    if (dataMode === "supabase") {
      await createBrowserSupabaseClient()?.auth.signOut();
      const firebase = getFirebaseAuth();
      if (firebase) await firebaseSignOut(firebase);
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
