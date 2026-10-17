import { describe, expect, it, vi } from "vitest";
import {
  runBoundedDetailObservation,
  type DetailObservationProfile,
} from "./bounded-detail-observation.js";
import { MemorySourceBudget } from "./bounded-probe.js";

const profile: DetailObservationProfile = {
  source_key: "source-a",
  allowed_hosts: ["listings.example.com"],
  allowed_path_prefixes: ["/rentals"],
  budget: {
    max_requests: 2,
    max_bytes: 4096,
    max_duration_ms: 1000,
    max_redirects: 0,
    max_concurrency: 1,
    max_source_requests: 2,
  },
};

const selection = {
  resolved: {
    selection: {
      contract_version: "v1" as const,
      discovery_observation_id: "discovery-1",
      candidate_url: "https://listings.example.com/rentals/one",
    },
    source_key: "source-a",
    scope: {
      country_code: "CO" as const,
      city_key: "barranquilla",
      capability: "discovery" as const,
      listing_roles: ["for_rent" as const],
    },
    discovery_profile_provenance: {
      source_key: "source-a",
      profile_version: 1,
      profile_sha256: "a".repeat(64),
    },
  },
};

const clock = {
  nowMs: () => 0,
  nowInstant: () => "2026-10-16T00:00:00.000Z",
};

describe("bounded detail observation", () => {
  it("performs dry preflight without DNS or HTTP", async () => {
    const resolve = vi.fn();
    const request = vi.fn();

    await expect(
      runBoundedDetailObservation(
        { ...selection, dry_run: true },
        {
          profile,
          clock,
          sourceBudget: new MemorySourceBudget(),
          transport: { resolve, request },
        },
      ),
    ).resolves.toEqual({
      ok: true,
      report: {
        kind: "dry_run",
        source_key: "source-a",
        discovery_observation_id: "discovery-1",
      },
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });

  it("uses only robots then the selected detail URL and disposes both bodies", async () => {
    const robots = new TextEncoder().encode("User-agent: *\nAllow: /");
    const detail = new TextEncoder().encode("<html>private source body</html>");
    const request = vi.fn(async (input) => ({
      kind: "response" as const,
      connected_address: input.validated_addresses[0]!,
      response:
        new URL(input.url).pathname === "/robots.txt"
          ? {
              status_code: 200,
              content_type: "text/plain",
              body: robots,
              classification: "robots_policy" as const,
            }
          : {
              status_code: 200,
              content_type: "text/html",
              body: detail,
              classification: "listing_discovery" as const,
            },
    }));

    await expect(
      runBoundedDetailObservation(
        { ...selection, dry_run: false },
        {
          profile,
          clock,
          sourceBudget: new MemorySourceBudget(),
          transport: {
            resolve: async () => ({
              kind: "resolved" as const,
              addresses: ["93.184.216.34"],
            }),
            request,
          },
        },
      ),
    ).resolves.toEqual({
      ok: true,
      report: {
        kind: "detail_received",
        response: {
          canonical_url: "https://listings.example.com/rentals/one",
          media_type: "text/html",
          body_sha256: expect.any(String),
          body_byte_length: detail.byteLength,
        },
      },
    });
    expect(request.mock.calls.map(([input]) => input.url)).toEqual([
      "https://listings.example.com/robots.txt",
      "https://listings.example.com/rentals/one",
    ]);
    expect([...robots].every((byte) => byte === 0)).toBe(true);
    expect([...detail].every((byte) => byte === 0)).toBe(true);
  });

  it("stops after robots denial and never requests the detail URL", async () => {
    const request = vi.fn(async (input) => ({
      kind: "response" as const,
      connected_address: input.validated_addresses[0]!,
      response: {
        status_code: 200,
        content_type: "text/plain",
        body: new TextEncoder().encode("User-agent: *\nDisallow: /rentals"),
        classification: "robots_policy" as const,
      },
    }));

    await expect(
      runBoundedDetailObservation(
        { ...selection, dry_run: false },
        {
          profile,
          clock,
          sourceBudget: new MemorySourceBudget(),
          transport: {
            resolve: async () => ({
              kind: "resolved" as const,
              addresses: ["93.184.216.34"],
            }),
            request,
          },
        },
      ),
    ).resolves.toEqual({
      ok: true,
      report: { kind: "stopped", reason: "robots_conflict" },
    });
    expect(request).toHaveBeenCalledOnce();
  });
});
