import { describe, expect, it } from "vitest";

import { createApp } from "../../../app.js";

describe("explorer HTTP routes", () => {
  it("serves the explorer bootstrap contract", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toMatchObject({
      default_area_id: "barranquilla",
      data_label: "Prototype data",
    });
    expect(body.areas).toContainEqual(
      expect.objectContaining({
        area_id: "barranquilla",
        country_code: "CO",
        area_type: "city",
      }),
    );

    await app.close();
  });

  it("serves selected area properties in the backend ranking order", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/areas/alto-prado",
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      area: {
        area_id: "alto-prado",
      },
      summary: {
        area_id: "alto-prado",
        property_count: 2,
      },
      sort: {
        metric: "gross_rent_yield",
        direction: "desc",
      },
      data_label: "Prototype data",
    });
    expect(
      body.properties.map(
        (property: { property_id: string }) => property.property_id,
      ),
    ).toEqual(["baq-001", "baq-002"]);
    expect(body.properties[0]).toMatchObject({
      annual_rent: 33_600_000,
      gross_rent_yield: 0.08,
      listing_url: "https://example.com/rent-yield/listings/baq-001",
      metric_status: "estimated_input",
    });

    await app.close();
  });

  it("serves empty areas as successful explorer payloads", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/areas/sample-empty-area",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      area: {
        area_id: "sample-empty-area",
      },
      summary: {
        area_id: "sample-empty-area",
        property_count: 0,
        median_gross_rent_yield: null,
      },
      properties: [],
    });

    await app.close();
  });

  it("returns a contract-shaped error for unsupported geography", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/bootstrap?country_code=US&city_name=Miami",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "unsupported_geography",
        message: "The prototype explorer only supports Barranquilla, Colombia.",
        request_id: null,
      },
    });

    await app.close();
  });

  it("returns a contract-shaped error for missing areas", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/areas/not-a-real-area",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: "area_not_found",
        message: "We could not find that area for the prototype explorer.",
        request_id: null,
      },
    });

    await app.close();
  });

  it("returns a contract-shaped error for malformed bootstrap requests", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/bootstrap?country_code=CO",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "The request did not match the prototype API contract.",
        request_id: null,
      },
    });

    await app.close();
  });

  it("returns a contract-shaped error for empty bootstrap query values", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/explorer/bootstrap?country_code=CO&city_name=",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "The request did not match the prototype API contract.",
        request_id: null,
      },
    });

    await app.close();
  });
});
