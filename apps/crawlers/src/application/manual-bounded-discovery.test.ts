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
      if (input.url.endsWith("/robots.txt")) {
        return {
          kind: "response" as const,
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
        result: {
          kind: "quarantined",
          fixture_id: "manual-ciencuadras-1",
          quarantine: { reason: "parser_not_selected" },
          discovery_profile_provenance: {
            source_key: "ciencuadras",
            profile_version: 3,
            profile_sha256: expect.any(String),
          },
        },
        receipt: expect.objectContaining({
          probe_id: "manual-probe-1",
          response_evidence: expect.arrayContaining([
            expect.objectContaining({
              body: expect.objectContaining({
                byte_length: expect.any(Number),
              }),
            }),
          ]),
        }),
      },
    });
    expect(materializedInputs[0]).toMatchObject({
      discovery_profile_provenance: {
        source_key: "ciencuadras",
        profile_version: 3,
        profile_sha256:
          "7e5e00ea00f72ba02226a35e90a83f97327c6a6d11026ab8c34ba62ea5f7f9f8",
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

describe("manual bounded discovery capture diagnostics", () => {
  it("reports a sanitized capture rejection instead of collapsing it into transport failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "rent-yield-manual-"));
    roots.push(root);
    const result = await runManualBoundedDiscovery(
      {
        contract_version: "v1",
        source_key: "ciencuadras",
        probe_id: "manual-probe-rejection",
        as_of: "2026-10-12T00:00:00.000Z",
        kill_switch: false,
        dry_run: false,
      },
      {
        profiles: profiles(),
        transport: {
          resolve: async () => ({
            kind: "resolved",
            addresses: ["93.184.216.34"],
          }),
          request: async (input) => ({
            kind: "response",
            connected_address: input.validated_addresses[0]!,
            response: {
              status_code: 200,
              content_type: "text/plain",
              body: new Uint8Array([0, 1]),
              classification: "listing_discovery",
              discovered_urls: [],
            },
          }),
        },
        clock,
        sourceBudget: new MemorySourceBudget(),
        fixtureRoot: root,
        materialize: async () => ({ ok: false }),
        quarantine: async () => ({ reason: "unused" }),
      },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "capture_rejected", reason: "prohibited_data" },
    });
  });
});
