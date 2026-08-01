import type { MetricStatus, SourceType } from "../properties/propertyTypes.js";

export type RentalMetricInput = {
  sale_price_amount: number | null;
  monthly_rent_amount: number | null;
  rent_source_type: SourceType;
  sale_price_source_type: SourceType;
};

export type RentalMetrics = {
  annual_rent: number | null;
  gross_rent_yield: number | null;
  sale_to_rent_ratio: number | null;
  metric_status: MetricStatus;
};

export function calculateRentalMetrics(
  input: RentalMetricInput,
): RentalMetrics {
  const { monthly_rent_amount, sale_price_amount } = input;

  if (monthly_rent_amount === null || sale_price_amount === null) {
    return unavailableMetrics("missing_input");
  }

  if (
    !Number.isFinite(monthly_rent_amount) ||
    !Number.isFinite(sale_price_amount) ||
    monthly_rent_amount <= 0 ||
    sale_price_amount <= 0
  ) {
    return unavailableMetrics("invalid_input");
  }

  const annual_rent = monthly_rent_amount * 12;
  const gross_rent_yield = annual_rent / sale_price_amount;
  const sale_to_rent_ratio = sale_price_amount / annual_rent;

  return {
    annual_rent,
    gross_rent_yield,
    sale_to_rent_ratio,
    metric_status: hasEstimatedInput(input) ? "estimated_input" : "valid",
  };
}

function unavailableMetrics(metric_status: MetricStatus): RentalMetrics {
  return {
    annual_rent: null,
    gross_rent_yield: null,
    sale_to_rent_ratio: null,
    metric_status,
  };
}

function hasEstimatedInput(input: RentalMetricInput) {
  return (
    input.rent_source_type !== "observed_listing" ||
    input.sale_price_source_type !== "observed_listing"
  );
}
