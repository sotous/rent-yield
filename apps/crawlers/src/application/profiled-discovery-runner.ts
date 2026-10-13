import { z } from "zod";
import type {
  ActiveDiscoveryProfileV1,
  DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import { deriveDiscoveryExtractionProvenance } from "@rent-yield/discovery-profile-storage";
import {
  MemorySourceBudget,
  probeListingDiscovery,
  type ProbeDependencies,
} from "./bounded-probe.js";

const commandSchema = z.strictObject({
  contract_version: z.literal("v1"),
  probe_id: z.string().min(1).max(256),
  source_key: z.string().min(1).max(256),
  as_of: z.string().datetime({ offset: true }),
});

type ProfiledDiscoveryDependencies = Omit<
  ProbeDependencies,
  | "access"
  | "discoveryExtraction"
  | "discoveryExtractionProvenance"
  | "discoveryProfileProvenance"
> & {
  profiles: DiscoveryProfileRepository;
};

function configuredUrlsFor(
  profile: ActiveDiscoveryProfileV1,
): { ok: true; robots_url: string; discovery_url: string } | { ok: false } {
  if (
    profile.allowed_hosts.length !== 1 ||
    !profile.allowed_path_prefixes.includes(profile.robots_path)
  )
    return { ok: false };
  return {
    ok: true,
    robots_url: `https://${profile.allowed_hosts[0]!}${profile.robots_path}`,
    discovery_url: `https://${profile.allowed_hosts[0]!}${profile.discovery_path}`,
  };
}

/**
 * Generic discovery entry point. Scope, host, path, and budget data are read
 * from Storage's active profile rather than accepted from the caller.
 */
export async function runProfiledListingDiscovery(
  input: unknown,
  dependencies: ProfiledDiscoveryDependencies,
) {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: {
        code: "invalid_input" as const,
        issues: parsed.error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.map((part) =>
            typeof part === "number" ? part : String(part),
          ),
        })),
      },
    };
  }
  const command = parsed.data;
  const profile = await dependencies.profiles.findActiveBySourceKey({
    source_key: command.source_key,
  });
  if (!profile)
    return {
      ok: false as const,
      error: { code: "profile_unavailable" as const },
    };
  const urls = configuredUrlsFor(profile);
  if (!urls.ok || profile.discovery_path === profile.robots_path)
    return {
      ok: false as const,
      error: { code: "profile_unavailable" as const },
    };

  return probeListingDiscovery(
    {
      contract_version: command.contract_version,
      probe_id: command.probe_id,
      scope: { ...profile.scope, source_key: profile.source_key },
      start_url: urls.discovery_url,
      robots_url: urls.robots_url,
      allowed_hosts: profile.allowed_hosts,
      allowed_path_prefixes: profile.allowed_path_prefixes,
      budget: profile.budget,
      permitted_media_types: profile.permitted_media_types,
      as_of: command.as_of,
    },
    {
      transport: dependencies.transport,
      clock: dependencies.clock,
      sourceBudget: dependencies.sourceBudget,
      discoveryProfileProvenance: profile.discovery_profile_provenance,
      discoveryExtraction: profile.extraction,
      discoveryExtractionProvenance: (() => {
        const provenance = deriveDiscoveryExtractionProvenance(profile);
        return provenance
          ? {
              kind: provenance.kind,
              version: provenance.version,
              config_sha256: provenance.config_sha256,
              artifact_sha256: provenance.extractor_artifact_sha256,
            }
          : null;
      })(),
      ...(dependencies.discoveryResponseProcessor
        ? {
            discoveryResponseProcessor: dependencies.discoveryResponseProcessor,
          }
        : {}),
      ...(dependencies.captureHandoff
        ? { captureHandoff: dependencies.captureHandoff }
        : {}),
    },
  );
}

export { MemorySourceBudget };
