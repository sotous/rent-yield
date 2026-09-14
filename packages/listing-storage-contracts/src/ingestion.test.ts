import { describe, expect, it } from "vitest";
import {
  ingestionSubmissionDigest,
  ingestionSubmissionExample,
  ingestionSubmissionSchema,
} from "./ingestion.js";

describe("ingestion contracts", () => {
  it("excludes the idempotency key from immutable submission identity", () => {
    expect(
      ingestionSubmissionSchema.safeParse(ingestionSubmissionExample).success,
    ).toBe(true);
    expect(
      ingestionSubmissionDigest({
        ...ingestionSubmissionExample,
        idempotency_key: "retry-key",
      }),
    ).toBe(ingestionSubmissionDigest(ingestionSubmissionExample));
  });

  it("includes capture-event and body identity in the submission digest", () => {
    expect(
      ingestionSubmissionDigest({
        ...ingestionSubmissionExample,
        capture: {
          ...ingestionSubmissionExample.capture,
          capture_event_id: "capture-2",
        },
      }),
    ).not.toBe(ingestionSubmissionDigest(ingestionSubmissionExample));
  });
});
