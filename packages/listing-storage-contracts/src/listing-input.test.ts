import { describe, expect, it } from "vitest";
import { listingInputSchema } from "./listing-input.js";

const listing = {
  source_key: "ciencuadras",
  source_listing_id: "listing-123",
  listing_url: "https://www.ciencuadras.com/inmueble/listing-123",
  collected_at: "2026-10-26T12:00:00.000Z",
  source_published_at: "2026-10-20T00:00:00.000Z",
  source_updated_at: null,
  country_code: "CO",
  city_name: "Barranquilla",
  neighborhood_name: "Alto Prado",
  latitude: "10.9942",
  longitude: "-74.8069",
  listing_role: "for_rent",
  listing_status: "active",
  property_type: "apartment",
  built_area_sqm: "72",
  bedrooms: 2,
  bathrooms: 2,
  social_stratum: 5,
  sale_asking_price_cop: null,
  monthly_asking_rent_cop: "1800000",
  administration_fee_cop: "250000",
  fees_included_in_asking_price: false,
  field_provenance: [
    {
      field: "source_listing_id",
      source_path: "/id",
      raw_value: "listing-123",
    },
    {
      field: "listing_url",
      source_path: "/url",
      raw_value: "https://www.ciencuadras.com/inmueble/listing-123",
    },
    {
      field: "source_published_at",
      source_path: "/publishedAt",
      raw_value: "2026-10-20T00:00:00.000Z",
    },
    { field: "city_name", source_path: "/city", raw_value: "Barranquilla" },
    {
      field: "neighborhood_name",
      source_path: "/neighborhood",
      raw_value: "Alto Prado",
    },
    { field: "latitude", source_path: "/latitude", raw_value: "10.9942" },
    { field: "longitude", source_path: "/longitude", raw_value: "-74.8069" },
    { field: "listing_role", source_path: "/operation", raw_value: "rent" },
    { field: "listing_status", source_path: "/status", raw_value: "active" },
    {
      field: "property_type",
      source_path: "/propertyType",
      raw_value: "apartment",
    },
    { field: "built_area_sqm", source_path: "/builtArea", raw_value: "72" },
    { field: "bedrooms", source_path: "/bedrooms", raw_value: 2 },
    { field: "bathrooms", source_path: "/bathrooms", raw_value: 2 },
    { field: "social_stratum", source_path: "/stratum", raw_value: 5 },
    {
      field: "monthly_asking_rent_cop",
      source_path: "/price",
      raw_value: "1800000",
    },
    {
      field: "administration_fee_cop",
      source_path: "/adminFee",
      raw_value: "250000",
    },
    {
      field: "fees_included_in_asking_price",
      source_path: "/includesAdmin",
      raw_value: false,
    },
  ],
  adapter_version: "ciencuadras-v1",
};

describe("ListingInput", () => {
  it("accepts a provenance-complete observed rental listing", () => {
    expect(listingInputSchema.parse(listing)).toEqual(listing);
  });

  it("requires a stable source identity and provenance for source-derived values", () => {
    expect(
      listingInputSchema.safeParse({
        ...listing,
        source_listing_id: null,
        listing_url: null,
      }).success,
    ).toBe(false);
    expect(
      listingInputSchema.safeParse({
        ...listing,
        field_provenance: listing.field_provenance.filter(
          (entry) => entry.field !== "monthly_asking_rent_cop",
        ),
      }).success,
    ).toBe(false);
  });

  it("keeps rental and sale asking amounts separate", () => {
    expect(
      listingInputSchema.safeParse({
        ...listing,
        sale_asking_price_cop: "450000000",
      }).success,
    ).toBe(false);
    expect(
      listingInputSchema.safeParse({
        ...listing,
        listing_role: "for_sale",
        sale_asking_price_cop: "450000000",
        monthly_asking_rent_cop: null,
        field_provenance: listing.field_provenance
          .filter((entry) => entry.field !== "monthly_asking_rent_cop")
          .concat([
            {
              field: "sale_asking_price_cop",
              source_path: "/price",
              raw_value: "450000000",
            },
          ]),
      }).success,
    ).toBe(true);
  });

  it("does not treat private area, invalid money, or undeclared fields as valid input", () => {
    expect(
      listingInputSchema.safeParse({ ...listing, built_area_sqm: "0" }).success,
    ).toBe(false);
    expect(
      listingInputSchema.safeParse({
        ...listing,
        monthly_asking_rent_cop: "-1",
      }).success,
    ).toBe(false);
    expect(
      listingInputSchema.safeParse({ ...listing, private_area_sqm: "65" })
        .success,
    ).toBe(false);
  });
});
