import { z } from "zod";

export const explorerBootstrapQuerySchema = z.object({
  country_code: z.string().min(1),
  city_name: z.string().min(1),
});

export const explorerAreaParamsSchema = z.object({
  area_id: z.string().min(1),
});

const areaTypeSchema = z.enum([
  "country",
  "city",
  "locality",
  "neighborhood",
  "viewport",
]);

const areaSchema = z.object({
  area_id: z.string(),
  country_code: z.literal("CO"),
  area_type: areaTypeSchema,
  display_name: z.string(),
  city_name: z.literal("Barranquilla"),
  description: z.string().nullable(),
  parent_area_id: z.string().nullable(),
  centroid_latitude: z.number().finite(),
  centroid_longitude: z.number().finite(),
  zoom: z.number().finite(),
  bounding_box: z
    .object({
      north: z.number().finite(),
      south: z.number().finite(),
      east: z.number().finite(),
      west: z.number().finite(),
    })
    .nullable(),
  geometry_reference: z.string().nullable(),
});

const propertySchema = z.object({
  property_id: z.string(),
  country_code: z.literal("CO"),
  city_name: z.literal("Barranquilla"),
  area_id: z.string(),
  neighborhood_name: z.string().nullable(),
  locality_name: z.string().nullable(),
  address_label: z.string(),
  listing_url: z.string().url().nullable(),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  property_type: z.enum(["apartment", "house", "studio", "other_residential"]),
  bedrooms: z.number().finite().nullable(),
  bathrooms: z.number().finite().nullable(),
  interior_area_sqm: z.number().finite().nullable(),
  sale_price_amount: z.number().finite().positive(),
  sale_price_currency: z.literal("COP"),
  monthly_rent_amount: z.number().finite().positive(),
  monthly_rent_currency: z.literal("COP"),
  listing_status: z.enum(["for_sale", "for_rent", "inactive", "unknown"]),
  rent_source_type: z.enum([
    "observed_listing",
    "historical_observed",
    "estimated_model",
    "manual_import",
    "unknown",
  ]),
  sale_price_source_type: z.enum([
    "observed_listing",
    "historical_observed",
    "estimated_model",
    "manual_import",
    "unknown",
  ]),
  observed_at: z.string().nullable(),
  annual_rent: z.number().finite().positive(),
  gross_rent_yield: z.number().finite().positive(),
  sale_to_rent_ratio: z.number().finite().positive(),
  metric_status: z.enum([
    "valid",
    "missing_input",
    "invalid_input",
    "estimated_input",
  ]),
});

const areaSummarySchema = z.object({
  area_id: z.string(),
  display_name: z.string(),
  area_type: areaTypeSchema,
  property_count: z.number().int().nonnegative(),
  median_sale_price_amount: z.number().finite().nullable(),
  median_monthly_rent_amount: z.number().finite().nullable(),
  median_gross_rent_yield: z.number().finite().nullable(),
  average_gross_rent_yield: z.number().finite().nullable(),
  min_gross_rent_yield: z.number().finite().nullable(),
  max_gross_rent_yield: z.number().finite().nullable(),
  median_sale_to_rent_ratio: z.number().finite().nullable(),
  data_coverage_score: z.number().finite().nullable(),
});

const sortMetadataSchema = z.object({
  metric: z.literal("gross_rent_yield"),
  direction: z.literal("desc"),
  tie_breakers: z.tuple([
    z.object({
      metric: z.literal("sale_to_rent_ratio"),
      direction: z.literal("asc"),
    }),
    z.object({
      metric: z.literal("monthly_rent_amount"),
      direction: z.literal("desc"),
    }),
  ]),
});

export const explorerBootstrapResponseSchema = z.object({
  default_area_id: z.string().nullable(),
  areas: z.array(areaSchema),
  data_label: z.string(),
});

export const explorerAreaResponseSchema = z.object({
  area: areaSchema,
  summary: areaSummarySchema,
  properties: z.array(propertySchema),
  sort: sortMetadataSchema,
  data_label: z.string(),
});
