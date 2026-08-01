import type { Area } from "../../domain/areas/areaTypes.js";
import type { PropertyRecord } from "../../domain/properties/propertyTypes.js";
import type { AreaSummary } from "../../domain/summaries/areaSummary.js";

export const prototypeDataLabel = "Prototype data";

export type ExplorerBootstrapResponse = {
  default_area_id: string | null;
  areas: Area[];
  data_label: string;
};

export type SortMetadata = {
  metric: "gross_rent_yield";
  direction: "desc";
  tie_breakers: [
    { metric: "sale_to_rent_ratio"; direction: "asc" },
    { metric: "monthly_rent_amount"; direction: "desc" },
  ];
};

export type ExplorerAreaResponse = {
  area: Area;
  summary: AreaSummary;
  properties: PropertyRecord[];
  sort: SortMetadata;
  data_label: string;
};

export const defaultExplorerSort: SortMetadata = {
  metric: "gross_rent_yield",
  direction: "desc",
  tie_breakers: [
    { metric: "sale_to_rent_ratio", direction: "asc" },
    { metric: "monthly_rent_amount", direction: "desc" },
  ],
};
