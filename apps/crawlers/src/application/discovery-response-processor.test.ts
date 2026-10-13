import { describe, expect, it, vi } from "vitest";
import type { DiscoveryObservationRepository } from "@rent-yield/listing-storage-contracts";
import { createDiscoveryResponseProcessor } from "./discovery-response-processor.js";

const provenance = {
  source_key: "source-a",
  profile_version: 1,
  profile_sha256: "a".repeat(64),
};
const extraction = {
  state: "reviewed" as const,
  kind: "html_anchor_href" as const,
  extractor_version: "html-anchor-href-v1",
  extractor_artifact_sha256:
    "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
  allow_no_candidates_rationale:
    "A valid discovery response can contain no matching anchors.",
  candidate_hosts: ["listings.example.com"],
  candidate_path_prefixes: ["/rentals"],
  allow_no_candidates: true,
};
const extractor = {
  kind: "html_anchor_href" as const,
  version: "html-anchor-href-v1",
  config_sha256: "b".repeat(64),
  artifact_sha256:
    "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
};

function input(overrides: Record<string, unknown> = {}) {
  return {
    source_key: "source-a",
    scope: {
      country_code: "CO" as const,
      city_key: "barranquilla",
      capability: "discovery" as const,
      listing_roles: ["for_rent" as const],
    },
    response_url: "https://listings.example.com/search",
    content_type: "text/html",
    original_bytes: new TextEncoder().encode(
      '<a href="/rentals/two">two</a><a href="/rentals/one">one</a>',
    ),
    response: {
      canonical_url: "https://listings.example.com/search",
      body_sha256: "c".repeat(64),
      body_byte_length: 64,
    },
    discovery_profile_provenance: provenance,
    extraction,
    extractor,
    ...overrides,
  };
}

describe("discovery response processor", () => {
  it("persists only the schema-valid allowlisted observation", async () => {
    const append = vi.fn(async (observation) => ({
      appended: true,
      observation,
    }));
    const processor = createDiscoveryResponseProcessor({
      observations: { append } as DiscoveryObservationRepository,
      observation_id: "observation-1",
      capture_event_id: "capture-1",
      collected_at: "2026-10-13T00:00:00.000Z",
    });

    await expect(processor.process(input())).resolves.toEqual({
      ok: true,
      observation: expect.objectContaining({
        observation_id: "observation-1",
        capture_event_id: "capture-1",
        outcome: "candidates_found",
        candidate_count: 2,
        candidate_urls: [
          "https://listings.example.com/rentals/one",
          "https://listings.example.com/rentals/two",
        ],
        discovery_profile_provenance: provenance,
        extractor,
      }),
    });
    expect(JSON.stringify(append.mock.calls)).not.toContain("<a href");
    expect(JSON.stringify(append.mock.calls)).not.toContain('/search">two');
  });

  it("returns a typed no-candidates result without writing when the rule disallows it", async () => {
    const append = vi.fn();
    const processor = createDiscoveryResponseProcessor({
      observations: { append } as DiscoveryObservationRepository,
      observation_id: "observation-1",
      capture_event_id: "capture-1",
      collected_at: "2026-10-13T00:00:00.000Z",
    });
    const original = new TextEncoder().encode('<a href="/other/one">one</a>');

    await expect(
      processor.process(
        input({
          original_bytes: original,
          extraction: { ...extraction, allow_no_candidates: false },
        }),
      ),
    ).resolves.toEqual({ ok: false, error: { code: "no_candidates" } });
    expect(append).not.toHaveBeenCalled();
    expect([...original].every((byte) => byte === 0)).toBe(true);
  });

  it("does not write when extraction rejects the bounded response", async () => {
    const append = vi.fn();
    const processor = createDiscoveryResponseProcessor({
      observations: { append } as DiscoveryObservationRepository,
      observation_id: "observation-1",
      capture_event_id: "capture-1",
      collected_at: "2026-10-13T00:00:00.000Z",
    });

    await expect(
      processor.process(input({ content_type: "application/json" })),
    ).resolves.toEqual({
      ok: false,
      error: { code: "unsupported_media_type" },
    });
    expect(append).not.toHaveBeenCalled();
  });

  it("returns a typed write failure without exposing an observation body", async () => {
    const processor = createDiscoveryResponseProcessor({
      observations: {
        append: async () => {
          throw new Error("unavailable");
        },
      },
      observation_id: "observation-1",
      capture_event_id: "capture-1",
      collected_at: "2026-10-13T00:00:00.000Z",
    });

    await expect(processor.process(input())).resolves.toEqual({
      ok: false,
      error: { code: "observation_write_failed" },
    });
  });
});
