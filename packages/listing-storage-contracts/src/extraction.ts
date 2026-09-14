import { z } from "zod";
import {
  contractVersionSchema,
  decimalSchema,
  identifierSchema,
  instantSchema,
  listingRoleSchema,
  positiveDecimalSchema,
  safeNonNegativeIntegerSchema,
  sha256Schema,
  sourceDateSchema,
} from "./primitives.js";
import { extractionMappingSchema, fixtureOriginSchema } from "./research.js";

export const extractionIssueCodeSchema = z.enum([
  "missing_stable_listing_url",
  "missing_stable_identity",
  "missing_source_date",
  "invalid_field",
  "missing_required_field",
  "unknown_currency",
  "unknown_frequency",
  "ambiguous_fee_scope",
  "invalid_asking_amount",
  "missing_built_area",
  "area_conflict",
  "inactive_listing",
  "unknown_listing_status",
  "unknown_rental_basis",
  "non_residential",
  "out_of_scope",
  "invalid_fixture",
  "incompatible_parser",
  "fixture_not_pinned",
  "unsupported_mapping",
  "schema_drift",
  "invalid_contract",
  "replay_not_permitted",
]);
export const extractionIssueSchema = z.strictObject({
  code: extractionIssueCodeSchema,
  field: extractionMappingSchema.shape.field.optional(),
  severity: z.enum(["warning", "error"]),
});
export const stableListingUrlSchema = z
  .url({ protocol: /^https$/ })
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname !== "/" &&
      url.href === value
    );
  });
export const stableSourceListingIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/);
const identityShape = {
  source_key: identifierSchema,
  source_listing_id: stableSourceListingIdSchema.nullable(),
  listing_url: stableListingUrlSchema.nullable(),
};
const hasIdentity = (value: {
  source_listing_id: string | null;
  listing_url: string | null;
}) => value.source_listing_id !== null || value.listing_url !== null;
const residentialSchema = z.enum([
  "apartment",
  "house",
  "studio",
  "other_residential",
]);

/** Economic projection only; the replay outcome links it to observation provenance. */
export const rentalEvidenceSchema = z
  .strictObject({
    ...identityShape,
    origin: z.literal("observed_listing"),
    collected_at: instantSchema,
    listing_role: z.literal("for_rent"),
    asking_amount: positiveDecimalSchema,
    currency: z.literal("COP"),
    frequency: z.literal("monthly"),
    fee_scope: z.literal("base"),
    rental_basis: z.literal("long_term"),
    listing_status: z.literal("active"),
    property_type: residentialSchema,
    built_area_sqm: positiveDecimalSchema,
  })
  .refine(hasIdentity, "Stable source identity required");

export const extractedFieldProvenanceSchema = z.strictObject({
  field: extractionMappingSchema.shape.field,
  raw_path: z.string(),
  raw_value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
  transforms: extractionMappingSchema.shape.transforms,
  transform_version: identifierSchema,
  quality_issue_codes: z.array(extractionIssueCodeSchema),
});
export const extractedObservationSchema = z
  .strictObject({
    ...identityShape,
    country_code: z.literal("CO"),
    city_key: identifierSchema,
    city: z.string().nullable(),
    area: z.string().nullable(),
    alias: z.string().nullable(),
    identity_candidates: z.array(
      z.strictObject({
        kind: z.enum(["source_listing_id", "listing_url", "alias"]),
        source_key: identifierSchema,
        value: z.string(),
      }),
    ),
    listing_role: listingRoleSchema.nullable(),
    asking_amount: decimalSchema.nullable(),
    currency: z.enum(["COP", "USD", "unknown"]),
    frequency: z.enum(["monthly", "one_time", "daily", "weekly", "unknown"]),
    fee_scope: z.enum(["base", "includes_admin", "bundled", "unknown"]),
    administration_amount: decimalSchema.nullable(),
    utilities_amount: decimalSchema.nullable(),
    parking_amount: decimalSchema.nullable(),
    built_area_sqm: decimalSchema.nullable(),
    private_area_sqm: decimalSchema.nullable(),
    interior_area_sqm: decimalSchema.nullable(),
    area_value: decimalSchema.nullable(),
    area_kind: z.enum(["built", "private", "interior", "unknown"]),
    property_type: residentialSchema.nullable(),
    rental_basis: z.enum(["long_term", "short_stay", "unknown"]),
    listing_status: z.enum(["active", "inactive", "unknown"]),
    title: z.string().nullable(),
    bedrooms: safeNonNegativeIntegerSchema.nullable(),
    bathrooms: safeNonNegativeIntegerSchema.nullable(),
    social_stratum: safeNonNegativeIntegerSchema.min(1).max(6).nullable(),
    latitude: decimalSchema.nullable(),
    longitude: decimalSchema.nullable(),
    source_published_at: sourceDateSchema,
    source_updated_at: sourceDateSchema,
    collected_at: instantSchema.nullable(),
    field_provenance: z.array(extractedFieldProvenanceSchema),
    quality: z.strictObject({
      ruleset: z.literal("listing-quality-v1"),
      index: z.number().int().min(0).max(100),
      blocking: z.boolean(),
      issues: z.array(extractionIssueSchema),
    }),
  })
  .superRefine((observation, ctx) => {
    const expected = scoreListingQuality(observation.quality.issues);
    if (
      observation.quality.index !== expected.index ||
      observation.quality.blocking !== expected.blocking
    )
      ctx.addIssue({
        code: "custom",
        message: "Quality must match its versioned ruleset",
      });
    const missingUrl = observation.quality.issues.some(
      (issue) => issue.code === "missing_stable_listing_url",
    );
    if ((observation.listing_url === null) !== missingUrl)
      ctx.addIssue({
        code: "custom",
        message: "Missing URL requires its quality penalty",
      });
    if (
      !hasIdentity(observation) &&
      !observation.quality.issues.some(
        (issue) =>
          issue.code === "missing_stable_identity" &&
          issue.severity === "error",
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Missing identity must block normalization",
      });
  });
const replayTraceSchema = z.strictObject({
  fixture_id: identifierSchema,
  envelope_sha256: sha256Schema,
  payload_sha256: sha256Schema,
  origin: fixtureOriginSchema,
  parser_version: identifierSchema,
  normalizer_version: identifierSchema,
  extraction_contract_sha256: sha256Schema,
});
const common = {
  contract_version: contractVersionSchema,
  trace: replayTraceSchema.nullable(),
  issues: z.array(extractionIssueSchema),
};
const evidenceEntries = z.array(
  z.strictObject({
    observation_index: z.number().int().min(0),
    evidence: rentalEvidenceSchema,
  }),
);
export const extractionOutcomeSchema = z
  .discriminatedUnion("kind", [
    z.strictObject({
      ...common,
      kind: z.literal("normalized"),
      observations: z.array(extractedObservationSchema).min(1),
      rental_evidence: evidenceEntries,
    }),
    z.strictObject({
      ...common,
      kind: z.literal("quarantined"),
      observations: z.array(extractedObservationSchema),
      rental_evidence: evidenceEntries,
    }),
    z.strictObject({
      ...common,
      kind: z.literal("parse_failed"),
      observations: z.tuple([]),
      rental_evidence: z.tuple([]),
    }),
    z.strictObject({
      ...common,
      kind: z.literal("capture_only"),
      observations: z.tuple([]),
      rental_evidence: z.tuple([]),
    }),
  ])
  .superRefine((outcome, ctx) => {
    const invalid = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (outcome.kind !== "parse_failed" && outcome.trace === null)
      invalid("Successful replay requires immutable trace");
    if (
      outcome.kind === "normalized" &&
      (outcome.observations.some(
        (observation) => observation.quality.blocking,
      ) ||
        outcome.issues.some((issue) => issue.severity === "error"))
    )
      invalid("Normalized output cannot hide blocking issues");
    if (
      outcome.kind === "quarantined" &&
      !outcome.observations.some(
        (observation) => observation.quality.blocking,
      ) &&
      !outcome.issues.some((issue) => issue.severity === "error")
    )
      invalid("Quarantine requires a blocking issue");
    if (
      outcome.kind === "parse_failed" &&
      !outcome.issues.some((issue) => issue.severity === "error")
    )
      invalid("Parse failure requires a reason");
    const seen = new Set<number>();
    for (const entry of outcome.rental_evidence) {
      const observation = outcome.observations[entry.observation_index];
      if (seen.has(entry.observation_index))
        invalid("Duplicate rental evidence");
      seen.add(entry.observation_index);
      if (
        !observation ||
        observation.quality.blocking ||
        outcome.trace?.origin.kind !== "permitted_source"
      ) {
        invalid("Rental evidence must reference a clean observed listing");
        continue;
      }
      if (
        entry.evidence.source_key !== outcome.trace.origin.source_key ||
        entry.evidence.collected_at !== outcome.trace.origin.collected_at
      )
        invalid("Rental evidence must match acquisition provenance");
      for (const [key, value] of Object.entries(entry.evidence)) {
        if (
          key !== "origin" &&
          observation[key as keyof typeof observation] !== value
        )
          invalid("Rental evidence must match source fields");
      }
    }
  });
export type ExtractedObservation = z.infer<typeof extractedObservationSchema>;
export type ExtractedFieldProvenance = z.infer<
  typeof extractedFieldProvenanceSchema
>;
export type ExtractionIssue = z.infer<typeof extractionIssueSchema>;
export type ExtractionOutcome = z.infer<typeof extractionOutcomeSchema>;
export type RentalEvidence = z.infer<typeof rentalEvidenceSchema>;

/** Non-URL penalties saturate separately so a missing URL always costs ten points. */
export function scoreListingQuality(issues: readonly ExtractionIssue[]) {
  const unique = [
    ...new Map(
      issues.map((issue) => [`${issue.code}:${issue.field ?? ""}`, issue]),
    ).values(),
  ];
  const otherPenalty = Math.min(
    70,
    unique
      .filter((issue) => issue.code !== "missing_stable_listing_url")
      .reduce((sum, issue) => sum + (issue.severity === "error" ? 10 : 2), 0),
  );
  return {
    ruleset: "listing-quality-v1" as const,
    index:
      100 -
      otherPenalty -
      (unique.some((issue) => issue.code === "missing_stable_listing_url")
        ? 10
        : 0),
    blocking: issues.some((issue) => issue.severity === "error"),
  };
}
