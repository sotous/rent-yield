import type {
  AdapterCandidate,
  ListingOperation,
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
  sourceUrl: string;
  contentType: "application/json" | "text/html";
  body: string;
  observedAt: string;
};

export type SourceAdapter = {
  sourceKey: string;
  sourceUrl: string;
  parse(
    response: SourceResponse,
  ):
    | { kind: "parsed"; listings: ListingInput[] }
    | { kind: "parse_failed"; code: string };
};

type BuildResult =
  | { kind: "built"; adapter: SourceAdapter }
  | { kind: "build_failed"; code: string };

type BuilderCandidate = AdapterCandidate & {
  supportedOperations: [ListingOperation];
  extractionRecipe: AdapterCandidate["extractionRecipe"] & {
    contentType: "application/json";
    fields: Record<string, string> & { id: string; priceCop: string };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function validateBuilderCandidate(input: unknown): BuilderCandidate | null {
  if (!isRecord(input)) return null;
  const { supportedOperations, extractionRecipe } = input;
  if (
    typeof input.sourceKey !== "string" ||
    typeof input.sourceName !== "string" ||
    typeof input.sourceUrl !== "string" ||
    input.countryCode !== "CO" ||
    input.cityName !== "Barranquilla" ||
    !Array.isArray(supportedOperations) ||
    !isRecord(extractionRecipe) ||
    !isRecord(extractionRecipe.fields) ||
    supportedOperations.length !== 1 ||
    (supportedOperations[0] !== "rent" && supportedOperations[0] !== "sale") ||
    extractionRecipe.contentType !== "application/json" ||
    !nonEmptyString(extractionRecipe.fields.id) ||
    !nonEmptyString(extractionRecipe.fields.priceCop)
  ) {
    return null;
  }
  return input as unknown as BuilderCandidate;
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
  return {
    sourceKey: candidate.sourceKey,
    sourceUrl: candidate.sourceUrl,
    parse(response) {
      if (response.sourceUrl !== candidate.sourceUrl) {
        return { kind: "parse_failed", code: "source_url_drift" };
      }
      if (response.contentType !== "application/json") {
        return { kind: "parse_failed", code: "content_type_drift" };
      }
      let document: unknown;
      try {
        document = JSON.parse(response.body);
      } catch {
        return { kind: "parse_failed", code: "invalid_json" };
      }
      const collection = pathValue(
        document,
        candidate.extractionRecipe.listingCollectionPath,
      );
      if (!Array.isArray(collection)) {
        return { kind: "parse_failed", code: "missing_collection" };
      }
      const listings: ListingInput[] = [];
      for (const item of collection) {
        const id = nonEmptyString(
          pathValue(item, candidate.extractionRecipe.fields.id),
        );
        const priceCop = positiveNumber(
          pathValue(item, candidate.extractionRecipe.fields.priceCop),
        );
        const builtAreaSqm = optionalNumber(
          item,
          candidate.extractionRecipe.fields.builtAreaSqm,
        );
        const bedrooms = optionalNumber(
          item,
          candidate.extractionRecipe.fields.bedrooms,
        );
        const neighborhood = optionalString(
          item,
          candidate.extractionRecipe.fields.neighborhood,
        );
        const listingUrl = optionalString(
          item,
          candidate.extractionRecipe.fields.listingUrl,
        );
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
          operation: candidate.supportedOperations[0],
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
