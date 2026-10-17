import {
  JsonFileDiscoveryProfileRepository,
  JsonFileDiscoveryObservationRepository,
  type DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import {
  detailCandidateSelectionV1Schema,
  resolveDetailCandidateSelection,
  type DiscoveryObservationRepository,
} from "@rent-yield/listing-storage-contracts";
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
  discovery_observation_id: string;
  candidate_url: string;
  discovery_observation_path: string;
  profile_path: string;
  dry_run: boolean;
};

type Dependencies = {
  profiles?: DiscoveryProfileRepository;
  observations?: DiscoveryObservationRepository;
  transport?: ProbeTransport;
  clock?: ProbeClock;
  sourceBudget?: MemorySourceBudget;
};

/** Reads only the already-sanitized discovery observation, never a source body. */
async function readSelection(
  input: LocalBoundedDetailObservationCommand,
  observations: DiscoveryObservationRepository,
) {
  try {
    const selection = detailCandidateSelectionV1Schema.parse({
      contract_version: "v1",
      discovery_observation_id: input.discovery_observation_id,
      candidate_url: input.candidate_url,
    });
    const observation = await observations.findById({
      observation_id: selection.discovery_observation_id,
    });
    if (!observation) return null;
    return {
      resolved: resolveDetailCandidateSelection(observation, selection),
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
  const observations =
    dependencies.observations ??
    new JsonFileDiscoveryObservationRepository({
      path: input.discovery_observation_path,
    });
  const selection = await readSelection(input, observations);
  if (!selection)
    return { ok: false, error: { code: "selection_unavailable" } };
  const profiles =
    dependencies.profiles ??
    new JsonFileDiscoveryProfileRepository({ path: input.profile_path });
  const profile = detailProfileFor(
    await profiles.findActiveBySourceKey({
      source_key: selection.resolved.source_key,
    }),
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
