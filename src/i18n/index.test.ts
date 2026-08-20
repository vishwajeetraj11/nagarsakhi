import { describe, expect, it } from "vitest";
import { dictionaries, getRoleLabel, getStatusLabel, t } from "./index";

describe("bilingual civic copy", () => {
  it("keeps both dictionaries aligned and translates every issue status", () => {
    expect(Object.keys(dictionaries.en).sort()).toEqual(Object.keys(dictionaries.hi).sort());
    expect(getStatusLabel("requested", "hi")).toBe("अनुरोध प्राप्त");
    expect(getStatusLabel("in_progress", "hi")).toBe("काम जारी है");
    expect(getStatusLabel("completed", "hi")).toBe("काम पूरा");
  });

  it("provides role labels and English fallback", () => {
    expect(getRoleLabel("parshad", "hi")).toBe("वार्ड पार्षद");
    expect(t("networkError", "en")).toContain("connect");
  });
});
