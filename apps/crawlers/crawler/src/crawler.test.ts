import { describe, expect, it, vi } from "vitest";

import { crawlCandidate } from "./crawler.js";

const candidate = {
  sourceKey: "fixture-source",
  sourceName: "Fixture Source",
  sourceUrl: "https://fixture.example",
  countryCode: "CO",
  cityName: "Barranquilla",
  operations: {
    rent: {
      requestUrl: "https://fixture.example/listings?operation=rent",
      extractionRecipe: {
        contentType: "application/json",
        listingCollectionPath: "results.items",
        fields: { id: "id", priceCop: "price" },
      },
    },
    sale: {
      requestUrl: "https://fixture.example/listings?operation=sale",
      extractionRecipe: {
        contentType: "application/json",
        listingCollectionPath: "results.items",
        fields: { id: "id", priceCop: "price" },
      },
    },
  },
};

function jsonResponse(id: string, price: number, status = 200): Response {
  return new Response(JSON.stringify({ results: { items: [{ id, price }] } }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

describe("crawlCandidate", () => {
  it("fetches and parses each configured request in operation order", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return url.endsWith("rent")
        ? jsonResponse("rent-1", 1800000)
        : jsonResponse("sale-1", 320000000);
    });
    const moments = [
      "2026-10-30T12:00:00.000Z",
      "2026-10-30T12:00:01.000Z",
      "2026-10-30T12:00:02.000Z",
      "2026-10-30T12:00:03.000Z",
    ];
    const now = vi.fn(
      () => new Date(moments.shift() ?? "2026-10-30T12:00:04.000Z"),
    );

    const result = await crawlCandidate(candidate, { fetch, now });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://fixture.example/listings?operation=rent",
      "https://fixture.example/listings?operation=sale",
    ]);
    expect(result.artifact).toMatchObject({
      schemaVersion: 1,
      sourceKey: "fixture-source",
      sourceName: "Fixture Source",
      cityName: "Barranquilla",
      startedAt: "2026-10-30T12:00:00.000Z",
      completedAt: "2026-10-30T12:00:03.000Z",
      status: "succeeded",
      operations: {
        rent: {
          requestUrl: "https://fixture.example/listings?operation=rent",
          status: "parsed",
          listingCount: 1,
        },
        sale: {
          requestUrl: "https://fixture.example/listings?operation=sale",
          status: "parsed",
          listingCount: 1,
        },
      },
      listings: [
        {
          sourceListingId: "rent-1",
          operation: "rent",
          priceCop: 1800000,
          observedAt: "2026-10-30T12:00:01.000Z",
        },
        {
          sourceListingId: "sale-1",
          operation: "sale",
          priceCop: 320000000,
          observedAt: "2026-10-30T12:00:02.000Z",
        },
      ],
    });
  });

  it("preserves normalized property type and social stratum in the run artifact", async () => {
    const enrichedCandidate = {
      ...candidate,
      operations: {
        rent: {
          ...candidate.operations.rent,
          extractionRecipe: {
            ...candidate.operations.rent.extractionRecipe,
            propertyType: { mode: "constant", value: "apartment" },
            fields: {
              ...candidate.operations.rent.extractionRecipe.fields,
              socialStratum: "stratum",
            },
          },
        },
      },
    };
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: { items: [{ id: "rent-1", price: 1800000, stratum: 4 }] },
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );

    const result = await crawlCandidate(enrichedCandidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(result.artifact.listings).toMatchObject([
      {
        sourceListingId: "rent-1",
        operation: "rent",
        propertyType: "apartment",
        socialStratum: 4,
      },
    ]);
  });

  it("fetches every category request and combines its typed listings", async () => {
    const multiTypeCandidate = {
      ...candidate,
      operations: {
        rent: {
          requests: [
            {
              requestKey: "apartment",
              requestUrl: "https://fixture.example/rent/apartment",
              extractionRecipe: {
                ...candidate.operations.rent.extractionRecipe,
                propertyType: { mode: "constant", value: "apartment" },
              },
            },
            {
              requestKey: "house",
              requestUrl: "https://fixture.example/rent/house",
              extractionRecipe: {
                ...candidate.operations.rent.extractionRecipe,
                propertyType: { mode: "constant", value: "house" },
              },
            },
          ],
        },
      },
    };
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(
        JSON.stringify({
          results: {
            items: [
              {
                id: url.endsWith("house") ? "house-1" : "apt-1",
                price: url.endsWith("house") ? 2200000 : 1800000,
              },
            ],
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    });

    const result = await crawlCandidate(multiTypeCandidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "https://fixture.example/rent/apartment",
      "https://fixture.example/rent/house",
    ]);
    expect(result.artifact.operations.rent).toMatchObject({
      status: "parsed",
      listingCount: 2,
      requestUrls: [
        "https://fixture.example/rent/apartment",
        "https://fixture.example/rent/house",
      ],
      requests: [
        { requestKey: "apartment", status: "parsed", listingCount: 1 },
        { requestKey: "house", status: "parsed", listingCount: 1 },
      ],
    });
    expect(result.artifact.listings).toMatchObject([
      { sourceListingId: "apt-1", propertyType: "apartment" },
      { sourceListingId: "house-1", propertyType: "house" },
    ]);
  });

  it("retains successful category requests when another category request fails", async () => {
    const multiTypeCandidate = {
      ...candidate,
      operations: {
        rent: {
          requests: [
            {
              requestKey: "apartment",
              requestUrl: "https://fixture.example/rent/apartment",
              extractionRecipe: candidate.operations.rent.extractionRecipe,
            },
            {
              requestKey: "house",
              requestUrl: "https://fixture.example/rent/house",
              extractionRecipe: candidate.operations.rent.extractionRecipe,
            },
          ],
        },
      },
    };
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith("house")
        ? new Response("failed", { status: 503 })
        : jsonResponse("apt-1", 1800000),
    );

    const result = await crawlCandidate(multiTypeCandidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(result.artifact.status).toBe("failed");
    expect(result.artifact.operations.rent).toMatchObject({
      status: "fetch_failed",
      listingCount: 1,
      requests: [
        { requestKey: "apartment", status: "parsed", listingCount: 1 },
        { requestKey: "house", status: "fetch_failed", listingCount: 0 },
      ],
    });
    expect(
      result.artifact.listings.map((listing) => listing.sourceListingId),
    ).toEqual(["apt-1"]);
  });

  it("continues after a failed operation and retains successful listings", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith("rent")
        ? new Response("private error body", { status: 503 })
        : jsonResponse("sale-1", 320000000),
    );

    const result = await crawlCandidate(candidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(result.artifact.status).toBe("failed");
    expect(result.artifact.operations.rent).toMatchObject({
      status: "fetch_failed",
      error: { code: "http_status" },
    });
    expect(result.artifact.operations.sale).toMatchObject({
      status: "parsed",
      listingCount: 1,
    });
    expect(
      result.artifact.listings.map((listing) => listing.operation),
    ).toEqual(["sale"]);
    expect(JSON.stringify(result.artifact)).not.toContain("private error body");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("preserves adapter parse failures and continues with the other operation", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith("rent")
        ? new Response("not json", { headers: { "content-type": "text/html" } })
        : jsonResponse("sale-1", 320000000),
    );

    const result = await crawlCandidate(candidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(result.artifact.operations.rent).toMatchObject({
      status: "parse_failed",
      error: { code: "content_type_drift" },
    });
    expect(result.artifact.operations.sale?.status).toBe("parsed");
    expect(
      result.artifact.listings.map((listing) => listing.sourceListingId),
    ).toEqual(["sale-1"]);
  });

  it("does not fetch when the candidate is rejected", async () => {
    const fetch = vi.fn();

    await expect(
      crawlCandidate({ ...candidate, operations: {} }, { fetch }),
    ).resolves.toEqual({
      kind: "candidate_failed",
      code: "invalid_operations",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("treats valid empty responses as parsed operations", async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ results: { items: [] } }), {
          headers: { "content-type": "application/json" },
        }),
    );

    const result = await crawlCandidate(candidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(result.artifact.status).toBe("succeeded");
    expect(result.artifact.operations).toEqual({
      rent: {
        requestUrl: "https://fixture.example/listings?operation=rent",
        requestUrls: ["https://fixture.example/listings?operation=rent"],
        requests: [
          {
            requestKey: "default",
            requestUrl: "https://fixture.example/listings?operation=rent",
            status: "parsed",
            listingCount: 0,
          },
        ],
        status: "parsed",
        listingCount: 0,
      },
      sale: {
        requestUrl: "https://fixture.example/listings?operation=sale",
        requestUrls: ["https://fixture.example/listings?operation=sale"],
        requests: [
          {
            requestKey: "default",
            requestUrl: "https://fixture.example/listings?operation=sale",
            status: "parsed",
            listingCount: 0,
          },
        ],
        status: "parsed",
        listingCount: 0,
      },
    });
    expect(result.artifact.listings).toEqual([]);
  });

  it("rejects an HTTP redirect and continues to later operations", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith("rent")
        ? new Response(null, {
            status: 302,
            headers: { location: "http://fixture.example/insecure" },
          })
        : jsonResponse("sale-1", 320000000),
    );

    const result = await crawlCandidate(candidate, { fetch });

    expect(result.kind).toBe("completed");
    if (result.kind !== "completed") throw new Error("expected completed run");
    expect(result.artifact.operations.rent).toMatchObject({
      status: "fetch_failed",
      error: { code: "redirect_policy" },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(([url]) => String(url))).not.toContain(
      "http://fixture.example/insecure",
    );
  });

  it("enforces response size and operation timeout limits", async () => {
    const oversizedFetch = vi.fn(async (input: string | URL | Request) =>
      String(input).endsWith("rent")
        ? new Response("12345678901", {
            headers: { "content-type": "application/json" },
          })
        : jsonResponse("sale-1", 320000000),
    );
    const oversized = await crawlCandidate(candidate, {
      fetch: oversizedFetch,
      maxResponseBytes: 10,
    });
    expect(oversized.kind).toBe("completed");
    if (oversized.kind !== "completed")
      throw new Error("expected completed run");
    expect(oversized.artifact.operations.rent).toMatchObject({
      status: "fetch_failed",
      error: { code: "response_too_large" },
    });

    const hangingFetch = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const timedOut = await crawlCandidate(candidate, {
      fetch: hangingFetch,
      timeoutMs: 5,
    });
    expect(timedOut.kind).toBe("completed");
    if (timedOut.kind !== "completed")
      throw new Error("expected completed run");
    expect(timedOut.artifact.operations.rent).toMatchObject({
      status: "fetch_failed",
      error: { code: "timeout" },
    });
  });
});
