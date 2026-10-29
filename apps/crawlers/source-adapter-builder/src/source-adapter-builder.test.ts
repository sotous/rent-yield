import { describe, expect, it } from "vitest";

import { buildSourceAdapter } from "./source-adapter-builder.js";

const candidate = {
  sourceKey: "example-baq-listings",
  sourceName: "Example Barranquilla Listings",
  sourceUrl: "https://example.test",
  countryCode: "CO",
  cityName: "Barranquilla",
  operations: {
    rent: {
      requestUrl: "https://example.test/api/properties?operation=rent",
      extractionRecipe: {
        contentType: "application/json",
        listingCollectionPath: "results.items",
        fields: {
          id: "id",
          priceCop: "rent.amount",
          builtAreaSqm: "area",
          bedrooms: "bedrooms",
          neighborhood: "neighborhood",
          listingUrl: "url",
        },
      },
    },
    sale: {
      requestUrl: "https://example.test/api/properties?operation=sale",
      extractionRecipe: {
        contentType: "application/json",
        listingCollectionPath: "data.properties",
        fields: {
          id: "code",
          priceCop: "sale.amount",
          builtAreaSqm: "built_area",
          bedrooms: "rooms",
        },
      },
    },
  },
};

const observedAt = "2026-10-28T12:00:00.000Z";

describe("buildSourceAdapter", () => {
  it("parses rent and sale responses with operation-specific recipes", () => {
    const result = buildSourceAdapter(candidate);

    expect(result.kind).toBe("built");
    if (result.kind !== "built") throw new Error("expected a built adapter");

    expect(result.adapter.supportedOperations).toEqual(["rent", "sale"]);
    expect(result.adapter.sourceUrls).toEqual({
      rent: candidate.operations.rent.requestUrl,
      sale: candidate.operations.sale.requestUrl,
    });
    expect(
      result.adapter.parse({
        operation: "rent",
        sourceUrl: candidate.operations.rent.requestUrl,
        contentType: "application/json",
        observedAt,
        body: JSON.stringify({
          results: {
            items: [
              {
                id: "rental-1",
                rent: { amount: 1800000 },
                area: 80,
                bedrooms: 2,
                neighborhood: "Alto Prado",
                url: "https://example.test/listings/rental-1",
              },
            ],
          },
        }),
      }),
    ).toEqual({
      kind: "parsed",
      listings: [
        {
          sourceKey: "example-baq-listings",
          sourceListingId: "rental-1",
          operation: "rent",
          priceCop: 1800000,
          builtAreaSqm: 80,
          bedrooms: 2,
          neighborhood: "Alto Prado",
          listingUrl: "https://example.test/listings/rental-1",
          observedAt,
        },
      ],
    });
    expect(
      result.adapter.parse({
        operation: "sale",
        sourceUrl: candidate.operations.sale.requestUrl,
        contentType: "application/json",
        observedAt,
        body: JSON.stringify({
          data: {
            properties: [
              {
                code: "sale-1",
                sale: { amount: 420000000 },
                built_area: 95,
                rooms: 3,
              },
            ],
          },
        }),
      }),
    ).toEqual({
      kind: "parsed",
      listings: [
        {
          sourceKey: "example-baq-listings",
          sourceListingId: "sale-1",
          operation: "sale",
          priceCop: 420000000,
          builtAreaSqm: 95,
          bedrooms: 3,
          observedAt,
        },
      ],
    });
  });

  it.each([
    [
      "an unsupported operation",
      "transfer",
      "unsupported_operation",
      undefined,
    ],
    [
      "a rent response with the sale URL",
      "rent",
      "source_url_drift",
      candidate.operations.sale.requestUrl,
    ],
  ])("rejects %s", (_scenario, operation, code, sourceUrl) => {
    const built = buildSourceAdapter(candidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");
    expect(
      built.adapter.parse({
        operation: operation as "rent" | "sale",
        sourceUrl: sourceUrl ?? candidate.operations.rent.requestUrl,
        contentType: "application/json",
        observedAt,
        body: JSON.stringify({ results: { items: [] } }),
      }),
    ).toEqual({ kind: "parse_failed", code });
  });

  it("keeps a single-operation adapter limited to its configured operation", () => {
    const singleOperation = {
      ...candidate,
      operations: { rent: candidate.operations.rent },
    };
    const built = buildSourceAdapter(singleOperation);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(built.adapter.supportedOperations).toEqual(["rent"]);
    expect(
      built.adapter.parse({
        operation: "sale",
        sourceUrl: candidate.operations.sale.requestUrl,
        contentType: "application/json",
        observedAt,
        body: JSON.stringify({ data: { properties: [] } }),
      }),
    ).toEqual({ kind: "parse_failed", code: "unsupported_operation" });
  });

  it("fails the whole response when any listing omits a required mapped field", () => {
    const built = buildSourceAdapter(candidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(
      built.adapter.parse({
        operation: "rent",
        sourceUrl: candidate.operations.rent.requestUrl,
        contentType: "application/json",
        observedAt,
        body: JSON.stringify({
          results: {
            items: [{ id: "valid", rent: { amount: 100 } }, { id: "invalid" }],
          },
        }),
      }),
    ).toEqual({ kind: "parse_failed", code: "invalid_listing" });
  });

  it.each([
    [
      "a mismatched content type",
      "text/html",
      '{"results":{"items":[]}}',
      "content_type_drift",
    ],
    ["invalid JSON", "application/json", "not-json", "invalid_json"],
    ["a missing collection", "application/json", "{}", "missing_collection"],
  ])("returns a typed failure for %s", (_scenario, contentType, body, code) => {
    const built = buildSourceAdapter(candidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");
    expect(
      built.adapter.parse({
        operation: "rent",
        sourceUrl: candidate.operations.rent.requestUrl,
        contentType: contentType as "application/json" | "text/html",
        observedAt,
        body,
      }),
    ).toEqual({ kind: "parse_failed", code });
  });

  it("rejects an adapter configuration with no JSON-supported operation", () => {
    expect(
      buildSourceAdapter({
        ...candidate,
        operations: {
          rent: {
            ...candidate.operations.rent,
            extractionRecipe: {
              ...candidate.operations.rent.extractionRecipe,
              contentType: "text/html",
            },
          },
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
