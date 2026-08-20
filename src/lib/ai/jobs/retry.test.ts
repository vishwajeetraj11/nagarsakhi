import { describe, expect, it } from "vitest";

import { nextRetryAt, retryDelayMs, shouldRetry } from "./retry";

describe("AI job retry policy", () => {
  it("uses capped exponential retry delays", () => {
    expect(retryDelayMs(1)).toBe(5_000);
    expect(retryDelayMs(2)).toBe(10_000);
    expect(retryDelayMs(10)).toBe(15 * 60 * 1_000);
  });

  it("does not schedule retry after the final attempt", () => {
    expect(nextRetryAt(10, new Date("2026-01-01T00:00:00.000Z"))).toBeNull();
    expect(shouldRetry({ retryable: true }, 9)).toBe(true);
    expect(shouldRetry({ retryable: true }, 10)).toBe(false);
    expect(shouldRetry({ retryable: false }, 1)).toBe(false);
  });
});
