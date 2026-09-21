import { describe, expect, it } from "vitest";
import {
  canonicalMethodologyManifestV2,
  methodologyLookupV2Schema,
  methodologyManifestDigestV2,
  methodologyManifestV2Schema,
} from "./methodology.js";

const manifest = {
  contract_version: "v2",
  methodology_key: "synthetic-detail-v2",
  scope: {
    source_key: "synthetic-source",
    city_key: "barranquilla",
    country_code: "CO",
    capability: "detail",
    listing_roles: ["for_rent"],
  },
  recheck_after: "2026-10-01T00:00:00.000Z",
  adapter: {
    key: "synthetic-detail",
    artifact_hash: "c".repeat(64),
    parser_version: "1.0.0",
    normalizer_version: "1.0.0",
    extraction_contract_hash: "d".repeat(64),
    supported_contract_version: "v2",
  },
  access_policy: {
    hosts: ["fixtures.example"],
    path_prefixes: ["/listings/"],
    request_methods: ["GET"],
    media_types: ["application/json", "text/html"],
    query: {
      kind: "declared",
      exact_pairs: [{ key: "locale", value: "es-CO" }],
      no_value_keys: ["preview"],
    },
    redirects: {
      https_only: true,
      max_hops: 1,
      host_rule: "same_host",
    },
    transport: {
      public_addresses_only: true,
      tls_hostname_verification: true,
      connection_timeout_ms: 1000,
      response_timeout_ms: 2000,
    },
    headers: { profile_key: "public-accept-json-v1" },
    credentials_permitted: false,
    cookies_permitted: false,
  },
  permitted_operations: ["read_detail"],
  strategy: "structured_json",
  budget: {
    max_requests: 2,
    max_bytes: 1024,
    max_duration_ms: 3000,
    max_redirects: 1,
    max_concurrency: 1,
    max_source_requests: 2,
  },
  circuit_breaker: {
    stop_on: ["access_denied", "policy_mismatch"],
    max_consecutive_failures: 1,
  },
  fixture_hashes: ["e".repeat(64)],
  redaction: {
    policy_key: "synthetic-redaction-v2",
    policy_hash: "f".repeat(64),
  },
  retention: {
    policy_key: "synthetic-fixtures-v2",
    policy_hash: "0".repeat(64),
    permitted_uses: ["parser_replay"],
    body_representation: "redacted_fixture",
    retain_images: false,
  },
};

describe("Methodology Manifest V2", () => {
  it("accepts a fixture-safe manifest with an exact resolver scope", () => {
    expect(methodologyManifestV2Schema.safeParse(manifest).success).toBe(true);
    expect(
      methodologyLookupV2Schema.safeParse({
        contract_version: "v2",
        accepted_contract_version: "v2",
        source_key: "synthetic-source",
        country_code: "CO",
        city_key: "barranquilla",
        capability: "detail",
        listing_role: "for_rent",
        effective_at: "2026-09-21T00:00:00.000Z",
        recorded_as_of: "2026-09-21T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects undeclared query values, credentials, cookies, and weaker transport", () => {
    expect(
      methodologyManifestV2Schema.safeParse({
        ...manifest,
        access_policy: {
          ...manifest.access_policy,
          query: { kind: "declared", exact_pairs: [], no_value_keys: [] },
        },
      }).success,
    ).toBe(false);
    for (const patch of [
      { credentials_permitted: true },
      { cookies_permitted: true },
      {
        transport: {
          ...manifest.access_policy.transport,
          public_addresses_only: false,
        },
      },
      { redirects: { ...manifest.access_policy.redirects, https_only: false } },
    ]) {
      expect(
        methodologyManifestV2Schema.safeParse({
          ...manifest,
          access_policy: { ...manifest.access_policy, ...patch },
        }).success,
      ).toBe(false);
    }
  });

  it("rejects a caller-supplied candidate or assessment binding", () => {
    expect(
      methodologyManifestV2Schema.safeParse({
        ...manifest,
        candidate_id: "candidate-1",
      }).success,
    ).toBe(false);
    expect(
      methodologyLookupV2Schema.safeParse({
        contract_version: "v2",
        accepted_contract_version: "v2",
        source_key: "synthetic-source",
        country_code: "CO",
        city_key: "barranquilla",
        capability: "detail",
        listing_role: "for_rent",
        effective_at: "2026-09-21T00:00:00.000Z",
        recorded_as_of: "2026-09-21T00:00:00.000Z",
        assessment_id: "assessment-1",
      }).success,
    ).toBe(false);
  });

  it("canonicalizes every set-valued policy field before hashing", () => {
    const reordered = {
      ...manifest,
      scope: {
        ...manifest.scope,
        listing_roles: [...manifest.scope.listing_roles].reverse(),
      },
      access_policy: {
        ...manifest.access_policy,
        media_types: [...manifest.access_policy.media_types].reverse(),
        query: {
          ...manifest.access_policy.query,
          exact_pairs: [...manifest.access_policy.query.exact_pairs].reverse(),
          no_value_keys: [
            ...manifest.access_policy.query.no_value_keys,
          ].reverse(),
        },
      },
    };
    expect(methodologyManifestDigestV2(reordered)).toBe(
      methodologyManifestDigestV2(manifest),
    );
    expect(canonicalMethodologyManifestV2(reordered)).toEqual(
      canonicalMethodologyManifestV2(manifest),
    );
  });
});

describe("Methodology Manifest V2 original-body retention", () => {
  it("permits explicitly approved original HTML or JSON for replay or audit", () => {
    expect(
      methodologyManifestV2Schema.safeParse({
        ...manifest,
        retention: {
          ...manifest.retention,
          body_representation: "original_source_body",
          original_body_media_types: ["application/json"],
        },
      }).success,
    ).toBe(true);
  });

  it("rejects an original body type outside the approved HTML or JSON allowlist", () => {
    expect(
      methodologyManifestV2Schema.safeParse({
        ...manifest,
        retention: {
          ...manifest.retention,
          body_representation: "original_source_body",
          original_body_media_types: ["text/plain"],
        },
      }).success,
    ).toBe(false);
  });

  it("requires the original body type to match the approved access and retention policy", () => {
    expect(
      methodologyManifestV2Schema.safeParse({
        ...manifest,
        access_policy: {
          ...manifest.access_policy,
          media_types: ["text/html"],
        },
        retention: {
          ...manifest.retention,
          body_representation: "original_source_body",
          original_body_media_types: ["application/json"],
        },
      }).success,
    ).toBe(false);
    expect(
      methodologyManifestV2Schema.safeParse({
        ...manifest,
        retention: {
          ...manifest.retention,
          body_representation: "original_source_body",
          original_body_media_types: ["application/json"],
          permitted_uses: [],
        },
      }).success,
    ).toBe(false);
  });
});
