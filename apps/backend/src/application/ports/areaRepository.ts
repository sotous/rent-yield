import type {
  Area,
  CityName,
  CountryCode,
} from "../../domain/areas/areaTypes.js";

export type ListSupportedAreasInput = {
  countryCode: CountryCode;
  cityName: CityName;
};

export type AreaRepository = {
  listSupportedAreas(input: ListSupportedAreasInput): Promise<Area[]>;
  findAreaById(areaId: string): Promise<Area | null>;
};
