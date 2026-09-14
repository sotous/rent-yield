import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  methodologyManifestExample,
  methodologyProposalSchema,
  type ExtractionContract,
} from "@rent-yield/listing-storage-contracts";
import type { FixtureArtifact } from "./fixture-capture.js";
import { inferExtractionContract } from "./fixture-extraction.js";
import {
  canonicalArtifactDigest,
  proposeMethodology,
  validateMethodologyFixtures,
} from "./methodology-validation.js";
import { methodologyManifestDigest } from "@rent-yield/listing-storage-contracts";

const at = "2026-09-14T12:00:00.000Z";
const scope = {
  source_key: "synthetic-source",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "detail",
  listing_roles: ["for_rent"],
} as const;

function fixture(): FixtureArtifact {
  const folder = new URL(
    "../../fixtures/synthetic-explicit-base-rent-v1/",
    import.meta.url,
  );
  return {
    envelope: JSON.parse(
      readFileSync(new URL("envelope.json", folder), "utf8"),
    ),
    payload: readFileSync(new URL("payload.json", folder), "utf8"),
  };
}

function extractionContract(artifact: FixtureArtifact): ExtractionContract {
  const result = inferExtractionContract({
    artifact,
    scope,
    created_at: at,
    extraction_contract_id: "synthetic-extraction-v1",
  });
  if (!result.ok) throw new Error(result.error.code);
  return result.contract;
}

function input() {
  const artifact = fixture();
  const extraction = extractionContract(artifact);
  const extraction_contract_hash = canonicalArtifactDigest(extraction);
  const manifest = {
    ...methodologyManifestExample,
    methodology_key: "synthetic-detail-v1",
    scope,
    adapter: {
      key: "fixture-json-v1",
      artifact_hash: "c".repeat(64),
      parser_version: "parser-v1",
      normalizer_version: "normalizer-v1",
      extraction_contract_hash,
      supported_contract_version: "v1",
    },
    fixture_hashes: [artifact.envelope.envelope_sha256],
    redaction: {
      policy_key: artifact.envelope.redaction_version,
      policy_hash: artifact.envelope.redaction_sha256,
    },
    retention: {
      policy_key: artifact.envelope.retention_policy_key,
      policy_hash: artifact.envelope.redaction_sha256,
      permitted_uses: ["parser_replay"],
      body_representation: "redacted_fixture",
      retain_images: false,
    },
  };
  const adapters = [
    {
      key: manifest.adapter.key,
      artifact_hash: manifest.adapter.artifact_hash,
      parser_version: manifest.adapter.parser_version,
      normalizer_version: manifest.adapter.normalizer_version,
      supported_contract_version: "v1" as const,
      strategies: ["structured_json"] as const,
    },
  ];
  return { artifact, extraction, manifest, adapters };
}

describe("offline methodology proposal and validation", () => {
  it("canonicalizes declared sets into a stable immutable manifest hash", () => {
    const { manifest } = input();
    expect(methodologyManifestDigest(manifest)).toBe(
      methodologyManifestDigest({
        ...manifest,
        evidence_hashes: [...manifest.evidence_hashes].reverse(),
        circuit_breaker: {
          ...manifest.circuit_breaker,
          stop_on: [...manifest.circuit_breaker.stop_on].reverse(),
        },
      }),
    );
    expect(
      methodologyManifestDigest({ ...manifest, methodology_key: "v2" }),
    ).not.toBe(methodologyManifestDigest(manifest));
  });

  it("creates a reviewable proposal and a passed report from exact offline pins", () => {
    const { artifact, extraction, manifest, adapters } = input();
    const proposal = proposeMethodology({ manifest, adapters });
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.proposal).not.toHaveProperty("approval");
    const report = validateMethodologyFixtures({
      proposal: proposal.proposal,
      adapters,
      fixtures: [artifact],
      extraction_contracts: [extraction],
      validated_at: at,
    });
    expect(report.outcome).toBe("passed");
    expect(report.issues).toEqual([]);
    expect(report.fixture_hashes).toEqual([artifact.envelope.envelope_sha256]);
    const completed = proposal.full(report);
    expect(completed.ok).toBe(true);
    if (completed.ok)
      expect(
        methodologyProposalSchema.safeParse(completed.proposal).success,
      ).toBe(true);
  });

  it("fails closed for unregistered adapters, changed pins, and replay failures", () => {
    const { artifact, extraction, manifest, adapters } = input();
    expect(
      proposeMethodology({
        manifest,
        adapters: [{ ...adapters[0]!, artifact_hash: "9".repeat(64) }],
      }),
    ).toEqual({ ok: false, error: { code: "incompatible_adapter" } });
    const prepared = proposeMethodology({ manifest, adapters });
    if (!prepared.ok) return;
    const changed = validateMethodologyFixtures({
      proposal: prepared.proposal,
      adapters,
      fixtures: [{ ...artifact, payload: `${artifact.payload} ` }],
      extraction_contracts: [extraction],
      validated_at: at,
    });
    expect(changed).toMatchObject({
      outcome: "failed",
      issues: [{ code: "invalid_fixture", severity: "error" }],
    });
    expect(prepared.full(changed)).toEqual({
      ok: false,
      error: { code: "validation_failed" },
    });
  });

  it("reports only typed failures for missing fixtures and changed extraction pins", () => {
    const { artifact, extraction, manifest, adapters } = input();
    const prepared = proposeMethodology({ manifest, adapters });
    if (!prepared.ok) return;
    const missing = validateMethodologyFixtures({
      proposal: prepared.proposal,
      adapters,
      fixtures: [],
      extraction_contracts: [extraction],
      validated_at: at,
    });
    expect(missing).toMatchObject({
      outcome: "failed",
      issues: [{ code: "fixture_not_found", severity: "error" }],
    });
    const mismatched = validateMethodologyFixtures({
      proposal: prepared.proposal,
      adapters,
      fixtures: [artifact],
      extraction_contracts: [
        { ...extraction, extraction_contract_id: "changed-contract" },
      ],
      validated_at: at,
    });
    expect(mismatched).toMatchObject({
      outcome: "failed",
      issues: [{ code: "extraction_contract_mismatch", severity: "error" }],
    });
    expect(JSON.stringify(missing)).not.toContain(artifact.payload);
  });

  it("does not make a mismatched parser version eligible through a registry entry", () => {
    const { artifact, extraction, manifest, adapters } = input();
    const prepared = proposeMethodology({ manifest, adapters });
    if (!prepared.ok) return;
    const report = validateMethodologyFixtures({
      proposal: {
        ...prepared.proposal,
        manifest: {
          ...prepared.proposal.manifest,
          adapter: {
            ...prepared.proposal.manifest.adapter,
            parser_version: "parser-v9",
          },
        },
      },
      adapters: [{ ...adapters[0]!, parser_version: "parser-v9" }],
      fixtures: [artifact],
      extraction_contracts: [extraction],
      validated_at: at,
    });
    expect(report).toMatchObject({
      outcome: "failed",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "manifest_hash_mismatch",
          severity: "error",
        }),
        expect.objectContaining({
          code: "incompatible_parser",
          severity: "error",
        }),
      ]),
    });
  });
});
