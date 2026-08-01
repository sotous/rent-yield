import type { PropertySourceRecord } from "../../domain/properties/propertyTypes.js";

export type PropertyRepository = {
  listPropertiesForArea(areaId: string): Promise<PropertySourceRecord[]>;
};
