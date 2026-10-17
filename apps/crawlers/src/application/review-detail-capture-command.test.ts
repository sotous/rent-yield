import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { DiscoveryObservationV1 } from "@rent-yield/listing-storage-contracts";
import {
  runReviewDetailCapture,
  type ReviewDetailCaptureCommand,
} from "./review-detail-capture-command.js";

const candidateUrl = "https://www.example.com/inmueble/one";
const command = (outputPath: string): ReviewDetailCaptureCommand => ({
  discovery_observation_id: "discovery-1",
  candidate_url: candidateUrl,
  discovery_observation_path: "/tmp/discovery-observation.json",
  output_path: outputPath,
});

const observation: DiscoveryObservationV1 = {
  contract_version: "v1",
  observation_id: "discovery-1",
  capture_event_id: "capture-1",
  source_key: "example-source",
  collected_at: "2026-10-17T12:00:00.000Z",
  scope: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "discovery",
    listing_roles: ["for_rent"],
  },
  discovery_profile_provenance: {
    source_key: "example-source",
    profile_version: 1,
    profile_sha256: "a".repeat(64),
  },
  extractor: {
    kind: "html_anchor_href",
    version: "html-anchor-href-v1",
    config_sha256: "b".repeat(64),
    artifact_sha256: "c".repeat(64),
  },
  response: {
    canonical_url: "https://www.example.com/search",
    media_type: "text/html",
    body_sha256: "d".repeat(64),
    body_byte_length: 0,
  },
  outcome: "candidates_found",
  candidate_count: 1,
  candidate_urls: [candidateUrl],
};

const response = (body: Uint8Array, contentType: string) => ({
  kind: "response" as const,
  connected_address: "93.184.216.34",
  response: {
    status_code: 200,
    content_type: contentType,
    body,
    classification: "listing_discovery" as const,
  },
});

const repository = (value: DiscoveryObservationV1 | null) => ({
  append: vi.fn(),
  findById: vi.fn().mockResolvedValue(value),
});

const transport = (outcomes: unknown[]) => ({
  resolve: vi.fn().mockResolvedValue({
    kind: "resolved",
    addresses: ["93.184.216.34"],
  }),
  request: vi.fn().mockImplementation(async () => outcomes.shift()),
});

describe("review detail capture command", () => {
  it("makes exactly robots then the persisted candidate request and writes no raw body", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-detail-capture-"));
    const outputPath = join(root, "capture.json");
    const robots = new TextEncoder().encode("User-agent: *\nAllow: /\n");
    const secret = "Carrera 53 # 80-67 / Ana Perez / 3001234567";
    const detail = new TextEncoder().encode(`
      <script type="application/ld+json">{"address":"${secret}"}</script>
      <dl><dt>Canon de arrendamiento</dt><dd>COP 1800000 mensual</dd></dl>
    `);
    const probe = transport([
      response(robots, "text/plain"),
      response(detail, "text/html"),
    ]);

    try {
      await expect(
        runReviewDetailCapture(command(outputPath), {
          observations: repository(observation),
          transport: probe,
        }),
      ).resolves.toMatchObject({
        ok: true,
        report: { kind: "captured", output_path: outputPath },
      });
      expect(probe.request).toHaveBeenCalledTimes(2);
      expect(probe.request.mock.calls.map(([request]) => request.url)).toEqual([
        "https://www.example.com/robots.txt",
        candidateUrl,
      ]);
      expect([...robots].every((byte) => byte === 0)).toBe(true);
      expect([...detail].every((byte) => byte === 0)).toBe(true);
      const artifact = await readFile(outputPath, "utf8");
      expect(artifact).toContain('"asking_amount": "1800000"');
      expect(artifact).toContain('"outcome": "unique"');
      expect(artifact).not.toContain(secret);
      expect(artifact).not.toContain("application/ld+json");
      expect(artifact).not.toContain("Canon de arrendamiento");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("stops after robots policy conflict and clears the policy bytes", async () => {
    const robots = new TextEncoder().encode(
      "User-agent: *\nDisallow: /inmueble\n",
    );
    const probe = transport([response(robots, "text/plain")]);

    await expect(
      runReviewDetailCapture(command("/tmp/review-detail-capture.json"), {
        observations: repository(observation),
        transport: probe,
      }),
    ).resolves.toEqual({
      ok: true,
      report: { kind: "stopped", reason: "robots_conflict" },
    });
    expect(probe.request).toHaveBeenCalledTimes(1);
    expect([...robots].every((byte) => byte === 0)).toBe(true);
  });

  it("rejects an unavailable persisted selection before networking", async () => {
    const probe = transport([]);

    await expect(
      runReviewDetailCapture(command("/tmp/review-detail-capture.json"), {
        observations: repository(null),
        transport: probe,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: "selection_unavailable" },
    });
    expect(probe.resolve).not.toHaveBeenCalled();
    expect(probe.request).not.toHaveBeenCalled();
  });

  it("refuses an already-reserved capture target before networking", async () => {
    const root = await mkdtemp(join(tmpdir(), "review-detail-capture-"));
    const outputPath = join(root, "capture.json");
    const probe = transport([]);
    try {
      await writeFile(outputPath, "{}\n", "utf8");
      await expect(
        runReviewDetailCapture(command(outputPath), {
          observations: repository(observation),
          transport: probe,
        }),
      ).resolves.toEqual({
        ok: false,
        error: { code: "capture_exists" },
      });
      expect(probe.resolve).not.toHaveBeenCalled();
      expect(probe.request).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
