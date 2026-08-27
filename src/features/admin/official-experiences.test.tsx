// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const route = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(route.query),
}));

import { getPublicDemoData } from "@/data/demo";
import { CorporationExperience } from "./official-experiences";
import styles from "./adminStyles";

const data = getPublicDemoData();
const overview = () => screen.getByRole("main", { name: "Nagar Parishad administration workspace" });
const review = (number: number) => screen.getByRole("main", { name: `Nagar Parishad review for Ward ${String(number).padStart(2, "0")}` });
const page = <CorporationExperience data={data} dataMode="demo" />;

beforeEach(() => {
  route.query = "";
  window.history.replaceState(null, "", "/overview");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("corporation ward URL state", () => {
  it.each(data.wards)("opens Ward $number from a direct URL", (ward) => {
    route.query = `ward=${ward.id}`;
    render(page);
    expect(review(ward.number)).toBeTruthy();
  });

  it.each(["7", "12"])("keeps numeric ward bookmarks working: %s", (number) => {
    route.query = `ward=${number}`;
    render(page);
    expect(review(Number(number))).toBeTruthy();
  });

  it.each(["", "ward=", "ward=unknown", "ward=999"])("handles a missing or invalid ward safely: %s", (query) => {
    route.query = query;
    render(page);
    expect(overview()).toBeTruthy();
  });

  it("changes reviews and exits when URL parameters change without remounting", () => {
    route.query = "ward=ward-7";
    const { rerender } = render(page);
    expect(review(7)).toBeTruthy();
    route.query = "ward=ward-12";
    rerender(<CorporationExperience data={data} dataMode="demo" />);
    expect(review(12)).toBeTruthy();
    route.query = "";
    rerender(<CorporationExperience data={data} dataMode="demo" />);
    expect(overview()).toBeTruthy();
  });

  it("writes canonical URLs and follows browser Back/Forward without losing notice drafts", async () => {
    const { rerender } = render(page);
    // Next updates useSearchParams after native history navigation. Mirror that
    // subscription explicitly here; real Next integration is checked in Chrome.
    const syncFromUrl = () => {
      route.query = window.location.search;
      rerender(<CorporationExperience data={data} dataMode="demo" />);
    };
    fireEvent.change(screen.getByLabelText(/Title/), { target: { value: "Unpublished title" } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: "Unpublished description" } });
    fireEvent.change(screen.getByLabelText("Ward number"), { target: { value: "ward-7" } });
    expect(window.location.pathname + window.location.search).toBe("/wards?ward=ward-7");
    syncFromUrl();
    expect(review(7)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Nagar Parishad overview" }));
    expect(window.location.pathname + window.location.search).toBe("/overview");
    syncFromUrl();
    expect((screen.getByLabelText(/Title/) as HTMLInputElement).value).toBe("Unpublished title");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe("Unpublished description");

    for (const direction of ["back", "forward"] as const) {
      await act(async () => {
        await new Promise<void>((resolve) => {
          window.addEventListener("popstate", () => { syncFromUrl(); resolve(); }, { once: true });
          window.history[direction]();
        });
      });
      if (direction === "back") expect(review(7)).toBeTruthy();
      else expect(overview()).toBeTruthy();
    }
  });

  it("opens an escalation's exact ward URL", () => {
    render(page);
    const row = screen.getByText(data.escalations[0].issueTitle).closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: /Open ward/ }));
    expect(window.location.pathname + window.location.search).toBe(`/wards?ward=${data.escalations[0].wardId}`);
  });

  it("renders the same review after remounting from the selected URL", () => {
    const first = render(page);
    fireEvent.change(screen.getByLabelText("Ward number"), { target: { value: "ward-12" } });
    route.query = window.location.search;
    first.unmount();
    render(page);
    expect(review(12)).toBeTruthy();
  });
});

describe("complete ward reports", () => {
  const statuses = ["requested", "in_progress", "completed"] as const;
  const issues = statuses.map((status, index) => ({
    ...data.issues[0], id: `long-report-${index}`, wardId: "ward-7", status,
    title: `${status}: ${"A long location and report title ".repeat(8)}`,
    description: `${"पूरा विवरण — report details. ".repeat(30)}\nExact location: ${"X".repeat(200)}`,
  }));

  it.each(["Requested", "In progress", "Fixed"])("exposes the complete %s report through a native disclosure", (label) => {
    route.query = "ward=ward-7";
    render(<CorporationExperience data={{ ...data, issues }} dataMode="demo" />);
    const index = ["Requested", "In progress", "Fixed"].indexOf(label);
    const section = screen.getByRole("region", { name: `${label} issues` });
    expect(within(section).getByText(issues[index].title.trim())).toBeTruthy();
    const summary = within(section).getByText("Read full report");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("p")?.textContent).toBe(issues[index].description);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("does not clamp full titles or descriptions and wraps long unbroken text", () => {
    expect(styles.drillIssueSection).not.toContain("line-clamp");
    expect(styles.drillIssueSection).toContain("[overflow-wrap:anywhere]");
    expect(styles.drillIssueSection).toContain("whitespace-pre-wrap");
  });
});
