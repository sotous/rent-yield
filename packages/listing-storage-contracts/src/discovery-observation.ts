import { z } from "zod";
import {
  identifierSchema,
  instantSchema,
  listingRoleSchema,
  safeNonNegativeIntegerSchema,
  sha256Schema,
} from "./primitives.js";

const canonicalHttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === ""
    );
  }, "Candidate URL must be credential-free HTTPS without query or fragment");

/**
 * Caller-controlled input for the single detail canary. Scope and provenance
 * are intentionally absent: they are derived from the persisted observation.
 */
export const detailCandidateSelectionV1Schema = z.strictObject({
  contract_version: z.literal("v1"),
  discovery_observation_id: identifierSchema,
  candidate_url: canonicalHttpsUrlSchema,
});

export const discoveryObservationLookupSchema = z.strictObject({
  observation_id: identifierSchema,
});

export const discoveryProfileProvenanceV1Schema = z.strictObject({
  source_key: identifierSchema,
  profile_version: z.number().int().positive().safe(),
  profile_sha256: sha256Schema,
});

/** Versioned Storage configuration identity for the generic extractor. */
export const discoveryExtractionRuleV1Schema = z.strictObject({
  kind: z.literal("html_anchor_href"),
  version: identifierSchema,
  config_sha256: sha256Schema,
  artifact_sha256: sha256Schema,
});

export const discoveryObservationV1Schema = z
  .strictObject({
    contract_version: z.literal("v1"),
    observation_id: identifierSchema,
    capture_event_id: identifierSchema,
    source_key: identifierSchema,
    collected_at: instantSchema,
    scope: z.strictObject({
      country_code: z.literal("CO"),
      city_key: identifierSchema,
      capability: z.literal("discovery"),
      listing_roles: z.array(listingRoleSchema).min(1).max(2),
    }),
    discovery_profile_provenance: discoveryProfileProvenanceV1Schema,
    extractor: discoveryExtractionRuleV1Schema,
    response: z.strictObject({
      canonical_url: canonicalHttpsUrlSchema,
      media_type: z.enum(["application/json", "text/html", "text/plain"]),
      body_sha256: sha256Schema,
      body_byte_length: safeNonNegativeIntegerSchema,
    }),
    outcome: z.enum(["candidates_found", "no_candidates"]),
    candidate_count: safeNonNegativeIntegerSchema,
    candidate_urls: z.array(canonicalHttpsUrlSchema),
  })
  .superRefine((value, context) => {
    if (value.discovery_profile_provenance.source_key !== value.source_key)
      context.addIssue({
        code: "custom",
        path: ["discovery_profile_provenance", "source_key"],
        message:
          "Discovery profile provenance source must match observation source",
      });
    if (value.scope.capability !== "discovery")
      context.addIssue({
        code: "custom",
        path: ["scope", "capability"],
        message: "Discovery observation scope must be discovery",
      });
    if (value.candidate_count !== value.candidate_urls.length)
      context.addIssue({
        code: "custom",
        path: ["candidate_count"],
        message: "Candidate count must equal the retained candidate URL count",
      });
    if (
      (value.outcome === "no_candidates") !==
      (value.candidate_urls.length === 0)
    )
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message:
          "Discovery outcome must match whether candidate URLs were retained",
      });
    for (let index = 1; index < value.candidate_urls.length; index += 1) {
      const current = value.candidate_urls[index]!;
      const previous = value.candidate_urls[index - 1]!;
      if (current <= previous) {
        context.addIssue({
          code: "custom",
          path: ["candidate_urls", index],
          message:
            current === previous
              ? "Candidate URLs must be unique"
              : "Candidate URLs must be sorted deterministically",
        });
      }
    }
  });

export type DiscoveryObservationV1 = z.infer<
  typeof discoveryObservationV1Schema
>;
export type DiscoveryObservationAppendResult = {
  appended: boolean;
  observation: DiscoveryObservationV1;
};

export type DetailCandidateSelectionV1 = z.infer<
  typeof detailCandidateSelectionV1Schema
>;
export type DiscoveryObservationLookup = z.infer<
  typeof discoveryObservationLookupSchema
>;

/** Safe, derived detail-canary input; it contains no caller-supplied scope. */
export type ResolvedDetailCandidateSelectionV1 = {
  selection: DetailCandidateSelectionV1;
  source_key: DiscoveryObservationV1["source_key"];
  scope: DiscoveryObservationV1["scope"];
  discovery_profile_provenance: DiscoveryObservationV1["discovery_profile_provenance"];
};

/**
 * Binds a detail request to an exact retained discovery candidate. The canary
 * is Colombia/Barranquilla/for-rent only; later orchestration applies profile
 * and transport rules after this local boundary succeeds.
 */
export function resolveDetailCandidateSelection(
  observationInput: DiscoveryObservationV1,
  selectionInput: DetailCandidateSelectionV1,
): ResolvedDetailCandidateSelectionV1 {
  const observation = discoveryObservationV1Schema.parse(observationInput);
  const selection = detailCandidateSelectionV1Schema.parse(selectionInput);

  if (selection.discovery_observation_id !== observation.observation_id)
    throw new Error("Detail selection observation identity does not match");
  if (
    observation.scope.country_code !== "CO" ||
    observation.scope.city_key !== "barranquilla" ||
    !observation.scope.listing_roles.includes("for_rent")
  )
    throw new Error("Discovery observation is outside the detail canary scope");
  if (!observation.candidate_urls.includes(selection.candidate_url))
    throw new Error("Detail selection candidate URL was not retained");

  return {
    selection,
    source_key: observation.source_key,
    scope: observation.scope,
    discovery_profile_provenance: observation.discovery_profile_provenance,
  };
}

/** Append-only boundary for sanitized discovery observations. */
export interface DiscoveryObservationRepository {
  append(
    input: DiscoveryObservationV1,
  ): Promise<DiscoveryObservationAppendResult>;
  findById(
    input: DiscoveryObservationLookup,
  ): Promise<DiscoveryObservationV1 | null>;
}
