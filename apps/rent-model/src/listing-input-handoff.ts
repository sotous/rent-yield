import {
  listingInputSchema,
  type ListingFieldProvenance,
} from "@rent-yield/listing-storage-contracts";
import type { ResidentialListing } from "./contracts.js";

export type ListingInputRentModelHandoff =
  | {
      ok: true;
      value: {
        listing: ResidentialListing;
        field_provenance: readonly ListingFieldProvenance[];
      };
    }
  | {
      ok: false;
      error: {
        code:
          | "invalid_listing_input"
          | "missing_source_listing_id"
          | "unrepresentable_decimal";
      };
    };

const decimalToNumber = (value: string | null): number | null =>
  value === null ? null : Number(value);

/**
 * Adapts the shared crawler contract to the existing Rent Model workbench
 * input without importing or knowing any source-specific adapter.
 */
export function handoffListingInputToRentModel(
  input: unknown,
): ListingInputRentModelHandoff {
  const parsed = listingInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: { code: "invalid_listing_input" } };
  const listing = parsed.data;
  if (listing.source_listing_id === null)
    return { ok: false, error: { code: "missing_source_listing_id" } };
  if (
    [
      listing.built_area_sqm,
      listing.sale_asking_price_cop,
      listing.monthly_asking_rent_cop,
    ].some((value) => value !== null && !Number.isFinite(Number(value)))
  )
    return { ok: false, error: { code: "unrepresentable_decimal" } };

  return {
    ok: true,
    value: {
      listing: {
        source_name: listing.source_key,
        source_listing_id: listing.source_listing_id,
        listing_url: listing.listing_url,
        listing_role: listing.listing_role,
        country_code: listing.country_code,
        city_name: listing.city_name,
        area_id: null,
        neighborhood_name: listing.neighborhood_name,
        property_type: listing.property_type,
        built_area_sqm: decimalToNumber(listing.built_area_sqm),
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        social_stratum: listing.social_stratum,
        sale_asking_price_cop: decimalToNumber(listing.sale_asking_price_cop),
        monthly_asking_rent_cop: decimalToNumber(
          listing.monthly_asking_rent_cop,
        ),
        observed_at: listing.collected_at,
      },
      field_provenance: listing.field_provenance,
    },
  };
}
