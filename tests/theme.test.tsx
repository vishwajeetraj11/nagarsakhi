import React from "react";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/overview", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.query),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { AppShell } from "@/components/shell/AppShell";
import { getPublicDemoData } from "@/data/demo";
import { CorporationExperience, ParshadExperience } from "@/features/admin";
import adminStyles from "@/features/admin/adminStyles";
import { CitizenExperience } from "@/features/citizen/CitizenExperience";
import citizenStyles from "@/features/citizen/citizenStyles";
import { MunicipalityPage } from "@/features/municipality/MunicipalityPage";
import type { DemoSession } from "@/lib/domain/types";

const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");
const palette = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [match[1], match[2]]));
const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const values = [luminance(palette[a]), luminance(palette[b])].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe("shared civic theme", () => {
  it("does not let workspaces override the palette or reintroduce heavy type", () => {
    for (const styles of [adminStyles, citizenStyles]) {
      const classes = Object.values(styles).join(" ");
      expect(classes).not.toMatch(/\[--(?:paper|ink|indigo|green|line|rule):/);
      expect(classes).not.toMatch(/oklch\(\d/);
      expect(classes).not.toMatch(/font-(?:bold|black|extrabold)/);
    }
    const loginCss = readFileSync(path.resolve("src/components/shell/LiveLogin.module.css"), "utf8");
    expect(loginCss).not.toMatch(/#[\da-f]{3,8}\b/i);
    expect(loginCss).toContain("font-family: var(--font-display)");
  });

  it.each([
    ["ink", "paper"], ["ink-soft", "paper"], ["ink-faint", "paper"],
    ["ink", "surface"], ["green", "green-soft"], ["danger", "danger-soft"],
    ["warning-ink", "marigold-soft"], ["surface", "ink"],
  ])("keeps %s readable on %s", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps form boundaries distinguishable", () => {
    expect(contrast("line-strong", "surface")).toBeGreaterThanOrEqual(3);
  });
});

describe("themed workspace render coverage", () => {
  const data = getPublicDemoData();
  const base: DemoSession = { profileId: "citizen-1", name: "Theme preview", role: "citizen", wardId: "ward-7", municipalityId: data.municipality.id };
  const cases = [
    { name: "municipality", pathname: "/municipality/phusro", role: "corporation_admin", query: "" },
    { name: "citizen", pathname: "/overview", role: "citizen", query: "" },
    { name: "report", pathname: "/report", role: "citizen", query: "" },
    { name: "parshad", pathname: "/parshad", role: "parshad", query: "" },
    { name: "corporation", pathname: "/overview", role: "corporation_admin", query: "" },
    { name: "ward-review", pathname: "/wards", role: "corporation_admin", query: "ward=ward-7" },
  ] as const;

  it.each(cases)("renders $name with public synthetic data", ({ name, pathname, role, query }) => {
    route.pathname = pathname;
    route.query = query;
    const session = { ...base, role };
    const page = name === "municipality" ? <MunicipalityPage data={data} session={session} />
      : role === "corporation_admin" ? <CorporationExperience data={data} dataMode="demo" session={session} />
      : role === "parshad" ? <ParshadExperience data={data} dataMode="demo" session={session} />
      : <CitizenExperience data={data} dataMode="demo" session={session} />;
    const markup = renderToStaticMarkup(<AppShell dataMode="demo" session={session}>{page}</AppShell>);
    expect(markup).toContain("NagarSakhi");
    expect(markup).toContain('id="main-content"');
    expect(markup).not.toContain("--paper:oklch");

    // Optional local visual fixtures; never mounted as an unauthenticated app route.
    const outputDirectory = process.env.NAGARSAKHI_THEME_PREVIEW_DIR;
    if (outputDirectory) writeFileSync(path.join(outputDirectory, `${name}.html`), markup);
  });
});
