// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getPublicDemoData } from "@/data/demo";
import type { DemoSession } from "@/lib/domain/types";
import { MunicipalityPage } from "./MunicipalityPage";

const data = getPublicDemoData();
const session: DemoSession = { profileId: "test", name: "Test official", role: "corporation_admin", wardId: null, municipalityId: data.municipality.id };
afterEach(cleanup);

describe("municipal ward finder", () => {
  it.each(["7", "07", "Ward 7", " ward 07 ", "MEENA"])("finds the correct ward for %s", (query) => {
    render(<MunicipalityPage data={data} session={session} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: query } });
    expect(screen.getAllByRole("link", { name: "Open ward" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open ward" })).toHaveAttribute("href", "/wards?ward=ward-7");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 28 wards match");
  });

  it("matches locality and handles empty results with clear recovery", () => {
    const customData = { ...data, wards: data.wards.map((ward) => ward.number === 7 ? { ...ward, name: "शिव मंदिर" } : ward) };
    render(<MunicipalityPage data={customData} session={session} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "शिव" } });
    expect(screen.getAllByRole("link", { name: "Open ward" })).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "No such ward" } });
    expect(screen.queryByRole("link", { name: "Open ward" })).toBeNull();
    expect(screen.getByText(/No wards found/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getAllByRole("link", { name: "Open ward" })).toHaveLength(28);
  });

  it.each(["citizen", "parshad", "corporation_admin"] as const)("only offers the appropriate desk for %s", (role) => {
    render(<MunicipalityPage data={data} session={{ ...session, role }} />);
    expect(screen.queryByRole("link", { name: /Administration desk/ }) !== null).toBe(role === "corporation_admin");
    expect(screen.queryByRole("link", { name: /Parshad desk/ }) !== null).toBe(role === "parshad");
    if (role === "citizen") {
      expect(screen.getByRole("link", { name: "Go to your ward" })).toHaveAttribute("href", "/wards");
    } else {
      expect(screen.queryByRole("link", { name: "Find a ward" })).toBeNull();
    }
    expect(screen.queryByRole("link", { name: "Municipality details" })).toBeNull();
    if (role === "citizen") expect(screen.queryByRole("heading", { name: "Municipality details" })).toBeNull();
  });

  it.each(["parshad", "corporation_admin"] as const)("places municipality details before ward representatives for %s", (role) => {
    render(<MunicipalityPage data={data} session={{ ...session, role }} />);
    const details = screen.getByRole("heading", { name: "Municipality details" });
    const representatives = screen.getByRole("heading", { name: "Ward representatives" });

    expect(details.compareDocumentPosition(representatives) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sends citizens to the ward overview even when a ward is set", () => {
    render(<MunicipalityPage data={data} session={{ ...session, role: "citizen", wardId: "ward-8" }} />);

    expect(screen.getByRole("link", { name: "Go to your ward" })).toHaveAttribute("href", "/wards");
  });
});
