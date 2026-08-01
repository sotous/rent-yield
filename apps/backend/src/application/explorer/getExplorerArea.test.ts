import { describe, expect, it } from "vitest";

import type { AreaRepository } from "../ports/areaRepository.js";
import type { PropertyRepository } from "../ports/propertyRepository.js";
import { getExplorerArea } from "./getExplorerArea.js";

describe("getExplorerArea", () => {
  it("returns an area payload with sorted rankable properties", async () => {
    const response = await getExplorerArea("alto-prado", {
      areaRepository,
      propertyRepository,
    });

    expect(response).toMatchObject({
      area: { area_id: "alto-prado" },
      summary: {
        property_count: 2,
      },
      sort: {
        metric: "gross_rent_yield",
        direction: "desc",
      },
      data_label: "Prototype data",
    });
    expect(response.summary.median_gross_rent_yield).toBeCloseTo(0.0744);
    expect(response.properties.map((property) => property.property_id)).toEqual(
      ["baq-001", "baq-002"],
    );
    expect(response.properties[0]).toMatchObject({
      annual_rent: 33_600_000,
      gross_rent_yield: 0.08,
      metric_status: "estimated_input",
    });
  });

  it("returns an empty successful payload for a valid empty area", async () => {
    const response = await getExplorerArea("empty-area", {
      areaRepository,
      propertyRepository,
    });

    expect(response.properties).toEqual([]);
    expect(response.summary).toMatchObject({
      area_id: "empty-area",
      property_count: 0,
      median_gross_rent_yield: null,
    });
  });

  it("rejects unknown areas with a typed error", async () => {
    await expect(
      getExplorerArea("unknown", { areaRepository, propertyRepository }),
    ).rejects.toMatchObject({
      code: "area_not_found",
      statusCode: 404,
    });
  });
});

const areaRepository: AreaRepository = {
  async listSupportedAreas() {
    return [];
  },
  async findAreaById(areaId) {
    if (areaId === "unknown") {
      return null;
    }

    return {
      area_id: areaId,
      country_code: "CO",
      area_type: "neighborhood",
      display_name: areaId === "empty-area" ? "Empty Area" : "Alto Prado",
      city_name: "Barranquilla",
      description: null,
      parent_area_id: "barranquilla",
      centroid_latitude: 11.004,
      centroid_longitude: -74.811,
      zoom: 14,
      bounding_box: null,
      geometry_reference: null,
    };
  },
};

const propertyRepository: PropertyRepository = {
  async listPropertiesForArea(areaId) {
    if (areaId === "empty-area") {
      return [];
    }

    return [
      {
        property_id: "baq-002",
        country_code: "CO",
        city_name: "Barranquilla",
        area_id: "alto-prado",
        neighborhood_name: "Alto Prado",
        locality_name: null,
        address_label: "Calle 79 corridor apartment",
        listing_url: "https://example.com/rent-yield/listings/baq-002",
        latitude: 11.0019,
        longitude: -74.8114,
        property_type: "apartment",
        bedrooms: 3,
        bathrooms: 3,
        interior_area_sqm: 118,
        sale_price_amount: 680_000_000,
        sale_price_currency: "COP",
        monthly_rent_amount: 3_900_000,
        monthly_rent_currency: "COP",
        listing_status: "for_sale",
        rent_source_type: "observed_listing",
        sale_price_source_type: "observed_listing",
        observed_at: null,
      },
      {
        property_id: "baq-001",
        country_code: "CO",
        city_name: "Barranquilla",
        area_id: "alto-prado",
        neighborhood_name: "Alto Prado",
        locality_name: null,
        address_label: "Carrera 54 near Parque Washington",
        listing_url: "https://example.com/rent-yield/listings/baq-001",
        latitude: 11.0061,
        longitude: -74.8097,
        property_type: "apartment",
        bedrooms: 2,
        bathrooms: 2,
        interior_area_sqm: 82,
        sale_price_amount: 420_000_000,
        sale_price_currency: "COP",
        monthly_rent_amount: 2_800_000,
        monthly_rent_currency: "COP",
        listing_status: "for_sale",
        rent_source_type: "estimated_model",
        sale_price_source_type: "observed_listing",
        observed_at: null,
      },
    ];
  },
};
