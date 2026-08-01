import { describe, expect, it } from "vitest";

import type { PropertyRecord } from "../properties/propertyTypes.js";
import { rankPropertiesByRentReturn } from "./propertyRanking.js";

describe("rankPropertiesByRentReturn", () => {
  it("sorts by rent yield, then sale-to-rent ratio, then monthly rent", () => {
    const properties = [
      property("a", 0.08, 12, 2_800_000),
      property("b", 0.09, 14, 2_600_000),
      property("c", 0.08, 11, 2_700_000),
      property("d", 0.08, 11, 3_000_000),
    ];

    expect(
      rankPropertiesByRentReturn(properties).map(
        (propertyRecord) => propertyRecord.property_id,
      ),
    ).toEqual(["b", "d", "c", "a"]);
  });
});

function property(
  property_id: string,
  gross_rent_yield: number,
  sale_to_rent_ratio: number,
  monthly_rent_amount: number,
): PropertyRecord {
  return {
    property_id,
    country_code: "CO",
    city_name: "Barranquilla",
    area_id: "barranquilla",
    neighborhood_name: null,
    locality_name: null,
    address_label: property_id,
    listing_url: null,
    latitude: 11,
    longitude: -74,
    property_type: "apartment",
    bedrooms: null,
    bathrooms: null,
    interior_area_sqm: null,
    sale_price_amount: 400_000_000,
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
