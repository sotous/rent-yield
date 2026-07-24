import { useEffect, useMemo, useRef } from "react";
import {
  AttributionControl,
  Map as MapLibre,
  Marker,
  NavigationControl,
  type LngLatBounds,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type { DemoArea } from "../domain/propertyTypes";
import "maplibre-gl/dist/maplibre-gl.css";
import "./ExplorerMap.css";

const BARRANQUILLA_VIEWPORT = {
  latitude: 10.9685,
  longitude: -74.7813,
  zoom: 11.7,
};

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

export type ExplorerMapProperty = {
  property_id: string;
  address_label: string;
  latitude: number;
  longitude: number;
  gross_rent_yield: number;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
};

export type ExplorerMapViewport = {
  latitude: number;
  longitude: number;
  zoom: number;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
};

export type ExplorerMapProps = {
  activeArea: DemoArea;
  properties: ExplorerMapProperty[];
  highlightedPropertyId: string | null;
  selectedPropertyId: string | null;
  onHighlightProperty: (propertyId: string | null) => void;
  onSelectProperty: (propertyId: string) => void;
  onMoveEnd?: (viewport: ExplorerMapViewport) => void;
  activeAreaLabel?: string;
  className?: string;
};

type MarkerRecord = {
  marker: Marker;
  element: HTMLButtonElement;
};

function syncMarkerState(
  markers: Map<string, MarkerRecord>,
  highlightedPropertyId: string | null,
  selectedPropertyId: string | null,
) {
  markers.forEach(({ element }, propertyId) => {
    const isHighlighted = propertyId === highlightedPropertyId;
    const isSelected = propertyId === selectedPropertyId;

    element.classList.toggle(
      "explorer-map__marker--highlighted",
      isHighlighted,
    );
    element.classList.toggle("explorer-map__marker--selected", isSelected);
    element.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function formatYield(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPropertyLabel(property: ExplorerMapProperty) {
  const details = [
    property.property_type,
    typeof property.bedrooms === "number"
      ? `${property.bedrooms} bedrooms`
      : null,
    typeof property.bathrooms === "number"
      ? `${property.bathrooms} bathrooms`
      : null,
  ].filter(Boolean);

  return [
    property.address_label,
    details.join(", "),
    `Yearly rent return ${formatYield(property.gross_rent_yield)}`,
  ]
    .filter(Boolean)
    .join(". ");
}

function readViewport(map: MapLibreMap): ExplorerMapViewport {
  const center = map.getCenter();
  const bounds: LngLatBounds = map.getBounds();

  return {
    latitude: center.lat,
    longitude: center.lng,
    zoom: map.getZoom(),
    bounds: {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    },
  };
}

export function ExplorerMap({
  activeArea,
  properties,
  highlightedPropertyId,
  selectedPropertyId,
  onHighlightProperty,
  onSelectProperty,
  onMoveEnd,
  activeAreaLabel = "Barranquilla, Colombia",
  className,
}: ExplorerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const callbacksRef = useRef({
    onHighlightProperty,
    onSelectProperty,
    onMoveEnd,
  });

  const rootClassName = useMemo(
    () => ["explorer-map", className].filter(Boolean).join(" "),
    [className],
  );

  useEffect(() => {
    callbacksRef.current = {
      onHighlightProperty,
      onSelectProperty,
      onMoveEnd,
    };
  }, [onHighlightProperty, onMoveEnd, onSelectProperty]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || mapRef.current) {
      return;
    }

    const map = new MapLibre({
      container,
      style: MAP_STYLE,
      center: [BARRANQUILLA_VIEWPORT.longitude, BARRANQUILLA_VIEWPORT.latitude],
      zoom: BARRANQUILLA_VIEWPORT.zoom,
      attributionControl: false,
    });

    map.addControl(
      new NavigationControl({
        visualizePitch: false,
      }),
      "top-right",
    );
    map.addControl(new AttributionControl({ compact: true }));

    map.on("moveend", () => {
      callbacksRef.current.onMoveEnd?.(readViewport(map));
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(container);
    window.requestAnimationFrame(() => map.resize());

    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      resizeObserver.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.flyTo({
      center: [activeArea.centroid_longitude, activeArea.centroid_latitude],
      essential: true,
      zoom: activeArea.zoom,
    });
  }, [activeArea]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const activePropertyIds = new Set(
      properties.map((property) => property.property_id),
    );

    markersRef.current.forEach(({ marker }, propertyId) => {
      if (!activePropertyIds.has(propertyId)) {
        marker.remove();
        markersRef.current.delete(propertyId);
      }
    });

    properties.forEach((property) => {
      const existingMarker = markersRef.current.get(property.property_id);

      if (existingMarker) {
        existingMarker.marker.setLngLat([
          property.longitude,
          property.latitude,
        ]);
        existingMarker.element.setAttribute(
          "aria-label",
          formatPropertyLabel(property),
        );
        return;
      }

      const element = document.createElement("button");
      element.type = "button";
      element.className = "explorer-map__marker";
      element.setAttribute("aria-label", formatPropertyLabel(property));
      element.dataset.propertyId = property.property_id;

      element.addEventListener("mouseenter", () => {
        callbacksRef.current.onHighlightProperty(property.property_id);
      });
      element.addEventListener("mouseleave", () => {
        callbacksRef.current.onHighlightProperty(null);
      });
      element.addEventListener("focus", () => {
        callbacksRef.current.onHighlightProperty(property.property_id);
      });
      element.addEventListener("blur", () => {
        callbacksRef.current.onHighlightProperty(null);
      });
      element.addEventListener("click", () => {
        callbacksRef.current.onSelectProperty(property.property_id);
      });

      const marker = new Marker({
        element,
        anchor: "bottom",
      })
        .setLngLat([property.longitude, property.latitude])
        .addTo(map);

      markersRef.current.set(property.property_id, { marker, element });
    });

    syncMarkerState(
      markersRef.current,
      highlightedPropertyId,
      selectedPropertyId,
    );
  }, [highlightedPropertyId, properties, selectedPropertyId]);

  useEffect(() => {
    syncMarkerState(
      markersRef.current,
      highlightedPropertyId,
      selectedPropertyId,
    );
  }, [highlightedPropertyId, selectedPropertyId]);

  return (
    <section
      className={rootClassName}
      aria-label={`Property map for ${activeAreaLabel}`}
    >
      <div className="explorer-map__status" aria-live="polite">
        Showing {properties.length} properties in {activeAreaLabel}
      </div>
      <div ref={containerRef} className="explorer-map__canvas" />
    </section>
  );
}
