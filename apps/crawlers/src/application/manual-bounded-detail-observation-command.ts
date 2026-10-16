import {
  JsonFileDiscoveryProfileRepository,
  type DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import { discoveryObservationV1Schema } from "@rent-yield/listing-storage-contracts";
import { readFile } from "node:fs/promises";
import { BoundedHttpsProbeTransport } from "../adapters/transport/bounded-https-probe-transport.js";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";
import { MemorySourceBudget } from "./bounded-probe.js";
import {
  runBoundedDetailObservation,
  type BoundedDetailObservationResult,
  type DetailObservationProfile,
} from "./bounded-detail-observation.js";

const defaultClock: ProbeClock = {
  nowMs: () => Date.now(),
  nowInstant: () => new Date().toISOString(),
};

export type LocalBoundedDetailObservationCommand = {
  source_key: string;
  candidate_url: string;
  discovery_observation_path: string;
  profile_path: string;
  dry_run: boolean;
};

type Dependencies = {
  profiles?: DiscoveryProfileRepository;
  transport?: ProbeTransport;
  clock?: ProbeClock;
  sourceBudget?: MemorySourceBudget;
};

/** Reads only the already-sanitized discovery observation, never a source body. */
async function readSelection(input: LocalBoundedDetailObservationCommand) {
  try {
    const serialized = await readFile(input.discovery_observation_path, "utf8");
    const observation = discoveryObservationV1Schema.parse(
      JSON.parse(serialized),
    );
    if (observation.source_key !== input.source_key) return null;
    return {
      source_key: observation.source_key,
      discovery_observation_id: observation.observation_id,
      candidate_url: input.candidate_url,
      candidate_urls: observation.candidate_urls,
      dry_run: input.dry_run,
    };
  } catch {
    return null;
  }
}

/**
 * Temporary adapter from the profile's reviewed detail section to the generic
 * transport shell. This fails closed until Storage exposes reviewed detail
 * configuration; it deliberately does not reuse discovery start paths.
 */
function detailProfileFor(
  profile: Awaited<
    ReturnType<DiscoveryProfileRepository["findActiveBySourceKey"]>
  >,
): DetailObservationProfile | null {
  if (!profile || profile.detail_observation.state !== "reviewed") return null;
  return {
    source_key: profile.source_key,
    allowed_hosts: profile.detail_observation.allowed_hosts,
    allowed_path_prefixes: profile.detail_observation.allowed_path_prefixes,
    budget: profile.detail_observation.budget,
  };
}

export async function runLocalBoundedDetailObservation(
  input: LocalBoundedDetailObservationCommand,
  dependencies: Dependencies = {},
): Promise<
  | BoundedDetailObservationResult
  | { ok: false; error: { code: "selection_unavailable" } }
> {
  const selection = await readSelection(input);
  if (!selection)
    return { ok: false, error: { code: "selection_unavailable" } };
  const profiles =
    dependencies.profiles ??
    new JsonFileDiscoveryProfileRepository({ path: input.profile_path });
  const profile = detailProfileFor(
    await profiles.findActiveBySourceKey({ source_key: input.source_key }),
  );
  if (!profile)
    return { ok: false, error: { code: "detail_scope_unavailable" } };
  return runBoundedDetailObservation(selection, {
    profile,
    transport: dependencies.transport ?? new BoundedHttpsProbeTransport(),
    clock: dependencies.clock ?? defaultClock,
    sourceBudget: dependencies.sourceBudget ?? new MemorySourceBudget(),
  });
}
