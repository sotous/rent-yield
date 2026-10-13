import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActiveDiscoveryProfileV1 } from "@rent-yield/discovery-profile-storage";
import { JsonFileDiscoveryProfileRepository } from "@rent-yield/discovery-profile-storage";
import { runAllowlistedDiscoveryObservation } from "./allowlisted-discovery-observation.js";
import { MemorySourceBudget } from "./bounded-probe.js";

const roots: string[] = [];
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true }))),
);

const profile: ActiveDiscoveryProfileV1 = {
  source_key: "source-a",
  profile_version: 1,
  state: "active",
  scope: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "discovery",
    listing_roles: ["for_rent"],
  },
  allowed_hosts: ["listings.example.com"],
  allowed_path_prefixes: ["/search"],
  budget: {
    max_requests: 2,
    max_bytes: 4096,
    max_duration_ms: 1000,
    max_redirects: 0,
    max_concurrency: 1,
    max_source_requests: 2,
  },
  permitted_media_types: ["text/html"],
  extraction: {
    state: "reviewed",
    kind: "html_anchor_href",
    extractor_version: "html-anchor-href-v1",
    extractor_artifact_sha256:
      "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
    allow_no_candidates_rationale:
      "A valid discovery response can contain no matching anchors.",
    candidate_hosts: ["listings.example.com"],
    candidate_path_prefixes: ["/rentals"],
    allow_no_candidates: true,
  },
  discovery_profile_provenance: {
    source_key: "source-a",
    profile_version: 1,
    profile_sha256: "a".repeat(64),
  },
};
const clock = { nowMs: () => 0, nowInstant: () => "2026-10-13T00:00:00.000Z" };
const command = (observation_path: string, dry_run = false) => ({
  contract_version: "v1" as const,
  source_key: "source-a",
  probe_id: "probe-1",
  observation_id: "observation-1",
  capture_event_id: "capture-1",
  as_of: "2026-10-13T00:00:00.000Z",
  kill_switch: false,
  dry_run,
  observation_path,
});

describe("allowlisted discovery observation", () => {
  it("runs the reviewed profile preflight without DNS, HTTP, or output", async () => {
    const resolve = vi.fn();
    const result = await runAllowlistedDiscoveryObservation(
      command("/tmp/no-write", true),
      {
        profiles: { findActiveBySourceKey: async () => profile },
        clock,
        sourceBudget: new MemorySourceBudget(),
        transport: { resolve, request: vi.fn() },
      },
    );
    expect(result).toEqual({
      ok: true,
      report: {
        kind: "dry_run",
        source_key: "source-a",
        profile_sha256: "a".repeat(64),
      },
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("preflights the reviewed Ciencuadras profile without using transport", async () => {
    const resolve = vi.fn();
    const result = await runAllowlistedDiscoveryObservation(
      { ...command("/tmp/no-write", true), source_key: "ciencuadras" },
      {
        profiles: new JsonFileDiscoveryProfileRepository({
          path: new URL(
            "../../../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json",
            import.meta.url,
          ).pathname,
        }),
        clock,
        sourceBudget: new MemorySourceBudget(),
        transport: { resolve, request: vi.fn() },
      },
    );
    expect(result).toMatchObject({
      ok: true,
      report: { kind: "dry_run", source_key: "ciencuadras" },
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("writes only a schema-valid observation from configured candidate URLs", async () => {
    const root = await mkdtemp(join(tmpdir(), "rent-yield-observation-"));
    roots.push(root);
    const path = join(root, "observation.json");
    const result = await runAllowlistedDiscoveryObservation(command(path), {
      profiles: { findActiveBySourceKey: async () => profile },
      clock,
      sourceBudget: new MemorySourceBudget(),
      transport: {
        resolve: async () => ({
          kind: "resolved" as const,
          addresses: ["93.184.216.34"],
        }),
        request: async (request) => ({
          kind: "response" as const,
          connected_address: request.validated_addresses[0]!,
          response: {
            status_code: 200,
            content_type: "text/html",
            body: new TextEncoder().encode(
              '<a href="/rentals/one">one</a><a href="/ignored">no</a>',
            ),
            classification: "listing_discovery" as const,
          },
        }),
      },
    });
    expect(result).toMatchObject({
      ok: true,
      report: {
        kind: "written",
        observation: {
          candidate_urls: ["https://listings.example.com/rentals/one"],
          extractor: {
            artifact_sha256:
              "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
          },
        },
      },
    });
    await expect(readFile(path, "utf8")).resolves.not.toContain("/ignored");
  });

  it("stops before DNS or output for an unreviewed rule, including dry mode", async () => {
    const resolve = vi.fn();
    const result = await runAllowlistedDiscoveryObservation(
      command("/tmp/no-write", true),
      {
        profiles: {
          findActiveBySourceKey: async () => ({
            ...profile,
            extraction: { state: "unreviewed" },
          }),
        },
        clock,
        sourceBudget: new MemorySourceBudget(),
        transport: { resolve, request: vi.fn() },
      },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "extraction_rule_unreviewed" },
    });
    expect(resolve).not.toHaveBeenCalled();
  });
});
