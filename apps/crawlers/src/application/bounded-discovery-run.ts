import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";
import { MemorySourceBudget, probeListingDiscovery } from "./bounded-probe.js";
import type { BoundedDiscoveryProfile } from "./bounded-discovery-profile.js";
import {
  normalizeFixtureMediaType,
  type FixtureMediaType,
} from "./fixture-media-type.js";

export type BoundedDiscoveryFixtureHandoff = {
  source_key: string;
  source_url: string;
  collected_at: string;
  discovery_profile_provenance: BoundedDiscoveryProfile["discovery_profile_provenance"];
  content_type: FixtureMediaType;
  payload: Uint8Array;
};

export async function runBoundedDiscovery(
  input: { probe_id: string; profile: BoundedDiscoveryProfile },
  dependencies: {
    transport: ProbeTransport;
    clock: ProbeClock;
    captureFixture?: (handoff: BoundedDiscoveryFixtureHandoff) => void;
  },
): ReturnType<typeof probeListingDiscovery> {
  const config = input.profile;
  let completedResponse: {
    source_url: string;
    content_type: BoundedDiscoveryFixtureHandoff["content_type"];
    payload: Uint8Array;
  } | null = null;
  const result = probeListingDiscovery(
    {
      contract_version: "v1",
      probe_id: input.probe_id,
      scope: {
        source_key: config.source_key,
        country_code: config.country_code,
        city_key: config.city_key,
        capability: config.capability,
        listing_roles: [...config.listing_roles],
      },
      start_url: `https://${config.allowed_hosts[0]}${config.allowed_path_prefixes[0]}`,
      allowed_hosts: [...config.allowed_hosts],
      allowed_path_prefixes: [...config.allowed_path_prefixes],
      budget: { ...config.budget },
      as_of: dependencies.clock.nowInstant(),
    },
    {
      transport: {
        resolve: (request) => dependencies.transport.resolve(request),
        request: async (request) => {
          const outcome = await dependencies.transport.request(request);
          if (
            outcome.kind === "response" &&
            outcome.response.status_code >= 200 &&
            outcome.response.status_code < 300 &&
            outcome.response.redirect_location === undefined
          ) {
            const contentType = normalizeFixtureMediaType(
              outcome.response.content_type,
            );
            if (
              contentType !== null &&
              config.permitted_media_types.includes(contentType)
            ) {
              completedResponse = {
                source_url: request.url,
                content_type: contentType,
                payload: outcome.response.body,
              };
            }
          }
          return outcome;
        },
      },
      clock: dependencies.clock,
      sourceBudget: new MemorySourceBudget(),
      access: {
        probeAccess: () => ({
          permitted: true,
          assessment_id: "mvp-operationally-enabled",
          assessment_sha256: "0".repeat(64),
          constraints: {
            allowed_hosts: [...config.allowed_hosts],
            allowed_path_prefixes: [...config.allowed_path_prefixes],
            budget: { ...config.budget },
          },
        }),
      },
    },
  );
  return result.then((value) => {
    if (
      value.ok &&
      value.value.outcome.kind === "completed" &&
      completedResponse !== null
    ) {
      dependencies.captureFixture?.({
        source_key: config.source_key,
        source_url: completedResponse.source_url,
        collected_at: dependencies.clock.nowInstant(),
        discovery_profile_provenance: config.discovery_profile_provenance,
        content_type: completedResponse.content_type,
        payload: completedResponse.payload,
      });
    }
    return value;
  });
}
