// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ pathname: "/overview", query: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(route.query),
}));

import { getPublicDemoData } from "@/data/demo";
import type { DemoSession, Official } from "@/lib/domain/types";
import { CitizenExperience } from "./CitizenExperience";

const demo = getPublicDemoData();
const officials: Official[] = demo.wards.map((ward) => ({
  id: `representative-${ward.number}`,
  municipalityId: demo.municipality.id,
  wardId: ward.id,
  name: `Representative ${ward.number}`,
  roleLabel: "Ward Parshad",
  current: true,
}));
const data = { ...demo, officials };
const corporation: DemoSession = {
  profileId: "test-official", name: "Test official", role: "corporation_admin",
  wardId: null, municipalityId: data.municipality.id,
};
const resident: DemoSession = { ...corporation, role: "citizen", wardId: "ward-12" };
const wardHeading = (number: number) => {
  const ward = data.wards.find((item) => item.number === number)!;
  return `Ward ${String(number).padStart(2, "0")} / ${ward.name}`;
};

beforeEach(() => { route.pathname = "/overview"; route.query = ""; });
afterEach(cleanup);

describe("representative profile ward context", () => {
  it.each(data.wards)("uses Ward $number on direct profile loads", (ward) => {
    route.pathname = `/officials/representative-${ward.number}`;
    render(<CitizenExperience data={data} dataMode="demo" session={corporation} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(ward.number));
  });

  it("updates the header when switching profiles without remounting", () => {
    route.pathname = "/officials/representative-1";
    const { rerender } = render(<CitizenExperience data={data} dataMode="demo" session={corporation} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(1));
    route.pathname = "/officials/representative-7";
    rerender(<CitizenExperience data={data} dataMode="demo" session={corporation} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(7));
  });

  it.each(["citizen", "parshad"] as const)("ignores the %s's own ward and stale query on a profile", (role) => {
    route.pathname = "/officials/representative-1";
    route.query = "ward=ward-18";
    render(<CitizenExperience data={data} dataMode="demo" session={{ ...resident, role }} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(1));
  });

  it("preserves the resident's ward when leaving a profile", () => {
    const { rerender } = render(<CitizenExperience data={data} dataMode="demo" session={resident} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(12));
    route.pathname = "/officials/representative-1";
    rerender(<CitizenExperience data={data} dataMode="demo" session={resident} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(1));
    route.pathname = "/overview";
    rerender(<CitizenExperience data={data} dataMode="demo" session={resident} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(12));
    expect(screen.getByRole("button", { name: "Report" })).toBeTruthy();
  });

  it("does not repeat generated ward labels as localities", () => {
    route.pathname = "/officials/representative-1";
    const numericNames = { ...data, wards: data.wards.map((ward) => ({ ...ward, name: `Ward ${String(ward.number).padStart(2, "0")}` })) };
    render(<CitizenExperience data={numericNames} dataMode="demo" session={corporation} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Ward 01");
  });

  it("uses municipality context for an unknown representative", () => {
    route.pathname = "/officials/missing";
    render(<CitizenExperience data={data} dataMode="demo" session={corporation} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(data.municipality.name);
    expect(screen.getByText("We couldn’t find that representative.")).toBeTruthy();
  });

  it.each([null, "missing-ward"])("uses municipality context when the profile ward is %s", (wardId) => {
    route.pathname = "/officials/municipal-official";
    const municipalData = { ...data, officials: [{ ...officials[0], id: "municipal-official", wardId, roleLabel: "Executive Officer" }] };
    render(<CitizenExperience data={municipalData} dataMode="demo" session={corporation} readOnly />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(data.municipality.name);
  });

  it("keeps the selected ward on the legacy Parshad profile route", () => {
    route.pathname = "/parshad";
    render(<CitizenExperience data={data} dataMode="demo" session={resident} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(wardHeading(12));
  });
});
