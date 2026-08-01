import { describe, expect, it } from "vitest";

import type { AreaRepository } from "../ports/areaRepository.js";
import { getExplorerBootstrap } from "./getExplorerBootstrap.js";

describe("getExplorerBootstrap", () => {
  it("returns supported Barranquilla areas and a default area", async () => {
    await expect(
      getExplorerBootstrap(
        { country_code: "CO", city_name: "Barranquilla" },
        { areaRepository },
      ),
    ).resolves.toMatchObject({
      default_area_id: "barranquilla",
      data_label: "Prototype data",
      areas: [
        {
          area_id: "barranquilla",
          area_type: "city",
        },
      ],
    });
  });

  it("rejects unsupported geography with a typed error", async () => {
    await expect(
      getExplorerBootstrap(
        { country_code: "US", city_name: "Miami" },
        { areaRepository },
      ),
    ).rejects.toMatchObject({
      code: "unsupported_geography",
      statusCode: 404,
    });
  });
});

const areaRepository: AreaRepository = {
  async listSupportedAreas() {
    return [
      {
        area_id: "barranquilla",
        country_code: "CO",
        area_type: "city",
        display_name: "Barranquilla",
        city_name: "Barranquilla",
        description: null,
        parent_area_id: null,
        centroid_latitude: 10.9878,
        centroid_longitude: -74.7889,
        zoom: 12,
        bounding_box: null,
        geometry_reference: null,
      },
    ];
  },
  async findAreaById() {
    return null;
  },
};
