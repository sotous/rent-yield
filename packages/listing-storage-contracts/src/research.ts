import { z } from "zod";
import {
  capabilitySchema,
  contractVersionSchema,
  identifierSchema,
  instantSchema,
  listingRoleSchema,
  qualityIssueSchema,
  safeNonNegativeIntegerSchema,
  sha256Schema,
  sourceDateSchema,
} from "./primitives.js";

/** Structural contracts do not grant network permission or sanitize content. */
const textSchema = z.string().min(1).max(2048);
const httpsUrlSchema = z.url({ protocol: /^https$/ }).refine((value) => {
  try {
    const url = new URL(value);
    return url.username === "" && url.password === "";
  } catch {
    return false;
  }
}, "URL credentials are not permitted");
const uniqueStrings = (values: readonly string[]) =>
  new Set(values).size === values.length;
const positiveIntegerSchema = safeNonNegativeIntegerSchema.min(1);
export const researchIssueSchema = qualityIssueSchema;
export const researchScopeSchema = z.strictObject({
  source_key: identifierSchema,
  country_code: z.literal("CO"),
  city_key: identifierSchema,
  capability: capabilitySchema,
  listing_roles: z
    .array(listingRoleSchema)
    .min(1)
    .max(2)
    .refine(uniqueStrings, "Duplicate listing role"),
});
export const evidenceReferenceSchema = z.strictObject({
  url: httpsUrlSchema,
  observed_at: instantSchema,
  effective_date: sourceDateSchema.optional(),
  declared_version: identifierSchema.optional(),
  sha256: sha256Schema.nullable(),
  conclusion: textSchema,
  excerpt: z.string().max(2048).nullable(),
});

export const sourceCandidateSchema = z.strictObject({
  contract_version: contractVersionSchema,
  candidate_id: identifierSchema,
  supersedes_candidate_id: identifierSchema.optional(),
  scope: researchScopeSchema,
  homepage_url: httpsUrlSchema,
  registered_at: instantSchema,
  evidence: z.array(evidenceReferenceSchema),
  unknowns: z.array(textSchema),
});

export const accessAssessmentSchema = z.strictObject({
  contract_version: contractVersionSchema,
  assessment_id: identifierSchema,
  candidate_id: identifierSchema,
  scope: researchScopeSchema,
  assessed_at: instantSchema,
  result: z.enum([
    "allowed_for_probe",
    "approval_required",
    "disallowed",
    "unknown",
  ]),
  technical_access: z.enum(["allowed", "blocked", "unknown"]),
  contractual_access: z.enum([
    "allowed",
    "blocked",
    "approval_required",
    "unknown",
  ]),
  evidence: z.array(evidenceReferenceSchema),
  unknowns: z.array(textSchema),
  issues: z.array(researchIssueSchema),
  recheck_at: instantSchema,
});

/** Policy enforcement and cross-field budget checking belong to the probe tool. */
export const probeBudgetSchema = z.strictObject({
  max_requests: positiveIntegerSchema,
  max_bytes: positiveIntegerSchema,
  max_duration_ms: positiveIntegerSchema,
  max_redirects: safeNonNegativeIntegerSchema,
  max_concurrency: positiveIntegerSchema,
  max_source_requests: positiveIntegerSchema,
});
export const probeResponseEvidenceSchema = z.strictObject({
  url: httpsUrlSchema,
  collected_at: instantSchema,
  status_code: safeNonNegativeIntegerSchema.min(100).max(599).nullable(),
  content_type: z.string().min(1).max(256).nullable(),
  body: z.discriminatedUnion("complete", [
    z.strictObject({
      complete: z.literal(true),
      sha256: sha256Schema,
      byte_length: safeNonNegativeIntegerSchema,
    }),
    z.strictObject({
      complete: z.literal(false),
      received_sha256: sha256Schema,
      byte_length: safeNonNegativeIntegerSchema,
    }),
  ]),
  redirect_location: httpsUrlSchema.nullable(),
});
export const probeResultSchema = z.strictObject({
  contract_version: contractVersionSchema,
  probe_id: identifierSchema,
  assessment_id: identifierSchema.nullable(),
  assessment_sha256: sha256Schema.nullable(),
  scope: researchScopeSchema,
  completed_at: instantSchema,
  budget: probeBudgetSchema,
  usage: z.strictObject({
    requests: safeNonNegativeIntegerSchema,
    bytes: safeNonNegativeIntegerSchema,
    duration_ms: safeNonNegativeIntegerSchema,
    redirects: safeNonNegativeIntegerSchema,
  }),
  outcome: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("completed"),
      discovered_urls: z.array(httpsUrlSchema),
    }),
    z.strictObject({
      kind: z.literal("stopped"),
      reason: z.enum([
        "robots_conflict",
        "policy_mismatch",
        "unauthorized",
        "forbidden",
        "rate_limited",
        "challenge",
        "authentication_required",
        "host_blocked",
        "path_blocked",
        "ip_blocked",
        "budget_exhausted",
        "redirect_blocked",
        "transport_error",
        "access_unknown",
      ]),
    }),
  ]),
  evidence: z.array(evidenceReferenceSchema),
  response_evidence: z.array(probeResponseEvidenceSchema).max(20),
  issues: z.array(researchIssueSchema),
});

export const fixtureOriginSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("permitted_source"),
    source_key: identifierSchema,
    source_url: httpsUrlSchema,
    collected_at: instantSchema,
    assessment_sha256: sha256Schema,
    original_entity_sha256: sha256Schema.nullable(),
  }),
  z.strictObject({
    kind: z.literal("synthetic"),
    scenario: textSchema,
    generated_at: instantSchema,
  }),
]);
export const fixtureEnvelopeSchema = z.strictObject({
  contract_version: contractVersionSchema,
  fixture_id: identifierSchema,
  origin: fixtureOriginSchema,
  created_at: instantSchema,
  representation: z.literal("redacted_fixture"),
  payload_sha256: sha256Schema,
  content_type: z.enum(["application/json", "text/html", "text/plain"]),
  encoding: z.literal("utf-8"),
  byte_length: safeNonNegativeIntegerSchema,
  redaction_version: identifierSchema,
  redaction_sha256: sha256Schema,
  permitted_use: z
    .array(z.enum(["parser_replay", "evidence_audit"]))
    .min(1)
    .max(2)
    .refine(uniqueStrings, "Duplicate permitted use"),
  retention_policy_key: identifierSchema,
  methodology_proposal_id: identifierSchema,
  parser_compatibility: z
    .array(identifierSchema)
    .min(1)
    .refine(uniqueStrings, "Duplicate parser"),
  expected_classification: z.enum([
    "normalized",
    "quarantined",
    "parse_failed",
    "capture_only",
  ]),
  successor_fixture_id: identifierSchema.nullable(),
});

export const extractionMappingSchema = z.strictObject({
  field: z.enum([
    "asking_amount",
    "currency",
    "frequency",
    "fee_scope",
    "administration_amount",
    "utilities_amount",
    "parking_amount",
    "area_value",
    "area_kind",
    "source_published_at",
    "source_updated_at",
    "listing_role",
    "source_listing_id",
    "city",
    "area",
    "property_type",
    "title",
    "address_label",
    "bedrooms",
    "bathrooms",
    "social_stratum",
    "listing_status",
    "latitude",
    "longitude",
  ]),
  locator: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("json_pointer"),
      pointer: z.string().regex(/^(?:\/(?:[^~]|~[01])*)*$/),
    }),
    z.strictObject({
      kind: z.literal("dom_path"),
      segments: z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1),
    }),
    z.strictObject({ kind: z.literal("text_label"), label: textSchema }),
  ]),
  transforms: z
    .array(
      z.enum([
        "identity",
        "trim",
        "collapse_whitespace",
        "parse_decimal",
        "parse_currency",
        "parse_frequency",
        "parse_source_date",
        "map_listing_role",
        "map_area_kind",
      ]),
    )
    .min(1),
  required: z.boolean(),
});
export const extractionContractSchema = z.strictObject({
  contract_version: contractVersionSchema,
  extraction_contract_id: identifierSchema,
  scope: researchScopeSchema,
  fixture_sha256s: z
    .array(sha256Schema)
    .min(1)
    .refine(uniqueStrings, "Duplicate fixture digest"),
  created_at: instantSchema,
  mappings: z.array(extractionMappingSchema).min(1),
  claim_status: z.enum(["hypothesis", "fixture_observed"]),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.array(evidenceReferenceSchema),
  unknowns: z.array(textSchema),
  issues: z.array(researchIssueSchema),
});

export type ResearchScope = z.infer<typeof researchScopeSchema>;
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>;
export type ResearchIssue = z.infer<typeof researchIssueSchema>;
export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;
export type AccessAssessment = z.infer<typeof accessAssessmentSchema>;
export type ProbeBudget = z.infer<typeof probeBudgetSchema>;
export type ProbeResult = z.infer<typeof probeResultSchema>;
export type ProbeResponseEvidence = z.infer<typeof probeResponseEvidenceSchema>;
export type FixtureEnvelope = z.infer<typeof fixtureEnvelopeSchema>;
export type ExtractionMapping = z.infer<typeof extractionMappingSchema>;
export type ExtractionContract = z.infer<typeof extractionContractSchema>;
