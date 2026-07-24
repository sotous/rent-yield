import type { MetricStatus } from "./propertyTypes";

export function calculateAnnualRent(monthlyRent: number): number | null {
  if (monthlyRent <= 0) {
    return null;
  }

  return monthlyRent * 12;
}

export function calculateGrossRentYield(
  annualRent: number,
  salePrice: number,
): number | null {
  if (annualRent <= 0 || salePrice <= 0) {
    return null;
  }

  return annualRent / salePrice;
}

export function calculateSaleToRentRatio(
  salePrice: number,
  annualRent: number,
): number | null {
  if (annualRent <= 0 || salePrice <= 0) {
    return null;
  }

  return salePrice / annualRent;
}

export function getMetricStatus(args: {
  salePrice: number;
  monthlyRent: number;
  hasEstimatedInput: boolean;
}): MetricStatus {
  if (args.salePrice == null || args.monthlyRent == null) {
    return "missing_input";
  }

  if (args.salePrice <= 0 || args.monthlyRent <= 0) {
    return "invalid_input";
  }

  if (args.hasEstimatedInput) {
    return "estimated_input";
  }

  return "valid";
}
