import { calculateRentalMetrics } from "../../domain/metrics/rentalMetrics.js";
import type {
  PropertyRecord,
  PropertySourceRecord,
} from "../../domain/properties/propertyTypes.js";

export function buildRankableProperty(
  source: PropertySourceRecord,
): PropertyRecord | null {
  const metrics = calculateRentalMetrics(source);

  if (
    source.latitude === null ||
    source.longitude === null ||
    source.sale_price_amount === null ||
    source.monthly_rent_amount === null ||
    metrics.annual_rent === null ||
    metrics.gross_rent_yield === null ||
    metrics.sale_to_rent_ratio === null
  ) {
    return null;
  }

  return {
    ...source,
    latitude: source.latitude,
    longitude: source.longitude,
    sale_price_amount: source.sale_price_amount,
    monthly_rent_amount: source.monthly_rent_amount,
    annual_rent: metrics.annual_rent,
    gross_rent_yield: metrics.gross_rent_yield,
    sale_to_rent_ratio: metrics.sale_to_rent_ratio,
    metric_status: metrics.metric_status,
  };
}
