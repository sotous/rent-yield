import type {
  DurableSubmissionV2,
  DurableSubmissionV2Provider,
} from "@rent-yield/listing-storage-contracts";
import {
  deriveFixtureSubmissionCandidate,
  orchestrateFixtureInterpretation,
  reportArtifactSafetyBlock,
  type FixtureInterpretationDependencies,
} from "./runtime-interpretation-orchestration.js";
import {
  prepareFixtureArtifact,
  type ObservedResponseEvidence,
} from "./runtime-artifact-pipeline.js";
import type { ReadyFixturePreflight } from "./runtime-preflight.js";
import { deliverFixtureSubmissionCandidate } from "./runtime-submission-delivery.js";

export type FixtureRuntimeResult =
  | {
      ok: true;
      result: {
        kind: "normalized";
        receipt: { receipt_id: string; duplicate_delivery: boolean };
      };
    }
  | {
      ok: true;
      result: { kind: "quarantined" | "parse_failed" | "capture_only" };
    }
  | { ok: false; error: { code: string } };

/**
 * Fixture-only composition root. It has no live transport and sends only a
 * normalized candidate through the Storage provider boundary.
 */
export async function runFixtureRuntime(
  input: {
    preflight: ReadyFixturePreflight;
    artifact: {
      content_type: "application/json" | "text/html" | "text/plain";
      original_bytes: Uint8Array;
      disposition: "inline_redacted" | "no_retained_bytes";
    };
    submission: {
      base: Omit<DurableSubmissionV2, "artifact" | "outcome">;
      provenance: Record<string, unknown>;
    };
  },
  dependencies: FixtureInterpretationDependencies & {
    disposeOriginal(): void;
    provider: DurableSubmissionV2Provider;
  },
): Promise<FixtureRuntimeResult> {
  const prepared = await prepareFixtureArtifact(input.artifact, dependencies);
  if (!prepared.ok) {
    const health = await reportArtifactSafetyBlock(
      { preflight: input.preflight, failure_code: prepared.error.code },
      dependencies,
    );
    return health.ok ? { ok: false, error: prepared.error } : health;
  }

  const interpreted = await orchestrateFixtureInterpretation(
    { preflight: input.preflight, artifact: prepared.artifact },
    dependencies,
  );
  if (!interpreted.ok) return interpreted;
  if (interpreted.interpretation.kind !== "normalized")
    return { ok: true, result: { kind: interpreted.interpretation.kind } };

  return deliverNormalized(
    input.submission.base,
    input.submission.provenance,
    prepared.capture_evidence,
    prepared.artifact,
    interpreted.interpretation,
    dependencies.provider,
  );
}

async function deliverNormalized(
  base: Omit<DurableSubmissionV2, "artifact" | "outcome">,
  provenance: Record<string, unknown>,
  capture_evidence: ObservedResponseEvidence,
  artifact: Parameters<typeof deriveFixtureSubmissionCandidate>[0]["artifact"],
  interpretation: Parameters<
    typeof deriveFixtureSubmissionCandidate
  >[0]["interpretation"],
  provider: DurableSubmissionV2Provider,
): Promise<FixtureRuntimeResult> {
  const candidate = deriveFixtureSubmissionCandidate({
    base,
    capture_evidence,
    artifact,
    interpretation,
    provenance,
  });
  if (!candidate.ok) return candidate;
  const delivered = await deliverFixtureSubmissionCandidate(
    candidate.candidate,
    provider,
  );
  if (!delivered.ok) return delivered;
  return {
    ok: true,
    result: {
      kind: "normalized",
      receipt: {
        receipt_id: delivered.receipt.receipt_id,
        duplicate_delivery: delivered.receipt.duplicate_delivery,
      },
    },
  };
}
