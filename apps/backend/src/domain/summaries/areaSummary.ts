import type { Area } from "../areas/areaTypes.js";
import type { PropertyRecord } from "../properties/propertyTypes.js";

export type AreaSummary = {
  area_id: string;
  display_name: string;
  area_type: Area["area_type"];
  property_count: number;
  median_sale_price_amount: number | null;
  median_monthly_rent_amount: number | null;
  median_gross_rent_yield: number | null;
  average_gross_rent_yield: number | null;
  min_gross_rent_yield: number | null;
  max_gross_rent_yield: number | null;
  median_sale_to_rent_ratio: number | null;
  data_coverage_score: number | null;
};

export function summarizeArea(
  area: Area,
  properties: PropertyRecord[],
): AreaSummary {
  const salePrices = properties.map((property) => property.sale_price_amount);
  const monthlyRents = properties.map(
    (property) => property.monthly_rent_amount,
  );
  const rentYields = properties.map((property) => property.gross_rent_yield);
  const saleToRentRatios = properties.map(
    (property) => property.sale_to_rent_ratio,
  );

  return {
    area_id: area.area_id,
    display_name: area.display_name,
    area_type: area.area_type,
    property_count: properties.length,
    median_sale_price_amount: median(salePrices),
    median_monthly_rent_amount: median(monthlyRents),
    median_gross_rent_yield: median(rentYields),
    average_gross_rent_yield: average(rentYields),
    min_gross_rent_yield: min(rentYields),
    max_gross_rent_yield: max(rentYields),
    median_sale_to_rent_ratio: median(saleToRentRatios),
    data_coverage_score: null,
  };
}

function median(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 1) {
    return sortedValues[middleIndex] ?? null;
  }

  const left = sortedValues[middleIndex - 1];
  const right = sortedValues[middleIndex];

  if (left === undefined || right === undefined) {
    return null;
  }

  return (left + right) / 2;
}

function average(values: number[]) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function min(values: number[]) {
  return values.length === 0 ? null : Math.min(...values);
}

function max(values: number[]) {
  return values.length === 0 ? null : Math.max(...values);
}
