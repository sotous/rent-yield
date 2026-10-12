import { describe, expect, it, vi } from "vitest";
import { JsonFileDiscoveryProfileRepository } from "@rent-yield/discovery-profile-storage";
import { MemorySourceBudget } from "./bounded-probe.js";
import { runProfiledListingDiscovery } from "./profiled-discovery-runner.js";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";

const clock: ProbeClock = {
  nowMs: () => 0,
  nowInstant: () => "2026-10-08T00:00:00.000Z",
};

const profiles = () =>
  new JsonFileDiscoveryProfileRepository({
    path: new URL(
      "../../../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json",
      import.meta.url,
    ).pathname,
  });

const transport = (): ProbeTransport => ({
  resolve: async () => ({ kind: "resolved", addresses: ["93.184.216.34"] }),
  request: async (input) => ({
    kind: "response",
    connected_address: input.validated_addresses[0]!,
    response: input.url.endsWith("/robots.txt")
      ? {
          status_code: 200,
          content_type: "text/plain",
          body: new TextEncoder().encode("User-agent: *\nDisallow:\n"),
          classification: "robots_policy" as const,
        }
      : {
          status_code: 200,
          content_type: "text/html",
          body: new TextEncoder().encode("unretained raw body"),
          classification: "listing_discovery" as const,
          discovered_urls: [
            "https://www.ciencuadras.com/arriendo/barranquilla/listing-one",
          ],
        },
  }),
});

describe("profiled bounded discovery runner", () => {
  it("checks the configured robots policy before the configured discovery path and accounts for both requests", async () => {
    const requests: string[] = [];
    const robotsThenDiscovery: ProbeTransport = {
      resolve: async () => ({
        kind: "resolved",
        addresses: ["93.184.216.34"],
      }),
      request: async (input) => {
        requests.push(input.url);
        if (input.url.endsWith("/robots.txt")) {
          return {
            kind: "response",
            connected_address: input.validated_addresses[0]!,
            response: {
              status_code: 200,
              content_type: "text/plain",
              body: new TextEncoder().encode("User-agent: *\nDisallow:\n"),
              classification: "robots_policy" as never,
            },
          };
        }
        return {
          kind: "response",
          connected_address: input.validated_addresses[0]!,
          response: {
            status_code: 200,
            content_type: "text/html",
            body: new TextEncoder().encode("listing response"),
            classification: "listing_discovery",
          },
        };
      },
    };

    await expect(
      runProfiledListingDiscovery(
        {
          contract_version: "v1",
          probe_id: "robots-then-discovery",
          source_key: "ciencuadras",
          as_of: "2026-10-08T00:00:00.000Z",
        },
        {
          profiles: profiles(),
          transport: robotsThenDiscovery,
          clock,
          sourceBudget: new MemorySourceBudget(),
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        usage: { requests: 2 },
        outcome: { kind: "completed" },
      },
    });
    expect(requests).toEqual([
      "https://www.ciencuadras.com/robots.txt",
      "https://www.ciencuadras.com/arriendo/barranquilla",
    ]);
  });

  it("stops after a robots denial without issuing the discovery request", async () => {
    const requests: string[] = [];
    const deniedByRobots: ProbeTransport = {
      resolve: async () => ({
        kind: "resolved",
        addresses: ["93.184.216.34"],
      }),
      request: async (input) => {
        requests.push(input.url);
        return {
          kind: "response",
          connected_address: input.validated_addresses[0]!,
          response: {
            status_code: 200,
            content_type: "text/plain",
            body: new TextEncoder().encode(
              "User-agent: *\nDisallow: /arriendo/barranquilla\n",
            ),
            classification: "robots_policy" as never,
          },
        };
      },
    };

    await expect(
      runProfiledListingDiscovery(
        {
          contract_version: "v1",
          probe_id: "robots-denied",
          source_key: "ciencuadras",
          as_of: "2026-10-08T00:00:00.000Z",
        },
        {
          profiles: profiles(),
          transport: deniedByRobots,
          clock,
          sourceBudget: new MemorySourceBudget(),
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { outcome: { kind: "stopped", reason: "robots_conflict" } },
    });
    expect(requests).toEqual(["https://www.ciencuadras.com/robots.txt"]);
  });

  it("loads Storage's active profile by source key and does not accept business profile fields", async () => {
    await expect(
      runProfiledListingDiscovery(
        {
          contract_version: "v1",
          probe_id: "probe-1",
          source_key: "ciencuadras",
          as_of: "2026-10-08T00:00:00.000Z",
          start_url: "https://attacker.example/ignored",
        },
        {
          profiles: profiles(),
          transport: transport(),
          clock,
          sourceBudget: new MemorySourceBudget(),
        },
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: "invalid_input" } });

    const request = vi.fn(transport().request);
    const captured: unknown[] = [];
    const handoff = {
      handoff: vi.fn(async (input: unknown) => {
        captured.push(input);
        return { ok: true as const };
      }),
    };
    await expect(
      runProfiledListingDiscovery(
        {
          contract_version: "v1",
          probe_id: "probe-1",
          source_key: "ciencuadras",
          as_of: "2026-10-08T00:00:00.000Z",
        },
        {
          profiles: profiles(),
          transport: { ...transport(), request },
          clock,
          sourceBudget: new MemorySourceBudget(),
          captureHandoff: handoff,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        scope: {
          source_key: "ciencuadras",
          country_code: "CO",
          city_key: "barranquilla",
          capability: "discovery",
          listing_roles: ["for_rent"],
        },
        assessment_id: null,
        outcome: { kind: "completed" },
      },
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://www.ciencuadras.com/arriendo/barranquilla",
      }),
    );
    expect(handoff.handoff).toHaveBeenCalledWith(
      expect.objectContaining({
        discovery_profile_provenance: {
          source_key: "ciencuadras",
          profile_version: 3,
          profile_sha256:
            "7e5e00ea00f72ba02226a35e90a83f97327c6a6d11026ab8c34ba62ea5f7f9f8",
        },
      }),
    );
    expect(captured[0]).not.toHaveProperty("assessment_sha256");
  });

  it("stops before transport when Storage has no active profile", async () => {
    const request = vi.fn();
    await expect(
      runProfiledListingDiscovery(
        {
          contract_version: "v1",
          probe_id: "probe-1",
          source_key: "missing-source",
          as_of: "2026-10-08T00:00:00.000Z",
        },
        {
          profiles: profiles(),
          transport: { ...transport(), request },
          clock,
          sourceBudget: new MemorySourceBudget(),
        },
      ),
    ).resolves.toEqual({ ok: false, error: { code: "profile_unavailable" } });
    expect(request).not.toHaveBeenCalled();
  });

  it("stops before capture when the response media type is outside Storage's active profile", async () => {
    const handoff = {
      handoff: vi.fn(async () => ({ ok: true as const })),
    };
    const plainTextTransport: ProbeTransport = {
      resolve: async () => ({
        kind: "resolved",
        addresses: ["93.184.216.34"],
      }),
      request: async (input) => ({
        kind: "response",
        connected_address: input.validated_addresses[0]!,
        response: input.url.endsWith("/robots.txt")
          ? {
              status_code: 200,
              content_type: "text/plain",
              body: new TextEncoder().encode("User-agent: *\nDisallow:\n"),
              classification: "robots_policy" as const,
            }
          : {
              status_code: 200,
              content_type: "application/xml",
              body: new TextEncoder().encode("not an allowed source response"),
              classification: "listing_discovery" as const,
              discovered_urls: [],
            },
      }),
    };

    await expect(
      runProfiledListingDiscovery(
        {
          contract_version: "v1",
          probe_id: "probe-media-policy",
          source_key: "ciencuadras",
          as_of: "2026-10-08T00:00:00.000Z",
        },
        {
          profiles: profiles(),
          transport: plainTextTransport,
          clock,
          sourceBudget: new MemorySourceBudget(),
          captureHandoff: handoff,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      value: { outcome: { kind: "stopped", reason: "policy_mismatch" } },
    });
    expect(handoff.handoff).not.toHaveBeenCalled();
  });
});
