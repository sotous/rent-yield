import { z } from "zod";
import {
  decimalSchema,
  identifierSchema,
  instantSchema,
  positiveDecimalSchema,
  safeNonNegativeIntegerSchema,
} from "./primitives.js";

export const listingInputFieldSchema = z.enum([
  "source_listing_id",
  "listing_url",
  "source_published_at",
  "source_updated_at",
  "city_name",
  "neighborhood_name",
  "latitude",
  "longitude",
  "listing_role",
  "listing_status",
  "property_type",
  "built_area_sqm",
  "bedrooms",
  "bathrooms",
  "social_stratum",
  "sale_asking_price_cop",
  "monthly_asking_rent_cop",
  "administration_fee_cop",
  "fees_included_in_asking_price",
]);

export const listingFieldProvenanceSchema = z.strictObject({
  field: listingInputFieldSchema,
  source_path: z.string().min(1),
  raw_value: z.union([z.string(), z.number().finite(), z.boolean(), z.null()]),
});

const stableListingUrlSchema = z
  .url({ protocol: /^https$/ })
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname !== "/" &&
      url.href === value
    );
  });
const stableSourceListingIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/);
const propertyTypeSchema = z.enum([
  "apartment",
  "house",
  "studio",
  "other_residential",
]);
const sourceDerivedFields = [
  "source_listing_id",
  "listing_url",
  "source_published_at",
  "source_updated_at",
  "city_name",
  "neighborhood_name",
  "latitude",
  "longitude",
  "listing_role",
  "listing_status",
  "property_type",
  "built_area_sqm",
  "bedrooms",
  "bathrooms",
  "social_stratum",
  "sale_asking_price_cop",
  "monthly_asking_rent_cop",
  "administration_fee_cop",
  "fees_included_in_asking_price",
] as const;

export const listingInputSchema = z
  .strictObject({
    source_key: identifierSchema,
    source_listing_id: stableSourceListingIdSchema.nullable(),
    listing_url: stableListingUrlSchema.nullable(),
    collected_at: instantSchema,
    source_published_at: instantSchema.nullable(),
    source_updated_at: instantSchema.nullable(),
    country_code: z.literal("CO"),
    city_name: z.string().trim().min(1),
    neighborhood_name: z.string().trim().min(1).nullable(),
    latitude: decimalSchema.nullable(),
    longitude: decimalSchema.nullable(),
    listing_role: z.enum(["for_sale", "for_rent"]),
    listing_status: z.enum(["active", "inactive", "unknown"]),
    property_type: propertyTypeSchema.nullable(),
    built_area_sqm: positiveDecimalSchema.nullable(),
    bedrooms: safeNonNegativeIntegerSchema.nullable(),
    bathrooms: safeNonNegativeIntegerSchema.nullable(),
    social_stratum: safeNonNegativeIntegerSchema.min(1).max(6).nullable(),
    sale_asking_price_cop: positiveDecimalSchema.nullable(),
    monthly_asking_rent_cop: positiveDecimalSchema.nullable(),
    administration_fee_cop: positiveDecimalSchema.nullable(),
    fees_included_in_asking_price: z.boolean().nullable(),
    field_provenance: z.array(listingFieldProvenanceSchema),
    adapter_version: identifierSchema,
  })
  .superRefine((listing, context) => {
    const issue = (path: readonly (string | number)[], message: string) =>
      context.addIssue({ code: "custom", path: [...path], message });
    if (listing.source_listing_id === null && listing.listing_url === null)
      issue(["source_listing_id"], "Stable source identity required");
    if (
      (listing.listing_role === "for_rent" &&
        listing.sale_asking_price_cop !== null) ||
      (listing.listing_role === "for_sale" &&
        listing.monthly_asking_rent_cop !== null)
    )
      issue(
        ["listing_role"],
        "Sale and rental asking amounts must remain separate",
      );

    const provenance = new Set(
      listing.field_provenance.map(({ field }) => field),
    );
    for (const field of sourceDerivedFields) {
      if (listing[field] !== null && !provenance.has(field))
        issue(
          ["field_provenance"],
          `Missing provenance for populated ${field}`,
        );
    }
  });

export type ListingInput = z.infer<typeof listingInputSchema>;
export type ListingFieldProvenance = z.infer<
  typeof listingFieldProvenanceSchema
>;
