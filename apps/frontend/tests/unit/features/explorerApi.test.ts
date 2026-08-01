import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchExplorerArea,
  fetchExplorerBootstrap,
  getApiBaseUrl,
} from "../../../src/features/explorer/explorerApi";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("explorer API boundary", () => {
  it("uses the configured API base URL when provided", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com/api/");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    expect(getApiBaseUrl()).toBe("https://api.example.com/api");
    await fetchExplorerArea("alto-prado");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/explorer/areas/alto-prado",
      undefined,
    );
  });

  it("returns the bootstrap payload from a successful response", async () => {
    const payload = {
      default_area_id: "alto-prado",
      areas: [],
      data_label: "Prototype data",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchExplorerBootstrap()).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla",
      undefined,
    );
  });

  it("returns an area payload from a successful response", async () => {
    const payload = {
      area: { area_id: "alto-prado" },
      summary: { area_id: "alto-prado" },
      properties: [],
      sort: {},
      data_label: "Prototype data",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchExplorerArea("alto-prado")).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/areas/alto-prado",
      undefined,
    );
  });

  it("encodes the area ID as one URL path segment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await fetchExplorerArea("centro / norte");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/areas/centro%20%2F%20norte",
      undefined,
    );
  });

  it.each([
    ["bootstrap", () => fetchExplorerBootstrap()],
    ["area", () => fetchExplorerArea("alto-prado")],
  ])("throws for a non-2xx %s response", async (_endpoint, request) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );

    await expect(request()).rejects.toThrow(
      "Prototype API request failed with 503",
    );
  });

  it("forwards an AbortSignal to the bootstrap request", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await fetchExplorerBootstrap(signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla",
      { signal },
    );
  });

  it("forwards an AbortSignal to the area request", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await fetchExplorerArea("alto-prado", signal);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/explorer/areas/alto-prado",
      { signal },
    );
  });
});

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(payload),
  };
}
