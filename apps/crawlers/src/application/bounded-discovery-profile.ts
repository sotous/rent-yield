/** Source-specific input consumed by the reusable bounded discovery runner. */
import type { FixtureMediaType } from "./fixture-media-type.js";

export type BoundedDiscoveryProfile = {
  source_key: string;
  country_code: "CO";
  city_key: string;
  capability: "discovery";
  listing_roles: ["for_rent"];
  discovery_profile_provenance: {
    source_key: string;
    profile_version: number;
    profile_sha256: string;
  };
  allowed_hosts: [string];
  allowed_path_prefixes: [string];
  permitted_media_types: FixtureMediaType[];
  budget: {
    max_requests: number;
    max_bytes: number;
    max_duration_ms: number;
    max_redirects: number;
    max_concurrency: number;
    max_source_requests: number;
  };
};
