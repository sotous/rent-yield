import { describe, expect, it } from "vitest";
import {
  acceptedReceiptV2Schema,
  acceptedSubmissionDigestV2,
  durableSubmissionV2ErrorSchema,
  durableSubmissionV2Schema,
  receiptProgressV2Schema,
} from "./durable-submission-v2.js";
import {
  acceptedReceiptV2Vector,
  acceptedSubmissionDigestV2Vectors,
  durableSubmissionV2ArtifactVectors,
  durableSubmissionV2IdempotencyVectors,
  durableSubmissionV2OutcomeReferenceVector,
  durableSubmissionV2RejectedReferenceVectors,
  durableSubmissionV2SanitizedErrorVectors,
  receiptProgressV2Vectors,
} from "./durable-submission-v2.vectors.js";

describe("DurableSubmissionV2 canonical vectors", () => {
  it("accepts every artifact disposition and an immutable outcome reference", () => {
    for (const vector of durableSubmissionV2ArtifactVectors)
      expect(durableSubmissionV2Schema.safeParse(vector).success).toBe(true);
    expect(durableSubmissionV2Schema.safeParse(durableSubmissionV2OutcomeReferenceVector).success).toBe(true);
  });

  it("keeps replay scoped by source and provides valid conflict inputs", () => {
    const vectors = durableSubmissionV2IdempotencyVectors;
    for (const vector of Object.values(vectors))
      expect(durableSubmissionV2Schema.safeParse(vector).success).toBe(true);
    expect(vectors.exact_replay.submission_id).toBe(vectors.same_submission_id_other_source.submission_id);
    expect(vectors.exact_replay.source_key).not.toBe(vectors.same_submission_id_other_source.source_key);
    expect(vectors.exact_replay.capture.capture_event_id).not.toBe(vectors.capture_event_conflict.capture.capture_event_id);
    expect(vectors.exact_replay.interpretation).not.toEqual(vectors.interpretation_conflict.interpretation);
  });

  it("rejects external or mismatched immutable references", () => {
    for (const vector of durableSubmissionV2RejectedReferenceVectors)
      expect(durableSubmissionV2Schema.safeParse(vector).success).toBe(false);
  });

  it("parses immutable accepted receipts, ordered progress, and sanitized errors", () => {
    expect(acceptedReceiptV2Schema.safeParse(acceptedReceiptV2Vector).success).toBe(true);
    for (const vector of receiptProgressV2Vectors)
      expect(receiptProgressV2Schema.safeParse(vector).success).toBe(true);
    expect(receiptProgressV2Vectors[1]!.sequence).toBeGreaterThan(receiptProgressV2Vectors[0]!.sequence);
    for (const vector of durableSubmissionV2SanitizedErrorVectors)
      expect(durableSubmissionV2ErrorSchema.safeParse(vector).success).toBe(true);
    expect(durableSubmissionV2ErrorSchema.safeParse({ code: "submission_conflict", body: "raw body" }).success).toBe(false);
  });

  it("makes accepted-submission hash inclusions and exclusions explicit", () => {
    const vectors = acceptedSubmissionDigestV2Vectors;
    const baseline = acceptedSubmissionDigestV2(vectors.baseline);
    expect(acceptedSubmissionDigestV2(vectors.excluded_submission_id)).toBe(baseline);
    expect(acceptedSubmissionDigestV2(vectors.excluded_submitted_at)).toBe(baseline);
    for (const vector of [vectors.included_capture, vectors.included_typed_outcome, vectors.included_provenance, vectors.included_interpretation])
      expect(acceptedSubmissionDigestV2(vector)).not.toBe(baseline);
  });
});
