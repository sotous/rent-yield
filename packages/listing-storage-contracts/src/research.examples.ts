/** Entirely synthetic examples; these are not source assessments or permissions. */
const at = "2026-09-08T12:00:00.000Z";
const digest = "a".repeat(64);
const scope = {
  source_key: "synthetic-example",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "discovery",
  listing_roles: ["for_rent"],
};
const candidate = {
  contract_version: "v1",
  candidate_id: "candidate-1",
  scope,
  homepage_url: "https://example.com/",
  registered_at: at,
  evidence: [],
  unknowns: ["access policy"],
};
const assessment = {
  contract_version: "v1",
  assessment_id: "assessment-1",
  candidate_id: "candidate-1",
  scope,
  assessed_at: at,
  result: "unknown",
  technical_access: "unknown",
  contractual_access: "unknown",
  evidence: [],
  unknowns: ["license"],
  issues: [],
  recheck_at: at,
};
const probe = {
  contract_version: "v1",
  probe_id: "probe-1",
  assessment_id: "assessment-1",
  assessment_sha256: digest,
  scope,
  completed_at: at,
  budget: {
    max_requests: 3,
    max_bytes: 1000,
    max_duration_ms: 1000,
    max_redirects: 0,
    max_concurrency: 1,
    max_source_requests: 3,
  },
  usage: { requests: 0, bytes: 0, duration_ms: 0, redirects: 0 },
  outcome: { kind: "stopped", reason: "access_unknown" },
  evidence: [],
  response_evidence: [],
  issues: [],
};
const fixture = {
  contract_version: "v1",
  fixture_id: "fixture-1",
  origin: {
    kind: "synthetic",
    scenario: "ambiguous rent fee",
    generated_at: at,
  },
  created_at: at,
  representation: "redacted_fixture",
  envelope_sha256: digest,
  payload_sha256: digest,
  content_type: "application/json",
  encoding: "utf-8",
  byte_length: 10,
  redaction_version: "redaction-v1",
  redaction_sha256: digest,
  permitted_use: ["parser_replay"],
  retention_policy_key: "fixture-policy",
  research_session_id: "research-session-1",
  parser_compatibility: ["parser-v1"],
  expected_classification: "quarantined",
  supersedes_fixture_id: null,
};
const extraction = {
  contract_version: "v1",
  extraction_contract_id: "extraction-1",
  scope,
  fixture_sha256s: [digest],
  created_at: at,
  mappings: [
    {
      field: "area_kind",
      locator: { kind: "json_pointer", pointer: "/area/type" },
      transforms: ["identity"],
      required: true,
    },
  ],
  claim_status: "hypothesis",
  confidence: "low",
  evidence: [],
  unknowns: ["area meaning"],
  issues: [],
};

export const researchExamples: readonly {
  name: string;
  schema:
    | "source_candidate"
    | "access_assessment"
    | "probe_result"
    | "fixture_envelope"
    | "extraction_contract";
  valid: boolean;
  value: unknown;
}[] = [
  {
    name: "unassessed synthetic candidate",
    schema: "source_candidate",
    valid: true,
    value: candidate,
  },
  {
    name: "unsupported candidate version",
    schema: "source_candidate",
    valid: false,
    value: { ...candidate, contract_version: "v2" },
  },
  {
    name: "unknown assessment",
    schema: "access_assessment",
    valid: true,
    value: assessment,
  },
  {
    name: "invented assessment result",
    schema: "access_assessment",
    valid: false,
    value: { ...assessment, result: "probably_allowed" },
  },
  {
    name: "mock probe stopped before request",
    schema: "probe_result",
    valid: true,
    value: probe,
  },
  {
    name: "probe credential injection",
    schema: "probe_result",
    valid: false,
    value: { ...probe, cookies: "secret" },
  },
  {
    name: "synthetic redacted fixture",
    schema: "fixture_envelope",
    valid: true,
    value: fixture,
  },
  {
    name: "fixture origin confusion",
    schema: "fixture_envelope",
    valid: false,
    value: {
      ...fixture,
      origin: { ...fixture.origin, source_url: "https://example.com/listing" },
    },
  },
  {
    name: "hypothetical extraction",
    schema: "extraction_contract",
    valid: true,
    value: extraction,
  },
  {
    name: "executable extraction injection",
    schema: "extraction_contract",
    valid: false,
    value: { ...extraction, script: "eval(input)" },
  },
];
