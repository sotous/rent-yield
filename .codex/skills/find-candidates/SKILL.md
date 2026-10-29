---
name: find-candidates
description: Produce new builder-ready Colombian, Barranquilla listing-source candidates. Use when a source adapter needs a complete candidate artifact; never generate or invoke the adapter.
---

# Find Candidates

Use this skill to produce new builder-ready listing-source candidate artifacts
for Colombia, initially Barranquilla. Each artifact is the sole input to the
source-adapter build step. It is not a candidate registration, access decision,
adapter implementation, or crawler invocation.

## Required boundaries

- Research only public internet search/index evidence and public pages needed
  to identify an organization and its apparent listing offering. Do not visit
  listing-detail pages, enumerate search results, submit forms, log in, bypass
  controls, call undocumented endpoints, or make any collection/probe request.
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
   Prefer first-party organization, city/category, and public policy/about
   pages. Capture only the minimal page facts needed for attribution.
2. Normalize each discovery to its organization name and canonical HTTPS
   homepage URL. Exclude sources already represented in the store. When a
   match is plausible but cannot be resolved, report `possible_duplicate` and
   do not write it. Deduplicate discoveries from this run by the same keys.
3. Keep unknowns explicit, including whether public evidence supports
   long-term, residential, rental, sale, or city-specific scope.
4. Emit an artifact only when it satisfies the complete contract below. Its
   extraction paths must come from a representative JSON source fixture
   supplied with the task; do not retrieve a fixture as part of discovery or
   invent paths from the candidate identity or URL.
5. Before saving, re-check the target filename and compare its source URL with
   stored artifacts. Never overwrite an existing file. If a key or source
   identity collision appears, skip the write and report the conflict.
6. Save each complete candidate as formatted JSON at
   `apps/crawlers/source-adapter-builder/candidates/<sourceKey>.json`. Confirm
   the file was written and report its path. If writing fails, return the
   candidate in the response as unsaved and explain the failure.

## AdapterCandidate contract

Each emitted artifact must be one standalone JSON object. Do not wrap it in a
discovery report, add report metadata, or combine multiple sources in one file.

```json
{
  "sourceKey": "lowercase-source-key",
  "sourceName": "Source display name",
  "sourceUrl": "https://example.com/listings",
  "countryCode": "CO",
  "cityName": "Barranquilla",
  "supportedOperations": ["rent"],
  "extractionRecipe": {
    "contentType": "application/json",
    "listingCollectionPath": "results.items",
    "fields": {
      "id": "id",
      "priceCop": "price"
    }
  }
}
```

The constraints are mandatory:

- `sourceKey` matches `^[a-z][a-z0-9-]{1,62}$`.
- `sourceUrl` is canonical HTTPS with no username or password.
- `countryCode` is `CO`; `cityName` is `Barranquilla`.
- `supportedOperations` has exactly one value: `rent` or `sale`.
- `contentType` is `application/json`.
- `listingCollectionPath`, `fields.id`, and `fields.priceCop` are nonempty dot
  paths proven by the supplied fixture. Optional paths are `builtAreaSqm`,
  `bedrooms`, `neighborhood`, and `listingUrl`.

## Output

Save one standalone `AdapterCandidate` JSON object per new source that satisfies
the contract. Do not wrap the object in a discovery report, add report metadata,
or combine multiple sources in one file. In the response, summarize the saved
file paths. For an incomplete or ambiguous source, save no artifact and state
the specific missing fixture evidence or duplicate basis separately.

Do not invent field paths or source-access permission. A valid empty result is
successful when no discovered source is both absent from the store and
supported by sufficient fixture evidence.
