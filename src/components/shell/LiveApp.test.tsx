// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null },
  observe: vi.fn(),
  rpc: vi.fn(),
  load: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("firebase/auth", () => ({ onAuthStateChanged: mocks.observe }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/firebase", () => ({ getFirebaseAuth: () => mocks.auth }));
vi.mock("@/lib/supabase", () => ({ createFirebaseSupabaseClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/data/live", () => ({ loadLiveData: mocks.load, loadWardIssues: vi.fn() }));
vi.mock("@/components/shell/LiveLogin", () => ({ LiveLogin: () => <div>Sign in screen</div> }));
vi.mock("@/components/shell/LiveOnboarding", () => ({ LiveOnboarding: ({ onComplete }: { onComplete: () => void }) => <button onClick={onComplete}>Finish registration</button> }));
vi.mock("@/components/shell/AppShell", () => ({ AppShell: () => <div>Workspace ready</div> }));
vi.mock("@/features/admin", () => ({ CorporationExperience: () => null, ParshadExperience: () => null }));
vi.mock("@/features/citizen/CitizenExperience", () => ({ CitizenExperience: () => null }));
vi.mock("@/features/municipality/MunicipalityPage", () => ({ MunicipalityPage: () => null }));

import { LiveApp } from "./LiveApp";

const user = { uid: "resident-test", displayName: "Test resident", getIdToken: vi.fn() };
let notify: (value: typeof user | null) => Promise<void>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.observe.mockImplementation((_auth, callback) => { notify = callback; return vi.fn(); });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.load.mockResolvedValue({ ok: true, data: {}, session: { role: "citizen" } });
  user.getIdToken.mockResolvedValue("test-token");
});

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("session loading recovery", () => {
  it("opens sign-in for a fresh signed-out session without querying ward data", async () => {
    render(<LiveApp />);
    await act(() => notify(null));
    expect(screen.getByText("Sign in screen")).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(16000));
    expect(screen.getByText("Sign in screen")).toBeTruthy();
  });

  it("offers recovery when Firebase never resolves its initial session", async () => {
    render(<LiveApp />);
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(screen.getByText("Your sign-in session is taking too long to open.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.observe).toHaveBeenCalledTimes(2);
    await act(() => notify(null));
    expect(screen.getByText("Sign in screen")).toBeTruthy();
  });

  it("restarts the deadline after signing in from a signed-out session", async () => {
    mocks.rpc.mockReturnValue(new Promise(() => {}));
    render(<LiveApp />);
    await act(() => notify(null));
    act(() => { void notify(user); });
    await act(() => vi.advanceTimersByTimeAsync(15000));
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("does not let a stale profile response overwrite sign-out", async () => {
    let resolve!: (value: { data: boolean; error: null }) => void;
    mocks.rpc.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<LiveApp />);
    act(() => { void notify(user); });
    await act(() => notify(null));
    await act(async () => { resolve({ data: true, error: null }); });
    expect(screen.getByText("Sign in screen")).toBeTruthy();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("ignores responses that finish after their deadline", async () => {
    let resolve!: (value: { data: boolean; error: null }) => void;
    mocks.rpc.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<LiveApp />);
    act(() => { void notify(user); });
    await act(() => vi.advanceTimersByTimeAsync(15000));
    await act(async () => { resolve({ data: true, error: null }); });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("catches token refresh failures after onboarding", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    render(<LiveApp />);
    await act(() => notify(user));
    user.getIdToken.mockRejectedValueOnce(new Error("Connection unavailable"));
    fireEvent.click(screen.getByRole("button", { name: "Finish registration" }));
    await act(() => notify(user));
    expect(screen.getByText("Connection unavailable")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("keeps a loaded session across ordinary rerenders", async () => {
    const view = render(<LiveApp />);
    await act(() => notify(user));
    view.rerender(<LiveApp />);
    await act(() => vi.advanceTimersByTimeAsync(16000));
    expect(screen.getByText("Workspace ready")).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.observe).toHaveBeenCalledTimes(1);
  });
});
