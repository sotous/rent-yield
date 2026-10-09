import { createHash } from "node:crypto";
import { z } from "zod";

const sourceKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/);
const positiveSafeIntegerSchema = z.number().int().positive().safe();
const hostnameSchema = z
  .string()
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/,
    "Expected a lowercase bare hostname",
  );
const pathPrefixSchema = z
  .string()
  .startsWith("/")
  .refine(
    (value) =>
      !value.startsWith("//") &&
      !/[?#]/.test(value) &&
      !value.split("/").includes(".."),
    "Expected an absolute path prefix without authority, traversal, query, or fragment",
  );
const budgetSchema = z
  .strictObject({
    max_requests: positiveSafeIntegerSchema,
    max_bytes: positiveSafeIntegerSchema,
    max_duration_ms: positiveSafeIntegerSchema,
    max_redirects: z.number().int().nonnegative().safe(),
    max_concurrency: positiveSafeIntegerSchema,
    max_source_requests: positiveSafeIntegerSchema,
  })
  .refine(
    (budget) => budget.max_source_requests <= budget.max_requests,
    "Source request budget cannot exceed the total request budget",
  );

export const discoveryProfileV1Schema = z.strictObject({
  source_key: sourceKeySchema,
  profile_version: positiveSafeIntegerSchema,
  state: z.enum(["active", "inactive"]),
  scope: z.strictObject({
    country_code: z.literal("CO"),
    city_key: sourceKeySchema,
    capability: z.literal("discovery"),
    listing_roles: z
      .array(z.enum(["for_rent", "for_sale"]))
      .min(1)
      .max(2)
      .refine(
        (roles) => new Set(roles).size === roles.length,
        "Listing roles must be unique",
      ),
  }),
  allowed_hosts: z
    .array(hostnameSchema)
    .min(1)
    .refine(
      (hosts) => new Set(hosts).size === hosts.length,
      "Allowed hosts must be unique",
    ),
  allowed_path_prefixes: z
    .array(pathPrefixSchema)
    .min(1)
    .refine(
      (paths) => new Set(paths).size === paths.length,
      "Allowed path prefixes must be unique",
    ),
  budget: budgetSchema,
  permitted_media_types: z
    .array(z.enum(["application/json", "text/html", "text/plain"]))
    .min(1)
    .refine(
      (mediaTypes) => new Set(mediaTypes).size === mediaTypes.length,
      "Media types must be unique",
    ),
});

export const discoveryProfileRegistryV1Schema = z
  .strictObject({
    contract_version: z.literal("v1"),
    profiles: z.array(discoveryProfileV1Schema),
  })
  .superRefine((registry, context) => {
    const seenVersions = new Set<string>();
    const activeSources = new Set<string>();

    for (const [index, profile] of registry.profiles.entries()) {
      const versionKey = `${profile.source_key}:${profile.profile_version}`;
      if (seenVersions.has(versionKey)) {
        context.addIssue({
          code: "custom",
          message: "Discovery profile versions must be unique per source",
          path: ["profiles", index, "profile_version"],
        });
      }
      seenVersions.add(versionKey);

      if (profile.state === "active") {
        if (activeSources.has(profile.source_key)) {
          context.addIssue({
            code: "custom",
            message:
              "Discovery profile registry has multiple active profiles for one source",
            path: ["profiles", index, "state"],
          });
        }
        activeSources.add(profile.source_key);
      }
    }
  });

export const discoveryProfileLookupSchema = z.strictObject({
  source_key: sourceKeySchema,
});

const profileSha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const discoveryProfileProvenanceSchema = z.strictObject({
  source_key: sourceKeySchema,
  profile_version: positiveSafeIntegerSchema,
  profile_sha256: profileSha256Schema,
});
export type DiscoveryProfileV1 = z.infer<typeof discoveryProfileV1Schema>;
export type DiscoveryProfileRegistryV1 = z.infer<
  typeof discoveryProfileRegistryV1Schema
>;
export type DiscoveryProfileLookup = z.infer<
  typeof discoveryProfileLookupSchema
>;
export type DiscoveryProfileProvenance = z.infer<
  typeof discoveryProfileProvenanceSchema
>;
export type ActiveDiscoveryProfileV1 = DiscoveryProfileV1 & {
  discovery_profile_provenance: DiscoveryProfileProvenance;
};

/**
 * Canonical V1 representation used only to bind an active operational profile
 * to the bounded facts Storage validated. Its field order is deliberate.
 */
function canonicalDiscoveryProfileV1(profile: DiscoveryProfileV1): string {
  return JSON.stringify({
    contract_version: "v1",
    source_key: profile.source_key,
    profile_version: profile.profile_version,
    state: profile.state,
    scope: {
      country_code: profile.scope.country_code,
      city_key: profile.scope.city_key,
      capability: profile.scope.capability,
      listing_roles: profile.scope.listing_roles,
    },
    allowed_hosts: profile.allowed_hosts,
    allowed_path_prefixes: profile.allowed_path_prefixes,
    budget: {
      max_requests: profile.budget.max_requests,
      max_bytes: profile.budget.max_bytes,
      max_duration_ms: profile.budget.max_duration_ms,
      max_redirects: profile.budget.max_redirects,
      max_concurrency: profile.budget.max_concurrency,
      max_source_requests: profile.budget.max_source_requests,
    },
    permitted_media_types: profile.permitted_media_types,
  });
}

/**
 * Deterministic configuration lineage for fixture capture, not access approval.
 */
export function deriveDiscoveryProfileProvenance(
  input: DiscoveryProfileV1,
): DiscoveryProfileProvenance {
  const profile = discoveryProfileV1Schema.parse(input);
  return {
    source_key: profile.source_key,
    profile_version: profile.profile_version,
    profile_sha256: createHash("sha256")
      .update(canonicalDiscoveryProfileV1(profile), "utf8")
      .digest("hex"),
  };
}

/** Read-only Storage boundary for bounded discovery profile lookup. */
export interface DiscoveryProfileRepository {
  findActiveBySourceKey(
    input: DiscoveryProfileLookup,
  ): Promise<ActiveDiscoveryProfileV1 | null>;
}
