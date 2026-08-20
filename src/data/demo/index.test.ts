import { describe, expect, it } from "vitest";
import { demoData, demoIssues, demoMunicipality, demoPublicProfiles, demoWards, getPublicDemoData, getWardBudget, getWardIssues } from "./index";

describe("Phusro demo data invariants", () => {
  it("has exactly 28 wards belonging to the municipality", () => {
    expect(demoMunicipality.wardCount).toBe(28);
    expect(demoWards).toHaveLength(28);
    expect(new Set(demoWards.map((ward) => ward.number)).size).toBe(28);
    expect(demoWards.every((ward) => ward.municipalityId === demoMunicipality.id)).toBe(true);
  });

  it("keeps budget arithmetic valid", () => {
    expect(demoWards.every((ward) => ward.spentBudget <= ward.allocatedBudget)).toBe(true);
    expect(getWardBudget(12)).toEqual({ allocated: 2420000, spent: 1487500, remaining: 932500 });
    expect(demoData.expenditures.every((item) => demoWards.some((ward) => ward.id === item.wardId))).toBe(true);
  });

  it("has safe issue media and mixed statuses/languages", () => {
    expect(demoIssues.length).toBeGreaterThanOrEqual(10);
    expect(new Set(demoIssues.map((item) => item.status))).toEqual(new Set(["requested", "in_progress", "completed"]));
    expect(new Set(demoIssues.map((item) => item.originalLanguage))).toEqual(new Set(["hi", "en"]));
    expect(demoIssues.every((item) => item.media.length <= 3)).toBe(true);
  });

  it("keeps private citizen data out of public selectors", () => {
    for (const ward of [7, 12, 18]) {
      expect(demoPublicProfiles.filter((profile) => profile.wardId === `ward-${ward}`)).toHaveLength(16);
      expect(demoData.privateCitizenProfiles.filter((profile) => demoPublicProfiles.find((publicProfile) => publicProfile.id === profile.profileId)?.wardId === `ward-${ward}`)).toHaveLength(16);
    }
    expect(getWardIssues(12)).toHaveLength(5);
    const publicData = getPublicDemoData() as Record<string, unknown>;
    expect(publicData).not.toHaveProperty("privateCitizenProfiles");
    expect(JSON.stringify(publicData)).not.toContain("00000000");
  });

  it("references valid wards and issues from escalations", () => {
    for (const escalation of demoData.escalations) {
      expect(demoWards.some((ward) => ward.id === escalation.wardId)).toBe(true);
      expect(demoIssues.some((issue) => issue.id === escalation.issueId && issue.wardId === escalation.wardId)).toBe(true);
    }
  });

  it("keeps every issue reporter in the issue ward", () => {
    for (const issue of demoIssues) {
      const reporter = demoPublicProfiles.find((profile) => profile.id === issue.reporterId);
      expect(reporter?.wardId).toBe(issue.wardId);
    }
  });
});
