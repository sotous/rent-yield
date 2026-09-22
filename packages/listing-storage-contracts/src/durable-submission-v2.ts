import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson } from "./canonical.js";
import {
  capabilitySchema,
  identifierSchema,
  instantSchema,
  listingRoleSchema,
  safeNonNegativeIntegerSchema,
  sha256Schema,
} from "./primitives.js";

const v2 = z.literal("v2");
const identitySchema = z.strictObject({
  source_key: identifierSchema,
  capture_event_id: identifierSchema,
});
export const interpretationIdentityV2Schema = z.strictObject({
  methodology_manifest_hash: sha256Schema,
  adapter_artifact_hash: sha256Schema,
  parser_version: identifierSchema,
  normalizer_version: identifierSchema,
  extraction_contract_hash: sha256Schema,
  canonical_outcome_hash: sha256Schema,
});
const bodyEvidenceSchema = z.strictObject({
  media_type: z.enum(["application/json", "text/html", "text/plain"]),
  encoding: z.string().min(1).nullable(),
  body_sha256: sha256Schema,
  body_byte_length: safeNonNegativeIntegerSchema,
});
const referenceBindingSchema = z.strictObject({
  issuer: z.literal("storage"),
  contract_version: v2,
  source_key: identifierSchema,
  capture_event_id: identifierSchema,
  interpretation: interpretationIdentityV2Schema,
});
const artifactReferenceSchema = z.strictObject({
  kind: z.literal("verified_immutable_reference"),
  reference_id: identifierSchema,
  ...referenceBindingSchema.shape,
  referenced_artifact_hash: sha256Schema,
  ...bodyEvidenceSchema.shape,
});
const outcomeReferenceSchema = z.strictObject({
  kind: z.literal("verified_immutable_outcome_reference"),
  reference_id: identifierSchema,
  ...referenceBindingSchema.shape,
  referenced_outcome_hash: sha256Schema,
});
const artifactSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("inline_redacted"),
    bytes: z.string().min(1),
    ...bodyEvidenceSchema.shape,
  }),
  z.strictObject({
    kind: z.literal("no_retained_bytes"),
    disposition: identifierSchema,
    ...bodyEvidenceSchema.shape,
  }),
  z.strictObject({
    kind: z.literal("staged_reference"),
    reference_id: identifierSchema,
    ...referenceBindingSchema.shape,
    referenced_artifact_hash: sha256Schema,
    ...bodyEvidenceSchema.shape,
  }),
  artifactReferenceSchema,
]);
const outcomeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("complete"),
    outcome_kind: z.enum([
      "normalized",
      "quarantined",
      "parse_failed",
      "capture_only",
    ]),
    typed_outcome: z.record(z.string(), z.unknown()),
    provenance: z.record(z.string(), z.unknown()),
  }),
  z.strictObject({
    kind: z.literal("verified_immutable_reference"),
    reference: outcomeReferenceSchema,
  }),
]);
export const durableSubmissionV2Schema = z
  .strictObject({
    contract_version: v2,
    source_key: identifierSchema,
    submission_id: identifierSchema,
    submitted_at: instantSchema,
    context: z.strictObject({
      country_code: z.literal("CO"),
      city_key: identifierSchema,
      capability: capabilitySchema,
      listing_role: listingRoleSchema,
      effective_at: instantSchema,
      recorded_as_of: instantSchema,
    }),
    capture: z.strictObject({
      capture_event_id: identifierSchema,
      collected_at: instantSchema,
      request: z.strictObject({
        method: z.literal("GET"),
        canonical_url: z.string().url(),
      }),
      response: z.strictObject({
        status_code: safeNonNegativeIntegerSchema.max(599),
        media_type: z.enum(["application/json", "text/html", "text/plain"]),
        content_encoding: z.string().min(1).nullable(),
        representation: z.enum(["redacted_fixture", "original_source_body"]),
        body_sha256: sha256Schema,
        body_byte_length: safeNonNegativeIntegerSchema,
      }),
      methodology_manifest_hash: sha256Schema,
      policy_hash: sha256Schema,
      retention_policy_hash: sha256Schema,
      redaction_policy_hash: sha256Schema,
      fixture_id: identifierSchema.nullable(),
    }),
    interpretation: interpretationIdentityV2Schema,
    outcome: outcomeSchema,
    artifact: artifactSchema,
  })
  .superRefine((value, ctx) => {
    const binding =
      value.artifact.kind === "verified_immutable_reference" ||
      value.artifact.kind === "staged_reference"
        ? value.artifact
        : value.outcome.kind === "verified_immutable_reference"
          ? value.outcome.reference
          : null;
    if (
      binding &&
      (binding.source_key !== value.source_key ||
        binding.capture_event_id !== value.capture.capture_event_id ||
        canonicalJson(binding.interpretation) !==
          canonicalJson(value.interpretation))
    )
      ctx.addIssue({
        code: "custom",
        message: "Storage reference binding mismatch",
      });
    if (
      value.outcome.kind === "verified_immutable_reference" &&
      value.outcome.reference.referenced_outcome_hash !==
        value.interpretation.canonical_outcome_hash
    )
      ctx.addIssue({
        code: "custom",
        message: "Outcome reference hash mismatch",
      });
  });
export const acceptedReceiptV2Schema = z.strictObject({
  contract_version: v2,
  receipt_id: identifierSchema,
  source_key: identifierSchema,
  submission_id: identifierSchema,
  capture_event_id: identifierSchema,
  accepted_submission_hash: sha256Schema,
  accepted_at: instantSchema,
  state: z.literal("accepted"),
  duplicate_delivery: z.boolean(),
});
export const receiptProgressV2Schema = z.strictObject({
  contract_version: v2,
  receipt_id: identifierSchema,
  sequence: safeNonNegativeIntegerSchema.min(1),
  occurred_at: instantSchema,
  state: z.enum(["committed", "quarantined", "failed"]),
  code: identifierSchema.nullable(),
});
export const durableSubmissionV2ErrorSchema = z.strictObject({
  code: z.enum([
    "validation_failed",
    "artifact_unverified",
    "staged_reference_invalid",
    "unsupported_contract",
    "storage_unavailable",
    "submission_conflict",
    "capture_event_conflict",
    "interpretation_conflict",
  ]),
  message: z.string().max(512).optional(),
});
export type DurableSubmissionV2 = z.infer<typeof durableSubmissionV2Schema>;
export type AcceptedReceiptV2 = z.infer<typeof acceptedReceiptV2Schema>;
export type ReceiptProgressV2 = z.infer<typeof receiptProgressV2Schema>;
export type DurableSubmissionV2Error = z.infer<
  typeof durableSubmissionV2ErrorSchema
>;
export function acceptedSubmissionDigestV2(input: DurableSubmissionV2): string {
  const parsed = durableSubmissionV2Schema.parse(input);
  const { submission_id: _id, submitted_at: _at, ...preimage } = parsed;
  return createHash("sha256")
    .update(canonicalJson(preimage), "utf8")
    .digest("hex");
}
export const captureIdentityV2Schema = identitySchema;
