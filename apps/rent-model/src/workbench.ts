import type {
  CrawlerRequirement,
  DataRequirement,
  ResidentialListing,
  RentModelRequest,
  WorkbenchReport,
} from "./contracts.js";

const DATA_REQUIREMENTS: DataRequirement[] = [
  {
    field: "source_name",
    level: "required",
    reason: "Creates a source-qualified listing identity.",
    required_for: ["subject", "rental_evidence"],
  },
  {
    field: "source_listing_id",
    level: "required",
    reason: "Supports stable identity, deduplication, and auditability.",
    required_for: ["subject", "rental_evidence"],
  },
  {
    field: "city_name",
    level: "required",
    reason: "Keeps comparables in the subject city.",
    required_for: ["subject", "rental_evidence", "benchmark"],
  },
  {
    field: "area_id",
    level: "recommended",
    reason: "Enables same-area comparable tiers and stronger evidence.",
    required_for: ["subject", "rental_evidence", "benchmark"],
  },
  {
    field: "property_type",
    level: "required",
    reason: "Prevents mixing incompatible residential property types.",
    required_for: ["subject", "rental_evidence", "benchmark"],
  },
  {
    field: "built_area_sqm",
    level: "required",
    reason: "Normalizes comparable asking rents to the subject area.",
    required_for: ["subject", "rental_evidence"],
  },
  {
    field: "monthly_asking_rent_cop",
    level: "required",
    reason: "Provides observed rental evidence; modeled rent is not evidence.",
    required_for: ["rental_evidence"],
  },
  {
    field: "observed_at",
    level: "required",
    reason: "Applies the model's fixed as-of-date and freshness policy.",
    required_for: ["subject", "rental_evidence"],
  },
  {
    field: "social_stratum",
    level: "recommended",
    reason:
      "Supports a stricter comparable tier without changing rent directly.",
    required_for: ["subject", "rental_evidence", "benchmark"],
  },
  {
    field: "sale_asking_price_cop",
    level: "optional",
    reason:
      "Belongs to a future yield calculation and is excluded from rent estimation.",
    required_for: ["subject"],
  },
];

const CRAWLER_REQUIREMENTS: CrawlerRequirement[] = [
  {
    listing_role: "for_sale",
    fields: [
      "source_name",
      "source_listing_id",
      "listing_url",
      "city_name",
      "area_id or neighborhood",
      "property_type",
      "built_area_sqm",
      "bedrooms",
      "bathrooms",
      "social_stratum",
      "sale_asking_price_cop",
      "observed_at",
    ],
    reason:
      "Creates a real property subject and preserves data needed for later yield calculation.",
  },
  {
    listing_role: "for_rent",
    fields: [
      "source_name",
      "source_listing_id",
      "listing_url",
      "city_name",
      "area_id or neighborhood",
      "property_type",
      "built_area_sqm",
      "bedrooms",
      "bathrooms",
      "social_stratum",
      "monthly_asking_rent_cop",
      "observed_at",
    ],
    reason: "Creates observed rent comparables independently of sale price.",
  },
];

export function inspectListingForRentModel(
  listing: ResidentialListing,
): WorkbenchReport {
  const missingSubjectFields = requiredSubjectFields(listing);
  const serverRequest =
    missingSubjectFields.length === 0 ? buildServerRequest(listing) : null;

  return {
    subject_ready: serverRequest !== null,
    missing_subject_fields: missingSubjectFields,
    data_requirements: DATA_REQUIREMENTS,
    crawler_requirements: CRAWLER_REQUIREMENTS,
    server_request: serverRequest,
  };
}

function requiredSubjectFields(listing: ResidentialListing): string[] {
  const missing: string[] = [];

  if (!listing.source_name) missing.push("source_name");
  if (!listing.source_listing_id) missing.push("source_listing_id");
  if (!listing.city_name) missing.push("city_name");
  if (!listing.property_type) missing.push("property_type");
  if (
    listing.built_area_sqm === null ||
    !Number.isFinite(listing.built_area_sqm) ||
    listing.built_area_sqm <= 0
  ) {
    missing.push("built_area_sqm");
  }
  if (!listing.observed_at) missing.push("observed_at");

  return missing;
}

function buildServerRequest(listing: ResidentialListing): RentModelRequest {
  if (listing.built_area_sqm === null) {
    throw new Error(
      "built_area_sqm must be available after readiness validation.",
    );
  }

  return {
    subject: {
      source_listing_key: `${listing.source_name}:${listing.source_listing_id}`,
      country_code: listing.country_code,
      city_name: listing.city_name,
      area_id: listing.area_id,
      property_type: listing.property_type,
      built_area_sqm: listing.built_area_sqm,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      social_stratum: listing.social_stratum,
    },
    as_of_date: listing.observed_at ?? "",
    sale_price_excluded: true,
  };
}
