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
    response: {
      status_code: 200,
      content_type: "text/html",
      body: new TextEncoder().encode("unretained raw body"),
      classification: "listing_discovery",
      discovered_urls: [
        "https://www.ciencuadras.com/arriendo/barranquilla/listing-one",
      ],
    },
  }),
});

describe("profiled bounded discovery runner", () => {
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
        return { ok: true };
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
          profile_version: 1,
          profile_sha256:
            "e29f1353e04b6425ce4385b343b3df1862213f0b7d2a18eb0b6d338cf7c533fc",
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
});
