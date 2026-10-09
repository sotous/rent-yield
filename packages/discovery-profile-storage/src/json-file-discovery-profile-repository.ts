import { readFile } from "node:fs/promises";
import {
  discoveryProfileLookupSchema,
  discoveryProfileRegistryV1Schema,
  deriveDiscoveryProfileProvenance,
  type ActiveDiscoveryProfileV1,
  type DiscoveryProfileRepository,
} from "./discovery-profile.js";

export class JsonFileDiscoveryProfileRepository implements DiscoveryProfileRepository {
  readonly #path: string;

  constructor(input: { path: string }) {
    this.#path = input.path;
  }

  async findActiveBySourceKey(input: {
    source_key: string;
  }): Promise<ActiveDiscoveryProfileV1 | null> {
    const lookup = discoveryProfileLookupSchema.parse(input);
    const registry = await this.#readRegistry();
    const matches = registry.profiles.filter(
      (profile) =>
        profile.source_key === lookup.source_key && profile.state === "active",
    );
    if (matches.length > 1)
      throw new Error(
        `Discovery profile registry has multiple active profiles for ${lookup.source_key}`,
      );
    const profile = matches[0];
    return profile
      ? {
          ...profile,
          discovery_profile_provenance:
            deriveDiscoveryProfileProvenance(profile),
        }
      : null;
  }

  async #readRegistry() {
    const serialized = await readFile(this.#path, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch {
      throw new Error("Discovery profile registry is invalid JSON");
    }
    return discoveryProfileRegistryV1Schema.parse(parsed);
  }
}
