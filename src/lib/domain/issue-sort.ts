import type { Issue } from "./types";

/**
 * Put the issues with the strongest community signal first. Newer reports
 * break ties so equally supported issues still feel current and predictable.
 */
export function compareIssuesBySupport(left: Issue, right: Issue): number {
  const supportDifference = right.upvotes - left.upvotes;
  if (supportDifference !== 0) return supportDifference;

  const createdDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (createdDifference !== 0) return createdDifference;

  return right.id.localeCompare(left.id);
}

export function sortIssuesBySupport(issues: Issue[]): Issue[] {
  return [...issues].sort(compareIssuesBySupport);
}
