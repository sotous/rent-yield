import { describe, expect, it } from "vitest";

import { createPrototypeAreaRepository } from "./prototypeAreaRepository.js";
import { createPrototypePropertyRepository } from "./prototypePropertyRepository.js";

describe("prototype memory repositories", () => {
  it("lists supported Barranquilla areas", async () => {
    const areas = await createPrototypeAreaRepository().listSupportedAreas({
      countryCode: "CO",
      cityName: "Barranquilla",
    });

    expect(areas.map((area) => area.area_id)).toContain("barranquilla");
    expect(areas.map((area) => area.area_id)).toContain("sample-empty-area");
  });

  it("returns city-level properties across child areas", async () => {
    const properties =
      await createPrototypePropertyRepository().listPropertiesForArea(
        "barranquilla",
      );

    expect(properties).toHaveLength(8);
  });

  it("returns no properties for the empty prototype area", async () => {
    await expect(
      createPrototypePropertyRepository().listPropertiesForArea(
        "sample-empty-area",
      ),
    ).resolves.toEqual([]);
  });
});
