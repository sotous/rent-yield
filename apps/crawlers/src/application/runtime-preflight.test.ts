import { describe, expect, it, vi } from "vitest";
import {
  methodologyManifestDigestV2,
  type MethodologyManifestV2,
} from "@rent-yield/listing-storage-contracts";
import {
  preflightFixtureRun,
  type FixtureRuntimeDependencies,
  type RuntimeMethodologyResolver,
} from "./runtime-preflight.js";

const now = "2026-09-23T12:00:00.000Z";
const fixtureHash = "e".repeat(64);

const manifest: MethodologyManifestV2 = {
  contract_version: "v2",
  methodology_key: "synthetic-detail-v2",
  scope: {
    source_key: "synthetic-source",
    country_code: "CO",
    city_key: "barranquilla",
    capability: "detail",
    listing_roles: ["for_rent"],
  },
  recheck_after: "2026-10-01T00:00:00.000Z",
  adapter: {
    key: "synthetic-detail",
    artifact_hash: "c".repeat(64),
    parser_version: "parser-v1",
    normalizer_version: "normalizer-v1",
    extraction_contract_hash: "d".repeat(64),
    supported_contract_version: "v2",
  },
  access_policy: {
    hosts: ["fixtures.example"],
    path_prefixes: ["/listings/"],
    request_methods: ["GET"],
    media_types: ["application/json"],
    query: { kind: "forbid" },
    redirects: { https_only: true, max_hops: 0, host_rule: "same_host" },
    transport: {
      public_addresses_only: true,
      tls_hostname_verification: true,
      connection_timeout_ms: 1000,
      response_timeout_ms: 1000,
    },
    headers: { profile_key: null },
    credentials_permitted: false,
    cookies_permitted: false,
  },
  permitted_operations: ["read_detail"],
  strategy: "structured_json",
  budget: {
    max_requests: 1,
    max_bytes: 1024,
    max_duration_ms: 1000,
    max_redirects: 0,
    max_concurrency: 1,
    max_source_requests: 1,
  },
  circuit_breaker: { stop_on: ["parser_drift"], max_consecutive_failures: 1 },
  fixture_hashes: [fixtureHash],
  redaction: { policy_key: "redaction-v2", policy_hash: "f".repeat(64) },
  retention: {
    policy_key: "fixtures-v2",
    policy_hash: "0".repeat(64),
    permitted_uses: ["parser_replay"],
    body_representation: "redacted_fixture",
    retain_images: false,
  },
};

const command = {
  mode: "fixture",
  fixture_id: "synthetic-listing-1",
  fixture_hash: fixtureHash,
  lookup: {
    contract_version: "v2",
    accepted_contract_version: "v2",
    source_key: "synthetic-source",
    country_code: "CO",
    city_key: "barranquilla",
    capability: "detail",
    listing_role: "for_rent",
    effective_at: now,
    recorded_as_of: now,
  },
};

const runtimeDependencies = () => {
  const allocate = vi.fn(async () => "capture-event-1");
  const methodologyResolver: RuntimeMethodologyResolver = {
    resolve: async () => ({
      kind: "resolved",
      manifest,
      manifest_hash: methodologyManifestDigestV2(manifest),
    }),
  };
  const dependencies: FixtureRuntimeDependencies = {
    methodologyResolver,
    artifactVerifier: { verify: async () => ({ ok: true as const }) },
    captureEventAllocator: { allocate },
    clock: { nowInstant: () => now },
  };
  return {
    allocate,
    dependencies,
  };
};

describe("fixture runtime preflight", () => {
  it("resolves trusted V2 methodology and allocates an opaque capture event after verification", async () => {
    const { dependencies, allocate } = runtimeDependencies();

    await expect(
      preflightFixtureRun(command, dependencies),
    ).resolves.toMatchObject({
      ok: true,
      run: {
        command,
        capture: {
          source_key: "synthetic-source",
          capture_event_id: "capture-event-1",
        },
        methodology: { manifest_hash: methodologyManifestDigestV2(manifest) },
      },
    });
    expect(allocate).toHaveBeenCalledWith({ source_key: "synthetic-source" });
  });

  it("fails closed before allocation for injected bindings, expired policy, and a resolver failure", async () => {
    const { dependencies, allocate } = runtimeDependencies();
    await expect(
      preflightFixtureRun(
        { ...command, candidate_id: "candidate-1" },
        dependencies,
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: "invalid_command" } });

    dependencies.methodologyResolver.resolve = async () => ({
      kind: "resolved",
      manifest: { ...manifest, recheck_after: now },
      manifest_hash: methodologyManifestDigestV2({
        ...manifest,
        recheck_after: now,
      }),
    });
    await expect(
      preflightFixtureRun(command, dependencies),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "methodology_expired" },
    });

    dependencies.methodologyResolver.resolve = async () => ({
      kind: "not_approved",
    });
    await expect(
      preflightFixtureRun(command, dependencies),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "methodology_not_approved" },
    });
    expect(allocate).not.toHaveBeenCalled();
  });

  it("rejects an out-of-scope methodology or unavailable pinned artifact before allocation", async () => {
    const { dependencies, allocate } = runtimeDependencies();
    dependencies.methodologyResolver.resolve = async () => ({
      kind: "resolved",
      manifest: {
        ...manifest,
        scope: { ...manifest.scope, city_key: "cartagena" },
      },
      manifest_hash: methodologyManifestDigestV2({
        ...manifest,
        scope: { ...manifest.scope, city_key: "cartagena" },
      }),
    });
    await expect(
      preflightFixtureRun(command, dependencies),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "methodology_scope_mismatch" },
    });

    dependencies.methodologyResolver.resolve = async () => ({
      kind: "resolved",
      manifest,
      manifest_hash: methodologyManifestDigestV2(manifest),
    });
    dependencies.artifactVerifier.verify = async () => ({
      ok: false,
      code: "missing_artifact",
    });
    await expect(
      preflightFixtureRun(command, dependencies),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "artifact_verification_failed" },
    });
    expect(allocate).not.toHaveBeenCalled();
  });
});
