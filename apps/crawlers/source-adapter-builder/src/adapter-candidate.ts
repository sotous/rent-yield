export type ListingOperation = "rent" | "sale";

export type ExtractionRecipe = {
  contentType: "text/html" | "application/json";
  listingCollectionPath: string;
  fields: Record<string, string>;
};

export type OperationRecipe = {
  requestUrl: string;
  extractionRecipe: ExtractionRecipe;
};

export type AdapterCandidate = {
  sourceKey: string;
  sourceName: string;
  /** Canonical HTTPS homepage or API base URL used for source identity. */
  sourceUrl: string;
  countryCode: "CO";
  cityName: "Barranquilla";
  operations: Partial<Record<ListingOperation, OperationRecipe>>;
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
        operations: Partial<
          Record<
            ListingOperation,
            {
              contentType: ExtractionRecipe["contentType"];
              listingCollectionPath: string;
              fieldNames: string[];
            }
          >
        >;
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
const supportedOperations: ListingOperation[] = ["rent", "sale"];

type OperationRecipeReceipt = {
  contentType: ExtractionRecipe["contentType"];
  listingCollectionPath: string;
  fieldNames: string[];
};

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

function parseRecipe(value: unknown): ExtractionRecipe | null {
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
  if (
    !entries.every(
      ([fieldName, fieldPath]) =>
        isNonEmptyString(fieldName) && isNonEmptyString(fieldPath),
    ) ||
    !isNonEmptyString(fields.id) ||
    !isNonEmptyString(fields.priceCop)
  ) {
    return null;
  }
  const parsedFields: Record<string, string> = {};
  for (const [fieldName, fieldPath] of entries) {
    parsedFields[fieldName] = fieldPath as string;
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
    operations,
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
  if (!isRecord(operations)) {
    return { kind: "rejected", code: "invalid_operations" };
  }
  const operationNames = Object.keys(operations);
  if (
    operationNames.length === 0 ||
    operationNames.some(
      (operation) =>
        !supportedOperations.includes(operation as ListingOperation),
    )
  ) {
    return { kind: "rejected", code: "invalid_operations" };
  }

  const operationReceipts: Partial<
    Record<ListingOperation, OperationRecipeReceipt>
  > = {};
  for (const operation of supportedOperations) {
    if (!(operation in operations)) continue;
    const operationRecipe = operations[operation];
    if (!isRecord(operationRecipe)) {
      return { kind: "rejected", code: "invalid_operations" };
    }
    if (!isSafeSourceUrl(operationRecipe.requestUrl)) {
      return { kind: "rejected", code: "invalid_source_url" };
    }
    const recipe = parseRecipe(operationRecipe.extractionRecipe);
    if (recipe === null) {
      return { kind: "rejected", code: "invalid_extraction_recipe" };
    }
    operationReceipts[operation] = {
      contentType: recipe.contentType,
      listingCollectionPath: recipe.listingCollectionPath,
      fieldNames: Object.keys(recipe.fields).sort(),
    };
  }

  return {
    kind: "accepted",
    candidate: {
      sourceKey,
      sourceName,
      countryCode,
      cityName,
      supportedOperations: supportedOperations.filter((operation) =>
        operationNames.includes(operation),
      ),
      operations: operationReceipts,
    },
  };
}
