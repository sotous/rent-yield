import type { DiscoveryProfileProvenance } from "@rent-yield/discovery-profile-storage";
import type { DiscoveryExtractionRuleV1 } from "./discovery-response-extractor.js";
import {
  discoveryObservationV1Schema,
  type DiscoveryObservationRepository,
  type DiscoveryObservationV1,
} from "@rent-yield/listing-storage-contracts";
import {
  extractDiscoveryCandidates,
  type DiscoveryExtractionResult,
} from "./discovery-response-extractor.js";

type ExtractionRejection = Extract<
  DiscoveryExtractionResult,
  { ok: false }
>["error"]["code"];

export type DiscoveryResponseProcessorResult =
  | { ok: true; observation: DiscoveryObservationV1 }
  | {
      ok: false;
      error: {
        code:
          ExtractionRejection | "no_candidates" | "observation_write_failed";
      };
    };

export type DiscoveryResponseProcessor = {
  process(input: {
    source_key: string;
    scope: DiscoveryObservationV1["scope"];
    response_url: string;
    content_type: string | null;
    original_bytes: Uint8Array;
    response: Omit<DiscoveryObservationV1["response"], "media_type">;
    discovery_profile_provenance: DiscoveryProfileProvenance;
    extraction: DiscoveryExtractionRuleV1;
    extractor: DiscoveryObservationV1["extractor"] | null;
  }): Promise<DiscoveryResponseProcessorResult>;
};

/**
 * Converts an in-memory bounded discovery response into the sole persisted
 * discovery payload: a validated, allowlisted observation. It never passes
 * HTML, DOM, rejected hrefs, or original bytes to the repository.
 */
export function createDiscoveryResponseProcessor(input: {
  observations: DiscoveryObservationRepository;
  observation_id: string;
  capture_event_id: string;
  collected_at: string;
}): DiscoveryResponseProcessor {
  return {
    async process(response) {
      const extracted = extractDiscoveryCandidates({
        content_type: response.content_type,
        response_url: response.response_url,
        original_bytes: response.original_bytes,
        rule: response.extraction,
      });
      if (!extracted.ok) return extracted;
      if (response.extraction.state !== "reviewed" || !response.extractor) {
        return { ok: false, error: { code: "extraction_rule_unreviewed" } };
      }
      if (
        extracted.candidates.length === 0 &&
        !response.extraction.allow_no_candidates
      ) {
        return { ok: false, error: { code: "no_candidates" } };
      }

      const observation = discoveryObservationV1Schema.parse({
        contract_version: "v1",
        observation_id: input.observation_id,
        capture_event_id: input.capture_event_id,
        source_key: response.source_key,
        collected_at: input.collected_at,
        scope: response.scope,
        discovery_profile_provenance: {
          source_key: response.discovery_profile_provenance.source_key,
          profile_version:
            response.discovery_profile_provenance.profile_version,
          profile_sha256: response.discovery_profile_provenance.profile_sha256,
        },
        extractor: response.extractor,
        response: { ...response.response, media_type: "text/html" },
        outcome:
          extracted.candidates.length === 0
            ? "no_candidates"
            : "candidates_found",
        candidate_count: extracted.candidates.length,
        candidate_urls: extracted.candidates,
      });
      try {
        const appended = await input.observations.append(observation);
        return { ok: true, observation: appended.observation };
      } catch {
        return { ok: false, error: { code: "observation_write_failed" } };
      }
    },
  };
}
