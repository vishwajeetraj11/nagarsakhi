import { describe, expect, it } from "vitest";

import { parseAiJobRecord, toAiJobRecord } from "./record";

const databaseJob = {
  id: "7d9a42bb-9a96-4c80-b0ae-9b2d9215f5ad",
  municipality_id: "e4d9572f-266f-43a5-ad99-1d55fdf245a0",
  created_by: "c74f74d4-9b5c-4a57-bc4e-4df8d59114bf",
  issue_id: "37d4f36f-9bf0-47bb-ae46-2ea938a4fd55",
  job_type: "summarization" as const,
  status: "queued" as const,
  attempt_count: 0,
  idempotency_key: "report-summary:37d4f36f-9bf0-47bb-ae46-2ea938a4fd55",
  input: { text: "A streetlight is not working." },
  result: null,
  provider_request_id: null,
  last_error: null,
  next_retry_at: null,
  created_at: "2026-08-28T12:00:00.000Z",
  updated_at: "2026-08-28T12:00:00.000Z",
  completed_at: null,
};

describe("parseAiJobRecord", () => {
  it("accepts the public camelCase contract returned by the job-status API", () => {
    const publicJob = toAiJobRecord(databaseJob);

    expect(parseAiJobRecord(publicJob)).toEqual(publicJob);
  });

  it("continues to accept snake_case Realtime records", () => {
    expect(parseAiJobRecord(databaseJob)).toEqual(toAiJobRecord(databaseJob));
  });
});
