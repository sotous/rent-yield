import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DiscoveryObservationV1 } from "@rent-yield/listing-storage-contracts";
import { JsonFileDiscoveryObservationRepository } from "./json-file-discovery-observation-repository.js";

const observation = {
  contract_version: "v1",
  observation_id: "observation-1",
  capture_event_id: "capture-1",
  source_key: "source-1",
  collected_at: "2026-10-13T12:00:00.000Z",
  scope: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "discovery",
    listing_roles: ["for_rent"],
  },
  discovery_profile_provenance: {
    source_key: "source-1",
    profile_version: 1,
    profile_sha256: "a".repeat(64),
  },
  extractor: {
    kind: "html_anchor_href",
    version: "html-anchor-href-v1",
    config_sha256: "b".repeat(64),
    artifact_sha256: "d".repeat(64),
  },
  response: {
    canonical_url: "https://source.example/search",
    media_type: "text/html",
    body_sha256: "c".repeat(64),
    body_byte_length: 42,
  },
  outcome: "candidates_found",
  candidate_count: 1,
  candidate_urls: ["https://source.example/listings/1"],
} satisfies DiscoveryObservationV1;

async function destination() {
  return join(
    await mkdtemp(join(tmpdir(), "rent-yield-observations-")),
    "observation.json",
  );
}

describe("JsonFileDiscoveryObservationRepository", () => {
  it("atomically writes only one validated structured observation", async () => {
    const path = await destination();
    const repository = new JsonFileDiscoveryObservationRepository({ path });

    await expect(repository.append(observation)).resolves.toEqual({
      appended: true,
      observation,
    });
    await expect(readFile(path, "utf8")).resolves.toBe(
      `${JSON.stringify(observation, null, 2)}\n`,
    );
  });

  it("is append-only and idempotent only for the identical observation", async () => {
    const path = await destination();
    const repository = new JsonFileDiscoveryObservationRepository({ path });
    await repository.append(observation);

    await expect(repository.append(observation)).resolves.toEqual({
      appended: false,
      observation,
    });
    await expect(
      repository.append({ ...observation, observation_id: "observation-2" }),
    ).rejects.toThrow("already contains a different observation");
  });

  it("rejects a malformed existing target without replacing it", async () => {
    const path = await destination();
    await writeFile(path, "{ not-json", "utf8");

    await expect(
      new JsonFileDiscoveryObservationRepository({ path }).append(observation),
    ).rejects.toThrow("invalid JSON");
    await expect(readFile(path, "utf8")).resolves.toBe("{ not-json");
  });

  it("rejects invalid data before creating a file", async () => {
    const path = await destination();
    const repository = new JsonFileDiscoveryObservationRepository({ path });

    await expect(
      repository.append({
        ...observation,
        candidate_urls: ["https://source.example/listings/1?unsafe=1"],
      } as DiscoveryObservationV1),
    ).rejects.toThrow();
    await expect(readFile(path, "utf8")).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
