import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  acceptedSubmissionDigestV2,
  canonicalOutcomeDigestV2,
  durableSubmissionV2Schema,
  MAX_INLINE_REDACTED_BYTES_V2,
  type DurableSubmissionV2,
} from "./durable-submission-v2.js";
import {
  runDurableSubmissionV2Conformance,
  type DurableSubmissionV2ConformanceFixtures,
  type DurableSubmissionV2Provider,
} from "./durable-submission-v2.conformance.js";

const interpretation = {
  methodology_manifest_hash: "b".repeat(64),
  adapter_artifact_hash: "f".repeat(64),
  parser_version: "parser-v2",
  normalizer_version: "normalizer-v2",
  extraction_contract_hash: "0".repeat(64),
};
const completeOutcomeHash = (
  typed_outcome: Record<string, unknown>,
  provenance: Record<string, unknown>,
) =>
  canonicalOutcomeDigestV2({
    outcome_kind: "capture_only",
    typed_outcome,
    provenance,
  });

const submission: DurableSubmissionV2 = {
  contract_version: "v2",
  source_key: "synthetic-source",
  submission_id: "submission-1",
  submitted_at: "2026-09-22T12:00:00.000Z",
  context: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "detail",
    listing_role: "for_rent",
    effective_at: "2026-09-22T12:00:00.000Z",
    recorded_as_of: "2026-09-22T12:00:00.000Z",
  },
  capture: {
    capture_event_id: "capture-1",
    collected_at: "2026-09-22T12:00:00.000Z",
    request: {
      method: "GET",
      canonical_url: "https://fixtures.example/listing/1",
    },
    response: {
      status_code: 200,
      media_type: "application/json",
      content_encoding: "utf-8",
      representation: "redacted_fixture",
      body_sha256: "a".repeat(64),
      body_byte_length: 120,
    },
    methodology_manifest_hash: "b".repeat(64),
    policy_hash: "c".repeat(64),
    retention_policy_hash: "d".repeat(64),
    redaction_policy_hash: "e".repeat(64),
    fixture_id: "fixture-1",
  },
  interpretation,
  outcome: {
    kind: "complete",
    canonical_outcome_hash: completeOutcomeHash(
      { reason_code: "no_listing_found" },
      { extraction_trace_hash: "2".repeat(64) },
    ),
    outcome_kind: "capture_only",
    typed_outcome: { reason_code: "no_listing_found" },
    provenance: { extraction_trace_hash: "2".repeat(64) },
  },
  artifact: {
    kind: "no_retained_bytes",
    disposition: "policy_forbids_retention",
    media_type: "application/json",
    encoding: "utf-8",
    body_sha256: "a".repeat(64),
    body_byte_length: 120,
  },
};

const storageReference = {
  kind: "verified_immutable_reference",
  reference_id: "storage-ref-1",
  issuer: "storage",
  contract_version: "v2",
  source_key: "synthetic-source",
  capture_event_id: "capture-1",
  retention_policy_hash: "d".repeat(64),
  interpretation,
  referenced_artifact_hash: "a".repeat(64),
  media_type: "application/json",
  encoding: "utf-8",
  body_sha256: "a".repeat(64),
  body_byte_length: 120,
};

function memoryProvider(): DurableSubmissionV2Provider &
  DurableSubmissionV2ConformanceFixtures {
  const receipts = new Map<string, { hash: string; receipt_id: string }>();
  const captures = new Map<string, string>();
  const interpretations = new Map<string, string>();
  const references = new Map<string, string>();
  const referenceFor = (input: DurableSubmissionV2) => {
    if (input.artifact.kind === "staged_reference")
      return {
        key: `staged:${input.artifact.reference_id}`,
        binding: input.artifact,
        error: "staged_reference_invalid" as const,
      };
    if (input.artifact.kind === "verified_immutable_reference")
      return {
        key: `artifact:${input.artifact.reference_id}`,
        binding: input.artifact,
        error: "artifact_unverified" as const,
      };
    if (input.outcome.kind === "verified_immutable_reference")
      return {
        key: `outcome:${input.outcome.reference.reference_id}`,
        binding: input.outcome.reference,
        error: "outcome_unverified" as const,
      };
    return null;
  };
  return {
    accept: async (input) => {
      const reference = referenceFor(input);
      if (
        reference &&
        references.get(reference.key) !== JSON.stringify(reference.binding)
      )
        return { code: reference.error };
      const key = `${input.source_key}:${input.submission_id}`;
      const hash = acceptedSubmissionDigestV2(input);
      const existing = receipts.get(key);
      if (existing && existing.hash !== hash)
        return { code: "submission_conflict" };
      const captureKey = `${input.source_key}:${input.capture.capture_event_id}`;
      const captureFingerprint = JSON.stringify({
        request: input.capture.request,
        response: input.capture.response,
        methodology_manifest_hash: input.capture.methodology_manifest_hash,
        policy_hash: input.capture.policy_hash,
        retention_policy_hash: input.capture.retention_policy_hash,
        redaction_policy_hash: input.capture.redaction_policy_hash,
      });
      const knownCapture = captures.get(captureKey);
      if (knownCapture && knownCapture !== captureFingerprint)
        return { code: "capture_event_conflict" };
      const interpretationKey = `${captureKey}:${JSON.stringify(input.interpretation)}`;
      const outcomeHash =
        input.outcome.kind === "complete"
          ? input.outcome.canonical_outcome_hash
          : input.outcome.reference.referenced_outcome_hash;
      const knownOutcome = interpretations.get(interpretationKey);
      if (knownOutcome && knownOutcome !== outcomeHash)
        return { code: "interpretation_conflict" };
      captures.set(captureKey, captureFingerprint);
      interpretations.set(interpretationKey, outcomeHash);
      const receipt = existing ?? {
        hash,
        receipt_id: `receipt-${receipts.size + 1}`,
      };
      receipts.set(key, receipt);
      return {
        contract_version: "v2",
        receipt_id: receipt.receipt_id,
        source_key: input.source_key,
        submission_id: input.submission_id,
        capture_event_id: input.capture.capture_event_id,
        accepted_submission_hash: receipt.hash,
        accepted_at: "2026-09-22T12:00:00.000Z",
        state: "accepted",
        duplicate_delivery: existing !== undefined,
      };
    },
    progress: async () => [],
    seedReference: async (input) => {
      const reference = referenceFor(input);
      if (!reference) throw new Error("expected reference input");
      references.set(reference.key, JSON.stringify(reference.binding));
    },
    invalidateReference: async (input) => {
      const reference = referenceFor(input);
      if (!reference) throw new Error("expected reference input");
      references.delete(reference.key);
    },
  };
}

describe("DurableSubmissionV2 contract", () => {
  it("derives complete outcome identity and bounds inline UTF-8 bytes", () => {
    const outcome = submission.outcome;
    if (outcome.kind !== "complete") throw new Error("expected complete");
    expect(canonicalOutcomeDigestV2(outcome)).toBe(
      outcome.canonical_outcome_hash,
    );
    const emoji = "é".repeat(Math.floor(MAX_INLINE_REDACTED_BYTES_V2 / 2));
    const bytes = Buffer.byteLength(emoji, "utf8");
    expect(bytes).toBe(MAX_INLINE_REDACTED_BYTES_V2);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: {
          kind: "inline_redacted",
          bytes: emoji,
          media_type: "text/plain",
          encoding: "utf-8",
          body_sha256: createHash("sha256").update(emoji).digest("hex"),
          body_byte_length: bytes,
        },
      }).success,
    ).toBe(true);
    const tooLarge = `${emoji}x`;
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: {
          kind: "inline_redacted",
          bytes: tooLarge,
          media_type: "text/plain",
          encoding: "utf-8",
          body_sha256: createHash("sha256").update(tooLarge).digest("hex"),
          body_byte_length: Buffer.byteLength(tooLarge, "utf8"),
        },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        outcome: {
          ...outcome,
          typed_outcome: { reason_code: "mutated-with-old-hash" },
        },
      }).success,
    ).toBe(false);
  });
  it("uses source-scoped submission idempotency", () => {
    expect(durableSubmissionV2Schema.safeParse(submission).success).toBe(true);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        source_key: "another-source",
      }).success,
    ).toBe(true);
  });

  it("requires digest and length for no-retained-bytes", () => {
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: { ...submission.artifact, body_sha256: undefined },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: { ...submission.artifact, body_byte_length: undefined },
      }).success,
    ).toBe(false);
  });

  it("accepts only Storage-issued artifact references bound to the full capture and interpretation", () => {
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: storageReference,
      }).success,
    ).toBe(true);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: { ...storageReference, issuer: "external" },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: {
          ...storageReference,
          interpretation: {
            ...interpretation,
            canonical_outcome_hash: "3".repeat(64),
          },
        },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: { ...storageReference, source_key: "other-source" },
      }).success,
    ).toBe(false);
  });

  it("supports only Storage-issued, hash-bound outcome references", () => {
    const outcomeReference = {
      kind: "verified_immutable_outcome_reference",
      reference_id: "storage-outcome-1",
      issuer: "storage",
      contract_version: "v2",
      source_key: "synthetic-source",
      capture_event_id: "capture-1",
      retention_policy_hash: "d".repeat(64),
      interpretation,
      referenced_outcome_hash: "1".repeat(64),
    };
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        outcome: {
          kind: "verified_immutable_reference",
          reference: outcomeReference,
        },
      }).success,
    ).toBe(true);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        outcome: {
          kind: "verified_immutable_reference",
          reference: { ...outcomeReference, issuer: "external" },
        },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        outcome: {
          kind: "verified_immutable_reference",
          reference: { ...outcomeReference, source_key: "other-source" },
        },
      }).success,
    ).toBe(false);
  });

  it("hashes immutable evidence but excludes retry and provider fields", () => {
    expect(
      acceptedSubmissionDigestV2({ ...submission, submission_id: "retry-2" }),
    ).toBe(acceptedSubmissionDigestV2(submission));
    expect(
      acceptedSubmissionDigestV2({
        ...submission,
        interpretation: { ...interpretation, parser_version: "parser-v3" },
      }),
    ).not.toBe(acceptedSubmissionDigestV2(submission));
    expect(
      acceptedSubmissionDigestV2({
        ...submission,
        outcome: {
          kind: "complete",
          canonical_outcome_hash: completeOutcomeHash(
            { reason_code: "different_complete_outcome" },
            { extraction_trace_hash: "2".repeat(64) },
          ),
          outcome_kind: "capture_only",
          typed_outcome: { reason_code: "different_complete_outcome" },
          provenance: { extraction_trace_hash: "2".repeat(64) },
        },
      }),
    ).not.toBe(acceptedSubmissionDigestV2(submission));
    expect(
      acceptedSubmissionDigestV2({
        ...submission,
        outcome: {
          kind: "complete",
          canonical_outcome_hash: completeOutcomeHash(
            { reason_code: "no_listing_found" },
            { extraction_trace_hash: "5".repeat(64) },
          ),
          outcome_kind: "capture_only",
          typed_outcome: { reason_code: "no_listing_found" },
          provenance: { extraction_trace_hash: "5".repeat(64) },
        },
      }),
    ).not.toBe(acceptedSubmissionDigestV2(submission));
  });

  it("runs source-scoped replay, conflict, and receipt-hash vectors through a provider-only adapter", async () => {
    const conformanceProvider = memoryProvider();
    await expect(
      runDurableSubmissionV2Conformance(
        conformanceProvider,
        conformanceProvider,
      ),
    ).resolves.toEqual(expect.objectContaining({ passed: true }));
    const provider = memoryProvider();
    await expect(
      runDurableSubmissionV2Conformance(
        {
          ...provider,
          accept: async (input) => {
            const receipt = await provider.accept(input);
            return "code" in receipt
              ? receipt
              : { ...receipt, accepted_submission_hash: "9".repeat(64) };
          },
        },
        {
          seedReference: async () => undefined,
          invalidateReference: async () => undefined,
        },
      ),
    ).rejects.toThrow("accepted_submission_hash");
  });
});

describe("DurableSubmissionV2 review regressions", () => {
  it("rejects unsafe canonical capture URLs and artifact hash mismatches", () => {
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        capture: {
          ...submission.capture,
          request: {
            method: "GET",
            canonical_url: "http://fixtures.example/a",
          },
        },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: {
          ...storageReference,
          referenced_artifact_hash: "9".repeat(64),
        },
      }).success,
    ).toBe(false);
  });

  it("makes submitted_at deliberately excluded from accepted submission identity", () => {
    expect(
      acceptedSubmissionDigestV2({
        ...submission,
        submitted_at: "2026-09-22T12:01:00.000Z",
      }),
    ).toBe(acceptedSubmissionDigestV2(submission));
  });
});

import { durableSubmissionV2ArtifactVectors } from "./durable-submission-v2.vectors.js";
it("accepts all canonical artifact vectors", () => {
  for (const vector of durableSubmissionV2ArtifactVectors)
    expect(durableSubmissionV2Schema.safeParse(vector).success).toBe(true);
});

import {
  acceptedReceiptV2Schema,
  durableSubmissionV2ErrorSchema,
  receiptProgressV2Schema,
} from "./durable-submission-v2.js";
describe("DurableSubmissionV2 canonical rejection vectors", () => {
  it("rejects untrusted and mismatched references", () => {
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: { ...storageReference, issuer: "external" },
      }).success,
    ).toBe(false);
    expect(
      durableSubmissionV2Schema.safeParse({
        ...submission,
        artifact: { ...storageReference, source_key: "other-source" },
      }).success,
    ).toBe(false);
  });
  it("requires strict accepted receipts and ordered sanitized progress", () => {
    expect(
      acceptedReceiptV2Schema.safeParse({
        contract_version: "v2",
        receipt_id: "r",
        source_key: "s",
        submission_id: "i",
        capture_event_id: "c",
        accepted_submission_hash: "a".repeat(64),
        accepted_at: "2026-09-23T00:00:00.000Z",
        state: "accepted",
        duplicate_delivery: false,
      }).success,
    ).toBe(true);
    expect(
      receiptProgressV2Schema.safeParse({
        contract_version: "v2",
        receipt_id: "r",
        sequence: 1,
        occurred_at: "2026-09-23T00:00:00.000Z",
        state: "committed",
        code: null,
        reason: null,
      }).success,
    ).toBe(true);
    expect(
      durableSubmissionV2ErrorSchema.safeParse({
        code: "submission_conflict",
        message: "sanitized",
      }).success,
    ).toBe(true);
    expect(
      durableSubmissionV2ErrorSchema.safeParse({
        code: "submission_conflict",
        body: "leak",
      }).success,
    ).toBe(false);
  });
});
