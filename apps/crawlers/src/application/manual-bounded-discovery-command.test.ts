import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { JsonFileDiscoveryProfileRepository } from "@rent-yield/discovery-profile-storage";
import { runLocalManualBoundedDiscovery } from "./manual-bounded-discovery-command.js";
import { MemorySourceBudget } from "./bounded-probe.js";
import type { ProbeClock, ProbeTransport } from "../ports/probe-transport.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true })),
  );
});
const profiles = () =>
  new JsonFileDiscoveryProfileRepository({
    path: new URL(
      "../../../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json",
      import.meta.url,
    ).pathname,
  });
const clock: ProbeClock = {
  nowMs: () => 0,
  nowInstant: () => "2026-10-09T00:00:00.000Z",
};
const transport: ProbeTransport = {
  resolve: async () => ({ kind: "resolved", addresses: ["93.184.216.34"] }),
  request: async (input) => ({
    kind: "response",
    connected_address: input.validated_addresses[0]!,
    response: {
      status_code: 200,
      content_type: "application/json",
      body: new TextEncoder().encode(
        '{"listing":{"id":"one"},"email":"private@example.com"}',
      ),
      classification: "listing_discovery",
      discovered_urls: [],
    },
  }),
};

describe("local manual bounded discovery command", () => {
  it("composes the local profile, bounded transport, deterministic materializer, writer, and quarantine offline", async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), "rent-yield-command-"));
    roots.push(fixtureRoot);

    const result = await runLocalManualBoundedDiscovery(
      {
        contract_version: "v1",
        source_key: "ciencuadras",
        probe_id: "manual-command-1",
        as_of: "2026-10-09T00:00:00.000Z",
        kill_switch: false,
        dry_run: false,
        profilePath: new URL(
          "../../../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json",
          import.meta.url,
        ).pathname,
        fixtureRoot,
        fixture_id: "manual-command-fixture-1",
      },
      {
        profiles: profiles(),
        transport,
        clock,
        sourceBudget: new MemorySourceBudget(),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      report: {
        kind: "quarantined",
        fixture_id: "manual-command-fixture-1",
        quarantine: { reason: "manual_parser_not_configured" },
      },
    });
    await expect(
      readFile(
        join(fixtureRoot, "manual-command-fixture-1", "payload.json"),
        "utf8",
      ),
    ).resolves.not.toContain("private@example.com");
  });

  it("rejects dry run before using the injected transport", async () => {
    let requested = false;
    const result = await runLocalManualBoundedDiscovery(
      {
        contract_version: "v1",
        source_key: "ciencuadras",
        probe_id: "manual-command-2",
        as_of: "2026-10-09T00:00:00.000Z",
        kill_switch: false,
        dry_run: true,
        profilePath: "/not-read.json",
        fixtureRoot: "/not-written",
        fixture_id: "manual-command-fixture-2",
      },
      {
        profiles: profiles(),
        transport: {
          resolve: async () => {
            requested = true;
            throw new Error("must not resolve");
          },
          request: async () => {
            requested = true;
            throw new Error("must not request");
          },
        },
        clock,
        sourceBudget: new MemorySourceBudget(),
      },
    );
    expect(result).toEqual({ ok: false, error: { code: "dry_run_rejected" } });
    expect(requested).toBe(false);
  });
});
