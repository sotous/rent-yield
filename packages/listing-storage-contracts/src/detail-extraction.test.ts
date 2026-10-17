import { describe, expect, it } from "vitest";
import {
  extractSafeDetailFields,
  safeDetailExtractionContractSchema,
} from "./detail-extraction.js";

const sha256 = "a".repeat(64);
const contract = {
  contract_version: "v1",
  extraction_contract_id: "generic-detail-v1",
  extraction_contract_sha256: sha256,
  source_key: "example-source",
  mappings: [
    {
      field: "source_listing_id",
      input_key: "listing_id",
      transforms: ["trim"],
      required: true,
    },
    {
      field: "asking_amount",
      input_key: "monthly_rent",
      transforms: ["parse_decimal"],
      required: true,
    },
    {
      field: "currency",
      input_key: "currency",
      transforms: ["parse_currency"],
      required: true,
    },
    {
      field: "listing_role",
      input_key: "operation",
      transforms: ["map_listing_role"],
      required: true,
    },
  ],
} as const;

describe("safe detail extraction contract", () => {
  it("emits only allowlisted normalized values and non-sensitive provenance", () => {
    const result = extractSafeDetailFields({
      contract,
      input: {
        contract_version: "v1",
        source_key: "example-source",
        extraction_contract_id: "generic-detail-v1",
        extraction_contract_sha256: sha256,
        values: {
          listing_id: " rent-123 ",
          monthly_rent: "1800000.00",
          currency: "cop",
          operation: "rent",
        },
      },
    });

    expect(result).toEqual({
      kind: "extracted",
      values: {
        source_listing_id: "rent-123",
        listing_url: null,
        listing_role: "for_rent",
        asking_amount: "1800000",
        currency: "COP",
        frequency: null,
        fee_scope: null,
        built_area_sqm: null,
        property_type: null,
        rental_basis: null,
        listing_status: null,
        city: null,
        area: null,
      },
      provenance: [
        {
          field: "source_listing_id",
          input_key: "listing_id",
          transforms: ["trim"],
          transform_version: "detail-safe-transforms-v1",
        },
        {
          field: "asking_amount",
          input_key: "monthly_rent",
          transforms: ["parse_decimal"],
          transform_version: "detail-safe-transforms-v1",
        },
        {
          field: "currency",
          input_key: "currency",
          transforms: ["parse_currency"],
          transform_version: "detail-safe-transforms-v1",
        },
        {
          field: "listing_role",
          input_key: "operation",
          transforms: ["map_listing_role"],
          transform_version: "detail-safe-transforms-v1",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("1800000.00");
  });

  it("fails closed for mismatched provenance, missing required fields, unknown input, and nested payloads", () => {
    const validInput = {
      contract_version: "v1" as const,
      source_key: "example-source",
      extraction_contract_id: "generic-detail-v1",
      extraction_contract_sha256: sha256,
      values: {
        listing_id: "rent-123",
        monthly_rent: "1800000",
        currency: "COP",
        operation: "rent",
      },
    };
    expect(
      extractSafeDetailFields({
        contract,
        input: { ...validInput, extraction_contract_sha256: "b".repeat(64) },
      }),
    ).toEqual({ kind: "rejected", reason: "contract_mismatch" });
    expect(
      extractSafeDetailFields({
        contract,
        input: {
          ...validInput,
          values: { ...validInput.values, operation: null },
        },
      }),
    ).toEqual({
      kind: "rejected",
      reason: "missing_required_field",
      field: "listing_role",
    });
    expect(
      extractSafeDetailFields({
        contract,
        input: {
          ...validInput,
          values: { ...validInput.values, title: "do not retain me" },
        },
      }),
    ).toEqual({ kind: "rejected", reason: "unmapped_input" });
    expect(
      extractSafeDetailFields({
        contract,
        input: {
          ...validInput,
          values: { ...validInput.values, listing_id: { nested: "payload" } },
        },
      }),
    ).toEqual({ kind: "rejected", reason: "unsafe_input" });
  });

  it("rejects source-configured traversal locators and unsafe output fields", () => {
    for (const mapping of [
      { ...contract.mappings[0], input_key: "/script/contact" },
      { ...contract.mappings[0], field: "title" },
    ]) {
      expect(
        safeDetailExtractionContractSchema.safeParse({
          ...contract,
          mappings: [mapping],
        }).success,
      ).toBe(false);
    }
  });

  it("publishes the reviewed contract without publishing a raw payload schema", async () => {
    const { contractSchemas } = await import("./catalog.js");
    expect(contractSchemas).toHaveProperty("safe_detail_extraction_contract");
    expect(contractSchemas).not.toHaveProperty("detail_payload");
  });
});
