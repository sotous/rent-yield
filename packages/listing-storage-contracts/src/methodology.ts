import { z } from "zod";
import {
  capabilitySchema,
  contractVersionSchema,
  identifierSchema,
  instantSchema,
  listingRoleSchema,
  safeNonNegativeIntegerSchema,
  sha256Schema,
} from "./primitives.js";
import {
  researchScopeSchema,
  probeBudgetSchema,
  researchIssueSchema,
} from "./research.js";

const hashSetSchema = z
  .array(sha256Schema)
  .min(1)
  .max(1000)
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate set member",
  );
const identifierSetSchema = z
  .array(identifierSchema)
  .min(1)
  .max(1000)
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate set member",
  );
const policyReferenceSchema = z.strictObject({
  policy_key: identifierSchema,
  policy_hash: sha256Schema,
});

/** Immutable declarative payload. A hash or review state cannot enter its preimage. */
export const methodologyManifestSchema = z.strictObject({
  contract_version: contractVersionSchema,
  methodology_key: identifierSchema,
  scope: researchScopeSchema,
  assessment_hash: sha256Schema,
  evidence_hashes: hashSetSchema,
  recheck_after: instantSchema,
  adapter: z.strictObject({
    key: identifierSchema,
    artifact_hash: sha256Schema,
    parser_version: identifierSchema,
    normalizer_version: identifierSchema,
    extraction_contract_hash: sha256Schema,
    supported_contract_version: contractVersionSchema,
  }),
  access_scope: z.strictObject({
    hosts: z
      .array(
        z
          .string()
          .max(253)
          .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/),
      )
      .min(1)
      .refine((values) => new Set(values).size === values.length),
    path_prefixes: z
      .array(
        z
          .string()
          .max(1024)
          .regex(/^\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]*$/)
          .refine(
            (value) =>
              !value
                .split("/")
                .some((segment) => segment === ".." || segment === "."),
          ),
      )
      .min(1)
      .refine((values) => new Set(values).size === values.length),
  }),
  permitted_operations: z
    .array(
      z.enum(["discover_listings", "read_detail", "extract_rental_evidence"]),
    )
    .min(1)
    .refine((values) => new Set(values).size === values.length),
  strategy: z.enum(["structured_json", "structured_html", "dom_text"]),
  budget: probeBudgetSchema,
  circuit_breaker: z.strictObject({
    stop_on: z
      .array(
        z.enum([
          "access_denied",
          "rate_limited",
          "challenge",
          "policy_mismatch",
          "parser_drift",
          "robots_conflict",
          "authentication_required",
        ]),
      )
      .min(1)
      .refine((values) => new Set(values).size === values.length),
    max_consecutive_failures: safeNonNegativeIntegerSchema.min(1),
  }),
  fixture_hashes: hashSetSchema,
  redaction: policyReferenceSchema,
  retention: z.strictObject({
    ...policyReferenceSchema.shape,
    permitted_uses: z
      .array(z.enum(["parser_replay", "evidence_audit"]))
      .min(1)
      .refine((values) => new Set(values).size === values.length),
    body_representation: z.enum(["original_entity", "redacted_fixture"]),
    retain_images: z.literal(false),
  }),
});

export const methodologyValidationReportSchema = z
  .strictObject({
    contract_version: contractVersionSchema,
    manifest_hash: sha256Schema,
    adapter_artifact_hash: sha256Schema,
    fixture_hashes: hashSetSchema,
    extraction_contract_hash: sha256Schema,
    validated_at: instantSchema,
    validator_version: identifierSchema,
    outcome: z.enum(["passed", "failed"]),
    checks_run: safeNonNegativeIntegerSchema.min(1),
    issues: z.array(researchIssueSchema),
  })
  .refine(
    (report) => report.outcome !== "passed" || report.issues.length === 0,
    "Successful validation cannot contain unresolved issues",
  );

/** Structure is validated here; authorization and report verification belong to review services. */
export const methodologyReviewDecisionSchema = z
  .strictObject({
    contract_version: contractVersionSchema,
    decision_event_id: identifierSchema,
    manifest_hash: sha256Schema,
    validation_report_hash: sha256Schema.nullable(),
    decision: z.enum(["approved", "paused", "revoked", "rejected", "retired"]),
    sequence: safeNonNegativeIntegerSchema.min(1),
    effective_from: instantSchema,
    effective_to: instantSchema.nullable(),
    recorded_at: instantSchema,
    reviewer_key: identifierSchema,
    reason_code: identifierSchema,
  })
  .superRefine((event, context) => {
    if (
      event.decision === "approved" &&
      event.validation_report_hash === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["validation_report_hash"],
        message: "Approval requires a validation report reference",
      });
    }
    if (event.decision !== "approved" && event.effective_to !== null) {
      context.addIssue({
        code: "custom",
        path: ["effective_to"],
        message: "Non-approval decisions must be open-ended",
      });
    }
    if (
      event.effective_to !== null &&
      event.effective_to <= event.effective_from
    ) {
      context.addIssue({
        code: "custom",
        path: ["effective_to"],
        message: "Effective interval must have positive duration",
      });
    }
  });

export const methodologyLookupSchema = z.strictObject({
  contract_version: contractVersionSchema,
  accepted_contract_version: contractVersionSchema,
  source_key: identifierSchema,
  city_key: identifierSchema,
  country_code: z.literal("CO"),
  capability: capabilitySchema,
  listing_role: listingRoleSchema,
  effective_at: instantSchema,
  recorded_as_of: instantSchema,
});

export const sourceHealthEventSchema = z.strictObject({
  contract_version: contractVersionSchema,
  event_id: identifierSchema,
  source_key: identifierSchema,
  methodology_hash: sha256Schema.nullable(),
  policy_hash: sha256Schema.nullable(),
  occurred_at: instantSchema,
  code: z.enum([
    "access_denied",
    "rate_limited",
    "challenge",
    "policy_mismatch",
    "parser_drift",
    "robots_conflict",
    "authentication_required",
    "budget_exhausted",
    "source_unavailable",
  ]),
  severity: z.enum(["warning", "error"]),
  issue_codes: identifierSetSchema,
});

export type MethodologyManifestV1 = z.infer<typeof methodologyManifestSchema>;
export type MethodologyValidationReportV1 = z.infer<
  typeof methodologyValidationReportSchema
>;
export type MethodologyReviewDecisionV1 = z.infer<
  typeof methodologyReviewDecisionSchema
>;
export type MethodologyLookupV1 = z.infer<typeof methodologyLookupSchema>;
export type SourceHealthEventV1 = z.infer<typeof sourceHealthEventSchema>;

/** Checks declared pins only; digest recomputation belongs to proposal intake. */
export const methodologyProposalSchema = z
  .strictObject({
    contract_version: contractVersionSchema,
    manifest_hash: sha256Schema,
    manifest: methodologyManifestSchema,
    validation_report_hash: sha256Schema,
    validation_report: methodologyValidationReportSchema,
  })
  .superRefine((proposal, context) => {
    const report = proposal.validation_report;
    const manifest = proposal.manifest;
    for (const [field, expected] of [
      ["manifest_hash", proposal.manifest_hash],
      ["adapter_artifact_hash", manifest.adapter.artifact_hash],
      ["extraction_contract_hash", manifest.adapter.extraction_contract_hash],
    ] as const) {
      if (report[field] !== expected) {
        context.addIssue({
          code: "custom",
          path: ["validation_report", field],
          message: "Artifact reference mismatch",
        });
      }
    }
    if (
      report.fixture_hashes.length !== manifest.fixture_hashes.length ||
      !report.fixture_hashes.every((hash) =>
        manifest.fixture_hashes.includes(hash),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["validation_report", "fixture_hashes"],
        message: "Fixture reference mismatch",
      });
    }
  });
export type MethodologyProposalV1 = z.infer<typeof methodologyProposalSchema>;
