import { describe, expect, it } from "vitest";
import { runBoundedDiscovery } from "./bounded-discovery-run.js";
import type { BoundedDiscoveryProfile } from "./bounded-discovery-profile.js";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";

const clock: ProbeClock = {
  nowMs: () => 0,
  nowInstant: () => "2026-10-08T12:00:00.000Z",
};

const profile: BoundedDiscoveryProfile = {
  source_key: "example-source",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "discovery",
  listing_roles: ["for_rent"],
  discovery_profile_provenance: {
    source_key: "example-source",
    profile_version: 1,
    profile_sha256: "0".repeat(64),
  },
  allowed_hosts: ["example.com"],
  allowed_path_prefixes: ["/rentals"],
  permitted_media_types: ["text/html", "application/json"],
  budget: {
    max_requests: 1,
    max_bytes: 1024,
    max_duration_ms: 1000,
    max_redirects: 0,
    max_concurrency: 1,
    max_source_requests: 1,
  },
};

describe("runBoundedDiscovery", () => {
  it("uses the fixed configured discovery URL rather than caller input", async () => {
    const requests: string[] = [];
    const transport: ProbeTransport = {
      resolve: async () => ({ kind: "resolved", addresses: ["93.184.216.34"] }),
      request: async (input) => {
        requests.push(input.url);
        return {
          kind: "response",
          connected_address: "93.184.216.34",
          response: {
            status_code: 200,
            content_type: "text/html",
            body: new Uint8Array(),
            classification: "listing_discovery",
          },
        };
      },
    };
    await runBoundedDiscovery(
      { probe_id: "probe-1", profile },
      { transport, clock },
    );
    expect(requests).toEqual(["https://example.com/rentals"]);
  });

  it.each([
    ["text/html; charset=utf-8", "text/html"],
    ["application/json; charset=utf-8", "application/json"],
  ] as const)(
    "hands unclassified %s to fixture capture as %s with Storage profile provenance",
    async (responseContentType, expectedContentType) => {
      const body = new TextEncoder().encode("<main>rental discovery</main>");
      const handoffs: unknown[] = [];
      const transport: ProbeTransport = {
        resolve: async () => ({
          kind: "resolved",
          addresses: ["93.184.216.34"],
        }),
        request: async () => ({
          kind: "response",
          connected_address: "93.184.216.34",
          response: {
            status_code: 200,
            content_type: responseContentType,
            body,
          },
        }),
      };

      const result = await runBoundedDiscovery(
        { probe_id: "probe-fixture", profile },
        {
          transport,
          clock,
          captureFixture: (handoff) => handoffs.push(handoff),
        },
      );

      expect(result.ok).toBe(true);
      expect(handoffs).toEqual([
        {
          source_key: "example-source",
          source_url: "https://example.com/rentals",
          collected_at: "2026-10-08T12:00:00.000Z",
          discovery_profile_provenance: {
            source_key: "example-source",
            profile_version: 1,
            profile_sha256: "0".repeat(64),
          },
          content_type: expectedContentType,
          payload: body,
        },
      ]);
    },
  );

  it("does not hand unsupported media to fixture capture", async () => {
    const handoffs: unknown[] = [];
    const transport: ProbeTransport = {
      resolve: async () => ({ kind: "resolved", addresses: ["93.184.216.34"] }),
      request: async () => ({
        kind: "response",
        connected_address: "93.184.216.34",
        response: {
          status_code: 200,
          content_type: "application/pdf",
          body: new Uint8Array([37, 80, 68, 70]),
        },
      }),
    };

    const result = await runBoundedDiscovery(
      {
        probe_id: "probe-unsupported-media",
        profile,
      },
      { transport, clock, captureFixture: (handoff) => handoffs.push(handoff) },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { outcome: { kind: "stopped", reason: "transport_error" } },
    });
    expect(handoffs).toEqual([]);
  });
});
