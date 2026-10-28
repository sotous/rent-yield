# Source Adapter Builder Boundary

## Status

`completed` — 2026-10-28.

## Goal

Replace the uncommitted top-level `apps/listing-import` prototype with
`apps/crawlers/source-adapter-builder`. The resulting workspace package owns
only the source-adapter-builder boundary: validating a candidate artifact,
building a source adapter, and parsing a supplied source response into
`ListingInput[]`.

## Why

`listing-import` inaccurately makes a narrow adapter-builder proof look like a
product import application. It also currently combines builder logic with a
crawler runner and adapter registry, which blurs the boundary the pipeline
needs to preserve.

## Scope

- Move the package to `apps/crawlers/source-adapter-builder` and retain its
  `@rent-yield/source-adapter-builder` workspace identity.
- Retain the `AdapterCandidate`, `SourceAdapter`, `SourceResponse`, and
  `ListingInput` contracts, candidate validation, adapter construction, parser
  behavior, fixture-backed unit tests, and the developer-invoked
  `adapter:build` command.
- Remove the adapter registry, crawler/import runner, runner tests, and any
  documentation that calls this package a listing-import or crawler runtime.
- Retain synthetic artifacts only as builder test fixtures. They are not a
  canonical candidate store and do not authorize source access.
- Update workspace documentation and the `find-candidates` skill so they no
  longer treat the removed top-level package as a candidate store.

## Out of Scope

- A crawler runtime, fetching transport, scheduling, persistence, registry,
  live source access, browser automation, or durable candidate storage.
- Changing source-selection rules beyond removing the nonexistent candidate
  store dependency.

## Proposed implementation

1. Write failing path/CLI tests for the renamed package and retain focused
   adapter-build behavior tests.
2. Move the builder-only files and rename the workspace package.
3. Remove `crawler-import.ts`, its tests, pipeline runner tests, and their
   documentation claims.
4. Update the candidate skill to deduplicate only within its current discovery
   run; persistent candidate storage remains a separate design decision.
5. Update root/package documentation; run focused tests, typecheck, lint, and
   repository checks.
6. Record the retrospective and documentation outcome.

## Risks and assumptions

- `apps/crawlers/` is a namespace, not evidence that a crawler runtime exists.
  This package remains builder-only.
- The current candidate artifact directory is prototype fixture material, not a
  registry. The skill may only deduplicate sources it discovers in one run.
- The workspace lockfile may require a targeted update when the workspace path
  changes; unrelated dirty lockfile edits must be preserved.

## Validation

- `pnpm --filter @rent-yield/source-adapter-builder typecheck`
- `pnpm --filter @rent-yield/source-adapter-builder lint`
- `pnpm --filter @rent-yield/source-adapter-builder test`
- Run `adapter:build` against the synthetic fixture and confirm a `built`
  result without any source request.
- Run relevant workspace checks and `git diff --check`.

## Completion evidence

- The builder package lives at `apps/crawlers/source-adapter-builder` as
  `@rent-yield/source-adapter-builder`.
- The crawler registry, runner, and their tests were removed. The package ends
  at `SourceAdapter.parse`.
- `find-candidates` does not treat prototype fixture files or an invented
  registry export as a candidate store; it deduplicates only within one run.
- Focused test, typecheck, lint, and synthetic `adapter:build` checks passed.
