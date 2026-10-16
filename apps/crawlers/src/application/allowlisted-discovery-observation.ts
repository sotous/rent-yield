import {
  JsonFileDiscoveryObservationRepository,
  type DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import { isIP } from "node:net";
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

function publicAddress(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [first = Number.NaN, second = Number.NaN] = address
    .split(".")
    .map(Number);
  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168))
  );
}

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

  // Robots is a bounded, body-discarding gate. It deliberately precedes the
  // discovery probe and consumes one of the active profile's two requests.
  const robotsUrl = `https://${profile.allowed_hosts[0]!}/robots.txt`;
  const startedAt = dependencies.clock.nowMs();
  let robots;
  try {
    const resolution = await dependencies.transport.resolve({
      hostname: profile.allowed_hosts[0]!,
      timeout_ms: profile.budget.max_duration_ms,
    });
    if (
      resolution.kind !== "resolved" ||
      resolution.addresses.length === 0 ||
      resolution.addresses.some((address) => !publicAddress(address))
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "robots_unavailable" },
      };
    if (
      !dependencies.sourceBudget.tryStartRequest(
        profile.source_key,
        profile.budget.max_source_requests,
        profile.budget.max_concurrency,
      )
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "budget_exhausted" },
      };
    try {
      robots = await dependencies.transport.request({
        method: "GET",
        url: robotsUrl,
        validated_addresses: resolution.addresses,
        max_response_bytes: profile.budget.max_bytes,
        timeout_ms:
          profile.budget.max_duration_ms -
          (dependencies.clock.nowMs() - startedAt),
      });
    } finally {
      dependencies.sourceBudget.finishRequest(profile.source_key);
    }
  } catch {
    return {
      ok: true,
      report: { kind: "stopped", reason: "robots_unavailable" },
    };
  }
  if (robots.kind !== "response") {
    robots.partial_body.fill(0);
    return {
      ok: true,
      report: { kind: "stopped", reason: "robots_unavailable" },
    };
  }
  const robotsBody = robots.response.body;
  try {
    const contentType = robots.response.content_type?.toLowerCase() ?? "";
    const denied = new TextDecoder("utf-8", { fatal: true })
      .decode(robotsBody)
      .split(/\r?\n/)
      .some((line) =>
        /^\s*disallow\s*:\s*\/arriendo\/barranquilla\s*$/i.test(line),
      );
    if (
      robots.response.status_code < 200 ||
      robots.response.status_code >= 300 ||
      !contentType.startsWith("text/plain") ||
      denied
    )
      return {
        ok: true,
        report: { kind: "stopped", reason: "robots_conflict" },
      };
  } catch {
    return { ok: true, report: { kind: "stopped", reason: "robots_conflict" } };
  } finally {
    robotsBody.fill(0);
  }

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
