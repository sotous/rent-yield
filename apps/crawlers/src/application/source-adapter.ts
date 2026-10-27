import { z } from "zod";
import {
  instantSchema,
  listingInputSchema,
  type ListingInput,
} from "@rent-yield/listing-storage-contracts";

export const sourceFixtureContentTypeSchema = z.enum([
  "application/json",
  "text/html",
]);
export const sourceFixtureSchema = z.strictObject({
  source_key: z.string().min(1),
  collected_at: instantSchema,
  content_type: sourceFixtureContentTypeSchema,
  body: z.string(),
});

export type SourceFixture = z.infer<typeof sourceFixtureSchema>;
export type SourceFixtureContentType = z.infer<
  typeof sourceFixtureContentTypeSchema
>;
export type SourceAdapterParseFailureCode =
  | "invalid_fixture"
  | "source_mismatch"
  | "unsupported_content_type"
  | "unsupported_shape"
  | "invalid_listing_input";
export type SourceAdapterResult =
  | { kind: "listed"; listings: readonly ListingInput[] }
  | { kind: "parse_failed"; code: SourceAdapterParseFailureCode };

/** Fixture-only source-format boundary; it has no transport or network inputs. */
export type SourceAdapter = {
  source_key: string;
  supported_content_types: readonly SourceFixtureContentType[];
  parseFixture(input: SourceFixture): SourceAdapterResult;
};

/**
 * Validates generic fixture and output invariants before a source-local parser
 * result can cross into the shared ListingInput boundary.
 */
export function parseSourceFixture(
  adapter: SourceAdapter,
  input: unknown,
): SourceAdapterResult {
  const fixture = sourceFixtureSchema.safeParse(input);
  if (!fixture.success)
    return { kind: "parse_failed", code: "invalid_fixture" };
  if (fixture.data.source_key !== adapter.source_key)
    return { kind: "parse_failed", code: "source_mismatch" };
  if (!adapter.supported_content_types.includes(fixture.data.content_type))
    return { kind: "parse_failed", code: "unsupported_content_type" };

  const result = adapter.parseFixture(fixture.data);
  if (result.kind === "parse_failed") return result;
  if (
    result.listings.some(
      (listing) =>
        listing.source_key !== adapter.source_key ||
        !listingInputSchema.safeParse(listing).success,
    )
  )
    return { kind: "parse_failed", code: "invalid_listing_input" };
  return result;
}
