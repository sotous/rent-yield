import { parseFragment, type DefaultTreeAdapterTypes } from "parse5";
import type {
  ListingFieldProvenance,
  ListingInput,
} from "@rent-yield/listing-storage-contracts";
import type {
  SourceAdapter,
  SourceAdapterResult,
  SourceFixture,
} from "../../application/source-adapter.js";

const adapterVersion = "ciencuadras-rental-discovery-v1";

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (node: DefaultTreeAdapterTypes.Node): string =>
  "childNodes" in node
    ? node.childNodes.map((child) => text(child)).join("")
    : "value" in node
      ? node.value
      : "";

function scriptById(
  node: DefaultTreeAdapterTypes.Node,
  id: string,
): DefaultTreeAdapterTypes.Element | null {
  if (
    "tagName" in node &&
    node.tagName === "script" &&
    node.attrs.some(
      (attribute) => attribute.name === "id" && attribute.value === id,
    )
  )
    return node;
  if ("childNodes" in node)
    for (const child of node.childNodes) {
      const found = scriptById(child, id);
      if (found) return found;
    }
  return null;
}

function scriptJson(
  node: DefaultTreeAdapterTypes.Node,
  id: string,
): unknown | null {
  const script = scriptById(node, id);
  if (!script) return null;
  try {
    return JSON.parse(text(script));
  } catch {
    return null;
  }
}

function cityFromBreadcrumb(value: unknown): string | null {
  if (!object(value) || !Array.isArray(value.itemListElement)) return null;
  const city = value.itemListElement
    .map((entry) =>
      object(entry) && typeof entry.name === "string" ? entry.name : null,
    )
    .find((name) => name === "Barranquilla");
  return city ?? null;
}

function provenance(
  field: ListingFieldProvenance["field"],
  source_path: string,
  raw_value: ListingFieldProvenance["raw_value"],
): ListingFieldProvenance {
  return { field, source_path, raw_value };
}

function listing(
  entry: unknown,
  index: number,
  city_name: string,
  collected_at: string,
): ListingInput | null {
  if (!object(entry) || typeof entry["@id"] !== "string" || !object(entry.item))
    return null;
  const source_listing_id = entry["@id"];
  const item = entry.item;
  const offers = item.offers;
  if (
    typeof item.url !== "string" ||
    !object(offers) ||
    typeof offers.price !== "string" ||
    offers.priceCurrency !== "COP" ||
    !object(offers.itemOffered) ||
    offers.itemOffered["@type"] !== "Apartment" ||
    typeof offers.itemOffered.numberOfBathroomsTotal !== "number" ||
    !Number.isSafeInteger(offers.itemOffered.numberOfBathroomsTotal)
  )
    return null;
  const bathrooms = offers.itemOffered.numberOfBathroomsTotal;
  const base = `/script[@id="searchResults-schema"]/itemListElement/${index}`;
  return {
    source_key: "ciencuadras",
    source_listing_id,
    listing_url: item.url,
    collected_at,
    source_published_at: null,
    source_updated_at: null,
    country_code: "CO",
    city_name,
    neighborhood_name: null,
    latitude: null,
    longitude: null,
    listing_role: "for_rent",
    listing_status: "unknown",
    property_type: "apartment",
    built_area_sqm: null,
    bedrooms: null,
    bathrooms,
    social_stratum: null,
    sale_asking_price_cop: null,
    monthly_asking_rent_cop: offers.price,
    administration_fee_cop: null,
    fees_included_in_asking_price: null,
    field_provenance: [
      provenance("source_listing_id", `${base}/@id`, source_listing_id),
      provenance("listing_url", `${base}/item/url`, item.url),
      provenance(
        "city_name",
        '/script[@id="breadcrumb-schema"]/itemListElement/2/name',
        city_name,
      ),
      provenance("listing_role", base, null),
      provenance("listing_status", base, null),
      provenance(
        "property_type",
        `${base}/item/offers/itemOffered/@type`,
        "Apartment",
      ),
      provenance(
        "bathrooms",
        `${base}/item/offers/itemOffered/numberOfBathroomsTotal`,
        bathrooms,
      ),
      provenance(
        "monthly_asking_rent_cop",
        `${base}/item/offers/price`,
        offers.price,
      ),
    ],
    adapter_version: adapterVersion,
  };
}

function parseFixture(input: SourceFixture): SourceAdapterResult {
  const document = parseFragment(input.body);
  const breadcrumb = scriptJson(document, "breadcrumb-schema");
  const searchResults = scriptJson(document, "searchResults-schema");
  const city_name = cityFromBreadcrumb(breadcrumb);
  if (
    city_name === null ||
    !object(searchResults) ||
    !Array.isArray(searchResults.itemListElement)
  )
    return { kind: "parse_failed", code: "unsupported_shape" };

  const listings: ListingInput[] = [];
  for (const [index, entry] of searchResults.itemListElement.entries()) {
    const parsed = listing(entry, index, city_name, input.collected_at);
    if (parsed === null)
      return { kind: "parse_failed", code: "unsupported_shape" };
    listings.push(parsed);
  }
  return { kind: "listed", listings };
}

export const ciencuadrasRentalDiscoveryAdapter: SourceAdapter = {
  source_key: "ciencuadras",
  supported_content_types: ["text/html"],
  parseFixture,
};
