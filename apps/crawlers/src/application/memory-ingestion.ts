import {
  ingestionReceiptSchema,
  ingestionSubmissionDigest,
  ingestionSubmissionSchema,
  receiptProgressSchema,
  type IngestionReceiptV1,
  type ReceiptProgressV1,
} from "@rent-yield/listing-storage-contracts";

type Stored = {
  receipt: IngestionReceiptV1;
  digest: string;
  progress: ReceiptProgressV1;
};

export class MemoryIngestion {
  readonly #byKey = new Map<string, Stored>();
  readonly #byReceipt = new Map<string, Stored>();
  readonly #captureKeys = new Map<string, string>();
  #nextReceipt = 0;

  ingest(
    input: unknown,
  ):
    | { ok: true; receipt: IngestionReceiptV1 }
    | {
        ok: false;
        error: {
          code:
            "invalid_input" | "idempotency_conflict" | "capture_event_conflict";
        };
      } {
    const parsed = ingestionSubmissionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: { code: "invalid_input" } };
    const submission = parsed.data;
    const key = `${submission.source_key}:${submission.idempotency_key}`;
    const digest = ingestionSubmissionDigest(submission);
    const existing = this.#byKey.get(key);
    if (existing)
      return existing.digest === digest
        ? { ok: true, receipt: structuredClone(existing.receipt) }
        : { ok: false, error: { code: "idempotency_conflict" } };
    const captureKey = `${submission.source_key}:${submission.capture.capture_event_id}`;
    if (this.#captureKeys.has(captureKey))
      return { ok: false, error: { code: "capture_event_conflict" } };
    const stage =
      submission.interpretation.outcome_kind === "quarantined"
        ? "quarantined"
        : "accepted";
    const receipt = ingestionReceiptSchema.parse({
      contract_version: "v1",
      receipt_id: `receipt-${++this.#nextReceipt}`,
      source_key: submission.source_key,
      capture_event_id: submission.capture.capture_event_id,
      idempotency_key: submission.idempotency_key,
      submission_hash: digest,
      stage,
    });
    const progress = receiptProgressSchema.parse({
      contract_version: "v1",
      receipt_id: receipt.receipt_id,
      stage,
      recorded_at: submission.capture.collected_at,
      failure: null,
    });
    const stored = { receipt, digest, progress };
    this.#byKey.set(key, stored);
    this.#byReceipt.set(receipt.receipt_id, stored);
    this.#captureKeys.set(captureKey, receipt.receipt_id);
    return { ok: true, receipt: structuredClone(receipt) };
  }

  progress(
    receiptId: string,
  ):
    | { ok: true; progress: ReceiptProgressV1 }
    | { ok: false; error: { code: "not_found" } } {
    const stored = this.#byReceipt.get(receiptId);
    return stored
      ? { ok: true, progress: structuredClone(stored.progress) }
      : { ok: false, error: { code: "not_found" } };
  }

  advance(
    receiptId: string,
    stage: "committed" | "quarantined",
  ): { ok: true } | { ok: false; error: { code: "not_found" } } {
    const stored = this.#byReceipt.get(receiptId);
    if (!stored) return { ok: false, error: { code: "not_found" } };
    stored.progress = { ...stored.progress, stage };
    return { ok: true };
  }
}
