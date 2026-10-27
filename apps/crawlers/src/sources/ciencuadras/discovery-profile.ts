import type { BoundedDiscoveryProfile } from "../../application/bounded-discovery-profile.js";

export const ciencuadrasDiscoveryProfile: BoundedDiscoveryProfile = {
  source_key: "ciencuadras",
  country_code: "CO",
  city_key: "barranquilla",
  capability: "discovery",
  listing_roles: ["for_rent"],
  discovery_profile_provenance: {
    source_key: "ciencuadras",
    profile_version: 3,
    profile_sha256:
      "26d015fb30e03328f331f8a29ee6ea5422ff22b612e141085943034f1167cebd",
  },
  allowed_hosts: ["www.ciencuadras.com"],
  allowed_path_prefixes: ["/arriendo/barranquilla"],
  permitted_media_types: ["text/html", "application/json"],
  budget: {
    max_requests: 2,
    max_bytes: 524288,
    max_duration_ms: 10000,
    max_redirects: 1,
    max_concurrency: 1,
    max_source_requests: 2,
  },
} as const;
