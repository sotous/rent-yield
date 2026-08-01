# prototype v1 backend contract and API docs

## Summary

Define the first backend-facing contract for the `rent-yield` prototype v1
explorer.

This is a documentation-only slice. It turns the finished frontend prototype's
fake data needs into a small API contract that can later guide backend
implementation.

## Goal

- Preserve the Barranquilla-first map-plus-chart workflow.
- Define the minimal read API needed to replace frontend fake data.
- Keep canonical domain names and metric formulas aligned with the shared domain
  spec.
- Give the frontend a practical API reference with example payloads.
- Avoid backend implementation, database, ingestion, auth, or advanced
  underwriting scope.

## Relevant Specs And Docs

- `README.md`
- `AGENTS.md`
- `specs/frontend-spec.md`
- `specs/frontend-interaction-spec.md`
- `specs/domain-spec.md`
- `docs/architecture/frontend-prototype-v1.md`
- `docs/reviews/prototype-v1-ergonomics-review.md`
- `plan/prototype-v1-explorer-foundation.md`

## Scope

This plan covers:

- backend API shape for the prototype explorer
- request parameters for startup and selected-area loading
- response envelopes for areas, area summaries, and properties
- field names, types, nullability, currency, units, and metric status
- error response shape
- frontend data-state implications
- a short review of contract alignment

This plan does not include:

- backend route implementation
- database schema design
- data ingestion or scraping
- rent estimation models
- authentication
- advanced underwriting
- filters, comparison, property detail pages, or transactions

## Contract Direction

The v1 frontend needs one simple screen payload more than it needs a general
backend resource graph.

The first API should therefore expose:

1. a bootstrap endpoint that tells the frontend which Barranquilla areas exist
   and which area should load first,
2. a selected-area endpoint that returns the active area, area summary, ranked
   properties, and data label in one response.

This keeps the contract close to the proven frontend workflow:

1. choose an area,
2. show map context,
3. rank homes by rent return,
4. expose the original listing URL only when the user shows interest.

## Proposed Endpoint Shape

### `GET /api/v1/explorer/bootstrap`

Purpose:

- load supported explorer areas for the first screen
- identify the default Barranquilla area

Required query parameters:

- `country_code=CO`
- `city_name=Barranquilla`

Returns:

- `default_area_id`
- `areas`
- `data_label`

### `GET /api/v1/explorer/areas/{area_id}`

Purpose:

- load the full map-plus-chart payload for one selected area

Returns:

- `area`
- `summary`
- `properties`
- `sort`
- `data_label`

The backend should return rankable properties first: records with usable sale
price, monthly rent, and coordinates. The shared domain may still represent
missing or invalid metrics, but the first chart contract should not require the
frontend to render unrankable property rows.

## Metric Ownership

The backend should own canonical metric calculation before data reaches the
frontend.

Rules:

- `annual_rent = monthly_rent_amount * 12`
- `gross_rent_yield = annual_rent / sale_price_amount`
- `sale_to_rent_ratio = sale_price_amount / annual_rent`
- yield values are decimals in payloads and percentages only in UI formatting
- currency is `COP` for version one
- area and property dimensions use square meters
- the backend must not divide by zero
- missing or invalid inputs should produce unavailable metrics rather than
  coerced numbers

The frontend may still sort and format, but it should not recalculate canonical
metrics once the backend exists.

## Documentation Outputs

- `specs/backend-api-spec.md`
- `docs/api/prototype-v1.md`
- `docs/reviews/backend-prototype-contract-review.md`

Supporting updates:

- add backend API links to `README.md`
- add a progress note to `plan/prototype-v1-explorer-foundation.md`
- update frontend architecture notes to point from fake data to the new backend
  contract

## Risks And Assumptions

- Real listing data may have missing bedrooms, bathrooms, interior area, or
  listing URLs, so the contract should use nullability where real data is likely
  uneven.
- A single property-level `metric_status` is simple, but it may hide which input
  caused uncertainty. That is acceptable for the first prototype contract.
- Viewport-driven area selection can expand scope quickly. The first contract
  supports named areas and reserves `viewport` as an area type without requiring
  viewport query support yet.
- Area summaries need clear aggregation rules so missing or invalid metrics do
  not distort medians and averages.

## Acceptance Criteria

- The backend API spec defines endpoint names, parameters, response envelopes,
  fields, field types, nullability, units, metric statuses, and error shape.
- The API docs include practical example requests and responses for frontend
  handoff.
- The contract is aligned with the current fake frontend data and shared domain
  spec.
- The docs clearly state that COP is canonical and `gross_rent_yield` is a
  decimal in API payloads.
- Scope exclusions are explicit.
- A review doc records the contract decision, caveats, and next implementation
  step.
