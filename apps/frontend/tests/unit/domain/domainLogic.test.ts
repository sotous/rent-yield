import { describe, expect, it } from "vitest";

import {
  calculateAnnualRent,
  calculateGrossRentYield,
  calculateSaleToRentRatio,
  getMetricStatus,
} from "../../../src/domain/metrics";
import { sortByGrossRentYield } from "../../../src/domain/sorting";
import { summarizeArea } from "../../../src/domain/summaries";
import type {
  DemoArea,
  PropertyRecord,
} from "../../../src/domain/propertyTypes";
import { formatCurrency, formatPercent } from "../../../src/lib/formatters";

describe("property metric calculations", () => {
  it("calculates annual rent and gross rent yield", () => {
    expect(calculateAnnualRent(2_800_000)).toBe(33_600_000);
    expect(calculateGrossRentYield(33_600_000, 420_000_000)).toBe(0.08);
  });

  it("calculates the sale-to-rent ratio", () => {
    expect(calculateSaleToRentRatio(420_000_000, 33_600_000)).toBe(12.5);
  });

  it("returns null for non-positive metric inputs", () => {
    expect(calculateAnnualRent(0)).toBeNull();
    expect(calculateGrossRentYield(0, 420_000_000)).toBeNull();
    expect(calculateGrossRentYield(33_600_000, 0)).toBeNull();
    expect(calculateSaleToRentRatio(0, 33_600_000)).toBeNull();
    expect(calculateSaleToRentRatio(420_000_000, 0)).toBeNull();
  });

  it.each([
    [
      { salePrice: 0, monthlyRent: 2_800_000, hasEstimatedInput: false },
      "invalid_input",
    ],
    [
      { salePrice: 420_000_000, monthlyRent: 0, hasEstimatedInput: false },
      "invalid_input",
    ],
    [
      { salePrice: null, monthlyRent: 2_800_000, hasEstimatedInput: false },
      "missing_input",
    ],
    [
      { salePrice: 420_000_000, monthlyRent: null, hasEstimatedInput: false },
      "missing_input",
    ],
    [
      {
        salePrice: 420_000_000,
        monthlyRent: 2_800_000,
        hasEstimatedInput: true,
      },
      "estimated_input",
    ],
    [
      {
        salePrice: 420_000_000,
        monthlyRent: 2_800_000,
        hasEstimatedInput: false,
      },
      "valid",
    ],
  ] as const)("classifies metric status as %s", (args, expected) => {
    expect(getMetricStatus(args)).toBe(expected);
  });
});

describe("property ranking", () => {
  it("sorts by yield, then ratio, then monthly rent without mutating input", () => {
    const properties = [
      makeProperty("rent-tie", 0.08, 14, 2_000_000),
      makeProperty("highest", 0.1, 13, 2_000_000),
      makeProperty("ratio-tie-break", 0.08, 12, 2_000_000),
      makeProperty("rent-tie-break", 0.08, 12, 3_000_000),
    ];

    expect(
      sortByGrossRentYield(properties).map((property) => property.property_id),
    ).toEqual(["highest", "rent-tie-break", "ratio-tie-break", "rent-tie"]);
    expect(properties[0]?.property_id).toBe("rent-tie");
  });
});

describe("area summaries", () => {
  it("calculates median, average, minimum, and maximum values", () => {
    const summary = summarizeArea(area, [
      makeProperty("one", 0.06, 16, 2_000_000),
      makeProperty("two", 0.08, 12, 3_000_000),
      makeProperty("three", 0.1, 10, 4_000_000),
    ]);

    expect(summary.property_count).toBe(3);
    expect(summary.median_gross_rent_yield).toBe(0.08);
    expect(summary.average_gross_rent_yield).toBeCloseTo(0.08);
    expect(summary.min_gross_rent_yield).toBe(0.06);
    expect(summary.max_gross_rent_yield).toBe(0.1);
    expect(summary.median_sale_to_rent_ratio).toBe(12);
  });

  it("returns null metrics for an empty area", () => {
    const summary = summarizeArea(area, []);

    expect(summary.property_count).toBe(0);
    expect(summary.median_sale_price_amount).toBeNull();
    expect(summary.average_gross_rent_yield).toBeNull();
    expect(summary.min_gross_rent_yield).toBeNull();
    expect(summary.max_gross_rent_yield).toBeNull();
  });
});

describe("display formatting", () => {
  it("formats Colombian currency and percentages", () => {
    expect(formatCurrency(420_000_000)).toContain("420");
    expect(formatPercent(0.08)).toContain("8,0");
  });

  it("uses an explicit unavailable label for missing values", () => {
    expect(formatCurrency(null)).toBe("Unavailable");
    expect(formatPercent(null)).toBe("Unavailable");
  });
});

const area: DemoArea = {
  area_id: "alto-prado",
  country_code: "CO",
  area_type: "neighborhood",
  display_name: "Alto Prado",
  city_name: "Barranquilla",
  description: "Prototype area",
  parent_area_id: "barranquilla",
  centroid_latitude: 11,
  centroid_longitude: -74.8,
  zoom: 14,
  bounding_box: null,
  geometry_reference: null,
};

function makeProperty(
  propertyId: string,
  grossRentYield: number,
  saleToRentRatio: number,
  monthlyRentAmount: number,
): PropertyRecord {
  return {
    property_id: propertyId,
    country_code: "CO",
    city_name: "Barranquilla",
    area_id: "alto-prado",
    neighborhood_name: "Alto Prado",
    locality_name: null,
    address_label: propertyId,
    listing_url: null,
    latitude: 11,
    longitude: -74.8,
    property_type: "apartment",
    bedrooms: 2,
    bathrooms: 2,
    interior_area_sqm: 82,
    sale_price_amount: 420_000_000,
    sale_price_currency: "COP",
    monthly_rent_amount: monthlyRentAmount,
    monthly_rent_currency: "COP",
    annual_rent: monthlyRentAmount * 12,
    gross_rent_yield: grossRentYield,
    sale_to_rent_ratio: saleToRentRatio,
    listing_status: "for_sale",
    rent_source_type: "observed_listing",
    sale_price_source_type: "observed_listing",
    metric_status: "valid",
    observed_at: null,
  };
}
