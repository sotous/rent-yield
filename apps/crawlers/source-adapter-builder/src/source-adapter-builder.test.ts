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
    expect(result.adapter.sourceRequests).toEqual({
      rent: [
        {
          requestKey: "default",
          requestUrl: candidate.operations.rent.requestUrl,
        },
      ],
      sale: [
        {
          requestKey: "default",
          requestUrl: candidate.operations.sale.requestUrl,
        },
      ],
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

  it("normalizes an explicit property type mapping and social stratum", () => {
    const enrichedCandidate = {
      ...candidate,
      operations: {
        rent: {
          ...candidate.operations.rent,
          extractionRecipe: {
            ...candidate.operations.rent.extractionRecipe,
            propertyType: {
              mode: "field",
              field: "property_type",
              values: {
                Apartamento: "apartment",
                Casa: "house",
              },
            },
            fields: {
              ...candidate.operations.rent.extractionRecipe.fields,
              socialStratum: "social_stratum",
            },
          },
        },
      },
    };
    const built = buildSourceAdapter(enrichedCandidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(
      built.adapter.parse({
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
                property_type: "Apartamento",
                social_stratum: 4,
              },
            ],
          },
        }),
      }),
    ).toMatchObject({
      kind: "parsed",
      listings: [
        {
          sourceListingId: "rental-1",
          operation: "rent",
          propertyType: "apartment",
          socialStratum: 4,
        },
      ],
    });
  });

  it("supports a verified constant property type for a category-scoped operation", () => {
    const categoryCandidate = {
      ...candidate,
      operations: {
        rent: {
          ...candidate.operations.rent,
          extractionRecipe: {
            ...candidate.operations.rent.extractionRecipe,
            propertyType: { mode: "constant", value: "apartment" },
          },
        },
      },
    };
    const built = buildSourceAdapter(categoryCandidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    const result = built.adapter.parse({
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
    });

    expect(result).toMatchObject({
      kind: "parsed",
      listings: [{ propertyType: "apartment" }],
    });
  });

  it("parses multiple category-scoped requests for the same operation", () => {
    const multiTypeCandidate = {
      ...candidate,
      operations: {
        rent: {
          requests: [
            {
              requestKey: "apartment",
              requestUrl: "https://example.test/rent/apartment",
              extractionRecipe: {
                ...candidate.operations.rent.extractionRecipe,
                propertyType: { mode: "constant", value: "apartment" },
              },
            },
            {
              requestKey: "house",
              requestUrl: "https://example.test/rent/house",
              extractionRecipe: {
                ...candidate.operations.rent.extractionRecipe,
                propertyType: { mode: "constant", value: "house" },
              },
            },
          ],
        },
      },
    };
    const built = buildSourceAdapter(multiTypeCandidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(built.adapter.sourceRequests.rent).toEqual([
      {
        requestKey: "apartment",
        requestUrl: "https://example.test/rent/apartment",
      },
      {
        requestKey: "house",
        requestUrl: "https://example.test/rent/house",
      },
    ]);
    expect(
      built.adapter.parse({
        operation: "rent",
        sourceUrl: "https://example.test/rent/house",
        contentType: "application/json",
        observedAt,
        body: JSON.stringify({
          results: {
            items: [
              {
                id: "house-1",
                rent: { amount: 2200000 },
                area: 120,
                bedrooms: 3,
                neighborhood: "Alto Prado",
                url: "https://example.test/listings/house-1",
              },
            ],
          },
        }),
      }),
    ).toMatchObject({
      kind: "parsed",
      listings: [
        {
          sourceListingId: "house-1",
          operation: "rent",
          propertyType: "house",
        },
      ],
    });
  });

  it("extracts type and stratum recipes from static HTML cards", () => {
    const htmlCandidate = {
      ...candidate,
      operations: {
        rent: {
          requestUrl: "https://example.test/apartments/rent",
          extractionRecipe: {
            format: "html",
            contentType: "text/html",
            listingSelector: "article.card",
            propertyType: {
              mode: "field",
              field: { selector: ".property-type" },
              values: { Apartamento: "apartment" },
            },
            fields: {
              id: { selector: "[data-id]", attribute: "data-id" },
              priceCop: { selector: ".price", numberFormat: "cop" },
              socialStratum: { selector: ".stratum" },
            },
          },
        },
      },
    };
    const built = buildSourceAdapter(htmlCandidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(
      built.adapter.parse({
        operation: "rent",
        sourceUrl: "https://example.test/apartments/rent",
        contentType: "text/html; charset=utf-8",
        observedAt,
        body: `<article class="card"><span data-id="property-1"></span><span class="property-type">Apartamento</span><span class="price">$2.500.000</span><span class="stratum">Estrato 4</span></article>`,
      }),
    ).toMatchObject({
      kind: "parsed",
      listings: [
        {
          sourceListingId: "property-1",
          priceCop: 2500000,
          propertyType: "apartment",
          socialStratum: 4,
        },
      ],
    });
  });

  it.each([0, 7, 4.5, "unknown"])(
    "rejects invalid mapped social stratum %s",
    (socialStratum) => {
      const enrichedCandidate = {
        ...candidate,
        operations: {
          rent: {
            ...candidate.operations.rent,
            extractionRecipe: {
              ...candidate.operations.rent.extractionRecipe,
              fields: {
                ...candidate.operations.rent.extractionRecipe.fields,
                socialStratum: "social_stratum",
              },
            },
          },
        },
      };
      const built = buildSourceAdapter(enrichedCandidate);
      if (built.kind !== "built") throw new Error("expected a built adapter");

      expect(
        built.adapter.parse({
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
                  social_stratum: socialStratum,
                },
              ],
            },
          }),
        }),
      ).toEqual({ kind: "parse_failed", code: "invalid_listing" });
    },
  );

  it("rejects a source property type that is not in the explicit mapping", () => {
    const enrichedCandidate = {
      ...candidate,
      operations: {
        rent: {
          ...candidate.operations.rent,
          extractionRecipe: {
            ...candidate.operations.rent.extractionRecipe,
            propertyType: {
              mode: "field",
              field: "property_type",
              values: { Apartamento: "apartment" },
            },
          },
        },
      },
    };
    const built = buildSourceAdapter(enrichedCandidate);
    if (built.kind !== "built") throw new Error("expected a built adapter");

    expect(
      built.adapter.parse({
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
                property_type: "Local comercial",
              },
            ],
          },
        }),
      }),
    ).toEqual({ kind: "parse_failed", code: "invalid_listing" });
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
