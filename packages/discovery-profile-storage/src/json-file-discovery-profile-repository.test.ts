import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveDiscoveryExtractionProvenance,
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
  allowed_path_prefixes: ["/arriendo/barranquilla"],
  budget: {
    max_requests: 2,
    max_bytes: 65536,
    max_duration_ms: 10000,
    max_redirects: 1,
    max_concurrency: 1,
    max_source_requests: 2,
  },
  permitted_media_types: ["text/html", "application/json"],
  extraction: {
    state: "reviewed",
    kind: "html_anchor_href",
    extractor_version: "html-anchor-href-v1",
    candidate_hosts: ["www.ciencuadras.com"],
    extractor_artifact_sha256:
      "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
    candidate_path_prefixes: ["/inmueble/"],
    allow_no_candidates: true,
    allow_no_candidates_rationale:
      "A valid discovery page can expose no qualifying /inmueble/ anchors without invalidating capture.",
  },
} satisfies DiscoveryProfileV1;

const activeProfileProvenance = {
  source_key: "ciencuadras",
  profile_version: 2,
  profile_sha256:
    "c5d63a80998f99e5f0659664982e66801f21bffe17dc2a7bcc7dbb091fc7bd9a",
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

  it("rejects missing, ambiguous, or broader extraction rules", async () => {
    const missingRule = await writeRegistry([
      Object.fromEntries(
        Object.entries(activeProfile).filter(([key]) => key !== "extraction"),
      ),
    ]);
    const broaderHost = await writeRegistry([
      {
        ...activeProfile,
        extraction: {
          ...activeProfile.extraction,
          candidate_hosts: ["other.example.com"],
        },
      },
    ]);
    const ambiguousPrefix = await writeRegistry([
      {
        ...activeProfile,
        extraction: {
          ...activeProfile.extraction,
          candidate_path_prefixes: ["/inmueble/", "/inmueble/"],
        },
      },
    ]);
    const invalidArtifact = await writeRegistry([
      {
        ...activeProfile,
        extraction: {
          ...activeProfile.extraction,
          extractor_artifact_sha256: "not-a-sha256",
        },
      },
    ]);

    await expect(
      new JsonFileDiscoveryProfileRepository({
        path: missingRule,
      }).findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
    await expect(
      new JsonFileDiscoveryProfileRepository({
        path: broaderHost,
      }).findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
    await expect(
      new JsonFileDiscoveryProfileRepository({
        path: ambiguousPrefix,
      }).findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
    await expect(
      new JsonFileDiscoveryProfileRepository({
        path: invalidArtifact,
      }).findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).rejects.toThrow();
  });

  it("does not expose an extractor provenance until Storage marks a rule reviewed", () => {
    expect(
      deriveDiscoveryExtractionProvenance({
        ...activeProfile,
        extraction: { state: "unreviewed" },
      }),
    ).toBeNull();
    expect(deriveDiscoveryExtractionProvenance(activeProfile)).toEqual({
      kind: "html_anchor_href",
      version: "html-anchor-href-v1",
      extractor_artifact_sha256:
        "bbb60b1d01acc0dc381fbfa832e72ac6bbcc739bd0fdd39fad33b5248ae0f3cb",
      config_sha256:
        "e4bf38048ec506752ec5f32e1533279be18aa8dcc9dfd207443e74ff32cd19b3",
    });
  });

  it("binds extraction configuration into deterministic profile provenance", () => {
    expect(
      deriveDiscoveryProfileProvenance({
        ...activeProfile,
        extraction: {
          ...activeProfile.extraction,
          extractor_artifact_sha256: "c".repeat(64),
        },
      }),
    ).not.toEqual(activeProfileProvenance);
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

  it("reads the committed Storage-owned registry fixture", async () => {
    const repository = new JsonFileDiscoveryProfileRepository({
      path: committedFixturePath,
    });

    await expect(
      repository.findActiveBySourceKey({ source_key: "ciencuadras" }),
    ).resolves.toEqual({
      ...activeProfile,
      discovery_profile_provenance: {
        source_key: "ciencuadras",
        profile_version: 2,
        profile_sha256:
          "c5d63a80998f99e5f0659664982e66801f21bffe17dc2a7bcc7dbb091fc7bd9a",
      },
    });
  });
});
