import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DemoArea } from "../../../src/domain/propertyTypes";
import { ExplorerMap } from "../../../src/components/ExplorerMap";

const mapInstances: MockMap[] = [];

vi.mock("maplibre-gl", () => ({
  AttributionControl: class AttributionControl {
    constructor(options: unknown) {
      void options;
    }
  },
  Map: class MockMap {
    center = { lat: 11, lng: -74.8 };
    zoom = 14;
    bounds = {
      getNorth: () => 11.1,
      getSouth: () => 10.9,
      getEast: () => -74.7,
      getWest: () => -74.9,
    };
    listeners = new Map<string, () => void>();
    flyTo = vi.fn();
    addControl = vi.fn();
    resize = vi.fn();
    remove = vi.fn();

    constructor(options: unknown) {
      void options;
      mapInstances.push(this);
    }

    on(event: string, callback: () => void) {
      this.listeners.set(event, callback);
      return this;
    }

    getCenter() {
      return this.center;
    }

    getBounds() {
      return this.bounds;
    }

    getZoom() {
      return this.zoom;
    }

    emit(event: string) {
      this.listeners.get(event)?.();
    }
  },
  Marker: class MockMarker {
    element: HTMLButtonElement;
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    addTo = vi.fn(() => {
      document.body.append(this.element);
      return this;
    });

    constructor(options: { element: HTMLButtonElement }) {
      this.element = options.element;
    }
  },
  NavigationControl: class NavigationControl {
    constructor(options: unknown) {
      void options;
    }
  },
}));

const area: DemoArea = {
  area_id: "alto-prado",
  country_code: "CO",
  area_type: "neighborhood",
  display_name: "Alto Prado",
  city_name: "Barranquilla",
  description: "Prototype area",
  parent_area_id: "barranquilla",
  centroid_latitude: 11.004,
  centroid_longitude: -74.811,
  zoom: 14,
  bounding_box: null,
  geometry_reference: null,
};

const properties = [
  {
    property_id: "baq-001",
    address_label: "Carrera 54",
    latitude: 11.006,
    longitude: -74.81,
    gross_rent_yield: 0.08,
    property_type: "apartment",
    bedrooms: 2,
    bathrooms: 2,
  },
  {
    property_id: "baq-002",
    address_label: "Calle 79",
    latitude: 11.002,
    longitude: -74.811,
    gross_rent_yield: 0.06,
    property_type: null,
    bedrooms: null,
    bathrooms: null,
  },
];

beforeEach(() => {
  mapInstances.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExplorerMap", () => {
  it("renders accessible property markers and reports interactions", () => {
    const onHighlightProperty = vi.fn();
    const onSelectProperty = vi.fn();
    const onMoveEnd = vi.fn();

    render(
      <ExplorerMap
        activeArea={area}
        activeAreaLabel="Alto Prado, Colombia"
        highlightedPropertyId="baq-001"
        properties={properties}
        selectedPropertyId="baq-002"
        onHighlightProperty={onHighlightProperty}
        onSelectProperty={onSelectProperty}
        onMoveEnd={onMoveEnd}
      />,
    );

    expect(
      screen.getByText("Showing 2 properties in Alto Prado, Colombia"),
    ).toBeVisible();
    const firstMarker = screen.getByRole("button", {
      name: /Carrera 54\. apartment, 2 bedrooms, 2 bathrooms\. Yearly rent return 8\.0%/i,
    });
    const secondMarker = screen.getByRole("button", {
      name: /Calle 79\. Yearly rent return 6\.0%/i,
    });

    expect(firstMarker).toHaveAttribute("aria-pressed", "false");
    expect(secondMarker).toHaveAttribute("aria-pressed", "true");
    expect(firstMarker).toHaveClass("explorer-map__marker--highlighted");

    fireEvent.mouseEnter(secondMarker);
    fireEvent.click(secondMarker);
    fireEvent.mouseLeave(secondMarker);

    expect(onHighlightProperty).toHaveBeenNthCalledWith(1, "baq-002");
    expect(onSelectProperty).toHaveBeenCalledWith("baq-002");
    expect(onHighlightProperty).toHaveBeenLastCalledWith(null);

    mapInstances[0]?.emit("moveend");
    expect(onMoveEnd).toHaveBeenCalledWith({
      latitude: 11,
      longitude: -74.8,
      zoom: 14,
      bounds: { north: 11.1, south: 10.9, east: -74.7, west: -74.9 },
    });
  });

  it("flies to a new area and removes markers on unmount", () => {
    const { rerender, unmount } = render(
      <ExplorerMap
        activeArea={area}
        properties={properties}
        highlightedPropertyId={null}
        selectedPropertyId={null}
        onHighlightProperty={vi.fn()}
        onSelectProperty={vi.fn()}
      />,
    );

    const map = mapInstances[0];
    expect(map).toBeDefined();

    const nextArea = { ...area, centroid_latitude: 11.01, zoom: 15 };
    rerender(
      <ExplorerMap
        activeArea={nextArea}
        properties={[]}
        highlightedPropertyId={null}
        selectedPropertyId={null}
        onHighlightProperty={vi.fn()}
        onSelectProperty={vi.fn()}
      />,
    );

    expect(map?.flyTo).toHaveBeenCalledWith({
      center: [-74.811, 11.01],
      essential: true,
      zoom: 15,
    });

    unmount();
    expect(map?.remove).toHaveBeenCalled();
  });
});

type MockMap = InstanceType<typeof import("maplibre-gl").Map>;
