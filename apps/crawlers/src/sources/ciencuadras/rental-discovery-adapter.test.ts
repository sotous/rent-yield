import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSourceFixture } from "../../application/source-adapter.js";
import { ciencuadrasRentalDiscoveryAdapter } from "./rental-discovery-adapter.js";

const fixturePath = fileURLToPath(
  new URL("./fixtures/rental-discovery.structural.html", import.meta.url),
);

async function sourceFixture() {
  return {
    source_key: "ciencuadras",
    collected_at: "2026-10-26T12:00:00.000Z",
    content_type: "text/html" as const,
    body: await readFile(fixturePath, "utf8"),
  };
}

describe("Ciencuadras rental discovery adapter", () => {
  it("maps the confirmed JSON-LD listing structure in source order", async () => {
    const result = parseSourceFixture(
      ciencuadrasRentalDiscoveryAdapter,
      await sourceFixture(),
    );

    expect(result.kind).toBe("listed");
    if (result.kind !== "listed") return;
    expect(result.listings.map((listing) => listing.source_listing_id)).toEqual(
      ["ciencuadras-listing-001", "ciencuadras-listing-002"],
    );
    expect(
      result.listings.map((listing) => listing.monthly_asking_rent_cop),
    ).toEqual(["1800000", "2100000"]);
  });

  it("emits explicit rental claims with city and field provenance", async () => {
    const result = parseSourceFixture(
      ciencuadrasRentalDiscoveryAdapter,
      await sourceFixture(),
    );

    expect(result.kind).toBe("listed");
    if (result.kind !== "listed") return;
    const listing = result.listings[0]!;
    expect(listing).toMatchObject({
      source_key: "ciencuadras",
      listing_url:
        "https://www.ciencuadras.com/inmueble/ciencuadras-listing-001",
      city_name: "Barranquilla",
      listing_role: "for_rent",
      sale_asking_price_cop: null,
      monthly_asking_rent_cop: "1800000",
      bathrooms: 2,
    });
    expect(listing.field_provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "city_name",
          source_path:
            '/script[@id="breadcrumb-schema"]/itemListElement/2/name',
        }),
        expect.objectContaining({
          field: "monthly_asking_rent_cop",
          source_path:
            '/script[@id="searchResults-schema"]/itemListElement/0/item/offers/price',
        }),
      ]),
    );
  });

  it("fails explicitly when the confirmed JSON-LD scripts are absent", () => {
    expect(
      parseSourceFixture(ciencuadrasRentalDiscoveryAdapter, {
        source_key: "ciencuadras",
        collected_at: "2026-10-26T12:00:00.000Z",
        content_type: "text/html",
        body: "<html><head></head></html>",
      }),
    ).toEqual({ kind: "parse_failed", code: "unsupported_shape" });
  });
});
