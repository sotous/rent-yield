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

- Before researching, require a supplied, current candidate-registry export.
  If it is missing, unreadable, or ambiguous, stop and report
  `dedupe_unavailable`; do not return candidates.
- Research only public internet search/index evidence and public pages needed
  to identify an organization and its apparent listing offering. Do not visit
  listing-detail pages, enumerate search results, submit forms, log in, bypass
  controls, call undocumented endpoints, or make any collection/probe request.
- Treat public visibility as discovery evidence only. Do not infer technical or
  contractual permission, robots status, reuse rights, completeness, or
  suitability for a crawler.
- Do not write to a registry, generate an adapter, invoke a builder or crawler,
  or otherwise change external state.

## Workflow

1. Obtain the supplied registry export and retain its read time and reference.
   Limit it to records relevant to `CO`, `barranquilla`, and listing discovery.
2. Search the public web for organizations that appear to publish Colombian
   residential rent or sale listings and show a credible Barranquilla presence.
   Prefer first-party organization, city/category, and public policy/about
   pages. Capture only the minimal page facts needed for attribution.
3. Normalize each discovery to its organization name and canonical HTTPS
   homepage URL. Compare it with registry source keys, normalized hostnames,
   and registrable domains. When a match is plausible but cannot be resolved,
   exclude it as `possible_duplicate` rather than emitting it.
4. Return only new candidates. Keep unknowns explicit, including whether the
   public evidence supports long-term, residential, rental, sale, or
   city-specific scope.
5. Emit an artifact only when it satisfies the complete contract below. Its
   extraction paths must come from a representative JSON source fixture
   supplied with the task; do not retrieve a fixture as part of discovery or
   invent paths from the candidate identity or URL.

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

Return only standalone `AdapterCandidate` JSON artifacts for sources absent
from the supplied registry export and satisfying the contract. For an
incomplete or possible-duplicate source, return no artifact and state the
specific missing fixture evidence or duplicate basis separately.

Do not invent registry fields, field paths, or source-access permission. A
valid empty result is successful when no source has both a unique registry
identity and sufficient fixture evidence.
