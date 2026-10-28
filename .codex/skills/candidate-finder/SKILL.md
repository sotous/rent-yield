---
name: candidate-finder
description: Find and prepare real listing-source candidates for the source-adapter builder. Use when selecting a source or producing its builder-ready candidate manifest.
---

# Candidate Finder

Use this skill to produce a real source candidate that the Source Adapter
Builder can consume. A URL-only discovery result is useful for research, but it
is not builder-ready.

## Output contract

The builder consumes an `AdapterCandidate` artifact with these required fields:

```ts
type AdapterCandidate = {
  sourceKey: string;
  sourceName: string;
  sourceUrl: string;
  countryCode: "CO";
  cityName: string;
  supportedOperations: Array<"rent" | "sale">;
  extractionRecipe: {
    contentType: "text/html" | "application/json";
    listingCollectionPath: string;
    fields: Record<string, string>;
  };
};
```

`extractionRecipe` is explicit parser input: it identifies the listing
collection and the source paths for normalized fields. Do not invent it from a
candidate's identity or URL alone.

## Workflow

1. Identify a real candidate and establish its source key, display name,
   configured source URL, Colombia city scope, and supported operation(s).
2. Inspect a representative source response or supplied fixture to establish
   content type, collection path, and field paths.
3. Produce the `AdapterCandidate` JSON only when every required field is
   explicit and supported by the inspected response or fixture.
4. If the source identity is known but its response structure is not, return a
   discovery result marked `adapterReady: false`; do not fabricate an
   `extractionRecipe`.
5. Hand a builder-ready candidate to the developer-invoked command:

   ```sh
   pnpm --filter @rent-yield/listing-import run adapter:generate \
     --candidate candidates/<source-key>.json
   ```

## Boundaries

- Candidate finding selects and describes a source; it does not generate
  adapter code or normalize listings.
- The builder makes the developer-invoked source request. Do not treat candidate
  discovery as a substitute for generated-adapter verification.
- A candidate that cannot supply an explicit extraction recipe is an incomplete
  input, not a parsing fallback.

## Success handoff

Builder validation needs two distinct builder-ready candidates. Each generated
adapter must later produce at least two normalized listings with no parsing
failure; four total listings prove the builder works across sources.
