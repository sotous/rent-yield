/** Explicitly synthetic contract examples: these authorize no real source access. */
export const methodologyManifestExample = {
  contract_version: "v1",
  methodology_key: "synthetic-detail-v1",
  scope: {
    source_key: "synthetic-source",
    city_key: "barranquilla",
    country_code: "CO",
    capability: "detail",
    listing_roles: ["for_rent"],
  },
  assessment_hash: "a".repeat(64),
  evidence_hashes: ["b".repeat(64)],
  recheck_after: "2026-09-09T00:00:00.000Z",
  adapter: {
    key: "synthetic-detail",
    artifact_hash: "c".repeat(64),
    parser_version: "1.0.0",
    normalizer_version: "1.0.0",
    extraction_contract_hash: "d".repeat(64),
    supported_contract_version: "v1",
  },
  access_scope: { hosts: ["fixtures.example"], path_prefixes: ["/listings/"] },
  permitted_operations: ["read_detail"],
  strategy: "structured_json",
  budget: {
    max_requests: 2,
    max_bytes: 1024,
    max_duration_ms: 1000,
    max_redirects: 0,
    max_concurrency: 1,
    max_source_requests: 2,
  },
  circuit_breaker: {
    stop_on: [
      "access_denied",
      "rate_limited",
      "challenge",
      "policy_mismatch",
      "parser_drift",
    ],
    max_consecutive_failures: 1,
  },
  fixture_hashes: ["e".repeat(64)],
  redaction: {
    policy_key: "synthetic-redaction-v1",
    policy_hash: "f".repeat(64),
  },
  retention: {
    policy_key: "synthetic-fixtures-v1",
    policy_hash: "0".repeat(64),
    permitted_uses: ["parser_replay", "evidence_audit"],
    body_representation: "redacted_fixture",
    retain_images: false,
  },
};

export const methodologyValidationReportExample = {
  contract_version: "v1",
  manifest_hash: "1".repeat(64),
  adapter_artifact_hash: "c".repeat(64),
  fixture_hashes: ["e".repeat(64)],
  extraction_contract_hash: "d".repeat(64),
  validated_at: "2026-09-08T12:00:00.000Z",
  validator_version: "1.0.0",
  outcome: "passed",
  checks_run: 5,
  issues: [],
};

export const methodologyReviewDecisionExample = {
  contract_version: "v1",
  decision_event_id: "review-1",
  manifest_hash: "1".repeat(64),
  validation_report_hash: "2".repeat(64),
  decision: "approved",
  sequence: 1,
  effective_from: "2026-09-08T13:00:00.000Z",
  effective_to: null,
  recorded_at: "2026-09-08T13:00:00.000Z",
  reviewer_key: "human-reviewer-1",
  reason_code: "fixture_validation_approved",
};

export const methodologyLookupExample = {
  contract_version: "v1",
  accepted_contract_version: "v1",
  source_key: "synthetic-source",
  city_key: "barranquilla",
  country_code: "CO",
  capability: "detail",
  listing_role: "for_rent",
  effective_at: "2026-09-08T14:00:00.000Z",
  recorded_as_of: "2026-09-08T14:00:00.000Z",
};
