// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/data/live-mutations", () => ({
  publishLiveNotice: vi.fn(), transitionLiveEscalation: vi.fn(),
  createLiveEscalation: vi.fn(), rejectLiveIssue: vi.fn(), transitionLiveIssue: vi.fn(),
}));

import { getPublicDemoData } from "@/data/demo";
import { publishLiveNotice, transitionLiveEscalation, type LiveMutationResult } from "@/lib/data/live-mutations";
import { CorporationExperience, ParshadExperience } from "./official-experiences";

const data = getPublicDemoData();
const failed = { ok: false, error: { code: "REQUEST_FAILED", message: "Connection failed. Try again." } } as const;
const success = { ok: true, data: { id: "published-test-notice" } } as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => { vi.resetAllMocks(); });
afterEach(cleanup);

describe.each(["corporation", "parshad"] as const)("%s notice publication", (role) => {
  function setup() {
    render(role === "corporation" ? <CorporationExperience data={data} dataMode="supabase" /> : <ParshadExperience data={data} dataMode="supabase" />);
    const region = screen.getByRole("region", { name: role === "corporation" ? "Publish a Nagar Parishad notice" : "Post a ward notice" });
    if (role === "corporation") fireEvent.change(within(region).getByLabelText(/Title/), { target: { value: "Road maintenance" } });
    const input = within(region).getByLabelText(role === "corporation" ? /Description/ : /Notice text/);
    fireEvent.change(input, { target: { value: "Work begins tomorrow morning." } });
    return { region, input, form: region.querySelector("form")! };
  }

  it("blocks duplicate requests, exposes pending state, and adds one confirmed notice", async () => {
    const request = deferred<LiveMutationResult<{ id: string }>>();
    vi.mocked(publishLiveNotice).mockReturnValue(request.promise);
    const { region, input, form } = setup();
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(publishLiveNotice).toHaveBeenCalledTimes(1);
    expect(within(region).getByRole("button", { name: "Publishing…" })).toBeDisabled();
    expect(input).toBeDisabled();
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(within(region).getByRole("status")).toHaveTextContent("Publishing notice");
    expect(region.querySelectorAll("ol li")).toHaveLength(data.notices.filter((notice) => role === "corporation" ? notice.wardId === null : notice.wardId === "ward-12").length);
    await act(async () => { request.resolve(success); });
    expect(input).toHaveValue("");
    expect(input).not.toBeDisabled();
    expect(within(region).getAllByText(/Work begins tomorrow morning/)).toHaveLength(1);
    expect(within(region).getByRole("status")).toHaveTextContent(/published/i);
    expect(form).toHaveAttribute("aria-busy", "false");
  });

  it.each(["result", "exception"])("preserves the draft and supports retry after a failed %s", async (kind) => {
    if (kind === "result") vi.mocked(publishLiveNotice).mockResolvedValueOnce(failed);
    else vi.mocked(publishLiveNotice).mockRejectedValueOnce(new Error("Connection failed. Try again."));
    const { region, input, form } = setup();
    await act(async () => { fireEvent.submit(form); });
    expect(within(region).getByRole("alert")).toHaveTextContent("Connection failed. Try again.");
    expect(input).toHaveValue("Work begins tomorrow morning.");
    expect(input).not.toBeDisabled();
    if (role === "corporation") expect(within(region).getByLabelText(/Title/)).toHaveValue("Road maintenance");
    vi.mocked(publishLiveNotice).mockResolvedValueOnce(success);
    await act(async () => { fireEvent.submit(form); });
    expect(publishLiveNotice).toHaveBeenCalledTimes(2);
    expect(within(region).queryByRole("alert")).toBeNull();
    expect(within(region).getAllByText(/Work begins tomorrow morning/)).toHaveLength(1);
  });
});

describe("escalation actions", () => {
  function setup(status: "open" | "acknowledged" | "resolved" = "open") {
    const escalation = { ...data.escalations[0], status };
    render(<CorporationExperience data={{ ...data, escalations: [escalation] }} dataMode="supabase" />);
    const row = screen.getByText(escalation.issueTitle).closest("tr")!;
    return { escalation, row };
  }

  it.each(["open", "acknowledged", "resolved"] as const)("offers only the permitted next action for %s", (status) => {
    const { row } = setup(status);
    expect(within(row).queryByRole("combobox")).toBeNull();
    const actions = within(row).getAllByRole("button").filter((button) => !button.textContent?.includes("Open ward"));
    expect(actions).toHaveLength(status === "resolved" ? 0 : 1);
    if (status === "open") expect(actions[0]).toHaveTextContent("Acknowledge");
    if (status === "acknowledged") {
      expect(actions[0]).toHaveTextContent("Mark resolved");
      expect(actions[0]).toHaveAccessibleDescription(/Resolution is final/);
    }
    expect(transitionLiveEscalation).not.toHaveBeenCalled();
  });

  it("keeps the confirmed status while saving and prevents duplicate transitions", async () => {
    const request = deferred<LiveMutationResult<"acknowledged" | "resolved">>();
    vi.mocked(transitionLiveEscalation).mockReturnValue(request.promise);
    const { row, escalation } = setup();
    const button = within(row).getByRole("button", { name: /^Acknowledge:/ });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(transitionLiveEscalation).toHaveBeenCalledExactlyOnceWith(escalation.id, "acknowledged");
    expect(button).toBeDisabled();
    expect(within(row).getByText("Open / खुला")).toBeVisible();
    expect(within(row).getByRole("status")).toHaveTextContent("Saving status");
    await act(async () => { request.resolve({ ok: true, data: "acknowledged" }); });
    expect(within(row).getByText("Acknowledged / संज्ञान में")).toBeVisible();
    expect(within(row).getByRole("status")).toHaveTextContent("Saved to the audit trail");
    expect(within(row).getByRole("button", { name: /^Mark resolved:/ })).toBeEnabled();
  });

  it.each(["result", "exception"])("reports a failed %s beside the action and allows retry without changing status", async (kind) => {
    if (kind === "result") vi.mocked(transitionLiveEscalation).mockResolvedValueOnce(failed);
    else vi.mocked(transitionLiveEscalation).mockRejectedValueOnce(new Error("Connection failed. Try again."));
    const { row } = setup("acknowledged");
    await act(async () => { fireEvent.click(within(row).getByRole("button", { name: /^Mark resolved:/ })); });
    expect(within(row).getByRole("alert")).toHaveTextContent("Connection failed. Try again.");
    expect(within(row).getByText("Acknowledged / संज्ञान में")).toBeVisible();
    vi.mocked(transitionLiveEscalation).mockResolvedValueOnce({ ok: true, data: "resolved" });
    await act(async () => { fireEvent.click(within(row).getByRole("button", { name: /^Mark resolved:/ })); });
    expect(transitionLiveEscalation).toHaveBeenCalledTimes(2);
    expect(within(row).getByText("Resolved / समाधान")).toBeVisible();
    expect(within(row).queryByRole("alert")).toBeNull();
    expect(within(row).queryByRole("button", { name: /^Mark resolved:/ })).toBeNull();
  });

  it("keeps each field's value and supporting text in one container", () => {
    const { row } = setup();
    for (const label of ["Parshad", "Issue", "Requested"]) {
      const cell = row.querySelector(`[data-label="${label}"]`)!;
      expect(cell.children).toHaveLength(1);
      expect(cell.firstElementChild?.querySelector("b")).not.toBeNull();
      expect(cell.firstElementChild?.querySelector("span")).not.toBeNull();
    }
  });
});

it("provides dashboard shortcuts with existing targets", () => {
  render(<CorporationExperience data={data} dataMode="demo" />);
  for (const link of within(screen.getByRole("navigation", { name: "Dashboard sections" })).getAllByRole("link")) {
    expect(document.querySelector(link.getAttribute("href")!)).not.toBeNull();
  }
});
