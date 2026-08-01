import { rankPropertiesByRentReturn } from "../../domain/sorting/propertyRanking.js";
import { summarizeArea } from "../../domain/summaries/areaSummary.js";
import { ApplicationError } from "../errors/applicationError.js";
import type { AreaRepository } from "../ports/areaRepository.js";
import type { PropertyRepository } from "../ports/propertyRepository.js";
import { buildRankableProperty } from "./buildRankableProperty.js";
import {
  defaultExplorerSort,
  prototypeDataLabel,
  type ExplorerAreaResponse,
} from "./explorerDtos.js";

export type GetExplorerAreaDependencies = {
  areaRepository: AreaRepository;
  propertyRepository: PropertyRepository;
};

export async function getExplorerArea(
  areaId: string,
  dependencies: GetExplorerAreaDependencies,
): Promise<ExplorerAreaResponse> {
  const area = await dependencies.areaRepository.findAreaById(areaId);

  if (area === null) {
    throw new ApplicationError(
      "area_not_found",
      "We could not find that area for the prototype explorer.",
      404,
    );
  }

  const sourceProperties =
    await dependencies.propertyRepository.listPropertiesForArea(area.area_id);
  const properties = rankPropertiesByRentReturn(
    sourceProperties.flatMap((sourceProperty) => {
      const rankableProperty = buildRankableProperty(sourceProperty);
      return rankableProperty === null ? [] : [rankableProperty];
    }),
  );

  return {
    area,
    summary: summarizeArea(area, properties),
    properties,
    sort: defaultExplorerSort,
    data_label: prototypeDataLabel,
  };
}
