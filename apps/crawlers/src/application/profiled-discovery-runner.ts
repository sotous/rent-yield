import { z } from "zod";
import type {
  ActiveDiscoveryProfileV2,
  DiscoveryProfileRepository,
} from "@rent-yield/discovery-profile-storage";
import {
  MemorySourceBudget,
  probeListingDiscovery,
  type ProbeDependencies,
} from "./bounded-probe.js";
import type { DiscoveryExtractionRuleV1 } from "./discovery-response-extractor.js";

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

function startUrlFor(
  profile: ActiveDiscoveryProfileV2,
): { ok: true; value: string } | { ok: false } {
  if (
    profile.allowed_hosts.length !== 1 ||
    profile.allowed_path_prefixes.length !== 1
  )
    return { ok: false };
  return {
    ok: true,
    value: `https://${profile.allowed_hosts[0]!}${profile.allowed_path_prefixes[0]!}`,
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
  const startUrl = startUrlFor(profile);
  if (!startUrl.ok)
    return {
      ok: false as const,
      error: { code: "profile_unavailable" as const },
    };

  const extraction = profile.candidate_url_extraction;
  const discoveryExtraction: DiscoveryExtractionRuleV1 =
    extraction.state === "reviewed"
      ? {
          state: "reviewed",
          kind: extraction.kind,
          extractor_version: extraction.extractor_id,
          candidate_hosts: extraction.allowed_hosts,
          candidate_path_prefixes: extraction.allowed_path_prefixes,
          allow_no_candidates: true,
        }
      : { state: "unreviewed" };
  const extractionProvenance =
    extraction.state === "reviewed"
      ? {
          kind: extraction.kind,
          version: extraction.extractor_id,
          config_sha256: profile.discovery_profile_provenance.profile_sha256,
          artifact_sha256: extraction.extractor_artifact_sha256,
        }
      : null;

  return probeListingDiscovery(
    {
      contract_version: command.contract_version,
      probe_id: command.probe_id,
      scope: { ...profile.scope, source_key: profile.source_key },
      start_url: startUrl.value,
      allowed_hosts: profile.allowed_hosts,
      allowed_path_prefixes: profile.allowed_path_prefixes,
      budget: profile.budget,
      as_of: command.as_of,
    },
    {
      transport: dependencies.transport,
      clock: dependencies.clock,
      sourceBudget: dependencies.sourceBudget,
      discoveryProfileProvenance: profile.discovery_profile_provenance,
      discoveryExtraction,
      discoveryExtractionProvenance: extractionProvenance,
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
