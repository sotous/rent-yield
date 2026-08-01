# Prototype v1 Consumer Contract

## Purpose

This note defines who consumes the prototype v1 backend API and what contract
the backend implementation must satisfy before frontend integration starts.

It exists to keep the backend provider and frontend consumer aligned while the
repo moves from fake frontend data to a local API-backed explorer.

## Scoped Consumer

The only scoped consumer for the prototype v1 API is the internal frontend
explorer in `apps/frontend`.

The consuming frontend surfaces are:

- `ExplorerScreen`
- named area selection
- area summary panel
- MapLibre property markers
- ranked rent-return chart
- contextual `View listing` link behavior

This API is not currently scoped for:

- public API access
- third-party clients
- mobile apps
- admin tools
- ingestion jobs
- analytics dashboards
- backend-to-backend integrations

## Contract Sources

The implementation contract is defined by:

- `specs/backend-api-spec.md`
- `docs/api/prototype-v1.md`

The backend implementation should expose:

```text
GET /api/v1/explorer/bootstrap
GET /api/v1/explorer/areas/{area_id}
```

The frontend integration should consume those endpoints for:

- supported areas
- default selected area
- selected area summary
- ranked property records
- sort metadata
- data label
- contextual listing URLs
- loading, ready, empty, and error states

## Type Sharing Decision

Do not introduce generated TypeScript client types or a shared frontend/backend
package in the first backend implementation.

The first priority is to make the runtime API match the written contract and
prove it with backend contract tests. Shared types can be reconsidered after the
backend and frontend integration reveal enough repetition or drift risk to
justify extraction.

## Done Boundary

The consumer contract is clear enough to begin backend implementation when:

- the scoped consumer is named as the frontend explorer
- the contract docs above are current
- non-consumers are explicitly out of scope
- frontend integration is deferred until the backend provider can be tested with
  prototype data
