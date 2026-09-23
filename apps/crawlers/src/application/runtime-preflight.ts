import {
  methodologyLookupV2Schema,
  methodologyManifestDigestV2,
  methodologyManifestV2Schema,
  sha256Schema,
  type MethodologyLookupV2,
  type MethodologyManifestV2,
} from "@rent-yield/listing-storage-contracts";
import { z } from "zod";

const fixtureRunCommandSchema = z.strictObject({
  mode: z.literal("fixture"),
  fixture_id: z.string().min(1).max(256),
  fixture_hash: sha256Schema,
  lookup: methodologyLookupV2Schema,
});

export type FixtureRunCommand = z.infer<typeof fixtureRunCommandSchema>;

export type ResolvedMethodology = {
  kind: "resolved";
  manifest: MethodologyManifestV2;
  manifest_hash: string;
};

export type MethodologyResolution =
  | ResolvedMethodology
  | { kind: "not_found" }
  | { kind: "not_approved" }
  | { kind: "ambiguous" };

/** Trusted boundary: callers provide lookup scope only, never methodology state. */
export interface RuntimeMethodologyResolver {
  resolve(lookup: MethodologyLookupV2): Promise<MethodologyResolution>;
}

/** Confirms that the artifacts named by trusted methodology are available and pinned. */
export interface RuntimeArtifactVerifier {
  verify(input: {
    manifest_hash: string;
    manifest: MethodologyManifestV2;
    fixture_hash: string;
  }): Promise<{ ok: true } | { ok: false; code: string }>;
}

/** Allocates the source-scoped opaque identity before any acquisition begins. */
export interface CaptureEventAllocator {
  allocate(input: { source_key: string }): Promise<string>;
}

export interface RuntimeClock {
  nowInstant(): string;
}

export type FixtureRuntimeDependencies = {
  methodologyResolver: RuntimeMethodologyResolver;
  artifactVerifier: RuntimeArtifactVerifier;
  captureEventAllocator: CaptureEventAllocator;
  clock: RuntimeClock;
};

export type FixturePreflightError =
  | { code: "invalid_command" }
  | { code: "methodology_not_found" }
  | { code: "methodology_not_approved" }
  | { code: "methodology_resolution_unavailable" }
  | { code: "methodology_ambiguous" }
  | { code: "methodology_integrity_mismatch" }
  | { code: "methodology_scope_mismatch" }
  | { code: "methodology_expired" }
  | { code: "fixture_not_approved" }
  | { code: "artifact_verification_failed" }
  | { code: "artifact_verification_unavailable" }
  | { code: "capture_event_allocation_failed" };

export type FixturePreflightResult =
  | {
      ok: true;
      run: {
        mode: "fixture";
        command: FixtureRunCommand;
        methodology: ResolvedMethodology;
        capture: {
          source_key: string;
          capture_event_id: string;
          allocated_at: string;
        };
      };
    }
  | { ok: false; error: FixturePreflightError };

const sameScope = (
  manifest: MethodologyManifestV2,
  lookup: MethodologyLookupV2,
): boolean =>
  manifest.scope.source_key === lookup.source_key &&
  manifest.scope.country_code === lookup.country_code &&
  manifest.scope.city_key === lookup.city_key &&
  manifest.scope.capability === lookup.capability &&
  manifest.scope.listing_roles.includes(lookup.listing_role);

const resolverFailure = (
  resolution: Exclude<MethodologyResolution, ResolvedMethodology>,
): FixturePreflightResult => {
  switch (resolution.kind) {
    case "not_found":
      return { ok: false, error: { code: "methodology_not_found" } };
    case "not_approved":
      return { ok: false, error: { code: "methodology_not_approved" } };
    case "ambiguous":
      return { ok: false, error: { code: "methodology_ambiguous" } };
  }
};

/**
 * Checks trusted V2 runtime policy before fixture access. This function has no
 * transport argument by design, which keeps fixture development unable to
 * contact a source.
 */
export async function preflightFixtureRun(
  input: unknown,
  dependencies: FixtureRuntimeDependencies,
): Promise<FixturePreflightResult> {
  const parsed = fixtureRunCommandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: { code: "invalid_command" } };
  const command = parsed.data;
  let resolution: MethodologyResolution;
  try {
    resolution = await dependencies.methodologyResolver.resolve(command.lookup);
  } catch {
    return {
      ok: false,
      error: { code: "methodology_resolution_unavailable" },
    };
  }
  if (resolution.kind !== "resolved") return resolverFailure(resolution);

  if (!methodologyManifestV2Schema.safeParse(resolution.manifest).success)
    return { ok: false, error: { code: "methodology_integrity_mismatch" } };
  if (
    methodologyManifestDigestV2(resolution.manifest) !==
    resolution.manifest_hash
  )
    return { ok: false, error: { code: "methodology_integrity_mismatch" } };
  if (!sameScope(resolution.manifest, command.lookup))
    return { ok: false, error: { code: "methodology_scope_mismatch" } };
  if (command.lookup.effective_at >= resolution.manifest.recheck_after)
    return { ok: false, error: { code: "methodology_expired" } };
  if (!resolution.manifest.fixture_hashes.includes(command.fixture_hash))
    return { ok: false, error: { code: "fixture_not_approved" } };

  let artifacts: Awaited<ReturnType<RuntimeArtifactVerifier["verify"]>>;
  try {
    artifacts = await dependencies.artifactVerifier.verify({
      manifest_hash: resolution.manifest_hash,
      manifest: resolution.manifest,
      fixture_hash: command.fixture_hash,
    });
  } catch {
    return { ok: false, error: { code: "artifact_verification_unavailable" } };
  }
  if (!artifacts.ok)
    return { ok: false, error: { code: "artifact_verification_failed" } };

  try {
    const capture_event_id = await dependencies.captureEventAllocator.allocate({
      source_key: command.lookup.source_key,
    });
    if (capture_event_id.length === 0)
      return { ok: false, error: { code: "capture_event_allocation_failed" } };
    return {
      ok: true,
      run: {
        mode: "fixture",
        command,
        methodology: resolution,
        capture: {
          source_key: command.lookup.source_key,
          capture_event_id,
          allocated_at: dependencies.clock.nowInstant(),
        },
      },
    };
  } catch {
    return { ok: false, error: { code: "capture_event_allocation_failed" } };
  }
}
