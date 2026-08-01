import { describe, expect, it } from "vitest";

import type { Area } from "../areas/areaTypes.js";
import type { PropertyRecord } from "../properties/propertyTypes.js";
import { summarizeArea } from "./areaSummary.js";

describe("summarizeArea", () => {
  it("summarizes property values for an area", () => {
    expect(
      summarizeArea(area, [
        property("a", 300_000_000, 2_000_000, 0.08, 12.5),
        property("b", 500_000_000, 3_000_000, 0.072, 13.89),
      ]),
    ).toMatchObject({
      area_id: "alto-prado",
      display_name: "Alto Prado",
      area_type: "neighborhood",
      property_count: 2,
      median_sale_price_amount: 400_000_000,
      median_monthly_rent_amount: 2_500_000,
      median_gross_rent_yield: 0.076,
      average_gross_rent_yield: 0.076,
      min_gross_rent_yield: 0.072,
      max_gross_rent_yield: 0.08,
      median_sale_to_rent_ratio: 13.195,
      data_coverage_score: null,
    });
  });

  it("returns frontend-safe null metrics for an empty area", () => {
    expect(summarizeArea(area, [])).toMatchObject({
      property_count: 0,
      median_sale_price_amount: null,
      median_monthly_rent_amount: null,
      median_gross_rent_yield: null,
      average_gross_rent_yield: null,
      min_gross_rent_yield: null,
      max_gross_rent_yield: null,
      median_sale_to_rent_ratio: null,
    });
  });
});

const area: Area = {
  area_id: "alto-prado",
  country_code: "CO",
  area_type: "neighborhood",
  display_name: "Alto Prado",
  city_name: "Barranquilla",
  description: null,
  parent_area_id: "barranquilla",
  centroid_latitude: 11.004,
  centroid_longitude: -74.811,
  zoom: 14,
  bounding_box: null,
  geometry_reference: null,
};

function property(
  property_id: string,
  sale_price_amount: number,
  monthly_rent_amount: number,
  gross_rent_yield: number,
  sale_to_rent_ratio: number,
): PropertyRecord {
  return {
    property_id,
    country_code: "CO",
    city_name: "Barranquilla",
    area_id: "alto-prado",
    neighborhood_name: "Alto Prado",
    locality_name: null,
    address_label: property_id,
    listing_url: null,
    latitude: 11,
    longitude: -74,
    property_type: "apartment",
    bedrooms: null,
    bathrooms: null,
    interior_area_sqm: null,
    sale_price_amount,
    sale_price_currency: "COP",
    monthly_rent_amount,
    monthly_rent_currency: "COP",
    annual_rent: monthly_rent_amount * 12,
    gross_rent_yield,
    sale_to_rent_ratio,
    listing_status: "for_sale",
    rent_source_type: "observed_listing",
    sale_price_source_type: "observed_listing",
    metric_status: "valid",
    observed_at: null,
  };
}
