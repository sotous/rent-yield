import type {
  AdapterCandidate,
  ExtractionRecipe,
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
  contentType: "application/json" | "text/html";
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
  contentType: "application/json";
  fields: Record<string, string> & { id: string; priceCop: string };
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

function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function isListingOperation(value: string): value is ListingOperation {
  return value === "rent" || value === "sale";
}

function validateRecipe(value: unknown): BuilderRecipe | null {
  if (!isRecord(value)) return null;
  const { contentType, listingCollectionPath, fields } = value;
  if (
    contentType !== "application/json" ||
    typeof listingCollectionPath !== "string" ||
    listingCollectionPath.trim() === "" ||
    !isRecord(fields) ||
    typeof fields.id !== "string" ||
    fields.id.trim() === "" ||
    typeof fields.priceCop !== "string" ||
    fields.priceCop.trim() === ""
  ) {
    return null;
  }
  if (
    !Object.entries(fields).every(
      ([name, path]) =>
        name.trim() !== "" && typeof path === "string" && path.trim() !== "",
    )
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
  return {
    requestUrl: value.requestUrl,
    extractionRecipe,
  };
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

function optionalNumber(
  item: unknown,
  path: string | undefined,
): number | undefined | null {
  if (path === undefined) return undefined;
  return positiveNumber(pathValue(item, path));
}

function optionalString(
  item: unknown,
  path: string | undefined,
): string | undefined | null {
  if (path === undefined) return undefined;
  return nonEmptyString(pathValue(item, path));
}

function createAdapter(candidate: BuilderCandidate): SourceAdapter {
  const supportedOperations: ListingOperation[] = (
    ["rent", "sale"] as const
  ).filter((operation) => candidate.operations[operation] !== undefined);
  const sourceUrls: Partial<Record<ListingOperation, string>> = {};
  for (const operation of supportedOperations) {
    const operationRecipe = candidate.operations[operation];
    if (operationRecipe !== undefined) {
      sourceUrls[operation] = operationRecipe.requestUrl;
    }
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
        response.contentType !== operationRecipe.extractionRecipe.contentType
      ) {
        return { kind: "parse_failed", code: "content_type_drift" };
      }

      let document: unknown;
      try {
        document = JSON.parse(response.body);
      } catch {
        return { kind: "parse_failed", code: "invalid_json" };
      }
      const recipe = operationRecipe.extractionRecipe;
      const collection = pathValue(document, recipe.listingCollectionPath);
      if (!Array.isArray(collection)) {
        return { kind: "parse_failed", code: "missing_collection" };
      }

      const listings: ListingInput[] = [];
      for (const item of collection) {
        const id = nonEmptyString(pathValue(item, recipe.fields.id));
        const priceCop = positiveNumber(
          pathValue(item, recipe.fields.priceCop),
        );
        const builtAreaSqm = optionalNumber(item, recipe.fields.builtAreaSqm);
        const bedrooms = optionalNumber(item, recipe.fields.bedrooms);
        const neighborhood = optionalString(item, recipe.fields.neighborhood);
        const listingUrl = optionalString(item, recipe.fields.listingUrl);
        if (
          id === null ||
          priceCop === null ||
          builtAreaSqm === null ||
          bedrooms === null ||
          neighborhood === null ||
          listingUrl === null
        ) {
          return { kind: "parse_failed", code: "invalid_listing" };
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
      }
      return { kind: "parsed", listings };
    },
  };
}

export function buildSourceAdapter(input: unknown): BuildResult {
  const candidate = validateBuilderCandidate(input);
  return candidate === null
    ? { kind: "build_failed", code: "unsupported_candidate" }
    : { kind: "built", adapter: createAdapter(candidate) };
}
