import { createHash } from "node:crypto";
import { z } from "zod";
import {
  canonicalJson,
  canonicalSet,
  decimalSchema,
  extractionContractSchema,
  extractedObservationSchema,
  rentalEvidenceSchema,
  sourceDateSchema,
  stableListingUrlSchema,
  type ExtractionContract,
  type ExtractionMapping,
  type ExtractionIssue,
  scoreListingQuality,
  stableSourceListingIdSchema,
  type ExtractionOutcome,
  type ExtractedObservation,
  type ExtractedFieldProvenance,
  positiveDecimalSchema,
} from "@rent-yield/listing-storage-contracts";
import {
  validateFixtureArtifact,
  type FixtureArtifact,
} from "./fixture-capture.js";

export const fixtureParserVersion = "parser-v1";
export const fixtureNormalizerVersion = "normalizer-v1";
const transformVersion = "transforms-v1";
type Field = ExtractionMapping["field"];
const vocabulary: Array<
  [Field, string, ExtractionMapping["transforms"][number]]
> = [
  ["source_listing_id", "id", "trim"],
  ["listing_url", "url", "trim"],
  ["alias", "alias", "trim"],
  ["listing_role", "operation", "map_listing_role"],
  ["asking_amount", "price", "parse_decimal"],
  ["currency", "currency", "parse_currency"],
  ["frequency", "frequency", "parse_frequency"],
  ["fee_scope", "feeScope", "trim"],
  ["administration_amount", "administrationFee", "parse_decimal"],
  ["utilities_amount", "utilitiesFee", "parse_decimal"],
  ["parking_amount", "parkingFee", "parse_decimal"],
  ["built_area_sqm", "builtArea", "parse_decimal"],
  ["private_area_sqm", "privateArea", "parse_decimal"],
  ["interior_area_sqm", "interiorArea", "parse_decimal"],
  ["area_value", "areaValue", "parse_decimal"],
  ["area_kind", "areaKind", "map_area_kind"],
  ["city", "city", "trim"],
  ["area", "neighborhood", "trim"],
  ["property_type", "propertyType", "trim"],
  ["title", "title", "collapse_whitespace"],
  ["rental_basis", "rentalBasis", "trim"],
  ["listing_status", "status", "trim"],
  ["bedrooms", "bedrooms", "parse_decimal"],
  ["bathrooms", "bathrooms", "parse_decimal"],
  ["social_stratum", "socialStratum", "parse_decimal"],
  ["latitude", "latitude", "parse_decimal"],
  ["longitude", "longitude", "parse_decimal"],
  ["source_published_at", "publishedAt", "parse_source_date"],
  ["source_updated_at", "updatedAt", "parse_source_date"],
];
const offerFields = new Set<Field>([
  "listing_role",
  "asking_amount",
  "currency",
  "frequency",
  "fee_scope",
  "administration_amount",
  "utilities_amount",
  "parking_amount",
]);
const supportedFields = new Set(vocabulary.map(([field]) => field));
const sha256 = (value: unknown) =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const scalar = (value: unknown): value is string | number | boolean | null =>
  value === null || ["string", "number", "boolean"].includes(typeof value);
const failure = (code: ExtractionIssue["code"]): ExtractionOutcome => ({
  contract_version: "v1",
  trace: null,
  kind: "parse_failed",
  observations: [],
  rental_evidence: [],
  issues: [{ code, severity: "error" }],
});

/** A fixture-vocabulary proposal, never permission or a live methodology. */
export function inferExtractionContract(input: {
  artifact: FixtureArtifact;
  scope: unknown;
  created_at: string;
  extraction_contract_id: string;
}):
  | { ok: true; contract: ExtractionContract }
  | { ok: false; error: { code: ExtractionIssue["code"] } } {
  if (!validateFixtureArtifact(input.artifact).ok)
    return { ok: false, error: { code: "invalid_fixture" } };
  const candidate = extractionContractSchema.safeParse({
    contract_version: "v1",
    extraction_contract_id: input.extraction_contract_id,
    scope: input.scope,
    fixture_sha256s: [input.artifact.envelope.envelope_sha256],
    created_at: input.created_at,
    mappings: vocabulary.map(([field, key, transform]) => ({
      field,
      locator: { kind: "json_pointer", pointer: `/${key}` },
      transforms: [transform],
      required: field === "listing_role" || field === "asking_amount",
    })),
    claim_status: "hypothesis",
    confidence: "low",
    evidence: [],
    unknowns: [
      "Mappings are limited to the offline JSON fixture vocabulary; no source permission is inferred.",
    ],
    issues: [],
  });
  if (!candidate.success)
    return { ok: false, error: { code: "invalid_contract" } };
  return { ok: true, contract: candidate.data };
}

function decimal(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim())
  )
    return null;
  let text = value.trim();
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  if (text === "-0") text = "0";
  return decimalSchema.safeParse(text).success ? text : null;
}
function compareDecimals(left: string, right: string): number {
  const [leftWhole, leftFraction = ""] = left.split(".");
  const [rightWhole, rightFraction = ""] = right.split(".");
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftInt = BigInt(`${leftWhole}${leftFraction.padEnd(scale, "0")}`);
  const rightInt = BigInt(`${rightWhole}${rightFraction.padEnd(scale, "0")}`);
  return leftInt < rightInt ? -1 : leftInt > rightInt ? 1 : 0;
}
function sourceDate(value: unknown): z.infer<typeof sourceDateSchema> {
  const raw_text = typeof value === "string" ? value : "";
  for (const precision of ["instant", "day", "month", "year"] as const) {
    const parsed = sourceDateSchema.safeParse({
      raw_text,
      precision,
      value: raw_text,
    });
    if (parsed.success) return parsed.data;
  }
  return { raw_text, precision: "unknown" };
}
function transform(
  value: unknown,
  method: ExtractionMapping["transforms"][number],
): unknown {
  if (method === "identity") return value;
  if (method === "parse_decimal") return decimal(value);
  if (method === "parse_source_date") return sourceDate(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  switch (method) {
    case "trim":
      return text;
    case "collapse_whitespace":
      return text.replace(/\s+/g, " ");
    case "parse_currency":
      return ["COP", "USD"].includes(text.toUpperCase())
        ? text.toUpperCase()
        : "unknown";
    case "parse_frequency":
      return (
        (
          {
            monthly: "monthly",
            mensual: "monthly",
            one_time: "one_time",
            daily: "daily",
            weekly: "weekly",
          } as Record<string, string>
        )[text.toLowerCase()] ?? "unknown"
      );
    case "map_listing_role":
      return (
        (
          {
            rent: "for_rent",
            for_rent: "for_rent",
            arriendo: "for_rent",
            sale: "for_sale",
            for_sale: "for_sale",
            venta: "for_sale",
          } as Record<string, string>
        )[text.toLowerCase()] ?? null
      );
    case "map_area_kind":
      return ["built", "private", "interior"].includes(text) ? text : "unknown";
  }
}
function readPointer(
  record: Record<string, unknown>,
  pointer: string,
): unknown {
  let value: unknown = record;
  for (const token of pointer.slice(1).split("/")) {
    const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
    if ((!object(value) && !Array.isArray(value)) || !Object.hasOwn(value, key))
      return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}
function useOffer(
  mapping: ExtractionMapping,
  offer?: Record<string, unknown>,
): boolean {
  if (!offer || mapping.locator.kind !== "json_pointer") return false;
  if (offerFields.has(mapping.field)) return true;
  return (
    ["listing_status", "rental_basis"].includes(mapping.field) &&
    readPointer(offer, mapping.locator.pointer) !== undefined
  );
}
function normalize(
  record: Record<string, unknown>,
  basePath: string,
  contract: ExtractionContract,
  artifact: FixtureArtifact,
  offer?: Record<string, unknown>,
  offerPath?: string,
): ExtractedObservation {
  const fields: Partial<Record<Field, unknown>> = {};
  const issues: ExtractionIssue[] = [];
  const provenance: ExtractedFieldProvenance[] = [];
  const issue = (
    code: ExtractionIssue["code"],
    field: Field,
    severity: "warning" | "error" = "error",
  ) => {
    if (!issues.some((entry) => entry.code === code && entry.field === field))
      issues.push({ code, field, severity });
  };
  for (const mapping of contract.mappings) {
    if (mapping.locator.kind !== "json_pointer") continue;
    const fromOffer = useOffer(mapping, offer);
    const raw = readPointer(
      fromOffer ? offer! : record,
      mapping.locator.pointer,
    );
    let value: unknown = raw;
    if (raw === undefined || raw === null) {
      value = null;
      if (mapping.required) issue("missing_required_field", mapping.field);
    } else {
      for (const method of mapping.transforms) value = transform(value, method);
      if (value === null || !scalar(raw)) issue("invalid_field", mapping.field);
    }
    fields[mapping.field] = value;
    provenance.push({
      field: mapping.field,
      raw_path: `${fromOffer ? offerPath : basePath}${mapping.locator.pointer}`,
      raw_value: scalar(raw) ? raw : null,
      transforms: mapping.transforms,
      transform_version: transformVersion,
      quality_issue_codes: [],
    });
  }
  const text = (field: Field): string | null =>
    typeof fields[field] === "string" && (fields[field] as string).length > 0
      ? (fields[field] as string)
      : null;
  const enumValue = <T extends string>(
    field: Field,
    values: readonly T[],
    fallback: T,
  ): T =>
    values.includes(fields[field] as T) ? (fields[field] as T) : fallback;
  const number = (field: Field) =>
    decimalSchema.safeParse(fields[field]).success
      ? (fields[field] as string)
      : null;
  let listing_url = stableListingUrlSchema.safeParse(fields.listing_url).success
    ? (fields.listing_url as string)
    : null;
  if (listing_url) {
    const url = new URL(listing_url);
    const origin = artifact.envelope.origin;
    const hostMatches =
      origin.kind === "permitted_source"
        ? url.host === new URL(origin.source_url).host
        : ["example.com", "example.net", "example.org"].includes(url.host);
    if (!hostMatches || !/^\/listings?\/[A-Za-z0-9_-]+\/?$/.test(url.pathname))
      listing_url = null;
  }
  const source_listing_id = stableSourceListingIdSchema.safeParse(
    text("source_listing_id"),
  ).success
    ? text("source_listing_id")
    : null;
  if (!listing_url)
    issue("missing_stable_listing_url", "listing_url", "warning");
  if (!listing_url && !source_listing_id)
    issue("missing_stable_identity", "source_listing_id");
  const dates = (field: Field) =>
    sourceDateSchema.safeParse(fields[field]).success
      ? (fields[field] as z.infer<typeof sourceDateSchema>)
      : sourceDate(null);
  const source_published_at = dates("source_published_at");
  const source_updated_at = dates("source_updated_at");
  if (
    source_published_at.precision === "unknown" &&
    source_updated_at.precision === "unknown"
  )
    issue("missing_source_date", "source_published_at", "warning");
  const identity_candidates: ExtractedObservation["identity_candidates"] = [];
  for (const [kind, value] of [
    ["source_listing_id", source_listing_id],
    ["listing_url", listing_url],
    ["alias", text("alias")],
  ] as const)
    if (value)
      identity_candidates.push({
        kind,
        value,
        source_key: contract.scope.source_key,
      });
  const integer = (
    field: Field,
    maximum = Number.MAX_SAFE_INTEGER,
    minimum = 0,
  ): number | null => {
    const value = number(field);
    if (value === null) return null;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
      issue("invalid_field", field);
      return null;
    }
    return parsed;
  };
  const coordinate = (
    field: "latitude" | "longitude",
    bound: string,
  ): string | null => {
    const value = number(field);
    if (
      value !== null &&
      (compareDecimals(value, bound) > 0 ||
        compareDecimals(value, `-${bound}`) < 0)
    ) {
      issue("invalid_field", field);
      return null;
    }
    return value;
  };
  const observation: ExtractedObservation = {
    source_key: contract.scope.source_key,
    country_code: "CO",
    city_key: contract.scope.city_key,
    city: text("city"),
    area: text("area"),
    alias: text("alias"),
    identity_candidates,
    source_listing_id,
    listing_url,
    listing_role:
      fields.listing_role === "for_rent" || fields.listing_role === "for_sale"
        ? fields.listing_role
        : null,
    asking_amount: number("asking_amount"),
    currency: enumValue("currency", ["COP", "USD", "unknown"], "unknown"),
    frequency: enumValue(
      "frequency",
      ["monthly", "one_time", "daily", "weekly", "unknown"],
      "unknown",
    ),
    fee_scope: enumValue(
      "fee_scope",
      ["base", "includes_admin", "bundled", "unknown"],
      "unknown",
    ),
    administration_amount: number("administration_amount"),
    utilities_amount: number("utilities_amount"),
    parking_amount: number("parking_amount"),
    built_area_sqm: number("built_area_sqm"),
    private_area_sqm: number("private_area_sqm"),
    interior_area_sqm: number("interior_area_sqm"),
    area_value: number("area_value"),
    area_kind: enumValue(
      "area_kind",
      ["built", "private", "interior", "unknown"],
      "unknown",
    ),
    property_type: [
      "apartment",
      "house",
      "studio",
      "other_residential",
    ].includes(text("property_type") ?? "")
      ? (text("property_type") as ExtractedObservation["property_type"])
      : null,
    rental_basis: enumValue(
      "rental_basis",
      ["long_term", "short_stay", "unknown"],
      "unknown",
    ),
    listing_status: enumValue(
      "listing_status",
      ["active", "inactive", "unknown"],
      "unknown",
    ),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    social_stratum: integer("social_stratum", 6, 1),
    latitude: coordinate("latitude", "90"),
    longitude: coordinate("longitude", "180"),
    title: text("title"),
    source_published_at,
    source_updated_at,
    collected_at:
      artifact.envelope.origin.kind === "permitted_source"
        ? artifact.envelope.origin.collected_at
        : null,
    field_provenance: provenance,
    quality: {
      ruleset: "listing-quality-v1",
      index: listing_url ? 100 : 90,
      blocking: issues.some((entry) => entry.severity === "error"),
      issues,
    },
  };
  if (observation.area_value !== null && observation.area_kind !== "unknown") {
    const target = `${observation.area_kind}_area_sqm` as
      "built_area_sqm" | "private_area_sqm" | "interior_area_sqm";
    if (
      observation[target] !== null &&
      observation[target] !== observation.area_value
    )
      issue("area_conflict", "area_value");
    else if (observation[target] === null)
      observation[target] = observation.area_value;
  }
  for (const field of [
    "administration_amount",
    "utilities_amount",
    "parking_amount",
  ] as const) {
    if (observation[field]?.startsWith("-")) issue("invalid_field", field);
  }
  for (const field of [
    "built_area_sqm",
    "private_area_sqm",
    "interior_area_sqm",
    "area_value",
  ] as const) {
    if (
      observation[field] !== null &&
      !positiveDecimalSchema.safeParse(observation[field]).success
    )
      issue("invalid_field", field);
  }
  if (
    observation.built_area_sqm &&
    observation.private_area_sqm &&
    compareDecimals(observation.private_area_sqm, observation.built_area_sqm) >
      0
  )
    issue("area_conflict", "private_area_sqm");
  if (
    observation.built_area_sqm &&
    observation.interior_area_sqm &&
    compareDecimals(observation.interior_area_sqm, observation.built_area_sqm) >
      0
  )
    issue("area_conflict", "interior_area_sqm");
  if (!observation.listing_role) issue("invalid_field", "listing_role");
  else if (!contract.scope.listing_roles.includes(observation.listing_role))
    issue("out_of_scope", "listing_role");
  if (observation.city?.toLowerCase() !== contract.scope.city_key)
    issue("out_of_scope", "city");
  if (!positiveDecimalSchema.safeParse(observation.asking_amount).success)
    issue("invalid_asking_amount", "asking_amount");
  if (observation.currency !== "COP") issue("unknown_currency", "currency");
  if (observation.listing_status === "inactive")
    issue("inactive_listing", "listing_status");
  if (observation.listing_status === "unknown")
    issue("unknown_listing_status", "listing_status");
  if (!observation.property_type) issue("non_residential", "property_type");
  if (observation.listing_role === "for_rent") {
    if (observation.frequency !== "monthly")
      issue("unknown_frequency", "frequency");
    if (observation.fee_scope !== "base")
      issue("ambiguous_fee_scope", "fee_scope");
    if (!positiveDecimalSchema.safeParse(observation.built_area_sqm).success)
      issue("missing_built_area", "built_area_sqm");
    if (observation.rental_basis !== "long_term")
      issue("unknown_rental_basis", "rental_basis");
  } else if (
    observation.listing_role === "for_sale" &&
    observation.frequency !== "one_time"
  )
    issue("unknown_frequency", "frequency");
  Object.assign(observation.quality, scoreListingQuality(issues));
  for (const entry of provenance)
    entry.quality_issue_codes = issues
      .filter((item) => item.field === entry.field)
      .map((item) => item.code);
  return extractedObservationSchema.parse(observation);
}

/** Pure fixture replay. It has no transport, approval, clock, or storage dependency. */
export function replayFixture(input: {
  artifact: FixtureArtifact;
  contract: unknown;
}): ExtractionOutcome {
  const { artifact } = input;
  if (!validateFixtureArtifact(artifact).ok) return failure("invalid_fixture");
  const parsed = extractionContractSchema.safeParse(input.contract);
  if (!parsed.success) return failure("invalid_contract");
  const contract = parsed.data;
  if (!artifact.envelope.permitted_use.includes("parser_replay"))
    return failure("replay_not_permitted");
  if (
    !artifact.envelope.parser_compatibility.includes(fixtureParserVersion) ||
    artifact.envelope.content_type !== "application/json"
  )
    return failure("incompatible_parser");
  if (!contract.fixture_sha256s.includes(artifact.envelope.envelope_sha256))
    return failure("fixture_not_pinned");
  if (
    contract.mappings.some(
      (mapping) =>
        mapping.locator.kind !== "json_pointer" ||
        !mapping.locator.pointer.startsWith("/") ||
        !supportedFields.has(mapping.field),
    ) ||
    new Set(contract.mappings.map((mapping) => mapping.field)).size !==
      contract.mappings.length
  )
    return failure("unsupported_mapping");
  if (
    !["listing_role", "asking_amount"].every((field) =>
      contract.mappings.some(
        (mapping) => mapping.field === field && mapping.required,
      ),
    )
  )
    return failure("unsupported_mapping");
  let payload: unknown;
  try {
    payload = JSON.parse(artifact.payload);
  } catch {
    return failure("schema_drift");
  }
  if (!object(payload)) return failure("schema_drift");
  const trace: NonNullable<ExtractionOutcome["trace"]> = {
    fixture_id: artifact.envelope.fixture_id,
    envelope_sha256: artifact.envelope.envelope_sha256,
    payload_sha256: artifact.envelope.payload_sha256,
    origin: artifact.envelope.origin,
    parser_version: fixtureParserVersion,
    normalizer_version: fixtureNormalizerVersion,
    extraction_contract_sha256: sha256({
      ...contract,
      scope: {
        ...contract.scope,
        listing_roles: canonicalSet(contract.scope.listing_roles),
      },
      fixture_sha256s: canonicalSet(contract.fixture_sha256s),
    }),
  };
  if (
    artifact.envelope.origin.kind === "permitted_source" &&
    artifact.envelope.origin.source_key !== contract.scope.source_key
  )
    return failure("out_of_scope");
  if (
    Array.isArray(payload.listings) &&
    payload.listings.length === 0 &&
    object(payload.pagination) &&
    payload.pagination.end === true &&
    contract.scope.capability === "discovery"
  ) {
    return {
      contract_version: "v1",
      kind: "capture_only",
      trace,
      observations: [],
      rental_evidence: [],
      issues: [],
    };
  }
  if (Object.hasOwn(payload, "listing") && Object.hasOwn(payload, "listings"))
    return failure("schema_drift");
  const listings = object(payload.listing)
    ? [payload.listing]
    : Array.isArray(payload.listings)
      ? payload.listings
      : [];
  if (listings.length === 0 || listings.length > 100)
    return failure("schema_drift");
  const observations: ExtractedObservation[] = [];
  for (const [index, listing] of listings.entries()) {
    if (!object(listing)) return failure("schema_drift");
    const basePath = object(payload.listing)
      ? "/listing"
      : `/listings/${index}`;
    const offers = Object.hasOwn(listing, "offers")
      ? listing.offers
      : [listing];
    if (!Array.isArray(offers) || offers.length === 0 || offers.length > 10)
      return failure("schema_drift");
    for (const [offerIndex, offer] of offers.entries()) {
      if (!object(offer)) return failure("schema_drift");
      const offerPath = Object.hasOwn(listing, "offers")
        ? `${basePath}/offers/${offerIndex}`
        : undefined;
      const sourceOffer = offerPath ? offer : undefined;
      let found = false;
      for (const mapping of contract.mappings) {
        if (mapping.locator.kind !== "json_pointer") continue;
        const raw = readPointer(
          useOffer(mapping, sourceOffer) ? offer : listing,
          mapping.locator.pointer,
        );
        if (raw !== undefined) found = true;
        if (raw !== undefined && !scalar(raw)) return failure("schema_drift");
        if (raw !== undefined) {
          try {
            canonicalJson(raw);
          } catch {
            return failure("schema_drift");
          }
        }
      }
      if (!found) return failure("schema_drift");
      observations.push(
        normalize(
          listing,
          basePath,
          contract,
          artifact,
          sourceOffer,
          offerPath,
        ),
      );
    }
  }
  const rental_evidence: Extract<
    ExtractionOutcome,
    { kind: "normalized" }
  >["rental_evidence"] = [];
  for (const [observation_index, observation] of observations.entries()) {
    const evidence = rentalEvidenceSchema.safeParse({
      origin:
        artifact.envelope.origin.kind === "permitted_source"
          ? "observed_listing"
          : "synthetic",
      source_key: observation.source_key,
      source_listing_id: observation.source_listing_id,
      listing_url: observation.listing_url,
      collected_at: observation.collected_at,
      listing_role: observation.listing_role,
      asking_amount: observation.asking_amount,
      currency: observation.currency,
      frequency: observation.frequency,
      fee_scope: observation.fee_scope,
      rental_basis: observation.rental_basis,
      listing_status: observation.listing_status,
      property_type: observation.property_type,
      built_area_sqm: observation.built_area_sqm,
    });
    if (evidence.success && !observation.quality.blocking)
      rental_evidence.push({ observation_index, evidence: evidence.data });
  }
  return {
    contract_version: "v1",
    trace,
    kind: observations.some((observation) => observation.quality.blocking)
      ? "quarantined"
      : "normalized",
    observations,
    rental_evidence,
    issues: [],
  };
}
