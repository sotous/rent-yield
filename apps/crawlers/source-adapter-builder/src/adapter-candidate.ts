export type ListingOperation = "rent" | "sale";

export type HtmlFieldRecipe = {
  selector: string;
  attribute?: string;
  numberFormat?: "plain" | "cop" | "decimal-comma" | "grouped-comma";
};

export type FieldRecipe = string | HtmlFieldRecipe;

export type PropertyType =
  "apartment" | "house" | "studio" | "other_residential";

export type PropertyTypeRecipe =
  | { mode: "constant"; value: PropertyType }
  | {
      mode: "field";
      field: FieldRecipe;
      values: Record<string, PropertyType>;
    };

export type ExtractionRecipe = {
  format?: "json" | "html" | "csv" | "xml";
  contentType:
    | "text/html"
    | "application/json"
    | "text/csv"
    | "application/xml"
    | "text/xml";
  listingCollectionPath?: string;
  listingSelector?: string;
  delimiter?: "," | ";" | "\t";
  propertyType?: PropertyTypeRecipe;
  fields: Record<string, FieldRecipe>;
};

export type OperationRequestRecipe = {
  requestKey: string;
  requestUrl: string;
  extractionRecipe: ExtractionRecipe;
};

/** A legacy single request or an explicit set of category/feed requests. */
export type OperationRecipe =
  | Omit<OperationRequestRecipe, "requestKey">
  | { requests: OperationRequestRecipe[] };

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
              requests: Array<{
                requestKey: string;
                contentType: ExtractionRecipe["contentType"];
                listingCollectionPath?: string;
                listingSelector?: string;
                fieldNames: string[];
              }>;
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

type OperationRequestReceipt = {
  requestKey: string;
  contentType: ExtractionRecipe["contentType"];
  listingCollectionPath?: string;
  listingSelector?: string;
  fieldNames: string[];
};

function parseOperationRequests(value: unknown): Array<{
  requestKey: string;
  requestUrl: unknown;
  extractionRecipe: unknown;
}> | null {
  if (!isRecord(value)) return null;
  if (Array.isArray(value.requests)) {
    if (Object.keys(value).length !== 1 || value.requests.length === 0) {
      return null;
    }
    const requests = value.requests.map((request) => {
      if (!isRecord(request)) return null;
      return {
        requestKey: request.requestKey,
        requestUrl: request.requestUrl,
        extractionRecipe: request.extractionRecipe,
      };
    });
    return requests.some((request) => request === null)
      ? null
      : (requests as Array<{
          requestKey: string;
          requestUrl: unknown;
          extractionRecipe: unknown;
        }>);
  }
  if (Object.keys(value).length !== 2) return null;
  return [
    {
      requestKey: "default",
      requestUrl: value.requestUrl,
      extractionRecipe: value.extractionRecipe,
    },
  ];
}

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

function isPropertyType(value: unknown): value is PropertyType {
  return (
    value === "apartment" ||
    value === "house" ||
    value === "studio" ||
    value === "other_residential"
  );
}

function isFieldRecipe(
  value: unknown,
  contentType: string,
): value is FieldRecipe {
  if (contentType !== "text/html") {
    return isNonEmptyString(value);
  }
  return (
    isRecord(value) &&
    isNonEmptyString(value.selector) &&
    (value.attribute === undefined || isNonEmptyString(value.attribute)) &&
    (value.numberFormat === undefined ||
      ["plain", "cop", "decimal-comma", "grouped-comma"].includes(
        String(value.numberFormat),
      ))
  );
}

function parsePropertyTypeRecipe(
  value: unknown,
  contentType: ExtractionRecipe["contentType"],
): PropertyTypeRecipe | null {
  if (!isRecord(value)) return null;
  if (value.mode === "constant" && isPropertyType(value.value)) {
    return { mode: "constant", value: value.value };
  }
  if (
    value.mode !== "field" ||
    !isFieldRecipe(value.field, contentType) ||
    !isRecord(value.values) ||
    Object.keys(value.values).length === 0
  ) {
    return null;
  }
  const values: Record<string, PropertyType> = {};
  const normalizedKeys = new Set<string>();
  for (const [sourceValue, propertyType] of Object.entries(value.values)) {
    const normalizedSourceValue = sourceValue.trim().toLocaleLowerCase("en");
    if (
      normalizedSourceValue === "" ||
      normalizedKeys.has(normalizedSourceValue) ||
      !isPropertyType(propertyType)
    ) {
      return null;
    }
    normalizedKeys.add(normalizedSourceValue);
    values[sourceValue] = propertyType;
  }
  return { mode: "field", field: value.field, values };
}

function parseRecipe(value: unknown): ExtractionRecipe | null {
  if (!isRecord(value)) return null;
  const {
    contentType,
    listingCollectionPath,
    listingSelector,
    delimiter,
    propertyType,
    fields,
  } = value;
  const supportedContentType =
    contentType === "application/json" ||
    contentType === "text/html" ||
    contentType === "text/csv" ||
    contentType === "application/xml" ||
    contentType === "text/xml";
  if (!supportedContentType || !isRecord(fields)) {
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
    delimiter !== undefined &&
    ![",", ";", "\t"].includes(String(delimiter))
  ) {
    return null;
  }
  const parsedPropertyType =
    propertyType === undefined
      ? undefined
      : parsePropertyTypeRecipe(propertyType, contentType);
  if (propertyType !== undefined && parsedPropertyType === null) return null;
  const acceptedPropertyType: PropertyTypeRecipe | undefined =
    parsedPropertyType ?? undefined;
  const entries = Object.entries(fields);
  if (!isNonEmptyString(fields.id) && contentType !== "text/html") {
    return null;
  }
  if (contentType === "text/html") {
    if (!isNonEmptyString(listingSelector)) return null;
    if (
      !entries.every(
        ([fieldName, recipe]) =>
          isNonEmptyString(fieldName) &&
          isRecord(recipe) &&
          isNonEmptyString(recipe.selector) &&
          (recipe.attribute === undefined ||
            isNonEmptyString(recipe.attribute)) &&
          (recipe.numberFormat === undefined ||
            ["plain", "cop", "decimal-comma", "grouped-comma"].includes(
              String(recipe.numberFormat),
            )),
      ) ||
      !isRecord(fields.id) ||
      !isRecord(fields.priceCop)
    ) {
      return null;
    }
    const htmlFields: Record<string, HtmlFieldRecipe> = {};
    for (const [fieldName, recipe] of entries) {
      htmlFields[fieldName] = recipe as unknown as HtmlFieldRecipe;
    }
    return {
      contentType,
      listingSelector,
      ...(acceptedPropertyType === undefined
        ? {}
        : { propertyType: acceptedPropertyType }),
      fields: htmlFields,
    };
  }
  if (
    !entries.every(
      ([fieldName, fieldPath]) =>
        isNonEmptyString(fieldName) && isNonEmptyString(fieldPath),
    ) ||
    !isNonEmptyString(fields.priceCop)
  ) {
    return null;
  }
  if (contentType !== "text/csv" && !isNonEmptyString(listingCollectionPath)) {
    return null;
  }
  const parsedFields: Record<string, string> = {};
  for (const [fieldName, fieldPath] of entries) {
    parsedFields[fieldName] = fieldPath as string;
  }
  return {
    contentType,
    ...(value.format === undefined ? {} : { format: expectedFormat }),
    ...(typeof listingCollectionPath === "string"
      ? { listingCollectionPath }
      : {}),
    ...(delimiter === undefined
      ? {}
      : { delimiter: delimiter as "," | ";" | "\t" }),
    ...(acceptedPropertyType === undefined
      ? {}
      : { propertyType: acceptedPropertyType }),
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
    Record<ListingOperation, { requests: OperationRequestReceipt[] }>
  > = {};
  for (const operation of supportedOperations) {
    if (!(operation in operations)) continue;
    const requests = parseOperationRequests(operations[operation]);
    if (requests === null) {
      return { kind: "rejected", code: "invalid_operations" };
    }
    const requestKeys = new Set<string>();
    const requestUrls = new Set<string>();
    const requestReceipts: OperationRequestReceipt[] = [];
    for (const request of requests) {
      if (
        typeof request.requestKey !== "string" ||
        !/^[a-z][a-z0-9-]{0,62}$/.test(request.requestKey) ||
        requestKeys.has(request.requestKey)
      ) {
        return { kind: "rejected", code: "invalid_operations" };
      }
      requestKeys.add(request.requestKey);
      if (!isSafeSourceUrl(request.requestUrl)) {
        return { kind: "rejected", code: "invalid_source_url" };
      }
      if (requestUrls.has(request.requestUrl)) {
        return { kind: "rejected", code: "invalid_operations" };
      }
      requestUrls.add(request.requestUrl);
      const recipe = parseRecipe(request.extractionRecipe);
      if (recipe === null) {
        return { kind: "rejected", code: "invalid_extraction_recipe" };
      }
      requestReceipts.push({
        requestKey: request.requestKey,
        contentType: recipe.contentType,
        ...(recipe.listingCollectionPath === undefined
          ? {}
          : { listingCollectionPath: recipe.listingCollectionPath }),
        ...(recipe.listingSelector === undefined
          ? {}
          : { listingSelector: recipe.listingSelector }),
        fieldNames: Object.keys(recipe.fields).sort(),
      });
    }
    operationReceipts[operation] = { requests: requestReceipts };
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
