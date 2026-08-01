import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AreaSummary } from "../../../src/components/AreaSummary";
import type { AreaSummary as AreaSummaryRecord } from "../../../src/domain/propertyTypes";

const makeSummary = (
  overrides: Partial<AreaSummaryRecord> = {},
): AreaSummaryRecord & { area_type: "neighborhood"; data_label: string } => ({
  area_id: "alto-prado",
  display_name: "Alto Prado",
  area_type: "neighborhood",
  property_count: 12,
  median_sale_price_amount: 550000000,
  median_monthly_rent_amount: 3350000,
  median_gross_rent_yield: 0.0744,
  average_gross_rent_yield: 0.0744,
  min_gross_rent_yield: 0.05,
  max_gross_rent_yield: 0.1,
  median_sale_to_rent_ratio: 13.5,
  data_coverage_score: null,
  data_label: "Prototype data",
  ...overrides,
});

describe("AreaSummary", () => {
  it("renders the no-area-selected state when the summary is null", () => {
    render(<AreaSummary summary={null} />);

    expect(
      screen.getByRole("heading", { name: "No area selected" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Choose a Barranquilla demo area to see its prototype summary.",
      ),
    ).toBeVisible();
  });

  it("renders unavailable values and the fallback note for missing summary metrics", () => {
    render(
      <AreaSummary
        summary={makeSummary({
          median_sale_price_amount: null,
          median_monthly_rent_amount: null,
          median_gross_rent_yield: null,
          average_gross_rent_yield: null,
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "Alto Prado" })).toBeVisible();
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(
      screen.getByText(
        "Prototype summary based on the currently visible API property set.",
      ),
    ).toBeVisible();
  });

  it("formats area type and average yield when summary values are present", () => {
    render(<AreaSummary summary={makeSummary()} />);

    expect(screen.getByText("Selected neighborhood")).toBeVisible();
    expect(screen.getByText("Average rent return is 7,4%.")).toBeVisible();
    expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
  });
});
