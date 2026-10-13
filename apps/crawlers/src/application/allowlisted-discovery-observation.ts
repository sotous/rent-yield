import {
  JsonFileDiscoveryObservationRepository,
  type DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import type { DiscoveryObservationV1 } from "@rent-yield/listing-storage-contracts";
import { createDiscoveryResponseProcessor } from "./discovery-response-processor.js";
import { MemorySourceBudget, type ProbeDependencies } from "./bounded-probe.js";
import { runProfiledListingDiscovery } from "./profiled-discovery-runner.js";

type Dependencies = Omit<
  ProbeDependencies,
  | "access"
  | "captureHandoff"
  | "discoveryResponseProcessor"
  | "discoveryExtraction"
  | "discoveryExtractionProvenance"
  | "discoveryProfileProvenance"
> & { profiles: DiscoveryProfileRepository };

export type AllowlistedDiscoveryObservationResult =
  | {
      ok: true;
      report: { kind: "dry_run"; source_key: string; profile_sha256: string };
    }
  | {
      ok: true;
      report: { kind: "written"; observation: DiscoveryObservationV1 };
    }
  | { ok: true; report: { kind: "stopped"; reason: string } }
  | {
      ok: false;
      error: {
        code:
          | "kill_switch_rejected"
          | "profile_unavailable"
          | "extraction_rule_unreviewed"
          | "invalid_input";
      };
    };

/**
 * Observation-only canary orchestration. It reads the Storage profile before
 * constructing a transport, so an unreviewed candidate rule cannot cause a
 * source request. No fixture writer is present on this path.
 */
export async function runAllowlistedDiscoveryObservation(
  input: {
    contract_version: "v1";
    source_key: string;
    probe_id: string;
    observation_id: string;
    capture_event_id: string;
    as_of: string;
    kill_switch: boolean;
    dry_run: boolean;
    observation_path: string;
  },
  dependencies: Dependencies,
): Promise<AllowlistedDiscoveryObservationResult> {
  if (input.kill_switch)
    return { ok: false, error: { code: "kill_switch_rejected" } };
  const profile = await dependencies.profiles.findActiveBySourceKey({
    source_key: input.source_key,
  });
  if (!profile) return { ok: false, error: { code: "profile_unavailable" } };
  if (profile.extraction.state !== "reviewed")
    return { ok: false, error: { code: "extraction_rule_unreviewed" } };
  if (input.dry_run)
    return {
      ok: true,
      report: {
        kind: "dry_run",
        source_key: profile.source_key,
        profile_sha256: profile.discovery_profile_provenance.profile_sha256,
      },
    };

  let written: DiscoveryObservationV1 | undefined;
  const processor = createDiscoveryResponseProcessor({
    observations: new JsonFileDiscoveryObservationRepository({
      path: input.observation_path,
    }),
    observation_id: input.observation_id,
    capture_event_id: input.capture_event_id,
    collected_at: input.as_of,
  });
  const recordingProcessor = {
    async process(...args: Parameters<typeof processor.process>) {
      const result = await processor.process(...args);
      if (result.ok) written = result.observation;
      return result;
    },
  };
  const result = await runProfiledListingDiscovery(
    {
      contract_version: input.contract_version,
      source_key: input.source_key,
      probe_id: input.probe_id,
      as_of: input.as_of,
    },
    { ...dependencies, discoveryResponseProcessor: recordingProcessor },
  );
  if (!result.ok)
    return {
      ok: false,
      error: {
        code:
          result.error.code === "profile_unavailable"
            ? "profile_unavailable"
            : "invalid_input",
      },
    };
  if (result.value.outcome.kind !== "completed")
    return {
      ok: true,
      report: { kind: "stopped", reason: result.value.outcome.reason },
    };
  return written
    ? { ok: true, report: { kind: "written", observation: written } }
    : { ok: false, error: { code: "invalid_input" } };
}

export { MemorySourceBudget };
