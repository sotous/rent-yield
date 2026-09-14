import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "./canonical.js";
import {
  contractVersionSchema,
  identifierSchema,
  instantSchema,
  safeNonNegativeIntegerSchema,
  sha256Schema,
} from "./primitives.js";

const captureSchema = z.strictObject({
  capture_event_id: identifierSchema,
  collected_at: instantSchema,
  request: z.strictObject({
    method: z.enum(["GET", "POST"]),
    url: z.string().min(1),
  }),
  response: z.strictObject({
    status_code: safeNonNegativeIntegerSchema.max(599),
    content_type: z.string().min(1).nullable(),
    content_encoding: z.string().min(1).nullable(),
    body_representation: z.enum(["original_entity", "redacted_fixture"]),
    body_sha256: sha256Schema,
    body_bytes: safeNonNegativeIntegerSchema,
  }),
  methodology_hash: sha256Schema,
  policy_hash: sha256Schema,
});

export const ingestionSubmissionSchema = z.strictObject({
  contract_version: contractVersionSchema,
  idempotency_key: identifierSchema,
  source_key: identifierSchema,
  capture: captureSchema,
  interpretation: z.strictObject({
    adapter_artifact_hash: sha256Schema,
    parser_version: identifierSchema,
    normalizer_version: identifierSchema,
    extraction_contract_hash: sha256Schema,
    outcome_hash: sha256Schema,
    outcome_kind: z.enum([
      "normalized",
      "quarantined",
      "parse_failed",
      "capture_only",
    ]),
  }),
});

export const ingestionReceiptSchema = z.strictObject({
  contract_version: contractVersionSchema,
  receipt_id: identifierSchema,
  source_key: identifierSchema,
  capture_event_id: identifierSchema,
  idempotency_key: identifierSchema,
  submission_hash: sha256Schema,
  stage: z.enum(["accepted", "committed", "quarantined"]),
});

export const receiptProgressSchema = z.strictObject({
  contract_version: contractVersionSchema,
  receipt_id: identifierSchema,
  stage: z.enum(["accepted", "committed", "quarantined", "failed"]),
  recorded_at: instantSchema,
  failure: z
    .enum([
      "policy_blocked",
      "incompatible_adapter",
      "validation_failed",
      "storage_unavailable",
    ])
    .nullable(),
});

export const ingestionErrorCodeSchema = z.enum([
  "invalid_input",
  "idempotency_conflict",
  "capture_event_conflict",
  "storage_unavailable",
]);

export type IngestionSubmissionV1 = z.infer<typeof ingestionSubmissionSchema>;
export type IngestionReceiptV1 = z.infer<typeof ingestionReceiptSchema>;
export type ReceiptProgressV1 = z.infer<typeof receiptProgressSchema>;

/** Immutable submission identity excludes caller retry and provider-derived fields. */
export function ingestionSubmissionDigest(
  input: IngestionSubmissionV1,
): string {
  const preimage = { ...input };
  delete (preimage as { idempotency_key?: string }).idempotency_key;
  return createHash("sha256")
    .update(canonicalJson(preimage), "utf8")
    .digest("hex");
}

export const ingestionSubmissionExample = {
  contract_version: "v1",
  idempotency_key: "synthetic-key-1",
  source_key: "synthetic-source",
  capture: {
    capture_event_id: "synthetic-capture-1",
    collected_at: "2026-09-14T12:00:00.000Z",
    request: { method: "GET", url: "https://fixtures.example/listing/1" },
    response: {
      status_code: 200,
      content_type: "application/json",
      content_encoding: null,
      body_representation: "redacted_fixture",
      body_sha256: "a".repeat(64),
      body_bytes: 12,
    },
    methodology_hash: "b".repeat(64),
    policy_hash: "c".repeat(64),
  },
  interpretation: {
    adapter_artifact_hash: "d".repeat(64),
    parser_version: "parser-v1",
    normalizer_version: "normalizer-v1",
    extraction_contract_hash: "e".repeat(64),
    outcome_hash: "f".repeat(64),
    outcome_kind: "normalized",
  },
} satisfies IngestionSubmissionV1;
