import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { rejectLiveIssue } from "./live-mutations";

describe("rejectLiveIssue", () => {
  it("requires a clear reason before calling Supabase", async () => {
    const rpc = vi.fn();
    const result = await rejectLiveIssue("issue-1", "no", { rpc } as unknown as SupabaseClient);

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "Add a clear rejection reason between 8 and 500 characters." },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("records the rejection through the secured status transition", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: "profile-1", error: null })
      .mockResolvedValueOnce({ data: "rejected", error: null });
    const result = await rejectLiveIssue("issue-1", "Outside the ward office mandate.", { rpc } as unknown as SupabaseClient);

    expect(result).toEqual({ ok: true, data: "rejected" });
    expect(rpc).toHaveBeenNthCalledWith(1, "current_profile_id");
    expect(rpc).toHaveBeenNthCalledWith(2, "transition_issue_status", {
      target_issue_id: "issue-1",
      target_status: "rejected",
      transition_note: "Outside the ward office mandate.",
    });
  });
});
