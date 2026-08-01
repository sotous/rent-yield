# Backend Prototype Contract Review

## Summary

The first backend prototype contract is aligned with the current v1 frontend
prototype and shared domain spec.

The contract is intentionally read-only and narrow. It defines the payloads
needed to replace fake Barranquilla data without starting backend
implementation, ingestion, database design, authentication, advanced
underwriting, filters, or transactions.

## Reviewed Against

- `README.md`
- `specs/frontend-spec.md`
- `specs/frontend-interaction-spec.md`
- `specs/domain-spec.md`
- `docs/architecture/frontend-prototype-v1.md`
- `docs/reviews/prototype-v1-ergonomics-review.md`
- `plan/prototype-v1-explorer-foundation.md`
- current frontend fake data and TypeScript domain types

## What Works

The contract follows the frontend's proven workflow:

1. load Barranquilla areas,
2. select one area,
3. show map context,
4. rank properties by `gross_rent_yield`,
5. display that metric to users as `rent return`.

The two-endpoint shape is small enough for the first backend implementation:

- `GET /api/v1/explorer/bootstrap`
- `GET /api/v1/explorer/areas/{area_id}`

The selected-area endpoint returns the full explorer payload in one response, so
the frontend does not need to choreograph several backend calls before it can
render the map and chart.

## Spec Alignment

The contract preserves the shared domain language:

- `annual_rent`
- `gross_rent_yield`
- `sale_to_rent_ratio`
- `metric_status`
- `rent_source_type`
- `sale_price_source_type`
- `listing_url`

It also preserves the frontend communication standard:

- payloads use canonical metric names
- UI copy remains free to say `rent return`
- `sale-to-rent ratio` stays out of the primary v1 chart
- listing URLs are contextual source links, not property detail pages or
  transaction flows

## Decisions

- The backend owns canonical metric calculation.
- API payloads use COP and decimal yield values.
- The first selected-area payload returns rankable properties.
- Missing or invalid metric states remain part of the domain model, but the
  first chart integration does not need to render unrankable rows.
- Viewport is reserved as an area type, but viewport query behavior is deferred.

## Caveats

The contract keeps `metric_status` as one property-level field. This is enough
for prototype v1, but a later version may need per-input or per-metric status.

The contract allows `listing_url` to be `null` because real data may not always
include a usable public source link. The frontend should simply omit `View
listing` when no URL is present.

The first contract documents API behavior but does not choose backend framework,
storage, ingestion strategy, hosting, or runtime details.

## Next Step

Task 8 is complete from a contract/documentation perspective.

The next meaningful work package should be a backend implementation plan that
chooses the backend stack and implements these read-only endpoints against
prototype data.
