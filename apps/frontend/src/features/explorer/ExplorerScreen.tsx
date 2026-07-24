import { lazy, Suspense, useMemo, useState } from "react";

import { AreaSummary } from "../../components/AreaSummary";
import type { ExplorerMapViewport } from "../../components/ExplorerMap";
import { MetricExplainer } from "../../components/MetricExplainer";
import { RankedYieldChart } from "../../components/RankedYieldChart";
import {
  barranquillaDemoAreas,
  defaultArea,
} from "../../data/barranquillaDemoAreas";
import { barranquillaDemoProperties } from "../../data/barranquillaDemoProperties";
import { summarizeArea } from "../../domain/summaries";
import "./ExplorerScreen.css";

const ExplorerMap = lazy(() =>
  import("../../components/ExplorerMap").then((module) => ({
    default: module.ExplorerMap,
  })),
);

export function ExplorerScreen() {
  const [selectedAreaId, setSelectedAreaId] = useState(defaultArea.area_id);
  const [highlightedPropertyId, setHighlightedPropertyId] = useState<
    string | null
  >(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    null,
  );
  const [mapViewport, setMapViewport] = useState<ExplorerMapViewport | null>(
    null,
  );

  const selectedArea =
    barranquillaDemoAreas.find((area) => area.area_id === selectedAreaId) ??
    defaultArea;

  const visibleProperties = useMemo(() => {
    if (selectedArea.area_type === "city") {
      return barranquillaDemoProperties;
    }

    return barranquillaDemoProperties.filter(
      (property) => property.area_id === selectedArea.area_id,
    );
  }, [selectedArea]);

  const areaSummary = useMemo(
    () => ({
      ...summarizeArea(selectedArea, visibleProperties),
      area_type: selectedArea.area_type,
      data_label: "Fake data",
    }),
    [selectedArea, visibleProperties],
  );

  function handleAreaChange(areaId: string) {
    setSelectedAreaId(areaId);
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
          <span>Fake data</span>
        </div>
      </header>

      <section className="area-tabs" aria-label="Barranquilla demo areas">
        {barranquillaDemoAreas.map((area) => (
          <button
            key={area.area_id}
            type="button"
            className="area-tabs__button"
            aria-pressed={area.area_id === selectedArea.area_id}
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
