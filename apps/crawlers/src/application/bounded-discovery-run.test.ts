import { describe, expect, it } from "vitest";
import { runBoundedDiscovery } from "./bounded-discovery-run.js";
import { ciencuadrasDiscoveryProfile } from "../sources/ciencuadras/discovery-profile.js";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";

const clock: ProbeClock = {
  nowMs: () => 0,
  nowInstant: () => "2026-10-08T12:00:00.000Z",
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
      { probe_id: "probe-1", profile: ciencuadrasDiscoveryProfile },
      { transport, clock },
    );
    expect(requests).toEqual([
      "https://www.ciencuadras.com/arriendo/barranquilla",
    ]);
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
        { probe_id: "probe-fixture", profile: ciencuadrasDiscoveryProfile },
        {
          transport,
          clock,
          captureFixture: (handoff) => handoffs.push(handoff),
        },
      );

      expect(result.ok).toBe(true);
      expect(handoffs).toEqual([
        {
          source_key: "ciencuadras",
          source_url: "https://www.ciencuadras.com/arriendo/barranquilla",
          collected_at: "2026-10-08T12:00:00.000Z",
          discovery_profile_provenance: {
            source_key: "ciencuadras",
            profile_version: 3,
            profile_sha256:
              "26d015fb30e03328f331f8a29ee6ea5422ff22b612e141085943034f1167cebd",
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
        profile: ciencuadrasDiscoveryProfile,
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
