import { describe, expect, it } from "vitest";

import { calculateRentalMetrics } from "./rentalMetrics.js";

describe("calculateRentalMetrics", () => {
  it("calculates annual rent, gross rent yield, and sale-to-rent ratio", () => {
    expect(
      calculateRentalMetrics({
        sale_price_amount: 420_000_000,
        monthly_rent_amount: 2_800_000,
        rent_source_type: "observed_listing",
        sale_price_source_type: "observed_listing",
      }),
    ).toEqual({
      annual_rent: 33_600_000,
      gross_rent_yield: 0.08,
      sale_to_rent_ratio: 12.5,
      metric_status: "valid",
    });
  });

  it("marks metrics as missing when required inputs are absent", () => {
    expect(
      calculateRentalMetrics({
        sale_price_amount: null,
        monthly_rent_amount: 2_800_000,
        rent_source_type: "observed_listing",
        sale_price_source_type: "observed_listing",
      }),
    ).toEqual({
      annual_rent: null,
      gross_rent_yield: null,
      sale_to_rent_ratio: null,
      metric_status: "missing_input",
    });
  });

  it("marks metrics as invalid instead of dividing by zero", () => {
    expect(
      calculateRentalMetrics({
        sale_price_amount: 0,
        monthly_rent_amount: 2_800_000,
        rent_source_type: "observed_listing",
        sale_price_source_type: "observed_listing",
      }),
    ).toEqual({
      annual_rent: null,
      gross_rent_yield: null,
      sale_to_rent_ratio: null,
      metric_status: "invalid_input",
    });
  });

  it("marks non-finite inputs as invalid", () => {
    expect(
      calculateRentalMetrics({
        sale_price_amount: Number.NaN,
        monthly_rent_amount: 2_800_000,
        rent_source_type: "observed_listing",
        sale_price_source_type: "observed_listing",
      }),
    ).toMatchObject({
      annual_rent: null,
      gross_rent_yield: null,
      sale_to_rent_ratio: null,
      metric_status: "invalid_input",
    });

    expect(
      calculateRentalMetrics({
        sale_price_amount: 420_000_000,
        monthly_rent_amount: Number.POSITIVE_INFINITY,
        rent_source_type: "observed_listing",
        sale_price_source_type: "observed_listing",
      }).metric_status,
    ).toBe("invalid_input");
  });

  it("marks metrics as estimated when either source input is not observed", () => {
    expect(
      calculateRentalMetrics({
        sale_price_amount: 420_000_000,
        monthly_rent_amount: 2_800_000,
        rent_source_type: "estimated_model",
        sale_price_source_type: "observed_listing",
      }).metric_status,
    ).toBe("estimated_input");
  });
});
