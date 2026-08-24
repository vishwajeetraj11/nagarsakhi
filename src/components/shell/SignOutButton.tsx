"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getFirebaseAuth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";

export function SignOutButton() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    const firebase = getFirebaseAuth();
    if (firebase) await firebaseSignOut(firebase);
    router.refresh();
  }

  return (
    <button className="quiet-action" disabled={leaving} onClick={signOut} type="button">
      {leaving ? "Closing…" : "Sign out"}
    </button>
  );
}
