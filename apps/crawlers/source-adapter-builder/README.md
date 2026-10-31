# Source Adapter Builder

`@rent-yield/source-adapter-builder` turns one local `AdapterCandidate` JSON
artifact into a source adapter. A candidate can configure rent, sale, or both
operations independently. Each operation declares its response format and an
executable extraction recipe. The builder accepts JSON, static HTML, CSV, and
XML and parses supplied response bodies into `ListingInput[]`; it does not fetch
responses, render JavaScript, register adapters, or run a crawler.

## Build a source adapter

From the repository root, run:

```sh
pnpm --filter @rent-yield/source-adapter-builder run adapter:build \
  --candidate fixtures/candidates/example-baq-rentals.json
```

The command reads one local JSON file and prints a `built` summary with the
source key, supported operations, and operation request URLs. `AdapterCandidate`
is builder input. The [crawler package](../crawler/README.md) fetches one
response for each configured operation and supplies its operation, request URL,
content type, body, and observation timestamp to `adapter.parse()`. The adapter
returns normalized listings tagged with that operation.

Invalid arguments, unreadable files, malformed JSON, or an unsupported
candidate return a typed build failure and a nonzero status.

## Candidate contract

The canonical `sourceUrl` identifies the source. Every supported operation has
its own request URL and extraction recipe. JSON and XML use dot paths. CSV maps
normalized fields to header names. Static HTML uses CSS selectors for listing
cards and fields; a field can read text or an HTML attribute. For example:

```json
{
  "format": "html",
  "contentType": "text/html",
  "listingSelector": "article.property-card",
  "fields": {
    "id": { "selector": "[data-property-id]", "attribute": "data-property-id" },
    "priceCop": { "selector": ".price", "numberFormat": "cop" },
    "listingUrl": { "selector": "a.details", "attribute": "href" }
  }
}
```

CSV recipes use `contentType: "text/csv"` and map fields to header names. XML
recipes use `application/xml` or `text/xml`, a `listingCollectionPath`, and
field dot paths (including `@_attribute` paths when the XML recipe retains
attributes). CSV delimiter may be comma (default), semicolon, or tab. The
response `Content-Type` may include parameters such as `charset`; matching uses
the normalized media type. The JSON example below shows the candidate envelope:

```json
{
  "sourceKey": "dc-colombia",
  "sourceName": "D.C Colombia S.A.S.",
  "sourceUrl": "https://dccolombia.com.co",
  "countryCode": "CO",
  "cityName": "Barranquilla",
  "operations": {
    "rent": {
      "requestUrl": "https://dccolombia.com.co/api/properties?operation=rent&city=Barranquilla",
      "extractionRecipe": {
        "format": "json",
        "contentType": "application/json",
        "listingCollectionPath": "properties",
        "fields": {
          "id": "slug",
          "priceCop": "price_rent"
        }
      }
    },
    "sale": {
      "requestUrl": "https://dccolombia.com.co/api/properties?operation=sale&city=Barranquilla",
      "extractionRecipe": {
        "format": "json",
        "contentType": "application/json",
        "listingCollectionPath": "properties",
        "fields": {
          "id": "slug",
          "priceCop": "price_sale"
        }
      }
    }
  }
}
```

Each operation needs its own verified `id` and `priceCop` paths. Optional paths
include `builtAreaSqm`, `bedrooms`, `neighborhood`, and `listingUrl`. A candidate
can define one operation when evidence for the other is incomplete. The built
adapter exposes `supportedOperations` and a `sourceUrls` map for the crawler;
each `SourceResponse` carries the operation label, and the parser checks that
the label and URL match the candidate.

The checked-in `fixtures/candidates/example-baq-rentals.json` is synthetic: its
`example.test` URL and recipe illustrate the contract only. It is not a real
source candidate, a retained source response, or permission to access any
third-party website.

Candidates discovered for future builder use are stored separately under
`candidates/<sourceKey>.json`. The `find-candidates` skill reads those files to
avoid duplicate candidates and appends new artifacts without overwriting them.

## Boundaries

This package uses no HTTP or DNS transport, browser automation, credentials,
pagination, fixture capture, crawler runtime, adapter registry, Rent Model call,
or durable write. HTML parsing handles supplied static markup and does not run
page scripts. A built adapter does not authorize third-party access or prove
that its recipes match live source responses.
