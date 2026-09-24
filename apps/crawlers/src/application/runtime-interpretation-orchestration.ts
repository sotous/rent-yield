import type { RuntimeArtifact } from "./runtime-artifact-pipeline.js";
import type { ReadyFixturePreflight } from "./runtime-preflight.js";
import {
  canonicalOutcomeDigestV2,
  durableSubmissionV2Schema,
  type DurableSubmissionV2,
} from "@rent-yield/listing-storage-contracts";

export type FixtureInterpretation = {
  kind: "normalized" | "quarantined" | "parse_failed" | "capture_only";
  observations: readonly unknown[];
  rental_evidence: readonly unknown[];
  issues: readonly unknown[];
};

export type FixtureHealthEvent = {
  code: "parser_drift";
  severity: "error";
  source_key: string;
  capture_event_id: string;
  methodology_manifest_hash: string;
};

export type FixtureInterpretationDependencies = {
  replay(input: {
    run: ReadyFixturePreflight["run"];
    artifact: RuntimeArtifact;
  }): Promise<FixtureInterpretation>;
  emitHealth(event: FixtureHealthEvent): Promise<void>;
};

export type FixtureInterpretationResult =
  | { ok: true; interpretation: FixtureInterpretation }
  | { ok: false; error: { code: "replay_unavailable" | "health_unavailable" } };

export type FixtureInterpretationIdentity = {
  source_key: string;
  capture_event_id: string;
  methodology_manifest_hash: string;
  adapter_artifact_hash: string;
  parser_version: string;
  normalizer_version: string;
  extraction_contract_hash: string;
  capture_fingerprint: string;
  outcome_hash: string;
};

/** Fixture-only replay registry: no persistence or durable receipt semantics. */
export class MemoryFixtureInterpretationRegistry {
  readonly #captures = new Map<string, string>();
  readonly #interpretations = new Map<string, string>();

  record(identity: FixtureInterpretationIdentity):
    | { ok: true; duplicate: boolean }
    | {
        ok: false;
        error: { code: "capture_event_conflict" | "interpretation_conflict" };
      } {
    const captureKey = `${identity.source_key}:${identity.capture_event_id}`;
    const priorCapture = this.#captures.get(captureKey);
    if (priorCapture && priorCapture !== identity.capture_fingerprint)
      return { ok: false, error: { code: "capture_event_conflict" } };
    const interpretationKey = [
      captureKey,
      identity.methodology_manifest_hash,
      identity.adapter_artifact_hash,
      identity.parser_version,
      identity.normalizer_version,
      identity.extraction_contract_hash,
    ].join(":");
    const priorOutcome = this.#interpretations.get(interpretationKey);
    if (priorOutcome && priorOutcome !== identity.outcome_hash)
      return { ok: false, error: { code: "interpretation_conflict" } };
    const duplicate =
      priorCapture === identity.capture_fingerprint &&
      priorOutcome === identity.outcome_hash;
    this.#captures.set(captureKey, identity.capture_fingerprint);
    this.#interpretations.set(interpretationKey, identity.outcome_hash);
    return { ok: true, duplicate };
  }
}

/** Builds a validated candidate only; delivery and durable acceptance are outside this runtime. */
export function deriveFixtureSubmissionCandidate(input: {
  base: Omit<DurableSubmissionV2, "artifact" | "outcome">;
  artifact: Extract<
    RuntimeArtifact,
    { kind: "inline_redacted" | "no_retained_bytes" }
  >;
  interpretation: FixtureInterpretation;
  provenance: Record<string, unknown>;
}): DurableSubmissionV2 {
  const typed_outcome = {
    observations: input.interpretation.observations,
    rental_evidence: input.interpretation.rental_evidence,
    issues: input.interpretation.issues,
  };
  const outcome_kind = input.interpretation.kind;
  return durableSubmissionV2Schema.parse({
    ...input.base,
    artifact: input.artifact,
    outcome: {
      kind: "complete",
      outcome_kind,
      typed_outcome,
      provenance: input.provenance,
      canonical_outcome_hash: canonicalOutcomeDigestV2({
        outcome_kind,
        typed_outcome,
        provenance: input.provenance,
      }),
    },
  });
}

/** Fixture-only orchestration accepts a successful preflight and post-redaction artifact. */
export async function orchestrateFixtureInterpretation(
  input: { preflight: ReadyFixturePreflight; artifact: RuntimeArtifact },
  dependencies: FixtureInterpretationDependencies,
): Promise<FixtureInterpretationResult> {
  let interpretation: FixtureInterpretation;
  try {
    interpretation = await dependencies.replay({
      run: input.preflight.run,
      artifact: input.artifact,
    });
  } catch {
    return { ok: false, error: { code: "replay_unavailable" } };
  }
  if (interpretation.kind === "parse_failed") {
    try {
      await dependencies.emitHealth({
        code: "parser_drift",
        severity: "error",
        source_key: input.preflight.run.capture.source_key,
        capture_event_id: input.preflight.run.capture.capture_event_id,
        methodology_manifest_hash:
          input.preflight.run.methodology.manifest_hash,
      });
    } catch {
      return { ok: false, error: { code: "health_unavailable" } };
    }
  }
  return { ok: true, interpretation };
}
