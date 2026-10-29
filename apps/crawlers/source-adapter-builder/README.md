# Source Adapter Builder

`@rent-yield/source-adapter-builder` turns one local `AdapterCandidate` JSON
artifact into a source adapter. The resulting adapter parses a supplied source
response into `ListingInput[]`; it does not fetch responses, register adapters,
or run a crawler.

## Build a source adapter

From the repository root, run:

```sh
pnpm --filter @rent-yield/source-adapter-builder run adapter:build \
  --candidate fixtures/candidates/example-baq-rentals.json
```

The command reads exactly one local JSON file and prints a `built` summary for
the generated adapter. `AdapterCandidate` is builder input. The generated
adapter later receives a supplied source response and returns `ListingInput[]`.

Invalid arguments, unreadable files, malformed JSON, or an unsupported
candidate return a typed build failure and a nonzero status.

## Builder input contract

The builder accepts one `AdapterCandidate` JSON artifact with these fields:

```json
{
  "sourceKey": "lowercase-source-key",
  "sourceName": "Source display name",
  "sourceUrl": "https://example.test/listings",
  "countryCode": "CO",
  "cityName": "Barranquilla",
  "supportedOperations": ["rent"],
  "extractionRecipe": {
    "contentType": "application/json",
    "listingCollectionPath": "results.items",
    "fields": {
      "id": "id"
    }
  }
}
```

The checked-in `fixtures/candidates/example-baq-rentals.json` is synthetic: its
`example.test` URL and recipe illustrate the contract only. It is not a real
source candidate, a retained source response, or permission to access any
third-party website.

Candidates discovered for future builder use are stored separately under
`candidates/<sourceKey>.json`. The `find-candidates` skill reads those files to
avoid saving duplicate candidates and appends new artifacts without overwriting
existing ones.

## Boundaries

This package uses no HTTP or DNS transport, browser automation, credentials,
pagination, fixture capture, crawler runtime, adapter registry, Rent Model call,
or durable write. A built adapter does not authorize third-party access or prove
that its recipe matches a live source response.
