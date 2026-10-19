# Basic Crawler Specification

## Status

in-progress — authorized on 2026-10-19.

## Goal

Define the smallest crawler that collects real Barranquilla rental and sale
listing data needed by the Rent Model and explorer. It serves one direct
product loop, not a reusable crawling platform.

## Decisions already made

- One source at a time, with source-specific parsing allowed.
- Developer-invoked collection; no schedule, queue, or generic runtime.
- Rental and sale listings are separate inputs.
- The crawler produces a local normalized dataset, initially JSON or SQLite.
- The crawler does not contain approval lifecycles, source profiles, generic
  transport, receipts, methodology state, durable-ingestion abstractions, or
  multi-source design.
- The specification focuses on data quality for the Rent Model. It does not
  model policy-compliance workflows. It does not describe bypassing
  authentication or access challenges.

## Delivery steps

1. Extract the smallest rental-evidence and sale-subject requirements from the
   Rent Model specification.
2. Identify the backend/explorer handoff needed to turn imported records into
   a visible yield ranking.
3. Define one compact source-agnostic listing record and the source-specific
   crawler/import responsibilities around it.
4. Define malformed-row handling, deduplication, freshness, and the smallest
   focused test suite without introducing platform abstractions.
5. Publish the specification and verify that it has no dependency on removed
   crawler/governance concepts.

## Success criteria

- An engineer can implement one source-specific collector without designing a
  framework first.
- The output contains enough real rental evidence for deterministic comparable
  rent estimation and enough sale data for yield ranking.
- Missing or malformed records are reported and skipped without corrupting the
  usable dataset.
- The specification makes the product data flow, ownership, and tests clear in
  one reading.
