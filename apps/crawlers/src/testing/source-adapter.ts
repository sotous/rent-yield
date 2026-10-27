import type {
  ListingInput,
  ListingFieldProvenance,
} from "@rent-yield/listing-storage-contracts";
import type { SourceFixture } from "../application/source-adapter.js";

export function makeSourceFixture(
  overrides: Partial<SourceFixture> = {},
): SourceFixture {
  return {
    source_key: "example-source",
    collected_at: "2026-10-26T12:00:00.000Z",
    content_type: "application/json",
    body: "{}",
    ...overrides,
  };
}

export function makeListingInput(
  overrides: Partial<ListingInput> = {},
): ListingInput {
  const provenance: ListingFieldProvenance[] = [
    { field: "source_listing_id", source_path: "/id", raw_value: "listing-1" },
    { field: "city_name", source_path: "/city", raw_value: "Barranquilla" },
    { field: "listing_role", source_path: "/operation", raw_value: "rent" },
    { field: "listing_status", source_path: "/status", raw_value: "active" },
    {
      field: "monthly_asking_rent_cop",
      source_path: "/price",
      raw_value: "1800000",
    },
  ];
  return {
    source_key: "example-source",
    source_listing_id: "listing-1",
    listing_url: null,
    collected_at: "2026-10-26T12:00:00.000Z",
    source_published_at: null,
    source_updated_at: null,
    country_code: "CO",
    city_name: "Barranquilla",
    neighborhood_name: null,
    latitude: null,
    longitude: null,
    listing_role: "for_rent",
    listing_status: "active",
    property_type: null,
    built_area_sqm: null,
    bedrooms: null,
    bathrooms: null,
    social_stratum: null,
    sale_asking_price_cop: null,
    monthly_asking_rent_cop: "1800000",
    administration_fee_cop: null,
    fees_included_in_asking_price: null,
    field_provenance: provenance,
    adapter_version: "example-v1",
    ...overrides,
  };
}
