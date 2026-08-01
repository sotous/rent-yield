import { ApplicationError } from "../errors/applicationError.js";
import type { AreaRepository } from "../ports/areaRepository.js";
import {
  prototypeDataLabel,
  type ExplorerBootstrapResponse,
} from "./explorerDtos.js";

export type GetExplorerBootstrapInput = {
  country_code: string;
  city_name: string;
};

export type GetExplorerBootstrapDependencies = {
  areaRepository: AreaRepository;
};

export async function getExplorerBootstrap(
  input: GetExplorerBootstrapInput,
  dependencies: GetExplorerBootstrapDependencies,
): Promise<ExplorerBootstrapResponse> {
  if (input.country_code !== "CO" || input.city_name !== "Barranquilla") {
    throw new ApplicationError(
      "unsupported_geography",
      "The prototype explorer only supports Barranquilla, Colombia.",
      404,
    );
  }

  const areas = await dependencies.areaRepository.listSupportedAreas({
    countryCode: "CO",
    cityName: "Barranquilla",
  });
  const defaultArea =
    areas.find((area) => area.area_type === "city") ?? areas.at(0) ?? null;

  return {
    default_area_id: defaultArea?.area_id ?? null,
    areas,
    data_label: prototypeDataLabel,
  };
}
