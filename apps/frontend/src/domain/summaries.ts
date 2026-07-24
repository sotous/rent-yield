import type { AreaSummary, DemoArea, PropertyRecord } from "./propertyTypes";

export function summarizeArea(
  area: DemoArea,
  properties: readonly PropertyRecord[],
): AreaSummary {
  return {
    area_id: area.area_id,
    display_name: area.display_name,
    property_count: properties.length,
    median_sale_price_amount: median(
      properties.map((property) => property.sale_price_amount),
    ),
    median_monthly_rent_amount: median(
      properties.map((property) => property.monthly_rent_amount),
    ),
    median_gross_rent_yield: median(
      properties.map((property) => property.gross_rent_yield),
    ),
    average_gross_rent_yield: average(
      properties.map((property) => property.gross_rent_yield),
    ),
    min_gross_rent_yield: min(
      properties.map((property) => property.gross_rent_yield),
    ),
    max_gross_rent_yield: max(
      properties.map((property) => property.gross_rent_yield),
    ),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[midpoint] ?? null;
  }

  const lower = sorted[midpoint - 1];
  const upper = sorted[midpoint];

  if (lower == null || upper == null) {
    return null;
  }

  return (lower + upper) / 2;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function min(values: number[]): number | null {
  return values.length === 0 ? null : Math.min(...values);
}

function max(values: number[]): number | null {
  return values.length === 0 ? null : Math.max(...values);
}
