import type {
  AreaRepository,
  ListSupportedAreasInput,
} from "../../../application/ports/areaRepository.js";
import { prototypeAreas } from "./prototypeData.js";

export function createPrototypeAreaRepository(): AreaRepository {
  return {
    async listSupportedAreas(input: ListSupportedAreasInput) {
      return prototypeAreas.filter(
        (area) =>
          area.country_code === input.countryCode &&
          area.city_name === input.cityName,
      );
    },
    async findAreaById(areaId: string) {
      return prototypeAreas.find((area) => area.area_id === areaId) ?? null;
    },
  };
}
