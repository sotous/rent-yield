import { describe, expect, it } from "vitest";

import { validateAdapterCandidate } from "./adapter-candidate.js";

const validCandidate = {
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
      listingUrl: "url",
    },
  },
};

describe("validateAdapterCandidate", () => {
  it("accepts a complete adapter candidate as a sanitized validation result", () => {
    expect(validateAdapterCandidate(validCandidate)).toEqual({
      kind: "accepted",
      candidate: {
        sourceKey: "example-baq-rentals",
        sourceName: "Example Barranquilla Rentals",
        countryCode: "CO",
        cityName: "Barranquilla",
        supportedOperations: ["rent"],
        extractionRecipe: {
          contentType: "application/json",
          listingCollectionPath: "results.items",
          fieldNames: ["id", "listingUrl", "priceCop"],
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
      { ...validCandidate, supportedOperations: [] },
      "invalid_operations",
    ],
    [
      "duplicate operations",
      { ...validCandidate, supportedOperations: ["rent", "rent"] },
      "invalid_operations",
    ],
    [
      "an unsupported content type",
      {
        ...validCandidate,
        extractionRecipe: {
          ...validCandidate.extractionRecipe,
          contentType: "text/xml",
        },
      },
      "invalid_extraction_recipe",
    ],
    [
      "an empty field mapping",
      {
        ...validCandidate,
        extractionRecipe: { ...validCandidate.extractionRecipe, fields: {} },
      },
      "invalid_extraction_recipe",
    ],
  ])("rejects %s", (_scenario, candidate, code) => {
    expect(validateAdapterCandidate(candidate)).toEqual({
      kind: "rejected",
      code,
    });
  });

  it("does not return the source URL in an acceptance receipt", () => {
    const receipt = validateAdapterCandidate(validCandidate);

    expect(JSON.stringify(receipt)).not.toContain(validCandidate.sourceUrl);
  });
});
