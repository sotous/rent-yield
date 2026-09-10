import { describe, expect, it } from "vitest";

import type { ResidentialListing } from "./contracts.js";
import { inspectListingForRentModel } from "./workbench.js";

const completeSaleListing: ResidentialListing = {
  source_name: "metro-cuadrado",
  source_listing_id: "baq-sale-001",
  listing_url: "https://example.com/listings/baq-sale-001",
  listing_role: "for_sale",
  country_code: "CO",
  city_name: "Barranquilla",
  area_id: "alto-prado",
  neighborhood_name: "Alto Prado",
  property_type: "apartment",
  built_area_sqm: 82,
  bedrooms: 2,
  bathrooms: 2,
  social_stratum: 5,
  sale_asking_price_cop: 420_000_000,
  monthly_asking_rent_cop: null,
  observed_at: "2026-08-01T00:00:00Z",
};

describe("inspectListingForRentModel", () => {
  it("makes a complete sale listing ready for the model without passing sale price", () => {
    const report = inspectListingForRentModel(completeSaleListing);

    expect(report.subject_ready).toBe(true);
    expect(report.missing_subject_fields).toEqual([]);
    expect(report.server_request).toEqual({
      subject: {
        source_listing_key: "metro-cuadrado:baq-sale-001",
        country_code: "CO",
        city_name: "Barranquilla",
        area_id: "alto-prado",
        property_type: "apartment",
        built_area_sqm: 82,
        bedrooms: 2,
        bathrooms: 2,
        social_stratum: 5,
      },
      as_of_date: "2026-08-01T00:00:00Z",
      sale_price_excluded: true,
    });
    expect(JSON.stringify(report.server_request)).not.toContain("420000000");
  });

  it("reports missing data instead of fabricating a model input", () => {
    const report = inspectListingForRentModel({
      ...completeSaleListing,
      built_area_sqm: null,
      observed_at: null,
    });

    expect(report).toMatchObject({
      subject_ready: false,
      missing_subject_fields: ["built_area_sqm", "observed_at"],
      server_request: null,
    });
  });

  it("teaches the crawler that rental evidence is required independently", () => {
    const report = inspectListingForRentModel(completeSaleListing);
    const rentalCrawler = report.crawler_requirements.find(
      (requirement) => requirement.listing_role === "for_rent",
    );

    expect(rentalCrawler?.fields).toContain("monthly_asking_rent_cop");
    expect(rentalCrawler?.fields).not.toContain("sale_asking_price_cop");
  });
});
