import { describe, expect, it } from "vitest";
import {
  discoveryObservationV1Schema,
  type DiscoveryObservationV1,
} from "./discovery-observation.js";

const observation = {
  contract_version: "v1",
  observation_id: "discovery-observation-1",
  capture_event_id: "capture-1",
  source_key: "ciencuadras",
  collected_at: "2026-10-13T12:00:00.000Z",
  scope: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "discovery",
    listing_roles: ["for_rent"],
  },
  discovery_profile_provenance: {
    source_key: "ciencuadras",
    profile_version: 2,
    profile_sha256: "a".repeat(64),
  },
  extractor: {
    kind: "html_anchor_href",
    version: "html-anchor-href-v1",
    config_sha256: "b".repeat(64),
    artifact_sha256: "d".repeat(64),
  },
  response: {
    canonical_url: "https://www.ciencuadras.com/arriendo/barranquilla",
    media_type: "text/html",
    body_sha256: "c".repeat(64),
    body_byte_length: 496229,
  },
  outcome: "candidates_found",
  candidate_count: 2,
  candidate_urls: [
    "https://www.ciencuadras.com/inmueble/arriendo-apartamento-1",
    "https://www.ciencuadras.com/inmueble/arriendo-apartamento-2",
  ],
} satisfies DiscoveryObservationV1;

describe("DiscoveryObservationV1", () => {
  it("accepts only a structured, deterministic candidate observation", () => {
    expect(discoveryObservationV1Schema.parse(observation)).toEqual(
      observation,
    );
  });

  it("rejects incomplete provenance, body retention, and provenance/source mismatch", () => {
    expect(
      discoveryObservationV1Schema.safeParse({
        ...observation,
        discovery_profile_provenance: {
          ...observation.discovery_profile_provenance,
          profile_sha256: "bad",
        },
      }).success,
    ).toBe(false);
    expect(
      discoveryObservationV1Schema.safeParse({
        ...observation,
        html: "<html />",
      }).success,
    ).toBe(false);
    expect(
      discoveryObservationV1Schema.safeParse({
        ...observation,
        discovery_profile_provenance: {
          ...observation.discovery_profile_provenance,
          source_key: "other-source",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unsafe, duplicate, or unsorted candidate URLs", () => {
    for (const candidate_urls of [
      ["http://www.ciencuadras.com/inmueble/a"],
      ["https://user@www.ciencuadras.com/inmueble/a"],
      ["https://www.ciencuadras.com/inmueble/a?tracking=1"],
      ["https://www.ciencuadras.com/inmueble/a#top"],
      [observation.candidate_urls[1]!, observation.candidate_urls[0]!],
      [observation.candidate_urls[0]!, observation.candidate_urls[0]!],
    ])
      expect(
        discoveryObservationV1Schema.safeParse({
          ...observation,
          candidate_urls,
          candidate_count: candidate_urls.length,
        }).success,
      ).toBe(false);
  });

  it("makes an empty observation an explicit no-candidates outcome", () => {
    expect(
      discoveryObservationV1Schema.safeParse({
        ...observation,
        outcome: "no_candidates",
        candidate_count: 0,
        candidate_urls: [],
      }).success,
    ).toBe(true);
    expect(
      discoveryObservationV1Schema.safeParse({
        ...observation,
        outcome: "candidates_found",
        candidate_count: 0,
        candidate_urls: [],
      }).success,
    ).toBe(false);
  });
});
