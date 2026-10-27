import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseSourceFixture } from "../../application/source-adapter.js";
import { handoffListingInputToRentModel } from "../../../../rent-model/src/listing-input-handoff.js";
import { inspectListingForRentModel } from "../../../../rent-model/src/workbench.js";
import { ciencuadrasRentalDiscoveryAdapter } from "./rental-discovery-adapter.js";

const fixturePath = fileURLToPath(
  new URL("./fixtures/rental-discovery.structural.html", import.meta.url),
);

describe("Ciencuadras ListingInput handoff", () => {
  it("preserves validated rental semantics and provenance for the Rent Model boundary", async () => {
    const adapterResult = parseSourceFixture(
      ciencuadrasRentalDiscoveryAdapter,
      {
        source_key: "ciencuadras",
        collected_at: "2026-10-26T12:00:00.000Z",
        content_type: "text/html",
        body: await readFile(fixturePath, "utf8"),
      },
    );
    expect(adapterResult.kind).toBe("listed");
    if (adapterResult.kind !== "listed") return;

    const handoff = handoffListingInputToRentModel(adapterResult.listings[0]);

    expect(handoff).toMatchObject({
      ok: true,
      value: {
        listing: {
          source_name: "ciencuadras",
          source_listing_id: "ciencuadras-listing-001",
          listing_role: "for_rent",
          sale_asking_price_cop: null,
          monthly_asking_rent_cop: 1800000,
          observed_at: "2026-10-26T12:00:00.000Z",
        },
        field_provenance: expect.arrayContaining([
          expect.objectContaining({
            field: "monthly_asking_rent_cop",
            source_path:
              '/script[@id="searchResults-schema"]/itemListElement/0/item/offers/price',
            raw_value: "1800000",
          }),
        ]),
      },
    });
    if (!handoff.ok) return;

    expect(inspectListingForRentModel(handoff.value.listing)).toMatchObject({
      subject_ready: false,
      missing_subject_fields: ["built_area_sqm"],
      server_request: null,
    });
  });

  it("rejects validated decimal values that cannot cross the numeric Rent Model boundary", async () => {
    const adapterResult = parseSourceFixture(
      ciencuadrasRentalDiscoveryAdapter,
      {
        source_key: "ciencuadras",
        collected_at: "2026-10-26T12:00:00.000Z",
        content_type: "text/html",
        body: await readFile(fixturePath, "utf8"),
      },
    );
    expect(adapterResult.kind).toBe("listed");
    if (adapterResult.kind !== "listed") return;

    const unrepresentableRent = "9".repeat(400);
    const listing = adapterResult.listings[0]!;
    expect(
      handoffListingInputToRentModel({
        ...listing,
        monthly_asking_rent_cop: unrepresentableRent,
        field_provenance: listing.field_provenance.map((entry) =>
          entry.field === "monthly_asking_rent_cop"
            ? { ...entry, raw_value: unrepresentableRent }
            : entry,
        ),
      }),
    ).toEqual({ ok: false, error: { code: "unrepresentable_decimal" } });
  });
});
