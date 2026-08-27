import { useRef, useState } from "react";

export type ActionFeedback = { state: "pending" | "success" | "error"; message: string };

// The ref closes the gap before React renders the disabled submit button.
export function useNoticePublication() {
  const inFlight = useRef(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  async function run(publish: () => Promise<string>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setFeedback({ state: "pending", message: "Publishing notice…" });
    try {
      setFeedback({ state: "success", message: await publish() });
    } catch (error) {
      setFeedback({ state: "error", message: error instanceof Error ? error.message : "Could not confirm publication. Your draft is preserved; check the notice list before retrying." });
    } finally {
      inFlight.current = false;
    }
  }

  return { run, feedback, pending: feedback?.state === "pending" };
}
