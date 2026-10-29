# Source Adapter Builder

`@rent-yield/source-adapter-builder` turns one local `AdapterCandidate` JSON
artifact into a source adapter. A candidate can configure rent, sale, or both
operations independently. The resulting adapter parses supplied source
responses into `ListingInput[]`; it does not fetch responses, register
adapters, or run a crawler.

## Build a source adapter

From the repository root, run:

```sh
pnpm --filter @rent-yield/source-adapter-builder run adapter:build \
  --candidate fixtures/candidates/example-baq-rentals.json
```

The command reads one local JSON file and prints a `built` summary with the
source key, supported operations, and operation request URLs. `AdapterCandidate`
is builder input. A future runtime caller, such as a crawler, will fetch a
response for one configured operation and supply its operation, request URL,
content type, body, and observation timestamp to `adapter.parse()`. The adapter
returns normalized listings tagged with that operation.

Invalid arguments, unreadable files, malformed JSON, or an unsupported
candidate return a typed build failure and a nonzero status.

## Candidate contract

The canonical `sourceUrl` identifies the source. Every supported operation has
its own request URL and extraction recipe:

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
adapter exposes `supportedOperations` and a `sourceUrls` map so a future crawler
can coordinate requests; each `SourceResponse` carries the operation label, and
the parser checks that the label and URL match the candidate.

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
or durable write. A built adapter does not authorize third-party access or
prove that its recipes match live source responses.
