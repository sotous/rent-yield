import { JsonFileDiscoveryProfileRepository } from "@rent-yield/discovery-profile-storage";
import type { ProbeClock } from "../ports/probe-transport.js";
import { BoundedHttpsProbeTransport } from "../adapters/transport/bounded-https-probe-transport.js";
import {
  MemoryFixtureCapture,
  type FixtureArtifact,
} from "./fixture-capture.js";
import { MemorySourceBudget, type ProbeDependencies } from "./bounded-probe.js";
import {
  runManualBoundedDiscovery,
  type ManualBoundedDiscoveryResult,
  type RedactedFixtureMaterializer,
} from "./manual-bounded-discovery.js";

const defaultClock: ProbeClock = {
  nowMs: () => Date.now(),
  nowInstant: () => new Date().toISOString(),
};

export type LocalManualBoundedDiscoveryCommand = {
  contract_version: "v1";
  source_key: string;
  probe_id: string;
  as_of: string;
  kill_switch: boolean;
  dry_run: boolean;
  profilePath: string;
  fixtureRoot: string;
  fixture_id: string;
};

type LocalCommandDependencies = Partial<
  Pick<ProbeDependencies, "transport" | "clock" | "sourceBudget">
> & {
  profiles?: JsonFileDiscoveryProfileRepository;
  materialize?: RedactedFixtureMaterializer;
  quarantine?: Parameters<typeof runManualBoundedDiscovery>[1]["quarantine"];
};

/**
 * Builds a valid V2 fixture only from an already-redacted runtime artifact.
 * Provenance is copied as the Storage contract defines it; no access decision
 * or source body enters this boundary.
 */
export function createDeterministicRedactedFixtureMaterializer(input: {
  fixture_id: string;
  created_at: string;
}): RedactedFixtureMaterializer {
  return async (capture) => {
    if (capture.artifact.kind !== "inline_redacted") return { ok: false };
    const captured = new MemoryFixtureCapture().captureRedactedFixture({
      fixture_id: input.fixture_id,
      supersedes_fixture_id: null,
      origin: {
        kind: "permitted_source",
        source_key: capture.source_key,
        source_url: capture.response_url,
        collected_at: input.created_at,
        discovery_profile_provenance: capture.discovery_profile_provenance,
      },
      created_at: input.created_at,
      content_type: capture.artifact.media_type,
      payload: capture.artifact.bytes,
      permitted_use: ["parser_replay"],
      retention_policy_key: "manual-redacted-fixture-v1",
      research_session_id: `manual-${capture.source_key}`,
      parser_compatibility: ["parser-v1"],
      expected_classification: "quarantined",
    });
    return captured.ok
      ? { ok: true, artifact: captured.artifact }
      : { ok: false };
  };
}

/**
 * Concrete local composition. A production invocation supplies the HTTPS
 * transport adapter; tests replace it with an in-memory fake. This function
 * performs no transport request until `dry_run` and `kill_switch` have passed.
 */
export async function runLocalManualBoundedDiscovery(
  input: LocalManualBoundedDiscoveryCommand,
  dependencies: LocalCommandDependencies,
): Promise<ManualBoundedDiscoveryResult> {
  const profiles =
    dependencies.profiles ??
    new JsonFileDiscoveryProfileRepository({ path: input.profilePath });
  return runManualBoundedDiscovery(input, {
    profiles,
    transport: dependencies.transport ?? new BoundedHttpsProbeTransport(),
    clock: dependencies.clock ?? defaultClock,
    sourceBudget: dependencies.sourceBudget ?? new MemorySourceBudget(),
    fixtureRoot: input.fixtureRoot,
    materialize:
      dependencies.materialize ??
      createDeterministicRedactedFixtureMaterializer({
        fixture_id: input.fixture_id,
        created_at: input.as_of,
      }),
    quarantine:
      dependencies.quarantine ??
      (async () => ({ reason: "manual_parser_not_configured" })),
  });
}

export type { FixtureArtifact };
