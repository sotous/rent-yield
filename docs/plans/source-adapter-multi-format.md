# Multi-Format Source Adapter Builder

## Status

`in-progress` — 2026-10-30.

## Goal

Make the source-adapter builder site agnostic at the response-parsing boundary.
One candidate can declare an operation-specific extraction recipe for supported
response formats, and a built adapter normalizes each supplied response into
the existing `ListingInput` contract.

## Why

The builder currently claims JSON-only parsing while the candidate validator
also accepts `text/html`. That mismatch excludes many listing sites and can
accept recipes that the builder cannot execute. Publicly available listing
pages, feeds, and published APIs may use different formats, so a source
candidate should describe the observed format rather than require one universal
JSON layout.

## Contract decisions

- Keep adapter building deterministic and offline: callers supply a response
  body; the builder performs no HTTP requests, browser automation, crawling, or
  persistence.
- Support JSON, static HTML, CSV, and XML response bodies in this iteration.
- Use format-specific extraction recipes: dot paths for JSON and parsed XML,
  header names for CSV, and CSS selectors with text/attribute selection for
  HTML.
- Keep recipes explicit per operation. Do not guess source URLs, extraction
  rules, or rent/sale classification.
- Keep the normalized `ListingInput` contract unchanged.
- The builder parses supplied content. It does not make access, consent, reuse,
  or source-permission decisions and does not implement bypasses for access
  controls.
- Browser-rendered JavaScript execution, pagination, request orchestration,
  authentication, retries, and source-specific custom code remain out of scope.

## Scope

- Define a discriminated recipe contract for JSON, HTML, CSV, and XML.
- Align candidate validation and runtime parsing so every accepted recipe can
  be executed by the adapter.
- Implement extraction, required-field validation, and typed failures for each
  format.
- Add contract and parser tests for every format, including malformed input,
  missing collections, and missing required listing fields.
- Update the candidate-discovery skill so it can describe evidenced format-
  specific recipes without treating a source as buildable when its format is
  unsupported or the necessary extraction evidence is absent.
- Update package/root documentation and record a retrospective.

## Out of scope

- Fetching source pages or APIs, crawling, browser automation, anti-bot or
  authentication handling, pagination, rate limiting, scheduling, and storage.
- Inferring undocumented endpoints or bypassing site controls.
- Changing rent/sale domain semantics or the normalized listing shape.
- Claiming that public visibility proves permission or suitability.

## Risks and assumptions

- Static HTML parsing cannot render JavaScript applications; those require a
  future browser-backed response provider.
- CSS selectors and field paths can drift when a source changes its markup or
  schema. A built adapter only validates against the supplied response, not a
  live source.
- CSV and XML conventions vary. Recipes must specify the collection and fields
  explicitly, and parser behavior must be documented to avoid implicit
  coercions.
- New parser dependencies increase package maintenance and should be narrowly
  scoped to this package.

## Files likely to change

- `apps/crawlers/source-adapter-builder/src/adapter-candidate.ts`
- `apps/crawlers/source-adapter-builder/src/source-adapter-builder.ts`
- `apps/crawlers/source-adapter-builder/src/*.test.ts`
- `apps/crawlers/source-adapter-builder/package.json` and lockfile
- `apps/crawlers/source-adapter-builder/README.md`
- `.codex/skills/find-candidates/SKILL.md`
- `README.md` and a builder retrospective

## Validation

- Write focused failing tests before implementing each recipe/parser path.
- Run source-adapter-builder tests, typecheck, lint, and format checks.
- Confirm checked-in candidate artifacts remain valid and the synthetic fixture
  still builds.
- Validate each new recipe against local representative response fixtures;
  do not request live sources.
- Run `git diff --check` and review docs against the final contract.

## Success criteria

- JSON, HTML, CSV, and XML candidates are accepted only when they declare a
  supported, executable recipe.
- Each format can emit equivalent normalized listings from representative
  local response fixtures.
- Unsupported or malformed inputs fail with typed errors rather than silent
  partial output.
- No network or browser behavior is introduced into the builder.
