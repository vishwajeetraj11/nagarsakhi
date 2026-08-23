import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { deleteLiveIssue } from "./live-mutations";

type QueryResult = { data: unknown; error: { message: string } | null };

const profileId = "ba72ea6a-0c68-4238-b886-c38112fc53fa";
const issueId = "0fdb3e71-ff87-4dc5-be3a-9dfda83d3133";

function mutationClient(results: QueryResult[]) {
  const remaining = [...results];
  const consume = () => {
    const result = remaining.shift();
    if (!result) throw new Error("The mutation made an unexpected query.");
    return result;
  };

  const from = vi.fn(() => {
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.delete = vi.fn(() => builder);
    builder.eq = vi.fn(() => builder);
    builder.maybeSingle = vi.fn(async () => consume());
    builder.then = (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(consume()).then(resolve, reject);
    return builder;
  });

  return {
    client: {
      rpc: vi.fn(async () => ({ data: profileId, error: null })),
      from,
    } as unknown as SupabaseClient,
    from,
  };
}

describe("deleteLiveIssue", () => {
  it("treats an already-absent report as an idempotent success", async () => {
    const { client, from } = mutationClient([{ data: null, error: null }]);

    await expect(deleteLiveIssue(issueId, client)).resolves.toEqual({ ok: true, data: undefined });
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("verifies that the row disappeared instead of requiring a DELETE representation", async () => {
    const { client } = mutationClient([
      { data: { id: issueId, reporter_id: profileId, status: "requested" }, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
    ]);

    await expect(deleteLiveIssue(issueId, client)).resolves.toEqual({ ok: true, data: undefined });
  });

  it("distinguishes a missing live delete policy from an ownership failure", async () => {
    const { client } = mutationClient([
      { data: { id: issueId, reporter_id: profileId, status: "requested" }, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: { id: issueId }, error: null },
    ]);

    await expect(deleteLiveIssue(issueId, client)).resolves.toMatchObject({
      ok: false,
      error: { message: "Your report is eligible for deletion, but the live database permission is not active yet." },
    });
  });
});
