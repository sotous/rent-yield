import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveDiscoveryProfileProvenance,
  discoveryProfileV2Schema,
  type DiscoveryProfileV2,
} from "./discovery-profile.js";
import { JsonFileDiscoveryProfileRepository } from "./json-file-discovery-profile-repository.js";

const activeProfile = {
  source_key: "ciencuadras",
  profile_version: 3,
  state: "active",
  scope: {
    country_code: "CO",
    city_key: "barranquilla",
    capability: "discovery",
    listing_roles: ["for_rent"],
  },
  allowed_hosts: ["www.ciencuadras.com"],
  allowed_path_prefixes: ["/arriendo/barranquilla"],
  budget: {
    max_requests: 2,
    max_bytes: 524288,
    max_duration_ms: 10000,
    max_redirects: 1,
    max_concurrency: 1,
    max_source_requests: 2,
  },
  permitted_media_types: ["text/html", "application/json"],
  candidate_url_extraction: {
    state: "reviewed",
    kind: "html_anchor_href",
    extractor_id: "html-anchor-href-v1",
    extractor_artifact_sha256:
      "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
    allowed_hosts: ["www.ciencuadras.com"],
    allowed_path_prefixes: ["/inmueble/"],
    allow_no_candidates_rationale:
      "A valid discovery response may contain no qualifying anchors.",
  },
} satisfies DiscoveryProfileV2;

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const committedFixturePath = join(
  packageDirectory,
  "..",
  "fixtures",
  "discovery-profiles.v2.json",
);

async function writeRegistry(profiles: readonly unknown[]): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "rent-yield-profiles-"));
  const path = join(directory, "profiles.json");
  await writeFile(
    path,
    JSON.stringify({ contract_version: "v2", profiles }),
    "utf8",
  );
  return path;
}

describe("JsonFileDiscoveryProfileRepository", () => {
  it("accepts an unreviewed extraction state only when it has no rule fields", () => {
    expect(
      discoveryProfileV2Schema.parse({
        ...activeProfile,
        candidate_url_extraction: { state: "unreviewed" },
      }).candidate_url_extraction,
    ).toEqual({ state: "unreviewed" });

    expect(
      discoveryProfileV2Schema.safeParse({
        ...activeProfile,
        candidate_url_extraction: {
          state: "unreviewed",
          allowed_hosts: ["www.ciencuadras.com"],
        },
      }).success,
    ).toBe(false);
  });

  it("requires a complete reviewed extraction rule", () => {
    expect(
      discoveryProfileV2Schema.safeParse({
        ...activeProfile,
        candidate_url_extraction: {
          ...activeProfile.candidate_url_extraction,
          extractor_artifact_sha256: "not-a-sha",
        },
      }).success,
    ).toBe(false);
    expect(
      discoveryProfileV2Schema.safeParse({
        ...activeProfile,
        candidate_url_extraction: {
          ...activeProfile.candidate_url_extraction,
          allow_no_candidates_rationale: " ",
        },
      }).success,
    ).toBe(false);
  });

  it("binds complete reviewed-rule facts into deterministic profile provenance", () => {
    const provenance = deriveDiscoveryProfileProvenance(activeProfile);
    expect(provenance).toMatchObject({
      source_key: "ciencuadras",
      profile_version: 3,
      candidate_url_extraction: {
        state: "reviewed",
        extractor_id: "html-anchor-href-v1",
        extractor_artifact_sha256:
          "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
      },
    });
    expect(
      deriveDiscoveryProfileProvenance({
        ...activeProfile,
        candidate_url_extraction: {
          ...activeProfile.candidate_url_extraction,
          allowed_path_prefixes: ["/inmueble-alt/"],
        },
      }),
    ).not.toEqual(provenance);
  });

  it("returns an active reviewed profile by source key without exposing unrelated profiles", async () => {
    const path = await writeRegistry([
      activeProfile,
      { ...activeProfile, source_key: "another-source", profile_version: 3 },
    ]);
    const repository = new JsonFileDiscoveryProfileRepository({ path });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).resolves.toMatchObject({
      ...activeProfile,
      discovery_profile_provenance:
        deriveDiscoveryProfileProvenance(activeProfile),
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
      { ...activeProfile, profile_version: 3 },
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

  it("reads the committed Storage-owned V2 registry fixture", async () => {
    const repository = new JsonFileDiscoveryProfileRepository({
      path: committedFixturePath,
    });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).resolves.toMatchObject({
      ...activeProfile,
      discovery_profile_provenance:
        deriveDiscoveryProfileProvenance(activeProfile),
    });
  });
});
