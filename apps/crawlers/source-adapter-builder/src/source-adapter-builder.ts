import { load } from "cheerio";
import { parse as parseCsv } from "csv-parse/sync";
import { XMLParser, XMLValidator } from "fast-xml-parser";

import type {
  AdapterCandidate,
  ExtractionRecipe,
  FieldRecipe,
  HtmlFieldRecipe,
  ListingOperation,
  OperationRecipe,
} from "./adapter-candidate.js";

export type ListingInput = {
  sourceKey: string;
  sourceListingId: string;
  operation: ListingOperation;
  priceCop: number;
  builtAreaSqm?: number;
  bedrooms?: number;
  neighborhood?: string;
  listingUrl?: string;
  observedAt: string;
};

export type SourceResponse = {
  operation: ListingOperation;
  sourceUrl: string;
  contentType: string;
  body: string;
  observedAt: string;
};

export type SourceAdapter = {
  sourceKey: string;
  supportedOperations: ListingOperation[];
  sourceUrls: Partial<Record<ListingOperation, string>>;
  parse(
    response: SourceResponse,
  ):
    | { kind: "parsed"; listings: ListingInput[] }
    | { kind: "parse_failed"; code: string };
};

type BuilderRecipe = ExtractionRecipe & {
  fields: Record<string, FieldRecipe> & {
    id: FieldRecipe;
    priceCop: FieldRecipe;
  };
};

type BuilderOperationRecipe = Omit<OperationRecipe, "extractionRecipe"> & {
  extractionRecipe: BuilderRecipe;
};

type BuilderCandidate = Omit<AdapterCandidate, "operations"> & {
  operations: Partial<Record<ListingOperation, BuilderOperationRecipe>>;
};

type BuildResult =
  | { kind: "built"; adapter: SourceAdapter }
  | { kind: "build_failed"; code: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeSourceUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}

function pathValue(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!isRecord(current)) return undefined;
    return current[key];
  }, value);
}

function parsedNumber(
  value: unknown,
  format: HtmlFieldRecipe["numberFormat"] = "plain",
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  let text = value.trim().replace(/[^\d.,+-]/g, "");
  if (!text) return null;

  if (format === "cop") {
    text = text.replace(/\./g, "").replace(/,/g, ".");
  } else if (format === "decimal-comma") {
    text = text.replace(/\./g, "").replace(/,/g, ".");
  } else if (format === "grouped-comma") {
    text = text.replace(/,/g, "");
  } else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function normalizedContentType(value: string): string {
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function isListingOperation(value: string): value is ListingOperation {
  return value === "rent" || value === "sale";
}

function validFieldRecipe(value: unknown, contentType: string): boolean {
  if (contentType !== "text/html") {
    return typeof value === "string" && value.trim() !== "";
  }
  if (
    !isRecord(value) ||
    typeof value.selector !== "string" ||
    !value.selector.trim()
  ) {
    return false;
  }
  return (
    (value.attribute === undefined ||
      (typeof value.attribute === "string" && value.attribute.trim() !== "")) &&
    (value.numberFormat === undefined ||
      ["plain", "cop", "decimal-comma", "grouped-comma"].includes(
        String(value.numberFormat),
      ))
  );
}

function validateRecipe(value: unknown): BuilderRecipe | null {
  if (!isRecord(value) || !isRecord(value.fields)) return null;
  const { contentType, listingCollectionPath, listingSelector, fields } = value;
  const supportedContentTypes = [
    "application/json",
    "text/html",
    "text/csv",
    "application/xml",
    "text/xml",
  ];
  if (
    typeof contentType !== "string" ||
    !supportedContentTypes.includes(contentType) ||
    !validFieldRecipe(fields.id, contentType) ||
    !validFieldRecipe(fields.priceCop, contentType) ||
    !Object.values(fields).every((field) =>
      validFieldRecipe(field, contentType),
    )
  ) {
    return null;
  }
  const expectedFormat =
    contentType === "application/json"
      ? "json"
      : contentType === "text/html"
        ? "html"
        : contentType === "text/csv"
          ? "csv"
          : "xml";
  if (
    (value.format !== undefined && value.format !== expectedFormat) ||
    (expectedFormat !== "json" && value.format !== expectedFormat)
  ) {
    return null;
  }
  if (
    value.delimiter !== undefined &&
    ![",", ";", "\t"].includes(String(value.delimiter))
  ) {
    return null;
  }
  if (contentType === "text/html") {
    if (typeof listingSelector !== "string" || !listingSelector.trim())
      return null;
  } else if (
    contentType !== "text/csv" &&
    (typeof listingCollectionPath !== "string" || !listingCollectionPath.trim())
  ) {
    return null;
  }
  return value as unknown as BuilderRecipe;
}

function validateOperationRecipe(
  value: unknown,
): BuilderOperationRecipe | null {
  if (!isRecord(value) || !isSafeSourceUrl(value.requestUrl)) return null;
  const extractionRecipe = validateRecipe(value.extractionRecipe);
  if (extractionRecipe === null) return null;
  return { requestUrl: value.requestUrl, extractionRecipe };
}

function validateBuilderCandidate(input: unknown): BuilderCandidate | null {
  if (!isRecord(input)) return null;
  const {
    sourceKey,
    sourceName,
    sourceUrl,
    countryCode,
    cityName,
    operations,
  } = input;
  if (
    typeof sourceKey !== "string" ||
    sourceKey.trim() === "" ||
    typeof sourceName !== "string" ||
    sourceName.trim() === "" ||
    !isSafeSourceUrl(sourceUrl) ||
    countryCode !== "CO" ||
    cityName !== "Barranquilla" ||
    !isRecord(operations)
  ) {
    return null;
  }

  const operationEntries = Object.entries(operations);
  if (
    operationEntries.length === 0 ||
    operationEntries.some(([operation]) => !isListingOperation(operation))
  ) {
    return null;
  }

  const validatedOperations: Partial<
    Record<ListingOperation, BuilderOperationRecipe>
  > = {};
  for (const [operation, recipe] of operationEntries) {
    const validatedRecipe = validateOperationRecipe(recipe);
    if (validatedRecipe === null || !isListingOperation(operation)) return null;
    validatedOperations[operation] = validatedRecipe;
  }

  return {
    sourceKey,
    sourceName,
    sourceUrl,
    countryCode,
    cityName,
    operations: validatedOperations,
  };
}

type ExtractedRow = {
  item: unknown;
  getField: (name: string) => unknown;
};

type ExtractRowsResult =
  { kind: "rows"; rows: ExtractedRow[] } | { kind: "failed"; code: string };

function extractRows(body: string, recipe: BuilderRecipe): ExtractRowsResult {
  if (recipe.contentType === "application/json") {
    let document: unknown;
    try {
      document = JSON.parse(body);
    } catch {
      return { kind: "failed", code: "invalid_json" };
    }
    const collection = pathValue(document, recipe.listingCollectionPath ?? "");
    if (!Array.isArray(collection)) {
      return { kind: "failed", code: "missing_collection" };
    }
    return {
      kind: "rows",
      rows: collection.map((item) => ({
        item,
        getField: (name) => pathValue(item, recipe.fields[name] as string),
      })),
    };
  }

  if (
    recipe.contentType === "application/xml" ||
    recipe.contentType === "text/xml"
  ) {
    if (XMLValidator.validate(body) !== true) {
      return { kind: "failed", code: "invalid_xml" };
    }
    let document: unknown;
    try {
      document = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        trimValues: true,
      }).parse(body);
    } catch {
      return { kind: "failed", code: "invalid_xml" };
    }
    const collection = pathValue(document, recipe.listingCollectionPath ?? "");
    const rows = Array.isArray(collection)
      ? collection
      : collection
        ? [collection]
        : null;
    if (rows === null) return { kind: "failed", code: "missing_collection" };
    return {
      kind: "rows",
      rows: rows.map((item) => ({
        item,
        getField: (name) => pathValue(item, recipe.fields[name] as string),
      })),
    };
  }

  if (recipe.contentType === "text/csv") {
    try {
      const records = parseCsv(body, {
        bom: true,
        columns: true,
        delimiter: recipe.delimiter ?? ",",
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, unknown>[];
      return {
        kind: "rows",
        rows: records.map((item) => ({
          item,
          getField: (name) => item[recipe.fields[name] as string],
        })),
      };
    } catch {
      return { kind: "failed", code: "invalid_csv" };
    }
  }

  const $ = load(body);
  let nodes;
  try {
    nodes = $(recipe.listingSelector ?? "").toArray();
  } catch {
    return { kind: "failed", code: "invalid_html" };
  }
  return {
    kind: "rows",
    rows: nodes.map((node) => {
      const row = $(node);
      return {
        item: node,
        getField(name) {
          const field = recipe.fields[name] as HtmlFieldRecipe;
          const ownMatch = row.filter(field.selector).first();
          const target =
            ownMatch.length > 0 ? ownMatch : row.find(field.selector).first();
          return field.attribute === undefined
            ? target.text().trim()
            : target.attr(field.attribute);
        },
      };
    }),
  };
}

function fieldNumber(
  row: ExtractedRow,
  recipe: BuilderRecipe,
  fieldName: string,
) {
  const field = recipe.fields[fieldName];
  const numberFormat =
    typeof field === "string" ? "plain" : (field?.numberFormat ?? "plain");
  return parsedNumber(row.getField(fieldName), numberFormat);
}

function fieldString(row: ExtractedRow, fieldName: string) {
  return nonEmptyString(row.getField(fieldName));
}

function createAdapter(candidate: BuilderCandidate): SourceAdapter {
  const supportedOperations: ListingOperation[] = (
    ["rent", "sale"] as const
  ).filter((operation) => candidate.operations[operation] !== undefined);
  const sourceUrls: Partial<Record<ListingOperation, string>> = {};
  for (const operation of supportedOperations) {
    const operationRecipe = candidate.operations[operation];
    if (operationRecipe !== undefined)
      sourceUrls[operation] = operationRecipe.requestUrl;
  }

  return {
    sourceKey: candidate.sourceKey,
    supportedOperations,
    sourceUrls,
    parse(response) {
      if (!isListingOperation(response.operation)) {
        return { kind: "parse_failed", code: "unsupported_operation" };
      }
      const operationRecipe = candidate.operations[response.operation];
      if (operationRecipe === undefined) {
        return { kind: "parse_failed", code: "unsupported_operation" };
      }
      if (response.sourceUrl !== operationRecipe.requestUrl) {
        return { kind: "parse_failed", code: "source_url_drift" };
      }
      if (
        normalizedContentType(response.contentType) !==
        operationRecipe.extractionRecipe.contentType
      ) {
        return { kind: "parse_failed", code: "content_type_drift" };
      }

      const recipe = operationRecipe.extractionRecipe;
      const extracted = extractRows(response.body, recipe);
      if (extracted.kind === "failed") {
        return { kind: "parse_failed", code: extracted.code };
      }
      const rows = extracted.rows;
      if (rows.length === 0 && recipe.contentType !== "text/html") {
        return { kind: "parsed", listings: [] };
      }
      if (rows.length === 0)
        return { kind: "parse_failed", code: "missing_collection" };

      const listings: ListingInput[] = [];
      for (const row of rows) {
        try {
          const id = fieldString(row, "id");
          const priceCop = fieldNumber(row, recipe, "priceCop");
          const builtAreaSqm =
            recipe.fields.builtAreaSqm === undefined
              ? undefined
              : fieldNumber(row, recipe, "builtAreaSqm");
          const bedrooms =
            recipe.fields.bedrooms === undefined
              ? undefined
              : fieldNumber(row, recipe, "bedrooms");
          const neighborhood =
            recipe.fields.neighborhood === undefined
              ? undefined
              : fieldString(row, "neighborhood");
          const rawListingUrl =
            recipe.fields.listingUrl === undefined
              ? undefined
              : fieldString(row, "listingUrl");
          if (
            id === null ||
            priceCop === null ||
            builtAreaSqm === null ||
            bedrooms === null ||
            neighborhood === null ||
            rawListingUrl === null
          ) {
            return { kind: "parse_failed", code: "invalid_listing" };
          }
          let listingUrl = rawListingUrl;
          if (listingUrl !== undefined) {
            try {
              listingUrl = new URL(listingUrl, response.sourceUrl).href;
            } catch {
              return { kind: "parse_failed", code: "invalid_listing" };
            }
          }
          listings.push({
            sourceKey: candidate.sourceKey,
            sourceListingId: id,
            operation: response.operation,
            priceCop,
            ...(builtAreaSqm === undefined ? {} : { builtAreaSqm }),
            ...(bedrooms === undefined ? {} : { bedrooms }),
            ...(neighborhood === undefined ? {} : { neighborhood }),
            ...(listingUrl === undefined ? {} : { listingUrl }),
            observedAt: response.observedAt,
          });
        } catch {
          return { kind: "parse_failed", code: "invalid_html" };
        }
      }
      return { kind: "parsed", listings };
    },
  };
}

export function buildSourceAdapter(input: unknown): BuildResult {
  const candidate = validateBuilderCandidate(input);
  if (candidate === null) {
    return { kind: "build_failed", code: "unsupported_candidate" };
  }
  return { kind: "built", adapter: createAdapter(candidate) };
}
