import type {
  DiscoveryProfileProvenance,
  DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import { writeRedactedFixture } from "../adapters/artifacts/filesystem-redacted-fixture-writer.js";
import { type FixtureArtifact } from "./fixture-capture.js";
import { MemorySourceBudget, type ProbeDependencies } from "./bounded-probe.js";
import {
  createRedactingProbeCaptureHandoff,
  type RedactedProbeArtifactWriter,
} from "./probe-capture-handoff.js";
import { runProfiledListingDiscovery } from "./profiled-discovery-runner.js";
import type {
  ObservedResponseEvidence,
  RuntimeArtifact,
} from "./runtime-artifact-pipeline.js";

export type RedactedFixtureMaterializer = (input: {
  source_key: string;
  response_url: string;
  artifact: RuntimeArtifact;
  capture_evidence: ObservedResponseEvidence;
  discovery_profile_provenance: DiscoveryProfileProvenance;
}) => Promise<{ ok: true; artifact: FixtureArtifact } | { ok: false }>;

export type QuarantinePort = (input: {
  source_key: string;
  fixture: FixtureArtifact;
  discovery_profile_provenance: DiscoveryProfileProvenance;
}) => Promise<{ reason: string }>;

type ManualBoundedDiscoveryDependencies = Omit<
  ProbeDependencies,
  "access" | "captureHandoff" | "discoveryProfileProvenance"
> & {
  profiles: DiscoveryProfileRepository;
  fixtureRoot: string;
  materialize: RedactedFixtureMaterializer;
  quarantine: QuarantinePort;
};

export type ManualBoundedDiscoveryResult =
  | {
      ok: true;
      report:
        | {
            kind: "quarantined";
            fixture_id: string;
            fixture_path: string;
            quarantine: { reason: string };
            discovery_profile_provenance: DiscoveryProfileProvenance;
          }
        | { kind: "stopped"; reason: string };
    }
  | {
      ok: false;
      error: {
        code:
          | "kill_switch_rejected"
          | "dry_run_rejected"
          | "profile_unavailable"
          | "capture_handoff_failed"
          | "invalid_input";
      };
    };

/**
 * Offline-testable manual orchestration. It has no CLI or live transport: the
 * caller supplies a bounded transport port. Raw bytes cross only the in-memory
 * redaction handoff. The validated filesystem adapter receives a fixture only
 * after the materializer has produced it from post-redaction data.
 */
export async function runManualBoundedDiscovery(
  input: {
    contract_version: "v1";
    source_key: string;
    probe_id: string;
    as_of: string;
    kill_switch: boolean;
    dry_run: boolean;
  },
  dependencies: ManualBoundedDiscoveryDependencies,
): Promise<ManualBoundedDiscoveryResult> {
  if (input.kill_switch)
    return { ok: false, error: { code: "kill_switch_rejected" } };
  if (input.dry_run) return { ok: false, error: { code: "dry_run_rejected" } };

  let report:
    Extract<ManualBoundedDiscoveryResult, { ok: true }>["report"] | undefined;
  let handoffFailed = false;
  const write: RedactedProbeArtifactWriter = async (capture) => {
    const provenance = capture.discovery_profile_provenance;
    if (!provenance) {
      handoffFailed = true;
      throw new Error("profile provenance is required for manual capture");
    }
    const materialized = await dependencies.materialize({
      source_key: capture.source_key,
      response_url: capture.response_url,
      artifact: capture.artifact,
      capture_evidence: capture.capture_evidence,
      discovery_profile_provenance: provenance,
    });
    if (!materialized.ok) {
      handoffFailed = true;
      throw new Error("redacted fixture materialization failed");
    }
    const persisted = await writeRedactedFixture({
      root: dependencies.fixtureRoot,
      artifact: materialized.artifact,
    });
    if (!persisted.ok) {
      handoffFailed = true;
      throw new Error("redacted fixture write failed");
    }
    const quarantine = await dependencies.quarantine({
      source_key: capture.source_key,
      fixture: materialized.artifact,
      discovery_profile_provenance: provenance,
    });
    report = {
      kind: "quarantined",
      fixture_id: materialized.artifact.envelope.fixture_id,
      fixture_path: persisted.path,
      quarantine,
      discovery_profile_provenance: provenance,
    };
  };

  const captureHandoff = createRedactingProbeCaptureHandoff({ write });
  const probed = await runProfiledListingDiscovery(
    {
      contract_version: input.contract_version,
      source_key: input.source_key,
      probe_id: input.probe_id,
      as_of: input.as_of,
    },
    { ...dependencies, captureHandoff },
  );
  if (!probed.ok) {
    return {
      ok: false,
      error: {
        code:
          probed.error.code === "profile_unavailable"
            ? "profile_unavailable"
            : "invalid_input",
      },
    };
  }
  if (handoffFailed)
    return { ok: false, error: { code: "capture_handoff_failed" } };
  if (probed.value.outcome.kind !== "completed")
    return {
      ok: true,
      report: { kind: "stopped", reason: probed.value.outcome.reason },
    };
  return report
    ? { ok: true, report }
    : { ok: false, error: { code: "capture_handoff_failed" } };
}

export { MemorySourceBudget };
