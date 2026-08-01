import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../../src/App";
import type {
  AreaSummary,
  DemoArea,
  PropertyRecord,
} from "../../src/domain/propertyTypes";

vi.mock("../../src/components/ExplorerMap", () => ({
  ExplorerMap: ({ activeAreaLabel }: { activeAreaLabel: string }) => (
    <section aria-label={`Property map for ${activeAreaLabel}`}>
      Mock property map for {activeAreaLabel}
    </section>
  ),
}));

const altoPradoArea: DemoArea = {
  area_id: "alto-prado",
  country_code: "CO",
  area_type: "neighborhood",
  display_name: "Alto Prado",
  city_name: "Barranquilla",
  description: "Named prototype area around Alto Prado.",
  parent_area_id: "barranquilla",
  centroid_latitude: 11.004,
  centroid_longitude: -74.811,
  zoom: 14,
  bounding_box: null,
  geometry_reference: null,
};

const emptyArea: DemoArea = {
  area_id: "sample-empty-area",
  country_code: "CO",
  area_type: "neighborhood",
  display_name: "Sample Empty Area",
  city_name: "Barranquilla",
  description: "Prototype area used to verify empty explorer responses.",
  parent_area_id: "barranquilla",
  centroid_latitude: 11,
  centroid_longitude: -74.8,
  zoom: 14,
  bounding_box: null,
  geometry_reference: null,
};

const altoPradoSummary: AreaSummary = {
  area_id: "alto-prado",
  display_name: "Alto Prado",
  area_type: "neighborhood",
  property_count: 2,
  median_sale_price_amount: 550000000,
  median_monthly_rent_amount: 3350000,
  median_gross_rent_yield: 0.0744,
  average_gross_rent_yield: 0.0744,
  min_gross_rent_yield: 0.0688,
  max_gross_rent_yield: 0.08,
  median_sale_to_rent_ratio: 13.515,
  data_coverage_score: null,
};

const altoPradoProperties: PropertyRecord[] = [
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
    sale_price_amount: 420000000,
    sale_price_currency: "COP",
    monthly_rent_amount: 2800000,
    monthly_rent_currency: "COP",
    annual_rent: 33600000,
    gross_rent_yield: 0.08,
    sale_to_rent_ratio: 12.5,
    listing_status: "for_sale",
    rent_source_type: "estimated_model",
    sale_price_source_type: "observed_listing",
    metric_status: "estimated_input",
    observed_at: null,
  },
  {
    property_id: "baq-002",
    country_code: "CO",
    city_name: "Barranquilla",
    area_id: "alto-prado",
    neighborhood_name: "Alto Prado",
    locality_name: null,
    address_label: "Calle 79 corridor apartment",
    listing_url: null,
    latitude: 11.0019,
    longitude: -74.8114,
    property_type: "apartment",
    bedrooms: 3,
    bathrooms: 3,
    interior_area_sqm: 118,
    sale_price_amount: 680000000,
    sale_price_currency: "COP",
    monthly_rent_amount: 3900000,
    monthly_rent_currency: "COP",
    annual_rent: 46800000,
    gross_rent_yield: 0.0688,
    sale_to_rent_ratio: 14.53,
    listing_status: "for_sale",
    rent_source_type: "observed_listing",
    sale_price_source_type: "observed_listing",
    metric_status: "valid",
    observed_at: null,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontend scaffold", () => {
  it("loads the explorer shell from the prototype API", async () => {
    const fetchMock = mockExplorerApi();
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Barranquilla rent return explorer",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: /Carrera 54/i }),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/areas/alto-prado",
      expect.any(Object),
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Yearly rent return" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: /View listing/i }),
    ).not.toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Carrera 54/i }));

    expect(
      screen.getByRole("link", {
        name: /View listing example\.com\/rent-yield\/listings\/baq-001/i,
      }),
    ).toHaveAttribute(
      "href",
      "https://example.com/rent-yield/listings/baq-001",
    );

    fireEvent.mouseLeave(screen.getByRole("button", { name: /Carrera 54/i }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: /Calle 79/i }));

    expect(
      screen.queryByRole("link", { name: /View listing/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the empty explorer state for areas without properties", async () => {
    vi.stubGlobal(
      "fetch",
      mockExplorerApi({
        defaultAreaId: "sample-empty-area",
      }),
    );

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Sample Empty Area" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "No properties are available for this area in the prototype dataset.",
      ),
    ).toBeVisible();
  });

  it("keeps the shell visible when the prototype API cannot load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    render(<App />);

    expect(
      await screen.findByText("We could not load the prototype API."),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Barranquilla rent return explorer",
      }),
    ).toBeVisible();
  });
});

function mockExplorerApi(options: { defaultAreaId?: string } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const defaultAreaId = options.defaultAreaId ?? "alto-prado";

    if (url.startsWith("/api/v1/explorer/bootstrap")) {
      return jsonResponse({
        default_area_id: defaultAreaId,
        areas: [altoPradoArea, emptyArea],
        data_label: "Prototype data",
      });
    }

    if (url === "/api/v1/explorer/areas/alto-prado") {
      return jsonResponse({
        area: altoPradoArea,
        summary: altoPradoSummary,
        properties: altoPradoProperties,
        sort: {
          metric: "gross_rent_yield",
          direction: "desc",
          tie_breakers: [
            { metric: "sale_to_rent_ratio", direction: "asc" },
            { metric: "monthly_rent_amount", direction: "desc" },
          ],
        },
        data_label: "Prototype data",
      });
    }

    if (url === "/api/v1/explorer/areas/sample-empty-area") {
      return jsonResponse({
        area: emptyArea,
        summary: {
          ...altoPradoSummary,
          area_id: "sample-empty-area",
          display_name: "Sample Empty Area",
          property_count: 0,
          median_sale_price_amount: null,
          median_monthly_rent_amount: null,
          median_gross_rent_yield: null,
          average_gross_rent_yield: null,
          min_gross_rent_yield: null,
          max_gross_rent_yield: null,
          median_sale_to_rent_ratio: null,
        },
        properties: [],
        sort: {
          metric: "gross_rent_yield",
          direction: "desc",
          tie_breakers: [
            { metric: "sale_to_rent_ratio", direction: "asc" },
            { metric: "monthly_rent_amount", direction: "desc" },
          ],
        },
        data_label: "Prototype data",
      });
    }

    return {
      ok: false,
      status: 404,
      json: async () => ({}),
    } satisfies Partial<Response>;
  });
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } satisfies Partial<Response>;
}
