/** Stable boundary between source adapters and durable listing storage. */
export type ListingRole = "for_sale" | "for_rent";
export type SourceMethodologyRole = "discovery" | "detail" | "rental_evidence";
export type MethodologyStatus = "proposed" | "approved" | "retired";
export type ArtifactBody = string | Uint8Array;

export type SourceMethodology = {
  methodology_id: string;
  source_key: string;
  city_key: string;
  role: SourceMethodologyRole;
  version: string;
  status: MethodologyStatus;
  allowed_listing_roles: readonly ListingRole[];
  permitted_probe_ids: readonly string[];
  fixture_ids: readonly string[];
  crawl_constraints: {
    max_requests_per_minute: number;
    max_concurrency: number;
    retention_policy_key: string;
  };
};

/** The only source-methodology lookup a crawler needs. */
export interface SourceMethodologyRepository {
  findApproved(input: {
    source_key: string;
    city_key: string;
    role: SourceMethodologyRole;
  }): Promise<SourceMethodology | null>;
}

export type RawCapture = {
  source_key: string;
  methodology_id: string;
  collected_at: string;
  request: { url: string; method: "GET" | "POST" };
  response: {
    status_code: number;
    content_type: string | null;
    content_encoding: string | null;
    body: ArtifactBody;
  };
  source_dates: {
    published_at: string | null;
    updated_at: string | null;
    published_text: string | null;
    updated_text: string | null;
  };
};

export type FieldProvenance = {
  field: string;
  raw_path: string;
  raw_label: string | null;
  raw_value: string | null;
  extraction_method: "structured" | "dom" | "text" | "manual";
  transform_version: string;
  quality_issue_codes: readonly string[];
};

export type ObservedOffer = {
  role: ListingRole;
  amount: string;
  currency: "COP" | string;
  frequency: "monthly" | "one_time" | "unknown";
  amount_scope: "base" | "includes_admin" | "unknown";
  administration_amount: string | null;
  utilities_amount: string | null;
  parking_amount: string | null;
};

/** Values are source observations, never model outputs. */
export type NormalizedListingObservation = {
  source_listing_key: string;
  source_listing_id: string;
  listing_url: string | null;
  observed_at: string;
  country_code: "CO";
  city_key: string;
  area_key: string | null;
  title: string | null;
  address_label: string | null;
  property_type: "apartment" | "house" | "studio" | "other_residential" | null;
  built_area_sqm: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  social_stratum: number | null;
  latitude: string | null;
  longitude: string | null;
  offers: readonly ObservedOffer[];
  normalizer_version: string;
  field_provenance: readonly FieldProvenance[];
  quality_issue_codes: readonly string[];
};

export type IngestionOutcome = {
  raw_artifact_sha256: string;
  source_listing_observation_id: string;
  normalized_observation_id: string;
  disposition: "stored" | "already_stored" | "quarantined";
};

/** Atomically links raw evidence to its normalized outcome. */
export interface ListingIngestionSink {
  ingest(input: {
    capture: RawCapture;
    observation: NormalizedListingObservation;
  }): Promise<IngestionOutcome>;
}

// Foundation v1 research surface. Legacy storage DTOs above remain unversioned
// drafts until their consumer/provider implementation slices replace them.
export * from "./primitives.js";
export * from "./canonical.js";
export * from "./research.js";
export * from "./methodology.js";
export * from "./catalog.js";
export * from "./research.examples.js";
export * from "./methodology.examples.js";
