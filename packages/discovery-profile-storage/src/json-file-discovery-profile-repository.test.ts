import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveDiscoveryProfileProvenance,
  type DiscoveryProfileV1,
} from "./discovery-profile.js";
import { JsonFileDiscoveryProfileRepository } from "./json-file-discovery-profile-repository.js";

const activeProfile = {
  source_key: "ciencuadras",
  profile_version: 2,
  state: "active",
  scope: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "discovery",
    listing_roles: ["for_rent"],
  },
  allowed_hosts: ["www.ciencuadras.com"],
  allowed_path_prefixes: ["/robots.txt", "/arriendo/barranquilla"],
  robots_path: "/robots.txt",
  discovery_path: "/arriendo/barranquilla",
  budget: {
    max_requests: 2,
    max_bytes: 262144,
    max_duration_ms: 10000,
    max_redirects: 1,
    max_concurrency: 1,
    max_source_requests: 2,
  },
  permitted_media_types: ["text/plain", "text/html", "application/json"],
} satisfies DiscoveryProfileV1;

const activeProfileProvenance = {
  source_key: "ciencuadras",
  profile_version: 2,
  profile_sha256:
    "8b9ee61bdcd0623b661d2371aa8b9ceea652a8f20e1eb24f321974737173d740",
};

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const committedFixturePath = join(
  packageDirectory,
  "..",
  "fixtures",
  "discovery-profiles.v1.json",
);

async function writeRegistry(profiles: readonly unknown[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "rent-yield-profiles-"));
  const path = join(directory, "profiles.json");
  await writeFile(
    path,
    JSON.stringify({ contract_version: "v1", profiles }),
    "utf8",
  );
  return path;
}

describe("JsonFileDiscoveryProfileRepository", () => {
  it("derives stable operational provenance from the complete validated profile", () => {
    expect(deriveDiscoveryProfileProvenance(activeProfile)).toEqual(
      activeProfileProvenance,
    );
    expect(
      deriveDiscoveryProfileProvenance({
        ...activeProfile,
        budget: { ...activeProfile.budget, max_bytes: 65537 },
      }),
    ).not.toEqual(activeProfileProvenance);
  });
  it("returns an active profile by source key without exposing unrelated profiles", async () => {
    const path = await writeRegistry([
      activeProfile,
      { ...activeProfile, source_key: "another-source", profile_version: 3 },
    ]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).resolves.toEqual({
      ...activeProfile,
      discovery_profile_provenance: activeProfileProvenance,
    });
  });

  it("returns null when a source has no active profile", async () => {
    const path = await writeRegistry([{ ...activeProfile, state: "inactive" }]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).resolves.toBeNull();
  });

  it("rejects a registry that tries to activate two versions for one source", async () => {
    const path = await writeRegistry([
      activeProfile,
      { ...activeProfile, profile_version: 2 },
    ]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow("multiple active profiles");
  });

  it("rejects invalid persisted profile data instead of passing it to the crawler", async () => {
    const path = await writeRegistry([
      { ...activeProfile, allowed_hosts: ["http://unsafe.example"] },
    ]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
  });

  it("rejects a profile with an unsafe path or contradictory request budget", async () => {
    const path = await writeRegistry([
      {
        ...activeProfile,
        allowed_path_prefixes: ["/arriendo/../private"],
        budget: { ...activeProfile.budget, max_source_requests: 3 },
      },
    ]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
  });

  it("rejects a profile whose robots path is not deliberately within its allowed request paths", async () => {
    const path = await writeRegistry([
      { ...activeProfile, robots_path: "/robots-private.txt" },
    ]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
  });

  it("reads the committed Storage-owned registry fixture", async () => {
    const repository = new JsonFileDiscoveryProfileRepository({
      path: committedFixturePath,
    });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).resolves.toEqual({
      ...activeProfile,
      discovery_profile_provenance: activeProfileProvenance,
    });
  });
});
