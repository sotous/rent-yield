import { describe, expect, it } from "vitest";
import { rentalEvidenceSchema, extractionOutcomeSchema } from "./extraction.js";
import { extractionMappingSchema } from "./research.js";

const evidence = {
  origin: "observed_listing",
  listing_role: "for_rent",
  currency: "COP",
  frequency: "monthly",
  fee_scope: "base",
  rental_basis: "long_term",
  listing_status: "active",
  property_type: "apartment",
  source_key: "example",
  source_listing_id: "123",
  listing_url: null,
  collected_at: "2026-09-12T12:00:00.000Z",
  asking_amount: "1800000",
  built_area_sqm: "72",
};

describe("offline extraction contracts", () => {
  it("admits only positive observed base monthly COP residential rental evidence", () => {
    expect(rentalEvidenceSchema.safeParse(evidence).success).toBe(true);
    for (const patch of [
      { origin: "synthetic" },
      { listing_role: "for_sale" },
      { currency: "USD" },
      { frequency: "daily" },
      { fee_scope: "includes_admin" },
      { rental_basis: "short_stay" },
      { listing_status: "inactive" },
      { asking_amount: "0" },
      { asking_amount: "-1" },
      { built_area_sqm: null },
      { sale_price: "500000000" },
      { modeled_rent: "1800000" },
      { source_listing_id: null, listing_url: null },
    ])
      expect(
        rentalEvidenceSchema.safeParse({ ...evidence, ...patch }).success,
      ).toBe(false);
  });
  it("extends declarative mappings for locator, rental basis and distinct area claims", () => {
    for (const field of [
      "listing_url",
      "rental_basis",
      "built_area_sqm",
      "private_area_sqm",
      "interior_area_sqm",
      "alias",
    ]) {
      expect(
        extractionMappingSchema.safeParse({
          field,
          locator: { kind: "json_pointer", pointer: "/url" },
          transforms: ["identity"],
          required: false,
        }).success,
      ).toBe(true);
    }
  });
  it("does not accept fabricated observations on parse failure or empty normalization", () => {
    expect(
      extractionOutcomeSchema.safeParse({
        contract_version: "v1",
        kind: "normalized",
        observations: [],
        rental_evidence: [],
        issues: [],
      }).success,
    ).toBe(false);
    expect(
      extractionOutcomeSchema.safeParse({
        contract_version: "v1",
        kind: "parse_failed",
        observations: [{}],
        rental_evidence: [],
        issues: [],
      }).success,
    ).toBe(false);
  });
});

it("publishes extraction result and rental evidence in the shared catalog", async () => {
  const { contractSchemas, contractJsonSchemas } = await import("./catalog.js");
  expect(contractSchemas).toHaveProperty("extraction_outcome");
  expect(contractSchemas).toHaveProperty("rental_evidence");
  expect(contractJsonSchemas).toHaveProperty("extraction_outcome");
});
