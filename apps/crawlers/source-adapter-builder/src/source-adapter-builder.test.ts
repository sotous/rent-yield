import { describe, expect, it } from "vitest";

import { buildSourceAdapter } from "./source-adapter-builder.js";

const candidate = {
  sourceKey: "example-baq-rentals",
  sourceName: "Example Barranquilla Rentals",
  sourceUrl: "https://example.test/barranquilla/rentals",
  countryCode: "CO",
  cityName: "Barranquilla",
  supportedOperations: ["rent"],
  extractionRecipe: {
    contentType: "application/json",
    listingCollectionPath: "results.items",
    fields: {
      id: "id",
      priceCop: "price.amount",
      builtAreaSqm: "area",
      bedrooms: "bedrooms",
      neighborhood: "neighborhood",
      listingUrl: "url",
    },
  },
};

describe("buildSourceAdapter", () => {
  it("builds an adapter that parses an explicit JSON response into ordered ListingInput rows", () => {
    const result = buildSourceAdapter(candidate);

    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected a built adapter");
    expect(
      result.adapter.parse({
        sourceUrl: candidate.sourceUrl,
        contentType: "application/json",
        observedAt: "2026-10-28T12:00:00.000Z",
        body: JSON.stringify({
          results: {
            items: [
              {
                id: "rental-1",
                price: { amount: 1800000 },
                area: 80,
                bedrooms: 2,
                neighborhood: "Alto Prado",
                url: "https://example.test/listings/rental-1",
              },
              {
                id: "rental-2",
                price: { amount: 2100000 },
                area: 92,
                bedrooms: 3,
                neighborhood: "El Prado",
                url: "https://example.test/listings/rental-2",
              },
            ],
          },
        }),
      }),
    ).toEqual({
      kind: "parsed",
      listings: [
        {
          sourceKey: "example-baq-rentals",
          sourceListingId: "rental-1",
          operation: "rent",
          priceCop: 1800000,
          builtAreaSqm: 80,
          bedrooms: 2,
          neighborhood: "Alto Prado",
          listingUrl: "https://example.test/listings/rental-1",
          observedAt: "2026-10-28T12:00:00.000Z",
        },
        {
          sourceKey: "example-baq-rentals",
          sourceListingId: "rental-2",
          operation: "rent",
          priceCop: 2100000,
          builtAreaSqm: 92,
          bedrooms: 3,
          neighborhood: "El Prado",
          listingUrl: "https://example.test/listings/rental-2",
          observedAt: "2026-10-28T12:00:00.000Z",
        },
      ],
    });
  });

  it("fails the whole response when any listing omits a required mapped field", () => {
    const built = buildSourceAdapter(candidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(
      built.adapter.parse({
        sourceUrl: candidate.sourceUrl,
        contentType: "application/json",
        observedAt: "2026-10-28T12:00:00.000Z",
        body: JSON.stringify({
          results: {
            items: [{ id: "valid", price: { amount: 100 } }, { id: "invalid" }],
          },
        }),
      }),
    ).toEqual({ kind: "parse_failed", code: "invalid_listing" });
  });

  it("does not build mixed-operation or HTML candidates", () => {
    expect(
      buildSourceAdapter({
        ...candidate,
        supportedOperations: ["rent", "sale"],
      }),
    ).toEqual({ kind: "build_failed", code: "unsupported_candidate" });
    expect(
      buildSourceAdapter({
        ...candidate,
        extractionRecipe: {
          ...candidate.extractionRecipe,
          contentType: "text/html",
        },
      }),
    ).toEqual({ kind: "build_failed", code: "unsupported_candidate" });
  });

  it("returns a typed failure for malformed builder input", () => {
    expect(buildSourceAdapter(null)).toEqual({
      kind: "build_failed",
      code: "unsupported_candidate",
    });
  });
});
