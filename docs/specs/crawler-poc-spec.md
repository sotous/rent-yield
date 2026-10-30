# Proof-of-Concept Crawler Specification

## Status

Approved specification for the first developer-operated crawler. The crawler
does not exist yet. The source-adapter builder is implemented independently and
parses supplied response bodies; it does not make network requests.

## Purpose

Connect a saved `AdapterCandidate` to the adapter builder, retrieve one response
for each configured operation, parse those responses through the generated
adapter, and save an inspectable local artifact of normalized listings.
This proves the candidate → builder → crawler → `ListingInput[]` pipeline with
real candidate artifacts before adding pagination, scheduling, or model
integration.

## Pipeline and ownership

```text
find-candidates skill
  → one saved AdapterCandidate JSON file
  → source-adapter-builder builds an in-memory SourceAdapter
  → crawler fetches each supported operation once
  → SourceAdapter.parse(SourceResponse)
  → local crawl-run JSON artifact containing normalized ListingInput rows
```

- The candidate-finding skill discovers and saves candidates. It does not know
  about or invoke consumers.
- The builder validates the candidate and constructs an in-memory adapter. It
  does not fetch or persist anything.
- The crawler owns HTTP retrieval, run reporting, and writing the normalized
  output artifact.
- This crawler does not register or activate sources, infer access permission,
  or modify a Rent Model dataset.

## Invocation

The crawler is developer-invoked for exactly one candidate file per run:

```sh
pnpm --filter @rent-yield/crawler run crawl -- \
  --candidate apps/crawlers/source-adapter-builder/candidates/<sourceKey>.json
```

An optional `--output <path>` overrides the default output location. By default,
write a uniquely named artifact under
`data/crawler-runs/<sourceKey>/<startedAt>.json` relative to the repository
root. Never overwrite an existing run artifact. Print a concise run summary to
stdout and the artifact path to stderr or as a documented summary field.

## Run behavior

1. Read and validate the candidate, then build the adapter. On either failure,
   print the typed error and exit nonzero without making a request.
2. Iterate `adapter.supportedOperations` in the builder's declared order. For
   each operation, use exactly `adapter.sourceUrls[operation]` and make one
   HTTPS `GET` request. Do not synthesize or modify request URLs.
3. Use a bounded request timeout (30 seconds) and a bounded response body
   (10 MiB). Do not retry. Do not paginate, schedule, or parallelize operations
   in this first version.
4. Send no credentials, cookies, form submissions, or source-specific headers.
   Do not execute JavaScript, bypass access controls, or call endpoints absent
   from the candidate. Redirects may be followed only over HTTPS, with a
   maximum of five hops; use the originally configured request URL as the
   `SourceResponse.sourceUrl` so it matches the adapter recipe.
5. For a successful HTTP response, pass the operation, configured request URL,
   response `Content-Type`, response body as text, and one UTC ISO-8601
   `observedAt` timestamp to `adapter.parse()`.
6. Preserve the builder's parse result without dropping or repairing rows. The
   builder currently treats each response atomically: any invalid mapped row
   fails that operation; valid rows from that same response are not returned.
   A successfully parsed empty response is recorded as parsed with zero rows.
7. Continue to the next configured operation after an operation failure. Keep
   successful operation listings in the run artifact and record each failure.
   Exit nonzero if any configured operation fails, while retaining the artifact
   for diagnosis.
8. Do not store raw response bodies by default.

## Adapter boundary

The crawler supplies the existing `SourceResponse` shape:

```ts
type SourceResponse = {
  operation: "rent" | "sale";
  sourceUrl: string;
  contentType: string;
  body: string;
  observedAt: string;
};
```

The adapter returns either `{ kind: "parsed", listings: ListingInput[] }` or a
typed `{ kind: "parse_failed", code }`. The normalized listing shape is:

```ts
type ListingInput = {
  sourceKey: string;
  sourceListingId: string;
  operation: "rent" | "sale";
  priceCop: number;
  builtAreaSqm?: number;
  bedrooms?: number;
  neighborhood?: string;
  listingUrl?: string;
  observedAt: string;
};
```

The request URL must match the candidate's operation URL, and the response
content type must match that operation's recipe. The crawler passes the actual
response content type to the adapter; it does not relabel a response to make it
parse. Existing parser error codes are preserved in the run report.

## Output artifact

Write one JSON object per run with this shape:

```json
{
  "schemaVersion": 1,
  "sourceKey": "dc-colombia",
  "sourceName": "D.C Colombia",
  "cityName": "Barranquilla",
  "startedAt": "2026-10-30T12:00:00.000Z",
  "completedAt": "2026-10-30T12:00:03.000Z",
  "status": "succeeded",
  "operations": {
    "rent": {
      "requestUrl": "https://example.com/api/listings?operation=rent",
      "status": "parsed",
      "listingCount": 1
    },
    "sale": {
      "requestUrl": "https://example.com/api/listings?operation=sale",
      "status": "parsed",
      "listingCount": 1
    }
  },
  "listings": [
    {
      "sourceKey": "dc-colombia",
      "sourceListingId": "wasi-10018216",
      "operation": "rent",
      "priceCop": 2800000,
      "builtAreaSqm": 79,
      "bedrooms": 3,
      "neighborhood": "Chapinero",
      "observedAt": "2026-10-30T12:00:01.000Z"
    },
    {
      "sourceKey": "dc-colombia",
      "sourceListingId": "wasi-10018217",
      "operation": "sale",
      "priceCop": 350000000,
      "builtAreaSqm": 79,
      "bedrooms": 3,
      "neighborhood": "Chapinero",
      "observedAt": "2026-10-30T12:00:02.000Z"
    }
  ]
}
```

`status` is `succeeded` only when all configured operations fetched and parsed;
otherwise it is `failed`. Operation status is `parsed`, `fetch_failed`, or
`parse_failed`. Failed operations include a stable error code and safe summary,
not response bodies or secrets. `listings` is the concatenation of listings
from operations that parsed successfully. A zero-row parse is successful for
run reporting, but does not satisfy the pipeline smoke-test acceptance below.

## Failure behavior

- Invalid/unreadable candidate or builder rejection: no network request, no
  output artifact, nonzero exit.
- Timeout, TLS/network error, redirect policy violation, oversized body, or
  non-2xx status: mark that operation `fetch_failed`.
- Adapter parse failure: mark that operation `parse_failed` with its builder
  error code.
- Any failed operation: continue other declared operations, write the partial
  run artifact, and exit nonzero.
- All operations parsed, including valid empty responses: write a succeeded
  artifact and exit zero.

## Proof-of-concept acceptance

The crawler and builder integration is demonstrated when:

- the developer invokes the crawler with a real saved candidate artifact;
- the candidate builds into an adapter without changing its JSON by hand;
- every configured operation is fetched once and passed to that adapter;
- the run has no fetch or parse failure and produces at least one normalized
  listing for each configured operation;
- the output artifact records the operation URLs, statuses, counts, and
  normalized listings; and
- the smoke run succeeds for at least two distinct candidates and two
  extraction formats. The current candidate set can exercise HTML with
  Ciencuadras and JSON with D.C. Colombia; each has rent and sale operations.

This is an integration threshold, not a data-quality or market-coverage claim.
The earlier 30–100 rent and 30–100 sale target belongs to building a useful
model dataset, not to proving that the crawler invokes adapters correctly.

## Boundaries and follow-up

Out of scope for this version: pagination, retries, scheduling, multi-source
batch orchestration, raw-response archives, database persistence, source
health/approval lifecycle, and direct Rent Model ingestion.

The current `ListingInput` is not yet sufficient to create every
`ResidentialListing` required by the Rent Model. In particular, city and
property type are absent from parsed rows, and bathrooms/social stratum are not
mapped. A separate mapping/enrichment contract must resolve that gap before
connecting crawler output to the Rent Model or Explorer.

## References

- [Source-adapter builder guide](../../apps/crawlers/source-adapter-builder/README.md)
- [PoC crawler reset plan](../plans/poc-crawler-reset.md)
- [Rent Model specification](rent-model-spec.md)
