import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonFileDiscoveryProfileRepository } from "@rent-yield/discovery-profile-storage";
import { MemoryFixtureCapture } from "./fixture-capture.js";
import { runManualBoundedDiscovery } from "./manual-bounded-discovery.js";
import { MemorySourceBudget } from "./bounded-probe.js";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});

const clock: ProbeClock = {
  nowMs: () => 0,
  nowInstant: () => "2026-10-09T00:00:00.000Z",
};
const profiles = () =>
  new JsonFileDiscoveryProfileRepository({
    path: new URL(
      "../../../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json",
      import.meta.url,
    ).pathname,
  });
const transport = (request = vi.fn()) =>
  ({
    resolve: async () => ({
      kind: "resolved" as const,
      addresses: ["93.184.216.34"],
    }),
    request: async (input) => {
      request(input);
      return {
        kind: "response" as const,
        connected_address: input.validated_addresses[0]!,
        response: {
          status_code: 200,
          content_type: "application/json",
          body: new TextEncoder().encode(
            '{"id":"listing-1","price":"1800000","email":"private@example.com"}',
          ),
          classification: "listing_discovery" as const,
          discovered_urls: [
            "https://www.ciencuadras.com/arriendo/barranquilla/listing-1",
          ],
        },
      };
    },
  }) satisfies ProbeTransport;

function materializeFixture() {
  const captured = new MemoryFixtureCapture().captureRedactedFixture({
    fixture_id: "manual-ciencuadras-1",
    supersedes_fixture_id: null,
    origin: {
      kind: "permitted_source",
      source_key: "ciencuadras",
      source_url: "https://www.ciencuadras.com/arriendo/barranquilla",
      collected_at: "2026-10-09T00:00:00.000Z",
      discovery_profile_provenance: {
        source_key: "ciencuadras",
        profile_version: 1,
        profile_sha256: "a".repeat(64),
      },
    },
    created_at: "2026-10-09T00:00:00.000Z",
    content_type: "application/json",
    payload:
      '{"id":"listing-1","price":"1800000","email":"private@example.com"}',
    permitted_use: ["parser_replay"],
    retention_policy_key: "redacted-fixture-v1",
    research_session_id: "manual-ciencuadras",
    parser_compatibility: ["parser-v1"],
    expected_classification: "quarantined",
  });
  if (!captured.ok) throw new Error("fixture setup failed");
  return captured.artifact;
}

describe("manual bounded discovery", () => {
  it("runs the profiled bounded probe, writes only a validated redacted fixture, then reports typed quarantine", async () => {
    const root = await mkdtemp(join(tmpdir(), "rent-yield-manual-"));
    roots.push(root);
    const quarantine = vi.fn(async () => ({
      reason: "parser_not_selected" as const,
    }));
    const materializedInputs: unknown[] = [];
    const materialize = vi.fn(async (input: unknown) => {
      materializedInputs.push(input);
      return { ok: true as const, artifact: materializeFixture() };
    });

    await expect(
      runManualBoundedDiscovery(
        {
          contract_version: "v1",
          source_key: "ciencuadras",
          probe_id: "manual-probe-1",
          as_of: "2026-10-09T00:00:00.000Z",
          kill_switch: false,
          dry_run: false,
        },
        {
          profiles: profiles(),
          transport: transport(),
          clock,
          sourceBudget: new MemorySourceBudget(),
          fixtureRoot: root,
          materialize,
          quarantine,
        },
      ),
    ).resolves.toMatchObject({
      ok: true,
      report: {
        kind: "quarantined",
        fixture_id: "manual-ciencuadras-1",
        quarantine: { reason: "parser_not_selected" },
        discovery_profile_provenance: {
          source_key: "ciencuadras",
          profile_version: 1,
          profile_sha256:
            "e29f1353e04b6425ce4385b343b3df1862213f0b7d2a18eb0b6d338cf7c533fc",
        },
      },
    });
    expect(materializedInputs[0]).toMatchObject({
      discovery_profile_provenance: {
        source_key: "ciencuadras",
        profile_version: 1,
        profile_sha256:
          "e29f1353e04b6425ce4385b343b3df1862213f0b7d2a18eb0b6d338cf7c533fc",
      },
    });
    expect(JSON.stringify(materialize.mock.calls)).not.toContain(
      "private@example.com",
    );
    expect(JSON.stringify(quarantine.mock.calls)).not.toContain(
      "private@example.com",
    );
    await expect(
      readFile(join(root, "manual-ciencuadras-1", "payload.json"), "utf8"),
    ).resolves.not.toContain("private@example.com");
  });

  it.each([
    ["kill_switch", { kill_switch: true, dry_run: false }],
    ["dry_run", { kill_switch: false, dry_run: true }],
  ] as const)(
    "stops %s before profile lookup, transport, or persistence",
    async (_case, flags) => {
      const request = vi.fn();
      const materialize = vi.fn();
      const quarantine = vi.fn();
      await expect(
        runManualBoundedDiscovery(
          {
            contract_version: "v1",
            source_key: "ciencuadras",
            probe_id: "manual-probe-1",
            as_of: "2026-10-09T00:00:00.000Z",
            ...flags,
          },
          {
            profiles: profiles(),
            transport: transport(request),
            clock,
            sourceBudget: new MemorySourceBudget(),
            fixtureRoot: "/tmp/unused",
            materialize,
            quarantine,
          },
        ),
      ).resolves.toEqual({ ok: false, error: { code: `${_case}_rejected` } });
      expect(request).not.toHaveBeenCalled();
      expect(materialize).not.toHaveBeenCalled();
      expect(quarantine).not.toHaveBeenCalled();
    },
  );
});
