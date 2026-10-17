import { z } from "zod";
import {
  decimalSchema,
  identifierSchema,
  positiveDecimalSchema,
  sha256Schema,
} from "./primitives.js";

const transformVersion = "detail-safe-transforms-v1";
const safeInputKeySchema = identifierSchema.refine(
  (value) =>
    !/[./]/.test(value) &&
    !["__proto__", "constructor", "prototype"].includes(value),
  "Detail input keys must be flat, non-traversal identifiers",
);
const safeScalarSchema = z.union([
  z.string().max(512),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);
const canonicalDetailUrlSchema = z
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
  }, "Detail listing URL must be canonical credential-free HTTPS");

/** The only source claims permitted to cross the detail extraction boundary. */
export const safeDetailFieldSchema = z.enum([
  "source_listing_id",
  "listing_url",
  "listing_role",
  "asking_amount",
  "currency",
  "frequency",
  "fee_scope",
  "built_area_sqm",
  "property_type",
  "rental_basis",
  "listing_status",
  "city",
  "area",
]);
const detailTransformSchema = z.enum([
  "identity",
  "trim",
  "parse_decimal",
  "parse_currency",
  "parse_frequency",
  "map_listing_role",
  "map_fee_scope",
  "map_residential_type",
  "map_rental_basis",
  "map_listing_status",
]);
const mappingSchema = z.strictObject({
  field: safeDetailFieldSchema,
  input_key: safeInputKeySchema,
  transforms: z.array(detailTransformSchema).min(1),
  required: z.boolean(),
});

/**
 * A reviewed, source-configured map over a pre-redacted flat scalar bag.
 * It never accepts raw HTML, JSON, DOM paths, or arbitrary payload traversal.
 */
export const safeDetailExtractionContractSchema = z
  .strictObject({
    contract_version: z.literal("v1"),
    extraction_contract_id: identifierSchema,
    extraction_contract_sha256: sha256Schema,
    source_key: identifierSchema,
    mappings: z.array(mappingSchema).min(1).max(13),
  })
  .superRefine((contract, context) => {
    const fields = new Set<string>();
    const inputKeys = new Set<string>();
    for (const [index, mapping] of contract.mappings.entries()) {
      if (fields.has(mapping.field))
        context.addIssue({
          code: "custom",
          path: ["mappings", index, "field"],
          message: "Detail output fields must be mapped at most once",
        });
      fields.add(mapping.field);
      if (inputKeys.has(mapping.input_key))
        context.addIssue({
          code: "custom",
          path: ["mappings", index, "input_key"],
          message: "Detail input keys must be mapped at most once",
        });
      inputKeys.add(mapping.input_key);
    }
  });

export const safeDetailExtractionInputSchema = z.strictObject({
  contract_version: z.literal("v1"),
  source_key: identifierSchema,
  extraction_contract_id: identifierSchema,
  extraction_contract_sha256: sha256Schema,
  values: z.record(safeInputKeySchema, safeScalarSchema),
});

const safeDetailValuesSchema = z.strictObject({
  source_listing_id: identifierSchema.nullable(),
  listing_url: canonicalDetailUrlSchema.nullable(),
  listing_role: z.literal("for_rent").nullable(),
  asking_amount: positiveDecimalSchema.nullable(),
  currency: z.literal("COP").nullable(),
  frequency: z.literal("monthly").nullable(),
  fee_scope: z.literal("base").nullable(),
  built_area_sqm: positiveDecimalSchema.nullable(),
  property_type: z
    .enum(["apartment", "house", "studio", "other_residential"])
    .nullable(),
  rental_basis: z.literal("long_term").nullable(),
  listing_status: z.literal("active").nullable(),
  city: z.string().trim().min(1).max(128).nullable(),
  area: z.string().trim().min(1).max(128).nullable(),
});
export const safeDetailFieldProvenanceSchema = z.strictObject({
  field: safeDetailFieldSchema,
  input_key: safeInputKeySchema,
  transforms: z.array(detailTransformSchema).min(1),
  transform_version: z.literal(transformVersion),
});

export const safeDetailExtractionResultSchema = z.union([
  z.strictObject({
    kind: z.literal("extracted"),
    values: safeDetailValuesSchema,
    provenance: z.array(safeDetailFieldProvenanceSchema).min(1),
  }),
  z.strictObject({
    kind: z.literal("rejected"),
    reason: z.literal("unsafe_input"),
  }),
  z.strictObject({
    kind: z.literal("rejected"),
    reason: z.literal("contract_mismatch"),
  }),
  z.strictObject({
    kind: z.literal("rejected"),
    reason: z.literal("unmapped_input"),
  }),
  z.strictObject({
    kind: z.literal("rejected"),
    reason: z.literal("missing_required_field"),
    field: safeDetailFieldSchema,
  }),
  z.strictObject({
    kind: z.literal("rejected"),
    reason: z.literal("invalid_mapped_value"),
    field: safeDetailFieldSchema,
  }),
]);

export type SafeDetailExtractionContract = z.infer<
  typeof safeDetailExtractionContractSchema
>;
export type SafeDetailExtractionInput = z.infer<
  typeof safeDetailExtractionInputSchema
>;
export type SafeDetailExtractionResult = z.infer<
  typeof safeDetailExtractionResultSchema
>;

function normalizeDecimal(value: unknown): string | null {
  const text = typeof value === "number" ? String(value) : value;
  if (
    typeof text !== "string" ||
    !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text.trim())
  )
    return null;
  let normalized = text.trim();
  if (normalized.includes("."))
    normalized = normalized.replace(/0+$/, "").replace(/\.$/, "");
  if (normalized === "-0") normalized = "0";
  return decimalSchema.safeParse(normalized).success ? normalized : null;
}

function transform(
  value: z.infer<typeof safeScalarSchema>,
  method: z.infer<typeof detailTransformSchema>,
): unknown {
  if (value === null) return null;
  if (method === "identity") return value;
  if (method === "parse_decimal") return normalizeDecimal(value);
  if (typeof value !== "string") return null;
  const text = value.trim();
  switch (method) {
    case "trim":
      return text;
    case "parse_currency":
      return text.toUpperCase() === "COP" ? "COP" : null;
    case "parse_frequency":
      return ["monthly", "mensual"].includes(text.toLowerCase())
        ? "monthly"
        : null;
    case "map_listing_role":
      return ["rent", "arriendo", "for_rent"].includes(text.toLowerCase())
        ? "for_rent"
        : null;
    case "map_fee_scope":
      return ["base", "canon"].includes(text.toLowerCase()) ? "base" : null;
    case "map_residential_type": {
      const types: Record<string, string> = {
        apartment: "apartment",
        apartamento: "apartment",
        house: "house",
        casa: "house",
        studio: "studio",
        apartaestudio: "studio",
        other_residential: "other_residential",
      };
      return types[text.toLowerCase()] ?? null;
    }
    case "map_rental_basis":
      return ["long_term", "long-term", "larga_estadia"].includes(
        text.toLowerCase(),
      )
        ? "long_term"
        : null;
    case "map_listing_status":
      return ["active", "available", "activo"].includes(text.toLowerCase())
        ? "active"
        : null;
  }
}

/**
 * Normalizes a pre-redacted flat scalar bag. Any nested value, unmapped key,
 * provenance mismatch, or malformed mapped claim fails closed without
 * returning a partial observation or raw source value.
 */
export function extractSafeDetailFields(input: {
  contract: unknown;
  input: unknown;
}): SafeDetailExtractionResult {
  const contract = safeDetailExtractionContractSchema.safeParse(input.contract);
  const extractionInput = safeDetailExtractionInputSchema.safeParse(
    input.input,
  );
  if (!contract.success || !extractionInput.success)
    return { kind: "rejected", reason: "unsafe_input" };
  if (
    contract.data.source_key !== extractionInput.data.source_key ||
    contract.data.extraction_contract_id !==
      extractionInput.data.extraction_contract_id ||
    contract.data.extraction_contract_sha256 !==
      extractionInput.data.extraction_contract_sha256
  )
    return { kind: "rejected", reason: "contract_mismatch" };

  const mappingsByKey = new Map(
    contract.data.mappings.map((mapping) => [mapping.input_key, mapping]),
  );
  if (
    Object.keys(extractionInput.data.values).some(
      (key) => !mappingsByKey.has(key),
    )
  )
    return { kind: "rejected", reason: "unmapped_input" };

  const values: Record<string, unknown> = Object.fromEntries(
    safeDetailFieldSchema.options.map((field) => [field, null]),
  );
  const provenance: z.infer<typeof safeDetailFieldProvenanceSchema>[] = [];
  for (const mapping of contract.data.mappings) {
    const raw = extractionInput.data.values[mapping.input_key];
    if (raw === undefined || raw === null) {
      if (mapping.required)
        return {
          kind: "rejected",
          reason: "missing_required_field",
          field: mapping.field,
        };
      continue;
    }
    let value: unknown = raw;
    for (const method of mapping.transforms)
      value = transform(value as z.infer<typeof safeScalarSchema>, method);
    const parsed = safeDetailValuesSchema.shape[mapping.field].safeParse(value);
    if (!parsed.success)
      return {
        kind: "rejected",
        reason: "invalid_mapped_value",
        field: mapping.field,
      };
    values[mapping.field] = parsed.data;
    provenance.push({
      field: mapping.field,
      input_key: mapping.input_key,
      transforms: mapping.transforms,
      transform_version: transformVersion,
    });
  }
  const parsedValues = safeDetailValuesSchema.safeParse(values);
  if (!parsedValues.success)
    return { kind: "rejected", reason: "unsafe_input" };
  return { kind: "extracted", values: parsedValues.data, provenance };
}
