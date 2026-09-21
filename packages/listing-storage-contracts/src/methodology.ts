import { createHash } from "node:crypto";
import { z } from "zod";
import { canonicalJson, canonicalSet } from "./canonical.js";
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

const sha256 = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

/** Canonicalizes only the set-valued manifest paths agreed by the v1 contract. */
export function canonicalMethodologyManifest(
  input: unknown,
): MethodologyManifestV1 {
  const manifest = methodologyManifestSchema.parse(input);
  return {
    ...manifest,
    scope: {
      ...manifest.scope,
      listing_roles: canonicalSet(manifest.scope.listing_roles),
    },
    evidence_hashes: canonicalSet(manifest.evidence_hashes),
    access_scope: {
      ...manifest.access_scope,
      hosts: canonicalSet(manifest.access_scope.hosts),
      path_prefixes: canonicalSet(manifest.access_scope.path_prefixes),
    },
    permitted_operations: canonicalSet(manifest.permitted_operations),
    circuit_breaker: {
      ...manifest.circuit_breaker,
      stop_on: canonicalSet(manifest.circuit_breaker.stop_on),
    },
    fixture_hashes: canonicalSet(manifest.fixture_hashes),
    retention: {
      ...manifest.retention,
      permitted_uses: canonicalSet(manifest.retention.permitted_uses),
    },
  };
}

/** The immutable manifest digest never includes a review, report, or self hash. */
export function methodologyManifestDigest(input: unknown): string {
  return sha256(canonicalMethodologyManifest(input));
}

/** Validation reports canonicalize their declared fixture-hash set before hashing. */
export function methodologyValidationReportDigest(input: unknown): string {
  const report = methodologyValidationReportSchema.parse(input);
  return sha256({
    ...report,
    fixture_hashes: canonicalSet(report.fixture_hashes),
  });
}

// V2 is intentionally separate from V1: research records stay replayable while
// the runtime receives only an approved policy envelope through its resolver.
const v2ContractVersionSchema = z.literal("v2");
const uniqueSet = <T>(values: readonly T[]) =>
  new Set(values.map((value) => canonicalJson(value))).size === values.length;
const hostnameSchema = z
  .string()
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/);
const pathPrefixSchema = z
  .string()
  .max(1024)
  .regex(/^\/(?:[A-Za-z0-9_~.-]+\/)*[A-Za-z0-9_~.-]*$/)
  .refine(
    (value) =>
      !value.split("/").some((segment) => segment === ".." || segment === "."),
    "Path prefix cannot contain dot segments",
  );
const queryKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.~-]+$/);
const declaredQueryPairSchema = z.strictObject({
  key: queryKeySchema,
  // Review establishes that this literal is non-secret; the runtime retains only
  // the exact values that appear in this immutable manifest.
  value: z.string().min(1).max(512),
});
const queryPolicyV2Schema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("forbid") }),
  z
    .strictObject({
      kind: z.literal("declared"),
      exact_pairs: z.array(declaredQueryPairSchema).max(100),
      no_value_keys: z.array(queryKeySchema).max(100),
    })
    .superRefine((policy, context) => {
      if (policy.exact_pairs.length + policy.no_value_keys.length === 0) {
        context.addIssue({
          code: "custom",
          message:
            "Declared query policy requires at least one permitted query",
        });
      }
      if (!uniqueSet(policy.exact_pairs)) {
        context.addIssue({
          code: "custom",
          path: ["exact_pairs"],
          message: "Duplicate exact query pair",
        });
      }
      if (new Set(policy.no_value_keys).size !== policy.no_value_keys.length) {
        context.addIssue({
          code: "custom",
          path: ["no_value_keys"],
          message: "Duplicate no-value query key",
        });
      }
      const exactKeys = new Set(policy.exact_pairs.map(({ key }) => key));
      for (const key of policy.no_value_keys) {
        if (exactKeys.has(key)) {
          context.addIssue({
            code: "custom",
            path: ["no_value_keys"],
            message: "A query key cannot be both exact-value and no-value",
          });
        }
      }
    }),
]);
const retentionPolicyV2Schema = z.discriminatedUnion("body_representation", [
  z.strictObject({
    ...policyReferenceSchema.shape,
    permitted_uses: z
      .array(z.enum(["parser_replay", "evidence_audit"]))
      .min(1)
      .refine(uniqueSet),
    body_representation: z.literal("redacted_fixture"),
    retain_images: z.literal(false),
  }),
  z.strictObject({
    ...policyReferenceSchema.shape,
    permitted_uses: z
      .array(z.enum(["parser_replay", "evidence_audit"]))
      .min(1)
      .refine(uniqueSet),
    body_representation: z.literal("original_source_body"),
    // This is an explicit policy authorization, never an inferred fallback.
    original_body_media_types: z
      .array(z.enum(["application/json", "text/html"]))
      .min(1)
      .max(2)
      .refine(uniqueSet),
    retain_images: z.literal(false),
  }),
]);

const accessPolicyV2Schema = z.strictObject({
  hosts: z.array(hostnameSchema).min(1).max(1000).refine(uniqueSet),
  path_prefixes: z.array(pathPrefixSchema).min(1).max(1000).refine(uniqueSet),
  request_methods: z.array(z.literal("GET")).min(1).max(1).refine(uniqueSet),
  media_types: z
    .array(z.enum(["application/json", "text/html", "text/plain"]))
    .min(1)
    .max(3)
    .refine(uniqueSet),
  query: queryPolicyV2Schema,
  redirects: z.strictObject({
    https_only: z.literal(true),
    max_hops: safeNonNegativeIntegerSchema,
    host_rule: z.enum(["same_host", "declared_hosts"]),
  }),
  transport: z.strictObject({
    public_addresses_only: z.literal(true),
    tls_hostname_verification: z.literal(true),
    connection_timeout_ms: safeNonNegativeIntegerSchema.min(1),
    response_timeout_ms: safeNonNegativeIntegerSchema.min(1),
  }),
  headers: z.strictObject({ profile_key: identifierSchema.nullable() }),
  credentials_permitted: z.literal(false),
  cookies_permitted: z.literal(false),
});

/**
 * Immutable runtime policy. Candidate and assessment provenance are resolved by
 * trusted review services and deliberately do not appear in the runtime input.
 */
export const methodologyManifestV2Schema = z
  .strictObject({
    contract_version: v2ContractVersionSchema,
    methodology_key: identifierSchema,
    scope: researchScopeSchema,
    recheck_after: instantSchema,
    adapter: z.strictObject({
      key: identifierSchema,
      artifact_hash: sha256Schema,
      parser_version: identifierSchema,
      normalizer_version: identifierSchema,
      extraction_contract_hash: sha256Schema,
      supported_contract_version: v2ContractVersionSchema,
    }),
    access_policy: accessPolicyV2Schema,
    permitted_operations: z
      .array(
        z.enum(["discover_listings", "read_detail", "extract_rental_evidence"]),
      )
      .min(1)
      .refine(uniqueSet),
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
        .refine(uniqueSet),
      max_consecutive_failures: safeNonNegativeIntegerSchema.min(1),
    }),
    fixture_hashes: hashSetSchema,
    redaction: policyReferenceSchema,
    retention: retentionPolicyV2Schema,
  })
  .superRefine((manifest, context) => {
    if (
      manifest.access_policy.redirects.max_hops > manifest.budget.max_redirects
    ) {
      context.addIssue({
        code: "custom",
        path: ["access_policy", "redirects", "max_hops"],
        message: "Redirect policy cannot exceed the approved request budget",
      });
    }
    if (
      manifest.access_policy.transport.connection_timeout_ms >
      manifest.budget.max_duration_ms
    ) {
      context.addIssue({
        code: "custom",
        path: ["access_policy", "transport", "connection_timeout_ms"],
        message:
          "Connection timeout cannot exceed the approved duration budget",
      });
    }
    if (
      manifest.retention.body_representation === "original_source_body" &&
      !manifest.retention.original_body_media_types.every((mediaType) =>
        manifest.access_policy.media_types.includes(mediaType),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["retention", "original_body_media_types"],
        message:
          "Original body retention must be a subset of the approved media types",
      });
    }
    if (
      manifest.access_policy.transport.response_timeout_ms >
      manifest.budget.max_duration_ms
    ) {
      context.addIssue({
        code: "custom",
        path: ["access_policy", "transport", "response_timeout_ms"],
        message: "Response timeout cannot exceed the approved duration budget",
      });
    }
  });

/** Exact runtime resolver scope; candidate and assessment identity stay upstream. */
export const methodologyLookupV2Schema = z.strictObject({
  contract_version: v2ContractVersionSchema,
  accepted_contract_version: v2ContractVersionSchema,
  source_key: identifierSchema,
  country_code: z.literal("CO"),
  city_key: identifierSchema,
  capability: capabilitySchema,
  listing_role: listingRoleSchema,
  effective_at: instantSchema,
  recorded_as_of: instantSchema,
});

export type MethodologyManifestV2 = z.infer<typeof methodologyManifestV2Schema>;
export type MethodologyLookupV2 = z.infer<typeof methodologyLookupV2Schema>;

/** Canonicalizes every V2 policy collection that is semantically a set. */
export function canonicalMethodologyManifestV2(
  input: unknown,
): MethodologyManifestV2 {
  const manifest = methodologyManifestV2Schema.parse(input);
  const query = manifest.access_policy.query;
  return {
    ...manifest,
    scope: {
      ...manifest.scope,
      listing_roles: canonicalSet(manifest.scope.listing_roles),
    },
    access_policy: {
      ...manifest.access_policy,
      hosts: canonicalSet(manifest.access_policy.hosts),
      path_prefixes: canonicalSet(manifest.access_policy.path_prefixes),
      request_methods: canonicalSet(manifest.access_policy.request_methods),
      media_types: canonicalSet(manifest.access_policy.media_types),
      query:
        query.kind === "forbid"
          ? query
          : {
              ...query,
              exact_pairs: canonicalSet(query.exact_pairs),
              no_value_keys: canonicalSet(query.no_value_keys),
            },
    },
    permitted_operations: canonicalSet(manifest.permitted_operations),
    circuit_breaker: {
      ...manifest.circuit_breaker,
      stop_on: canonicalSet(manifest.circuit_breaker.stop_on),
    },
    fixture_hashes: canonicalSet(manifest.fixture_hashes),
    retention:
      manifest.retention.body_representation === "redacted_fixture"
        ? {
            ...manifest.retention,
            permitted_uses: canonicalSet(manifest.retention.permitted_uses),
          }
        : {
            ...manifest.retention,
            permitted_uses: canonicalSet(manifest.retention.permitted_uses),
            original_body_media_types: canonicalSet(
              manifest.retention.original_body_media_types,
            ),
          },
  };
}

export function methodologyManifestDigestV2(input: unknown): string {
  return sha256(canonicalMethodologyManifestV2(input));
}
