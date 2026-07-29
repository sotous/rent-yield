export type MetricStatus =
  "valid" | "missing_input" | "invalid_input" | "estimated_input";

export type PropertyType =
  "apartment" | "house" | "studio" | "other_residential";

export type SourceType =
  | "observed_listing"
  | "historical_observed"
  | "estimated_model"
  | "manual_import"
  | "unknown";

export type AreaType = "city" | "locality" | "neighborhood" | "viewport";

export type DemoArea = {
  area_id: string;
  area_type: AreaType;
  display_name: string;
  city_name: string;
  country_code: "CO";
  description: string;
  centroid_latitude: number;
  centroid_longitude: number;
  zoom: number;
};

export type PropertyRecord = {
  property_id: string;
  country_code: "CO";
  city_name: string;
  area_id: string;
  neighborhood_name: string;
  address_label: string;
  listing_url: string;
  latitude: number;
  longitude: number;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  interior_area_sqm: number;
  sale_price_amount: number;
  sale_price_currency: "COP";
  monthly_rent_amount: number;
  monthly_rent_currency: "COP";
  annual_rent: number;
  gross_rent_yield: number;
  sale_to_rent_ratio: number;
  listing_status: "for_sale" | "for_rent" | "inactive" | "unknown";
  rent_source_type: SourceType;
  sale_price_source_type: SourceType;
  metric_status: MetricStatus;
};

export type AreaSummary = {
  area_id: string;
  display_name: string;
  property_count: number;
  median_sale_price_amount: number | null;
  median_monthly_rent_amount: number | null;
  median_gross_rent_yield: number | null;
  average_gross_rent_yield: number | null;
  min_gross_rent_yield: number | null;
  max_gross_rent_yield: number | null;
};
