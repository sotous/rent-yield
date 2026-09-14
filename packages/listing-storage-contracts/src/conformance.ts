import { ingestionSubmissionExample } from "./ingestion.js";

/** Provider-neutral fixture vectors. Providers must preserve these outcomes. */
export const ingestionConformanceVectors = {
  exact_retry: {
    first: ingestionSubmissionExample,
    retry: ingestionSubmissionExample,
    expected: "same_receipt",
  },
  changed_payload: {
    first: ingestionSubmissionExample,
    retry: {
      ...ingestionSubmissionExample,
      capture: {
        ...ingestionSubmissionExample.capture,
        response: {
          ...ingestionSubmissionExample.capture.response,
          body_sha256: "0".repeat(64),
        },
      },
    },
    expected: "idempotency_conflict",
  },
  distinct_capture_same_body: {
    first: ingestionSubmissionExample,
    second: {
      ...ingestionSubmissionExample,
      idempotency_key: "synthetic-key-2",
      capture: {
        ...ingestionSubmissionExample.capture,
        capture_event_id: "synthetic-capture-2",
      },
    },
    expected: "distinct_receipt",
  },
} as const;
