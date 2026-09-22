import { describe, expect, it } from "vitest";
import {
  acceptedSubmissionDigestV2,
  durableSubmissionV2Schema,
  type DurableSubmissionV2,
} from "./durable-submission-v2.js";
import {
  runDurableSubmissionV2Conformance,
  type DurableSubmissionV2Provider,
} from "./durable-submission-v2.conformance.js";

const interpretation = {
  methodology_manifest_hash: "b".repeat(64),
  adapter_artifact_hash: "f".repeat(64),
  parser_version: "parser-v2",
  normalizer_version: "normalizer-v2",
  extraction_contract_hash: "0".repeat(64),
  canonical_outcome_hash: "1".repeat(64),
};

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
  interpretation,
  referenced_artifact_hash: "a".repeat(64),
  media_type: "application/json",
  encoding: "utf-8",
  body_sha256: "a".repeat(64),
  body_byte_length: 120,
};

function memoryProvider(): DurableSubmissionV2Provider {
  const receipts = new Map<string, { hash: string; receipt_id: string }>();
  return {
    accept: async (input) => {
      const key = `${input.source_key}:${input.submission_id}`;
      const hash = acceptedSubmissionDigestV2(input);
      const existing = receipts.get(key);
      if (existing && existing.hash !== hash) {
        return { code: "submission_conflict" };
      }
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
  };
}

describe("DurableSubmissionV2 contract", () => {
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
      interpretation,
      referenced_outcome_hash: interpretation.canonical_outcome_hash,
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
        interpretation: {
          ...interpretation,
          canonical_outcome_hash: "3".repeat(64),
        },
      }),
    ).not.toBe(acceptedSubmissionDigestV2(submission));
    expect(
      acceptedSubmissionDigestV2({
        ...submission,
        outcome: {
          kind: "complete",
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
          outcome_kind: "capture_only",
          typed_outcome: { reason_code: "no_listing_found" },
          provenance: { extraction_trace_hash: "5".repeat(64) },
        },
      }),
    ).not.toBe(acceptedSubmissionDigestV2(submission));
  });

  it("runs source-scoped replay, conflict, and receipt-hash vectors through a provider-only adapter", async () => {
    await expect(
      runDurableSubmissionV2Conformance(memoryProvider()),
    ).resolves.toEqual(expect.objectContaining({ passed: true }));
    const provider = memoryProvider();
    await expect(
      runDurableSubmissionV2Conformance({
        ...provider,
        accept: async (input) => {
          const receipt = await provider.accept(input);
          return "code" in receipt
            ? receipt
            : { ...receipt, accepted_submission_hash: "9".repeat(64) };
        },
      }),
    ).rejects.toThrow("accepted_submission_hash");
  });
});
