---
name: find-candidates
description: Discover new builder-ready Colombian, Barranquilla listing sources and save evidence-backed operation recipes. Never generate or invoke the adapter.
---

# Find Candidates

Use this skill to produce new builder-ready listing-source candidate artifacts
for Colombia, initially Barranquilla. It starts from no user-provided candidate
or fixture: discover sources, check the local candidate store, and save any
complete artifacts found. Each artifact is the sole input to the source-adapter
build step. It is not a candidate registration, access decision, adapter
implementation, or crawler invocation.

## Required boundaries

- Research public internet evidence and publicly accessible listing/search pages
  needed to identify the source and verify a representative extraction recipe.
  Do not submit forms, log in, bypass technical access controls, or call
  undocumented endpoints. Inspect only the minimum page structure needed to
  verify the recipe; do not exhaustively enumerate listings.
  Do not require the user to supply candidates, fixtures, or a registry export.
- Use `apps/crawlers/source-adapter-builder/candidates/` as the persistent,
  append-only store for complete `AdapterCandidate` artifacts. Read its existing
  JSON files before researching and compare source keys, normalized hostnames,
  and registrable domains. Create the directory if it does not exist.
- Treat public visibility as discovery evidence only. Do not infer technical or
  contractual permission, robots status, reuse rights, completeness, or
  suitability for a crawler.
- Do not generate an adapter or invoke a builder or crawler.

## Workflow

1. Search the public web for organizations that appear to publish Colombian
   residential rent or sale listings and show a credible Barranquilla presence.
   Prefer first-party organization, city/category, and public policy/about pages.
   Capture only the minimal page facts needed for attribution.
2. Normalize each discovery to its organization name and canonical HTTPS
   homepage URL. Exclude sources already represented in the store. When a match
   is plausible but cannot be resolved, report `possible_duplicate` and do not
   write it. Deduplicate discoveries from this run by the same keys.
3. Keep unknowns explicit, including whether public evidence supports
   long-term, residential, rental, sale, or city-specific scope.
4. For each operation the source supports, verify its response format and a
   representative listing structure from public documentation, a published
   schema, or a publicly accessible source page. Do not invent request URLs,
   paths, selectors, or field names. Verify each operation's listing collection
   and required ID/price mappings independently. Include rent, sale, or both
   only when each recipe is supported by evidence. The builder accepts JSON,
   static HTML, CSV, and XML; it does not render JavaScript.
5. Before saving, re-check the target filename and compare the source URL with
   stored artifacts. Never overwrite an existing file. If a key or source
   identity collision appears, skip the write and report the conflict.
6. Save each complete candidate as formatted JSON at
   `apps/crawlers/source-adapter-builder/candidates/<sourceKey>.json`. Confirm
   the file was written and report its path. If writing fails, return the
   candidate in the response as unsaved and explain the failure.

## AdapterCandidate contract

Each emitted artifact is one standalone JSON object. `sourceUrl` identifies the
source's canonical HTTPS homepage or API base. `operations` contains one entry
for each evidenced operation and configures the URL and extraction recipe the
future crawler must use for that operation. JSON and XML recipes use dot paths;
CSV recipes map fields to header names; static HTML recipes select listing cards
and fields with CSS selectors. HTML fields may read text or an attribute.

```json
{
  "sourceKey": "lowercase-source-key",
  "sourceName": "Source display name",
  "sourceUrl": "https://example.com",
  "countryCode": "CO",
  "cityName": "Barranquilla",
  "operations": {
    "rent": {
      "requestUrl": "https://example.com/api/listings?operation=rent",
      "extractionRecipe": {
        "format": "json",
        "contentType": "application/json",
        "listingCollectionPath": "results.items",
        "fields": {
          "id": "id",
          "priceCop": "rent.amount"
        }
      }
    },
    "sale": {
      "requestUrl": "https://example.com/api/listings?operation=sale",
      "extractionRecipe": {
        "format": "json",
        "contentType": "application/json",
        "listingCollectionPath": "results.items",
        "fields": {
          "id": "id",
          "priceCop": "sale.amount"
        }
      }
    }
  }
}
```

Other supported recipe shapes:

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

```json
{
  "format": "csv",
  "contentType": "text/csv",
  "delimiter": ";",
  "fields": { "id": "codigo", "priceCop": "precio" }
}
```

For XML, use `contentType: "application/xml"` or `"text/xml"`, a
`listingCollectionPath`, and field dot paths as for JSON.

The constraints are mandatory:

- `sourceKey` matches `^[a-z][a-z0-9-]{1,62}$`.
- `sourceUrl` and every operation's `requestUrl` are HTTPS URLs with no
  username or password.
- `countryCode` is `CO`; `cityName` is `Barranquilla`.
- `operations` contains at least one of `rent` and `sale`, with no other keys.
- Each recipe uses one supported format (`json`, `html`, `csv`, or `xml`) and
  its matching content type. Include the `format` discriminator for HTML, CSV,
  and XML recipes; existing JSON artifacts may omit it.
- JSON/XML require a nonempty `listingCollectionPath` and nonempty dot paths for
  `fields.id` and `fields.priceCop`.
- CSV maps `fields.id` and `fields.priceCop` to nonempty header names. An
  evidenced comma, semicolon, or tab delimiter may be declared.
- HTML requires a nonempty `listingSelector` and selector objects for `id` and
  `priceCop`. Optional fields may map `builtAreaSqm`, `bedrooms`,
  `neighborhood`, and `listingUrl`.
- For HTML numeric strings, declare the evidenced format when separators need
  normalization: `cop` for periods as thousands and comma decimals,
  `grouped-comma` for comma thousands, or `decimal-comma` for comma decimals.
- Include optional fields only when their mappings are verified.

## Output

Save one standalone `AdapterCandidate` JSON object per new source. Do not wrap
the object in a discovery report, add report metadata, or combine multiple
sources in one file. In the response, summarize saved paths. For an incomplete
or ambiguous source, save no artifact and state the specific evidence gap or
duplicate basis. A run with no complete candidates is valid; do not ask the user
to provide missing evidence.

Do not invent field paths, selectors, or source-access permission. Public
visibility does not establish suitability or permission. A valid empty result
is successful when no discovered source is absent from the store with
sufficient recipe evidence for at least one operation.
