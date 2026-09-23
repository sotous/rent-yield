import { canonicalOutcomeDigestV2 } from "./durable-submission-v2.js";
import type {
  AcceptedReceiptV2,
  DurableSubmissionV2,
  DurableSubmissionV2Error,
  ReceiptProgressV2,
} from "./durable-submission-v2.js";

export const durableSubmissionV2Interpretation = {
  methodology_manifest_hash: "b".repeat(64),
  adapter_artifact_hash: "f".repeat(64),
  parser_version: "parser-v2",
  normalizer_version: "normalizer-v2",
  extraction_contract_hash: "0".repeat(64),
} as const;
const completeOutcome = (
  typed_outcome: Record<string, unknown>,
  provenance: Record<string, unknown>,
) => ({
  kind: "complete" as const,
  outcome_kind: "capture_only" as const,
  typed_outcome,
  provenance,
  canonical_outcome_hash: canonicalOutcomeDigestV2({
    outcome_kind: "capture_only",
    typed_outcome,
    provenance,
  }),
});

/** A complete fixture-backed submission used as the canonical V2 baseline. */
export const durableSubmissionV2Vector: DurableSubmissionV2 = {
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
  interpretation: durableSubmissionV2Interpretation,
  outcome: completeOutcome(
    { reason_code: "no_listing_found" },
    { extraction_trace_hash: "2".repeat(64) },
  ),
  artifact: {
    kind: "no_retained_bytes",
    disposition: "policy_forbids_retention",
    media_type: "application/json",
    encoding: "utf-8",
    body_sha256: "a".repeat(64),
    body_byte_length: 120,
  },
};

const artifactBinding = {
  issuer: "storage" as const,
  contract_version: "v2" as const,
  source_key: "synthetic-source",
  capture_event_id: "capture-1",
  retention_policy_hash: "d".repeat(64),
  interpretation: durableSubmissionV2Interpretation,
  referenced_artifact_hash: "a".repeat(64),
  media_type: "application/json" as const,
  encoding: "utf-8",
  body_sha256: "a".repeat(64),
  body_byte_length: 120,
};

/** Every permitted artifact disposition has canonical body evidence. */
export const durableSubmissionV2ArtifactVectors: readonly DurableSubmissionV2[] =
  [
    durableSubmissionV2Vector,
    {
      ...durableSubmissionV2Vector,
      artifact: {
        kind: "inline_redacted",
        bytes: "{}",
        media_type: "application/json",
        encoding: "utf-8",
        body_sha256:
          "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
        body_byte_length: 2,
      },
    } as DurableSubmissionV2,
    {
      ...durableSubmissionV2Vector,
      artifact: {
        kind: "staged_reference",
        reference_id: "staged-1",
        ...artifactBinding,
      },
    } as DurableSubmissionV2,
    {
      ...durableSubmissionV2Vector,
      artifact: {
        kind: "verified_immutable_reference",
        reference_id: "artifact-1",
        ...artifactBinding,
      },
    } as DurableSubmissionV2,
  ];

const outcomeReference = {
  kind: "verified_immutable_outcome_reference" as const,
  reference_id: "outcome-1",
  issuer: "storage" as const,
  contract_version: "v2" as const,
  source_key: "synthetic-source",
  capture_event_id: "capture-1",
  retention_policy_hash: "d".repeat(64),
  interpretation: durableSubmissionV2Interpretation,
  referenced_outcome_hash:
    durableSubmissionV2Vector.outcome.kind === "complete"
      ? durableSubmissionV2Vector.outcome.canonical_outcome_hash
      : "",
};

export const durableSubmissionV2OutcomeReferenceVector: DurableSubmissionV2 = {
  ...durableSubmissionV2Vector,
  outcome: {
    kind: "verified_immutable_reference",
    reference: outcomeReference,
  },
};

/** Inputs used to establish source-scoped replay and the three conflict classes. */
export const durableSubmissionV2IdempotencyVectors = {
  exact_replay: durableSubmissionV2Vector,
  same_submission_id_other_source: {
    ...durableSubmissionV2Vector,
    source_key: "other-source",
  } as DurableSubmissionV2,
  changed_payload_same_pair: {
    ...durableSubmissionV2Vector,
    outcome: completeOutcome(
      { reason_code: "changed" },
      { extraction_trace_hash: "2".repeat(64) },
    ),
  } as DurableSubmissionV2,
  capture_event_conflict: {
    ...durableSubmissionV2Vector,
    capture: {
      ...durableSubmissionV2Vector.capture,
      capture_event_id: "capture-2",
    },
  } as DurableSubmissionV2,
  interpretation_conflict: {
    ...durableSubmissionV2Vector,
    interpretation: {
      ...durableSubmissionV2Interpretation,
      adapter_artifact_hash: "3".repeat(64),
    },
  } as DurableSubmissionV2,
} as const;

/** These must fail schema validation before a provider sees them. */
export const durableSubmissionV2RejectedReferenceVectors: readonly unknown[] = [
  {
    ...durableSubmissionV2ArtifactVectors[3],
    artifact: {
      ...artifactBinding,
      kind: "verified_immutable_reference",
      reference_id: "bad-issuer",
      issuer: "external",
    },
  },
  {
    ...durableSubmissionV2ArtifactVectors[3],
    artifact: {
      ...artifactBinding,
      kind: "verified_immutable_reference",
      reference_id: "bad-source",
      source_key: "other-source",
    },
  },
  {
    ...durableSubmissionV2ArtifactVectors[3],
    artifact: {
      ...artifactBinding,
      kind: "verified_immutable_reference",
      reference_id: "bad-hash",
      referenced_artifact_hash: "9".repeat(64),
    },
  },
  {
    ...durableSubmissionV2OutcomeReferenceVector,
    outcome: {
      kind: "verified_immutable_reference",
      reference: {
        ...outcomeReference,
        capture_event_id: "capture-2",
      },
    },
  },
  {
    ...durableSubmissionV2OutcomeReferenceVector,
    outcome: {
      kind: "verified_immutable_reference",
      reference: {
        ...outcomeReference,
        source_key: "other-source",
      },
    },
  },
];

export const acceptedReceiptV2Vector: AcceptedReceiptV2 = {
  contract_version: "v2",
  receipt_id: "receipt-1",
  source_key: "synthetic-source",
  submission_id: "submission-1",
  capture_event_id: "capture-1",
  accepted_submission_hash: "a".repeat(64),
  accepted_at: "2026-09-23T00:00:00.000Z",
  state: "accepted",
  duplicate_delivery: false,
};

export const receiptProgressV2Vectors: readonly ReceiptProgressV2[] = [
  {
    contract_version: "v2",
    receipt_id: "receipt-1",
    sequence: 1,
    occurred_at: "2026-09-23T00:01:00.000Z",
    state: "committed",
    code: null,
    reason: null,
  },
];

export const durableSubmissionV2SanitizedErrorVectors: readonly DurableSubmissionV2Error[] =
  [
    {
      code: "submission_conflict",
      message: "Submission differs from accepted receipt.",
    },
    { code: "storage_unavailable" },
  ];

/** Mutations that state exactly which values participate in accepted-submission identity. */
export const acceptedSubmissionDigestV2Vectors = {
  baseline: durableSubmissionV2Vector,
  excluded_submission_id: {
    ...durableSubmissionV2Vector,
    submission_id: "submission-retry",
  } as DurableSubmissionV2,
  excluded_submitted_at: {
    ...durableSubmissionV2Vector,
    submitted_at: "2026-09-22T12:01:00.000Z",
  } as DurableSubmissionV2,
  included_capture: {
    ...durableSubmissionV2Vector,
    capture: { ...durableSubmissionV2Vector.capture, fixture_id: "fixture-2" },
  } as DurableSubmissionV2,
  included_typed_outcome:
    durableSubmissionV2IdempotencyVectors.changed_payload_same_pair,
  included_provenance: {
    ...durableSubmissionV2Vector,
    outcome: completeOutcome(
      { reason_code: "no_listing_found" },
      { extraction_trace_hash: "8".repeat(64) },
    ),
  } as DurableSubmissionV2,
  included_interpretation:
    durableSubmissionV2IdempotencyVectors.interpretation_conflict,
} as const;

export const durableSubmissionV2RejectedInlineArtifactVector: DurableSubmissionV2 =
  {
    ...durableSubmissionV2ArtifactVectors[1]!,
    artifact: {
      kind: "inline_redacted",
      bytes: "{}",
      media_type: "application/json",
      encoding: "utf-8",
      body_sha256: "a".repeat(64),
      body_byte_length: 120,
    },
  };
