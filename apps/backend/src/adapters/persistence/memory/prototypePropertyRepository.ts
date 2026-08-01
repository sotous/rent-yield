import type { PropertyRepository } from "../../../application/ports/propertyRepository.js";
import { prototypeAreas, prototypeProperties } from "./prototypeData.js";

export function createPrototypePropertyRepository(): PropertyRepository {
  return {
    async listPropertiesForArea(areaId: string) {
      const area = prototypeAreas.find(
        (candidate) => candidate.area_id === areaId,
      );

      if (area?.area_type === "city") {
        return prototypeProperties.filter(
          (property) => property.city_name === area.city_name,
        );
      }

      return prototypeProperties.filter(
        (property) => property.area_id === areaId,
      );
    },
  };
}
