import { describe, expect, it } from "vitest";

import { validateAdapterCandidate } from "./adapter-candidate.js";

const rentRecipe = {
  requestUrl: "https://example.test/api/properties?operation=rent",
  extractionRecipe: {
    contentType: "application/json",
    listingCollectionPath: "results.items",
    fields: {
      id: "id",
      priceCop: "price.amount",
      listingUrl: "url",
    },
  },
};

const saleRecipe = {
  requestUrl: "https://example.test/api/properties?operation=sale",
  extractionRecipe: {
    contentType: "application/json",
    listingCollectionPath: "data.listings",
    fields: {
      id: "code",
      priceCop: "sale_price",
    },
  },
};

const validCandidate = {
  sourceKey: "example-baq",
  sourceName: "Example Barranquilla Listings",
  sourceUrl: "https://example.test",
  countryCode: "CO",
  cityName: "Barranquilla",
  operations: { rent: rentRecipe },
};

describe("validateAdapterCandidate", () => {
  it("accepts a complete single-operation candidate without exposing URLs", () => {
    expect(validateAdapterCandidate(validCandidate)).toEqual({
      kind: "accepted",
      candidate: {
        sourceKey: "example-baq",
        sourceName: "Example Barranquilla Listings",
        countryCode: "CO",
        cityName: "Barranquilla",
        supportedOperations: ["rent"],
        operations: {
          rent: {
            contentType: "application/json",
            listingCollectionPath: "results.items",
            fieldNames: ["id", "listingUrl", "priceCop"],
          },
        },
      },
    });

    expect(
      JSON.stringify(validateAdapterCandidate(validCandidate)),
    ).not.toContain(rentRecipe.requestUrl);
  });

  it("accepts both operations with independent request URLs and recipes", () => {
    expect(
      validateAdapterCandidate({
        ...validCandidate,
        operations: { rent: rentRecipe, sale: saleRecipe },
      }),
    ).toMatchObject({
      kind: "accepted",
      candidate: {
        supportedOperations: ["rent", "sale"],
        operations: {
          rent: { listingCollectionPath: "results.items" },
          sale: { listingCollectionPath: "data.listings" },
        },
      },
    });
  });

  it.each([
    ["a malformed root", null, "invalid_candidate"],
    [
      "an unsupported geography",
      { ...validCandidate, countryCode: "US" },
      "unsupported_geography",
    ],
    [
      "an unsupported city",
      { ...validCandidate, cityName: "Cartagena" },
      "unsupported_geography",
    ],
    [
      "a noncanonical source key",
      { ...validCandidate, sourceKey: "Example Source" },
      "invalid_source_key",
    ],
    [
      "no supported operation",
      { ...validCandidate, operations: {} },
      "invalid_operations",
    ],
    [
      "an unsupported operation",
      { ...validCandidate, operations: { transfer: rentRecipe } },
      "invalid_operations",
    ],
    [
      "an unsupported content type",
      {
        ...validCandidate,
        operations: {
          rent: {
            ...rentRecipe,
            extractionRecipe: {
              ...rentRecipe.extractionRecipe,
              contentType: "text/xml",
            },
          },
        },
      },
      "invalid_extraction_recipe",
    ],
    [
      "an empty field mapping",
      {
        ...validCandidate,
        operations: {
          rent: {
            ...rentRecipe,
            extractionRecipe: { ...rentRecipe.extractionRecipe, fields: {} },
          },
        },
      },
      "invalid_extraction_recipe",
    ],
    [
      "an operation with an unsafe request URL",
      {
        ...validCandidate,
        operations: {
          rent: { ...rentRecipe, requestUrl: "http://example.test/listings" },
        },
      },
      "invalid_source_url",
    ],
  ])("rejects %s", (_scenario, candidate, code) => {
    expect(validateAdapterCandidate(candidate)).toEqual({
      kind: "rejected",
      code,
    });
  });
});
