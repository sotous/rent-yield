import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExplorerScreen } from "../../../src/features/explorer/ExplorerScreen";
import type { DemoArea } from "../../../src/domain/propertyTypes";

vi.mock("../../../src/components/ExplorerMap", () => ({
  ExplorerMap: ({ activeAreaLabel }: { activeAreaLabel: string }) => (
    <section aria-label={`Property map for ${activeAreaLabel}`}>
      Mock property map for {activeAreaLabel}
    </section>
  ),
}));

const altoPradoArea = makeArea("alto-prado", "Alto Prado");
const riomarArea = makeArea("riomar", "Riomar");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExplorerScreen state", () => {
  it("shows the empty state when bootstrap has no default area", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain("/api/v1/explorer/bootstrap");
      return jsonResponse({
        default_area_id: null,
        areas: [altoPradoArea, riomarArea],
        data_label: "Prototype data",
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExplorerScreen />);

    expect(
      await screen.findByText(
        "Choose a Barranquilla demo area to see its prototype summary.",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Waiting for Barranquilla area data..."),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Alto Prado/i })).toBeEnabled();
  });

  it("shows the selected-area error when the area API fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/bootstrap")) {
        return jsonResponse({
          default_area_id: "alto-prado",
          areas: [altoPradoArea],
          data_label: "Prototype data",
        });
      }

      return errorResponse(503);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ExplorerScreen />);

    expect(
      await screen.findByText("We could not load the prototype API."),
    ).toBeVisible();
    expect(
      screen.getByText("Prototype API request failed with 503"),
    ).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/areas/alto-prado",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});

function makeArea(areaId: string, displayName: string): DemoArea {
  return {
    area_id: areaId,
    country_code: "CO",
    area_type: "neighborhood",
    display_name: displayName,
    city_name: "Barranquilla",
    description: `${displayName} prototype area.`,
    parent_area_id: "barranquilla",
    centroid_latitude: 11,
    centroid_longitude: -74.8,
    zoom: 14,
    bounding_box: null,
    geometry_reference: null,
  };
}

function jsonResponse(body: unknown): Partial<Response> {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

function errorResponse(status: number): Partial<Response> {
  return {
    ok: false,
    status,
    json: async () => ({}),
  };
}
