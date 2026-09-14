import { describe, expect, it } from "vitest";
import {
  ingestionConformanceVectors,
  ingestionSubmissionExample,
} from "@rent-yield/listing-storage-contracts";
import { MemoryIngestion } from "./memory-ingestion.js";

describe("memory ingestion conformance", () => {
  it("replays an immutable receipt and rejects changed payloads under its source key", () => {
    const store = new MemoryIngestion();
    const first = store.ingest(ingestionSubmissionExample);
    expect(first).toMatchObject({ ok: true, receipt: { stage: "accepted" } });
    expect(store.ingest(ingestionSubmissionExample)).toEqual(first);
    expect(
      store.ingest({
        ...ingestionSubmissionExample,
        capture: {
          ...ingestionSubmissionExample.capture,
          response: {
            ...ingestionSubmissionExample.capture.response,
            body_sha256: "0".repeat(64),
          },
        },
      }),
    ).toEqual({ ok: false, error: { code: "idempotency_conflict" } });
  });

  it("runs the shared retry, conflict, and distinct-capture vectors", () => {
    const retry = new MemoryIngestion();
    const first = retry.ingest(ingestionConformanceVectors.exact_retry.first);
    expect(retry.ingest(ingestionConformanceVectors.exact_retry.retry)).toEqual(
      first,
    );

    const conflict = new MemoryIngestion();
    conflict.ingest(ingestionConformanceVectors.changed_payload.first);
    expect(
      conflict.ingest(ingestionConformanceVectors.changed_payload.retry),
    ).toEqual({ ok: false, error: { code: "idempotency_conflict" } });

    const distinct = new MemoryIngestion();
    const initial = distinct.ingest(
      ingestionConformanceVectors.distinct_capture_same_body.first,
    );
    const next = distinct.ingest(
      ingestionConformanceVectors.distinct_capture_same_body.second,
    );
    expect(initial).toMatchObject({ ok: true });
    expect(next).toMatchObject({
      ok: true,
      receipt: { capture_event_id: "synthetic-capture-2" },
    });
  });

  it("keeps distinct capture events when bytes match and exposes progress", () => {
    const store = new MemoryIngestion();
    const first = store.ingest(ingestionSubmissionExample);
    const second = store.ingest({
      ...ingestionSubmissionExample,
      idempotency_key: "synthetic-key-2",
      capture: {
        ...ingestionSubmissionExample.capture,
        capture_event_id: "synthetic-capture-2",
      },
    });
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({
      ok: true,
      receipt: { capture_event_id: "synthetic-capture-2" },
    });
    if (!first.ok) throw new Error("expected receipt");
    expect(store.progress(first.receipt.receipt_id)).toMatchObject({
      ok: true,
      progress: { stage: "accepted" },
    });
    expect(store.advance(first.receipt.receipt_id, "committed")).toEqual({
      ok: true,
    });
    expect(store.progress(first.receipt.receipt_id)).toMatchObject({
      ok: true,
      progress: { stage: "committed" },
    });
  });

  it("rejects capture-event reuse and preserves quarantined receipts", () => {
    const store = new MemoryIngestion();
    store.ingest(ingestionSubmissionExample);
    expect(
      store.ingest({
        ...ingestionSubmissionExample,
        idempotency_key: "new-key",
      }),
    ).toEqual({ ok: false, error: { code: "capture_event_conflict" } });
    expect(
      store.ingest({
        ...ingestionSubmissionExample,
        idempotency_key: "quarantine-key",
        capture: {
          ...ingestionSubmissionExample.capture,
          capture_event_id: "quarantine-capture",
        },
        interpretation: {
          ...ingestionSubmissionExample.interpretation,
          outcome_kind: "quarantined",
        },
      }),
    ).toMatchObject({ ok: true, receipt: { stage: "quarantined" } });
  });
});
