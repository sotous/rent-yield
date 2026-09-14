import { createHash } from "node:crypto";
import {
  canonicalJson,
  canonicalSet,
  canonicalMethodologyManifest,
  methodologyManifestDigest,
  methodologyProposalSchema,
  methodologyValidationReportDigest,
  methodologyValidationReportSchema,
  type ExtractionContract,
  type MethodologyManifestV1,
  type MethodologyProposalV1,
  type MethodologyValidationReportV1,
  type ResearchIssue,
} from "@rent-yield/listing-storage-contracts";
import type { FixtureArtifact } from "./fixture-capture.js";
import {
  fixtureNormalizerVersion,
  fixtureParserVersion,
  replayFixture,
} from "./fixture-extraction.js";

export type AdapterRegistration = {
  key: string;
  artifact_hash: string;
  parser_version: string;
  normalizer_version: string;
  supported_contract_version: "v1";
  strategies: readonly MethodologyManifestV1["strategy"][];
};

type PreparedProposal = {
  contract_version: "v1";
  manifest_hash: string;
  manifest: MethodologyManifestV1;
};

export type ProposalError =
  "invalid_manifest" | "incompatible_adapter" | "validation_failed";

/** Hashes a validated canonical artifact without assigning it authority. */
export function canonicalArtifactDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function registeredAdapter(
  manifest: MethodologyManifestV1,
  adapters: readonly AdapterRegistration[],
): AdapterRegistration | null {
  const adapter = adapters.find(
    (candidate) => candidate.key === manifest.adapter.key,
  );
  if (
    !adapter ||
    adapter.artifact_hash !== manifest.adapter.artifact_hash ||
    adapter.parser_version !== manifest.adapter.parser_version ||
    adapter.normalizer_version !== manifest.adapter.normalizer_version ||
    adapter.supported_contract_version !==
      manifest.adapter.supported_contract_version ||
    !adapter.strategies.includes(manifest.strategy)
  )
    return null;
  return adapter;
}

function issue(code: string, path?: string): ResearchIssue {
  return { code, ...(path === undefined ? {} : { path }), severity: "error" };
}

function report(
  proposal: PreparedProposal,
  issues: ResearchIssue[],
  validated_at: string,
  checks_run: number,
): MethodologyValidationReportV1 {
  return methodologyValidationReportSchema.parse({
    contract_version: "v1",
    manifest_hash: proposal.manifest_hash,
    adapter_artifact_hash: proposal.manifest.adapter.artifact_hash,
    fixture_hashes: canonicalSet(proposal.manifest.fixture_hashes),
    extraction_contract_hash:
      proposal.manifest.adapter.extraction_contract_hash,
    validated_at,
    validator_version: "fixture-validator-v1",
    outcome: issues.length === 0 ? "passed" : "failed",
    checks_run,
    issues,
  });
}

function fullProposal(
  proposal: PreparedProposal,
  validation_report: MethodologyValidationReportV1,
):
  | { ok: true; proposal: MethodologyProposalV1 }
  | { ok: false; error: { code: ProposalError } } {
  if (validation_report.outcome !== "passed")
    return { ok: false, error: { code: "validation_failed" } };
  const result = methodologyProposalSchema.safeParse({
    contract_version: "v1",
    manifest_hash: proposal.manifest_hash,
    manifest: proposal.manifest,
    validation_report_hash:
      methodologyValidationReportDigest(validation_report),
    validation_report,
  });
  return result.success
    ? { ok: true, proposal: result.data }
    : { ok: false, error: { code: "validation_failed" } };
}

/** Prepares an immutable declarative proposal. It cannot publish or approve it. */
export function proposeMethodology(input: {
  manifest: unknown;
  adapters: readonly AdapterRegistration[];
}):
  | {
      ok: true;
      proposal: PreparedProposal;
      full: (
        validation_report: MethodologyValidationReportV1,
      ) =>
        | { ok: true; proposal: MethodologyProposalV1 }
        | { ok: false; error: { code: ProposalError } };
    }
  | { ok: false; error: { code: ProposalError } } {
  let manifest: MethodologyManifestV1;
  try {
    manifest = canonicalMethodologyManifest(input.manifest);
  } catch {
    return { ok: false, error: { code: "invalid_manifest" } };
  }
  if (registeredAdapter(manifest, input.adapters) === null)
    return { ok: false, error: { code: "incompatible_adapter" } };
  const proposal: PreparedProposal = {
    contract_version: "v1",
    manifest_hash: canonicalArtifactDigest(manifest),
    manifest,
  };
  return {
    ok: true,
    proposal,
    full: (validation_report) => fullProposal(proposal, validation_report),
  };
}

/** Replays only fixture and extraction artifacts pinned by an immutable proposal. */
export function validateMethodologyFixtures(input: {
  proposal: PreparedProposal;
  adapters: readonly AdapterRegistration[];
  fixtures: readonly FixtureArtifact[];
  extraction_contracts: readonly ExtractionContract[];
  validated_at: string;
}): MethodologyValidationReportV1 {
  const issues: ResearchIssue[] = [];
  let checks_run = 1;
  const { manifest } = input.proposal;
  if (methodologyManifestDigest(manifest) !== input.proposal.manifest_hash)
    issues.push(issue("manifest_hash_mismatch"));
  if (registeredAdapter(manifest, input.adapters) === null)
    issues.push(issue("incompatible_adapter", "adapter"));
  if (
    manifest.adapter.parser_version !== fixtureParserVersion ||
    manifest.adapter.normalizer_version !== fixtureNormalizerVersion
  )
    issues.push(issue("incompatible_parser", "adapter"));

  const fixtureByHash = new Map(
    input.fixtures.map((fixture) => [
      fixture.envelope.envelope_sha256,
      fixture,
    ]),
  );
  const contractByHash = new Map(
    input.extraction_contracts.map((contract) => [
      canonicalArtifactDigest(contract),
      contract,
    ]),
  );
  const extraction = contractByHash.get(
    manifest.adapter.extraction_contract_hash,
  );
  if (!extraction) issues.push(issue("extraction_contract_mismatch"));

  for (const fixture_hash of manifest.fixture_hashes) {
    checks_run += 1;
    const fixture = fixtureByHash.get(fixture_hash);
    if (!fixture) {
      issues.push(issue("fixture_not_found"));
      continue;
    }
    if (
      fixture.envelope.redaction_version !== manifest.redaction.policy_key ||
      fixture.envelope.redaction_sha256 !== manifest.redaction.policy_hash ||
      fixture.envelope.retention_policy_key !== manifest.retention.policy_key ||
      !fixture.envelope.permitted_use.every((use) =>
        manifest.retention.permitted_uses.includes(use),
      )
    ) {
      issues.push(issue("fixture_policy_mismatch"));
      continue;
    }
    if (!extraction) continue;
    const outcome = replayFixture({ artifact: fixture, contract: extraction });
    if (outcome.kind !== fixture.envelope.expected_classification) {
      const replayIssues = outcome.issues.filter(
        (entry) => entry.severity === "error",
      );
      issues.push(
        ...(replayIssues.length > 0
          ? replayIssues
          : [issue("fixture_outcome_mismatch")]),
      );
    }
  }
  return report(input.proposal, issues, input.validated_at, checks_run);
}
