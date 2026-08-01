import type {
  AreaSummary,
  DemoArea,
  PropertyRecord,
} from "../../domain/propertyTypes";

export type ExplorerBootstrapResponse = {
  default_area_id: string | null;
  areas: DemoArea[];
  data_label: string;
};

export type ExplorerAreaResponse = {
  area: DemoArea;
  summary: AreaSummary;
  properties: PropertyRecord[];
  sort: {
    metric: "gross_rent_yield";
    direction: "desc";
    tie_breakers: [
      { metric: "sale_to_rent_ratio"; direction: "asc" },
      { metric: "monthly_rent_amount"; direction: "desc" },
    ];
  };
  data_label: string;
};

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
}

export async function fetchExplorerBootstrap(signal?: AbortSignal) {
  return fetchJson<ExplorerBootstrapResponse>(
    `${getApiBaseUrl()}/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla`,
    signal,
  );
}

export async function fetchExplorerArea(areaId: string, signal?: AbortSignal) {
  return fetchJson<ExplorerAreaResponse>(
    `${getApiBaseUrl()}/v1/explorer/areas/${encodeURIComponent(areaId)}`,
    signal,
  );
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, signal ? { signal } : undefined);

  if (!response.ok) {
    throw new Error(`Prototype API request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
