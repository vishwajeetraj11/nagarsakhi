import { describe, expect, it } from "vitest";
import { demoIssues } from "@/data/demo";
import { sortIssuesBySupport } from "./issue-sort";

describe("sortIssuesBySupport", () => {
  it("orders by support, then newest report, without mutating the input", () => {
    const [first, second, third] = demoIssues;
    const issues = [
      { ...first, id: "low", upvotes: 1, createdAt: "2026-08-28T09:00:00Z" },
      { ...second, id: "high-older", upvotes: 5, createdAt: "2026-08-26T09:00:00Z" },
      { ...third, id: "high-newer", upvotes: 5, createdAt: "2026-08-27T09:00:00Z" },
    ];
    const original = [...issues];

    expect(sortIssuesBySupport(issues).map((issue) => issue.id)).toEqual(["high-newer", "high-older", "low"]);
    expect(issues).toEqual(original);
  });
});
