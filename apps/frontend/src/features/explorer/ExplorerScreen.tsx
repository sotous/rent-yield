import { lazy, Suspense, useEffect, useState } from "react";

import { AreaSummary } from "../../components/AreaSummary";
import type { ExplorerMapViewport } from "../../components/ExplorerMap";
import { MetricExplainer } from "../../components/MetricExplainer";
import { RankedYieldChart } from "../../components/RankedYieldChart";
import type {
  AreaSummary as AreaSummaryRecord,
  DemoArea,
  PropertyRecord,
} from "../../domain/propertyTypes";
import { fetchExplorerArea, fetchExplorerBootstrap } from "./explorerApi";
import "./ExplorerScreen.css";

const ExplorerMap = lazy(() =>
  import("../../components/ExplorerMap").then((module) => ({
    default: module.ExplorerMap,
  })),
);

type DataState = "loading" | "ready" | "empty" | "error";

type ExplorerAreaSummary = AreaSummaryRecord & {
  area_type: DemoArea["area_type"];
  data_label: string;
};

export function ExplorerScreen() {
  const [availableAreas, setAvailableAreas] = useState<DemoArea[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<DemoArea | null>(null);
  const [areaSummary, setAreaSummary] = useState<ExplorerAreaSummary | null>(
    null,
  );
  const [visibleProperties, setVisibleProperties] = useState<PropertyRecord[]>(
    [],
  );
  const [dataState, setDataState] = useState<DataState>("loading");
  const [dataLabel, setDataLabel] = useState("Prototype data");
  const [dataError, setDataError] = useState<string | null>(null);
  const [highlightedPropertyId, setHighlightedPropertyId] = useState<
    string | null
  >(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [mapViewport, setMapViewport] = useState<ExplorerMapViewport | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadBootstrap() {
      try {
        setDataState("loading");
        setDataError(null);
        const bootstrap = await fetchExplorerBootstrap(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setAvailableAreas(bootstrap.areas);
        setDataLabel(bootstrap.data_label);
        setSelectedAreaId(bootstrap.default_area_id);

        if (bootstrap.default_area_id === null) {
          setSelectedArea(null);
          setAreaSummary(null);
          setVisibleProperties([]);
          setDataState("empty");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDataError(readErrorMessage(error));
        setDataState("error");
      }
    }

    void loadBootstrap();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const areaId = selectedAreaId;

    if (areaId === null) {
      return;
    }

    const controller = new AbortController();

    async function loadArea(areaIdForRequest: string) {
      try {
        setDataState("loading");
        setDataError(null);
        const payload = await fetchExplorerArea(
          areaIdForRequest,
          controller.signal,
        );

        if (controller.signal.aborted) {
          return;
        }

        setSelectedArea(payload.area);
        setAreaSummary({
          ...payload.summary,
          area_type: payload.summary.area_type,
          data_label: payload.data_label,
        });
        setVisibleProperties(payload.properties);
        setDataLabel(payload.data_label);
        setDataState(payload.properties.length === 0 ? "empty" : "ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setDataError(readErrorMessage(error));
        setDataState("error");
      }
    }

    void loadArea(areaId);

    return () => controller.abort();
  }, [selectedAreaId]);

  function handleAreaChange(areaId: string) {
    setSelectedAreaId(areaId);
    setSelectedArea(
      availableAreas.find((area) => area.area_id === areaId) ?? null,
    );
    setAreaSummary(null);
    setVisibleProperties([]);
    setHighlightedPropertyId(null);
    setSelectedPropertyId(null);
  }

  return (
    <main className="explorer-shell">
      <header className="explorer-hero">
        <div>
          <p className="explorer-eyebrow">Rent Yield / Prototype v1</p>
          <h1>Barranquilla rent return explorer</h1>
          <p>
            Choose a demo area, scan the map, and see which homes may bring in
            the strongest rent for their price.
          </p>
        </div>
        <div className="explorer-hero__status" aria-label="Prototype status">
          <span>Colombia-first</span>
          <span>Barranquilla-first</span>
          <span>{dataLabel}</span>
        </div>
      </header>

      {dataState === "error" ? (
        <section className="explorer-data-state" role="status">
          <strong>We could not load the prototype API.</strong>
          <span>{dataError ?? "Try running the backend and refreshing."}</span>
        </section>
      ) : null}

      {dataState === "loading" ? (
        <section className="explorer-data-state" role="status">
          Loading Barranquilla prototype data...
        </section>
      ) : null}

      <section className="area-tabs" aria-label="Barranquilla demo areas">
        {availableAreas.map((area) => (
          <button
            key={area.area_id}
            type="button"
            className="area-tabs__button"
            aria-pressed={area.area_id === selectedAreaId}
            disabled={availableAreas.length === 0}
            onClick={() => handleAreaChange(area.area_id)}
          >
            <span>{area.display_name}</span>
            <small>{area.description}</small>
          </button>
        ))}
      </section>

      <section
        className="explorer-grid"
        aria-label="Map and rent return ranking"
      >
        <div className="explorer-grid__map">
          {selectedArea == null ? (
            <section className="map-loading" aria-label="Loading property map">
              Waiting for Barranquilla area data...
            </section>
          ) : (
            <Suspense
              fallback={
                <section
                  className="map-loading"
                  aria-label="Loading property map"
                >
                  Loading Barranquilla map...
                </section>
              }
            >
              <ExplorerMap
                activeArea={selectedArea}
                activeAreaLabel={`${selectedArea.display_name}, Colombia`}
                highlightedPropertyId={highlightedPropertyId}
                properties={visibleProperties}
                selectedPropertyId={selectedPropertyId}
                onHighlightProperty={setHighlightedPropertyId}
                onMoveEnd={setMapViewport}
                onSelectProperty={setSelectedPropertyId}
              />
            </Suspense>
          )}
        </div>

        <aside
          className="explorer-grid__side"
          aria-label="Area and ranking details"
        >
          <AreaSummary summary={areaSummary} />
          <MetricExplainer />
          <RankedYieldChart
            highlightedPropertyId={highlightedPropertyId}
            properties={visibleProperties}
            selectedPropertyId={selectedPropertyId}
            onHighlightProperty={setHighlightedPropertyId}
            onSelectProperty={setSelectedPropertyId}
          />
        </aside>
      </section>

      <footer className="explorer-footer">
        <span>
          Current viewport:{" "}
          {mapViewport == null
            ? "waiting for map"
            : `${mapViewport.latitude.toFixed(4)}, ${mapViewport.longitude.toFixed(
                4,
              )} at zoom ${mapViewport.zoom.toFixed(1)}`}
        </span>
      </footer>
    </main>
  );
}

function readErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The prototype API returned an unexpected response.";
}
