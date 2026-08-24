import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createLiveEscalation, rejectLiveIssue } from "./live-mutations";

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

describe("createLiveEscalation", () => {
  it("requires a reason before calling Supabase", async () => {
    const rpc = vi.fn();
    const result = await createLiveEscalation("issue-1", "no", { rpc } as unknown as SupabaseClient);

    expect(result).toEqual({
      ok: false,
      error: { code: "VALIDATION", message: "Add an escalation reason between 3 and 1,000 characters." },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates an open escalation through the authenticated client", async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: "escalation-1" }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn().mockResolvedValue({ data: "profile-1", error: null });
    const client = { rpc, from: vi.fn().mockReturnValue({ insert }) } as unknown as SupabaseClient;

    const result = await createLiveEscalation("issue-1", "Corporation follow-up is needed.", client);

    expect(result).toEqual({ ok: true, data: { id: "escalation-1" } });
    expect(rpc).toHaveBeenCalledWith("current_profile_id");
    expect(insert).toHaveBeenCalledWith({
      issue_id: "issue-1",
      escalated_by: "profile-1",
      reason: "Corporation follow-up is needed.",
      status: "open",
    });
  });
});
