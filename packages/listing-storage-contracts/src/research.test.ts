import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  accessAssessmentSchema,
  extractionContractSchema,
  fixtureEnvelopeSchema,
  probeBudgetSchema,
  probeResultSchema,
  sourceCandidateSchema,
} from "./research.js";

const instant = "2026-09-08T12:00:00.000Z";
const hash = "a".repeat(64);
const scope = {
  source_key: "sample",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "discovery",
  listing_roles: ["for_rent"],
};
const evidence = {
  url: "https://example.com/policy",
  observed_at: instant,
  sha256: hash,
  conclusion: "Requires review",
  excerpt: null,
};
const budget = {
  max_requests: 3,
  max_bytes: 1000,
  max_duration_ms: 1000,
  max_redirects: 0,
  max_concurrency: 1,
  max_source_requests: 3,
};
const assessment = {
  contract_version: "v1",
  assessment_id: "assessment-1",
  candidate_id: "candidate-1",
  scope,
  assessed_at: instant,
  result: "unknown",
  technical_access: "unknown",
  contractual_access: "unknown",
  evidence: [evidence],
  unknowns: ["license"],
  issues: [],
  recheck_at: instant,
};
const fixture = {
  contract_version: "v1",
  fixture_id: "fixture-1",
  origin: {
    kind: "synthetic",
    scenario: "ambiguous rent fee",
    generated_at: instant,
  },
  created_at: instant,
  representation: "redacted_fixture",
  payload_sha256: hash,
  content_type: "application/json",
  encoding: "utf-8",
  byte_length: 10,
  redaction_version: "redaction-v1",
  redaction_sha256: hash,
  permitted_use: ["parser_replay"],
  retention_policy_key: "fixture-policy",
  methodology_proposal_id: "proposal-1",
  parser_compatibility: ["parser-v1"],
  expected_classification: "quarantined",
  successor_fixture_id: null,
};

describe("research contracts", () => {
  it("accepts a candidate with unresolved evidence and rejects version or authority injection", () => {
    const value = {
      contract_version: "v1",
      candidate_id: "candidate-1",
      scope,
      homepage_url: "https://example.com/",
      registered_at: instant,
      evidence: [],
      unknowns: ["access policy"],
    };
    expect(sourceCandidateSchema.safeParse(value).success).toBe(true);
    expect(
      sourceCandidateSchema.safeParse({ ...value, contract_version: "v2" })
        .success,
    ).toBe(false);
    expect(
      sourceCandidateSchema.safeParse({ ...value, approved: true }).success,
    ).toBe(false);
    expect(
      sourceCandidateSchema.safeParse({
        ...value,
        candidate_id: "candidate-2",
        supersedes_candidate_id: "candidate-1",
      }).success,
    ).toBe(true);
  });
  it("preserves unknown technical and contractual assessments without requiring policy bodies", () => {
    expect(accessAssessmentSchema.parse(assessment)).toEqual(assessment);
    expect(
      accessAssessmentSchema.safeParse({
        ...assessment,
        result: "probably_allowed",
      }).success,
    ).toBe(false);
    expect(
      accessAssessmentSchema.safeParse({
        ...assessment,
        evidence: [{ ...evidence, raw_body: "unredacted" }],
      }).success,
    ).toBe(false);
  });
  it("bounds all probe counts and cannot carry credential or arbitrary header fields", () => {
    expect(probeBudgetSchema.safeParse(budget).success).toBe(true);
    for (const max_requests of [-1, 0, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        probeBudgetSchema.safeParse({ ...budget, max_requests }).success,
      ).toBe(false);
    }
    const value = {
      contract_version: "v1",
      probe_id: "probe-1",
      assessment_id: "assessment-1",
      assessment_sha256: hash,
      scope,
      completed_at: instant,
      budget,
      usage: { requests: 1, bytes: 0, duration_ms: 2, redirects: 0 },
      outcome: { kind: "stopped", reason: "challenge" },
      evidence: [],
      response_evidence: [
        {
          url: "https://example.com/listings",
          collected_at: instant,
          status_code: 200,
          content_type: "text/html",
          body: { complete: true, sha256: hash, byte_length: 10 },
          redirect_location: null,
        },
      ],
      issues: [],
    };
    expect(probeResultSchema.safeParse(value).success).toBe(true);
    expect(
      probeResultSchema.safeParse({
        ...value,
        headers: { authorization: "secret" },
      }).success,
    ).toBe(false);
    expect(
      probeResultSchema.safeParse({
        ...value,
        outcome: { kind: "stopped", reason: "retry_with_proxy" },
      }).success,
    ).toBe(false);
  });
  it("distinguishes synthetic fixtures from source captures and excludes binary/raw artifacts", () => {
    expect(fixtureEnvelopeSchema.safeParse(fixture).success).toBe(true);
    expect(
      fixtureEnvelopeSchema.safeParse({
        ...fixture,
        origin: {
          ...fixture.origin,
          source_url: "https://example.com/listing",
        },
      }).success,
    ).toBe(false);
    expect(
      fixtureEnvelopeSchema.safeParse({
        ...fixture,
        origin: {
          kind: "permitted_source",
          source_key: "sample",
          source_url: "https://example.com/listing",
          collected_at: instant,
          assessment_sha256: hash,
          original_entity_sha256: null,
        },
      }).success,
    ).toBe(true);
    expect(
      fixtureEnvelopeSchema.safeParse({
        ...fixture,
        content_type: "image/jpeg",
      }).success,
    ).toBe(false);
    expect(
      fixtureEnvelopeSchema.safeParse({
        ...fixture,
        representation: "original_entity",
      }).success,
    ).toBe(false);
    expect(
      fixtureEnvelopeSchema.safeParse({
        ...fixture,
        raw_body: "contact details",
      }).success,
    ).toBe(false);
  });
  it("allows declarative extraction with explicit hypotheses, never executable selectors or transforms", () => {
    const value = {
      contract_version: "v1",
      extraction_contract_id: "extraction-1",
      scope,
      fixture_sha256s: [hash],
      created_at: instant,
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
    expect(extractionContractSchema.safeParse(value).success).toBe(true);
    expect(
      extractionContractSchema.safeParse({
        ...value,
        mappings: [{ ...value.mappings[0], transforms: ["eval"] }],
      }).success,
    ).toBe(false);
    expect(
      extractionContractSchema.safeParse({
        ...value,
        mappings: [
          {
            ...value.mappings[0],
            locator: { kind: "css", selector: "script" },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("maps approved residential traits while rejecting arbitrary targets", () => {
    const value = {
      contract_version: "v1",
      extraction_contract_id: "extraction-1",
      scope,
      fixture_sha256s: [hash],
      created_at: instant,
      mappings: [
        {
          field: "social_stratum",
          locator: { kind: "json_pointer", pointer: "/features/estrato" },
          transforms: ["parse_decimal"],
          required: false,
        },
      ],
      claim_status: "fixture_observed",
      confidence: "medium",
      evidence: [],
      unknowns: [],
      issues: [],
    };
    expect(extractionContractSchema.safeParse(value).success).toBe(true);
    expect(
      extractionContractSchema.safeParse({
        ...value,
        mappings: [{ ...value.mappings[0], field: "owner_phone" }],
      }).success,
    ).toBe(false);
  });
  it("preserves policy effective dates and versions apart from retrieval time", () => {
    const datedEvidence = {
      ...evidence,
      effective_date: {
        raw_text: "September 2026",
        precision: "month",
        value: "2026-09",
      },
      declared_version: "terms-2026-09",
    };
    expect(
      accessAssessmentSchema.safeParse({
        ...assessment,
        evidence: [datedEvidence],
      }).success,
    ).toBe(true);
    expect(accessAssessmentSchema.safeParse(assessment).success).toBe(true);
    expect(
      accessAssessmentSchema.safeParse({
        ...assessment,
        evidence: [{ ...datedEvidence, effective_date: "2026-09-01" }],
      }).success,
    ).toBe(false);
  });
  it("exports JSON schemas for every research envelope", () => {
    for (const schema of [
      sourceCandidateSchema,
      accessAssessmentSchema,
      probeResultSchema,
      fixtureEnvelopeSchema,
      extractionContractSchema,
    ]) {
      expect(z.toJSONSchema(schema).type).toBe("object");
    }
  });
});

it("keeps the portable research example corpus valid and invalid as labeled", async () => {
  const { researchExamples } = await import("./research.examples.js");
  const schemas = {
    source_candidate: sourceCandidateSchema,
    access_assessment: accessAssessmentSchema,
    probe_result: probeResultSchema,
    fixture_envelope: fixtureEnvelopeSchema,
    extraction_contract: extractionContractSchema,
  };
  for (const example of researchExamples) {
    expect(
      schemas[example.schema].safeParse(example.value).success,
      example.name,
    ).toBe(example.valid);
  }
});

it("rejects duplicate declared sets and embedded URL credentials", () => {
  expect(
    accessAssessmentSchema.safeParse({
      ...assessment,
      scope: { ...scope, listing_roles: ["for_rent", "for_rent"] },
    }).success,
  ).toBe(false);
  expect(
    fixtureEnvelopeSchema.safeParse({
      ...fixture,
      permitted_use: ["parser_replay", "parser_replay"],
    }).success,
  ).toBe(false);
  expect(
    fixtureEnvelopeSchema.safeParse({
      ...fixture,
      parser_compatibility: ["parser-v1", "parser-v1"],
    }).success,
  ).toBe(false);
  expect(
    accessAssessmentSchema.safeParse({
      ...assessment,
      evidence: [{ ...evidence, url: "https://user:secret@example.com/" }],
    }).success,
  ).toBe(false);
});
