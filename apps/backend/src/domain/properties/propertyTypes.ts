import type { CountryCode, CityName } from "../areas/areaTypes.js";

export type PropertyType =
  "apartment" | "house" | "studio" | "other_residential";

export type ListingStatus = "for_sale" | "for_rent" | "inactive" | "unknown";

export type SourceType =
  | "observed_listing"
  | "historical_observed"
  | "estimated_model"
  | "manual_import"
  | "unknown";

export type MetricStatus =
  "valid" | "missing_input" | "invalid_input" | "estimated_input";

export type PropertySourceRecord = {
  property_id: string;
  country_code: CountryCode;
  city_name: CityName;
  area_id: string;
  neighborhood_name: string | null;
  locality_name: string | null;
  address_label: string;
  listing_url: string | null;
  latitude: number | null;
  longitude: number | null;
  property_type: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  interior_area_sqm: number | null;
  sale_price_amount: number | null;
  sale_price_currency: "COP";
  monthly_rent_amount: number | null;
  monthly_rent_currency: "COP";
  listing_status: ListingStatus;
  rent_source_type: SourceType;
  sale_price_source_type: SourceType;
  observed_at: string | null;
};

export type PropertyRecord = Omit<
  PropertySourceRecord,
  "latitude" | "longitude" | "sale_price_amount" | "monthly_rent_amount"
> & {
  latitude: number;
  longitude: number;
  sale_price_amount: number;
  monthly_rent_amount: number;
  annual_rent: number;
  gross_rent_yield: number;
  sale_to_rent_ratio: number;
  metric_status: MetricStatus;
};
