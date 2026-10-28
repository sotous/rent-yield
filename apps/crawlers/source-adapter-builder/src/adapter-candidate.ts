export type ListingOperation = "rent" | "sale";

export type AdapterCandidate = {
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
  countryCode: "CO";
  cityName: "Barranquilla";
  supportedOperations: ListingOperation[];
  extractionRecipe: {
    contentType: "text/html" | "application/json";
    listingCollectionPath: string;
    fields: Record<string, string>;
  };
};

export type AdapterCandidateValidation =
  | {
      kind: "accepted";
      candidate: {
        sourceKey: string;
        sourceName: string;
        countryCode: "CO";
        cityName: "Barranquilla";
        supportedOperations: ListingOperation[];
        extractionRecipe: {
          contentType: "text/html" | "application/json";
          listingCollectionPath: string;
          fieldNames: string[];
        };
      };
    }
  | {
      kind: "rejected";
      code:
        | "invalid_candidate"
        | "invalid_source_key"
        | "invalid_source_url"
        | "unsupported_geography"
        | "invalid_operations"
        | "invalid_extraction_recipe";
    };

const sourceKeyPattern = /^[a-z][a-z0-9-]{1,62}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSafeSourceUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}

function isOperation(value: unknown): value is ListingOperation {
  return value === "rent" || value === "sale";
}

function parseOperations(value: unknown): ListingOperation[] | null {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every(isOperation)
  ) {
    return null;
  }
  return new Set(value).size === value.length ? [...value] : null;
}

function parseRecipe(
  value: unknown,
): AdapterCandidate["extractionRecipe"] | null {
  if (!isRecord(value)) return null;
  const { contentType, listingCollectionPath, fields } = value;
  if (
    (contentType !== "text/html" && contentType !== "application/json") ||
    !isNonEmptyString(listingCollectionPath) ||
    !isRecord(fields)
  ) {
    return null;
  }
  const entries = Object.entries(fields);
  if (entries.length === 0) return null;
  const parsedFields: Record<string, string> = {};
  for (const [fieldName, fieldPath] of entries) {
    if (!isNonEmptyString(fieldName) || !isNonEmptyString(fieldPath)) {
      return null;
    }
    parsedFields[fieldName] = fieldPath;
  }
  return {
    contentType,
    listingCollectionPath,
    fields: parsedFields,
  };
}

export function validateAdapterCandidate(
  input: unknown,
): AdapterCandidateValidation {
  if (!isRecord(input)) return { kind: "rejected", code: "invalid_candidate" };
  const {
    sourceKey,
    sourceName,
    sourceUrl,
    countryCode,
    cityName,
    supportedOperations,
    extractionRecipe,
  } = input;
  if (!isNonEmptyString(sourceKey) || !sourceKeyPattern.test(sourceKey)) {
    return { kind: "rejected", code: "invalid_source_key" };
  }
  if (!isNonEmptyString(sourceName)) {
    return { kind: "rejected", code: "invalid_candidate" };
  }
  if (!isSafeSourceUrl(sourceUrl)) {
    return { kind: "rejected", code: "invalid_source_url" };
  }
  if (countryCode !== "CO" || cityName !== "Barranquilla") {
    return { kind: "rejected", code: "unsupported_geography" };
  }
  const operations = parseOperations(supportedOperations);
  if (operations === null)
    return { kind: "rejected", code: "invalid_operations" };
  const recipe = parseRecipe(extractionRecipe);
  if (recipe === null) {
    return { kind: "rejected", code: "invalid_extraction_recipe" };
  }
  return {
    kind: "accepted",
    candidate: {
      sourceKey,
      sourceName,
      countryCode,
      cityName,
      supportedOperations: operations,
      extractionRecipe: {
        contentType: recipe.contentType,
        listingCollectionPath: recipe.listingCollectionPath,
        fieldNames: Object.keys(recipe.fields).sort(),
      },
    },
  };
}
