# Backend API Spec

## Purpose

This document defines the first backend API contract for the `rent-yield`
prototype v1 explorer.

The contract is intentionally narrow. It exists so the current frontend
prototype can later replace fake Barranquilla data with backend-served explorer
data without widening the product.

## Product Frame

The API supports one version-one question:

`In this selected Barranquilla area, which homes may bring in the strongest rent for their price?`

The frontend should continue to communicate this as `rent return`. The API uses
canonical domain names such as `gross_rent_yield` and `sale_to_rent_ratio`.

## Scope

Included:

- read-only explorer data
- Colombia-first and Barranquilla-first payloads
- supported areas
- selected-area summaries
- rankable property records
- canonical metric values and metric status
- direct listing URLs when available
- basic loading, empty, and error semantics for frontend integration

Not included:

- backend implementation
- database schema
- ingestion pipeline
- authentication
- underwriting inputs
- filters
- metric toggles
- property detail pages
- saved searches
- transactions

## Base Path

All prototype v1 routes use:

```text
/api/v1
```

## Endpoint Overview

| Endpoint                               | Purpose                                                     |
| -------------------------------------- | ----------------------------------------------------------- |
| `GET /api/v1/explorer/bootstrap`       | Load supported areas and the default area for the explorer. |
| `GET /api/v1/explorer/areas/{area_id}` | Load one selected area's map, summary, and chart payload.   |

The first implementation may add split resource endpoints later, but the
frontend-facing prototype contract should begin with these two routes.

## Shared Rules

### Currency And Units

- canonical currency is `COP`
- monetary amounts are numbers in COP
- interior area is square meters
- latitude and longitude are decimal degrees
- `gross_rent_yield` is a decimal such as `0.08`
- percentages are presentation-only and should be formatted by the frontend

### Metric Calculation

The backend owns canonical metric calculation.

```text
annual_rent = monthly_rent_amount * 12
gross_rent_yield = annual_rent / sale_price_amount
sale_to_rent_ratio = sale_price_amount / annual_rent
```

Rules:

- `sale_price_amount` must be greater than zero for yield and ratio to be valid.
- `monthly_rent_amount` must be greater than zero for yield and ratio to be
  valid.
- `annual_rent` is derived, not manually authored.
- invalid or missing inputs produce unavailable metrics.
- the backend must not silently divide by zero.

### Sorting

Selected-area properties should be returned in the default chart order:

1. descending `gross_rent_yield`
2. ascending `sale_to_rent_ratio`
3. descending `monthly_rent_amount`

The response also includes the applied sort contract so the frontend can display
and verify the ranking without inventing a separate rule.

### Rankable Property Rule

The prototype selected-area endpoint should return properties that can appear in
the v1 ranked chart.

For the first contract, that means each returned property should have:

- usable `sale_price_amount`
- usable `monthly_rent_amount`
- usable `gross_rent_yield`
- usable `sale_to_rent_ratio`
- usable `latitude` and `longitude`

The shared domain still supports `missing_input` and `invalid_input`, but the
first frontend integration does not need to render unrankable rows.

### Nullability

Real listing data can be uneven. Fields that are helpful but not guaranteed may
be `null`, including:

- `listing_url`
- `neighborhood_name`
- `locality_name`
- `bedrooms`
- `bathrooms`
- `interior_area_sqm`
- `observed_at`
- optional area geometry fields

Fields required for chart ranking should not be `null` in selected-area
property results.

## Resource Schemas

### `Area`

```ts
type Area = {
  area_id: string;
  country_code: "CO";
  area_type: "country" | "city" | "locality" | "neighborhood" | "viewport";
  display_name: string;
  city_name: string;
  description: string | null;
  parent_area_id: string | null;
  centroid_latitude: number;
  centroid_longitude: number;
  zoom: number;
  bounding_box: BoundingBox | null;
  geometry_reference: string | null;
};

type BoundingBox = {
  north: number;
  south: number;
  east: number;
  west: number;
};
```

Notes:

- `viewport` is reserved for future map-driven area selection.
- v1 can start with named Barranquilla areas.
- `geometry_reference` may point to a future geometry asset or storage key.

### `AreaSummary`

```ts
type AreaSummary = {
  area_id: string;
  display_name: string;
  area_type: Area["area_type"];
  property_count: number;
  median_sale_price_amount: number | null;
  median_monthly_rent_amount: number | null;
  median_gross_rent_yield: number | null;
  average_gross_rent_yield: number | null;
  min_gross_rent_yield: number | null;
  max_gross_rent_yield: number | null;
  median_sale_to_rent_ratio: number | null;
  data_coverage_score: number | null;
};
```

Aggregation rules:

- summary metrics should use only records with valid values for that metric.
- `property_count` counts properties returned for the selected area payload.
- `data_coverage_score` is optional and may be `null` until real ingestion
  exists.

### `PropertyRecord`

```ts
type PropertyRecord = {
  property_id: string;
  country_code: "CO";
  city_name: string;
  area_id: string;
  neighborhood_name: string | null;
  locality_name: string | null;
  address_label: string;
  listing_url: string | null;
  latitude: number;
  longitude: number;
  property_type: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  interior_area_sqm: number | null;
  sale_price_amount: number;
  sale_price_currency: "COP";
  monthly_rent_amount: number;
  monthly_rent_currency: "COP";
  annual_rent: number;
  gross_rent_yield: number;
  sale_to_rent_ratio: number;
  listing_status: ListingStatus;
  rent_source_type: SourceType;
  sale_price_source_type: SourceType;
  metric_status: MetricStatus;
  observed_at: string | null;
};

type PropertyType = "apartment" | "house" | "studio" | "other_residential";

type ListingStatus = "for_sale" | "for_rent" | "inactive" | "unknown";

type SourceType =
  | "observed_listing"
  | "historical_observed"
  | "estimated_model"
  | "manual_import"
  | "unknown";

type MetricStatus =
  "valid" | "missing_input" | "invalid_input" | "estimated_input";
```

Notes:

- `listing_url` is an outbound source link. The frontend should show it only in
  contextual hover, focus, or selected states.
- `metric_status = estimated_input` means one or more metric inputs came from an
  estimated or historical source.
- A later contract may split metric status by metric or by input if users need
  more audit detail.

### `SortMetadata`

```ts
type SortMetadata = {
  metric: "gross_rent_yield";
  direction: "desc";
  tie_breakers: [
    { metric: "sale_to_rent_ratio"; direction: "asc" },
    { metric: "monthly_rent_amount"; direction: "desc" },
  ];
};
```

### `ErrorResponse`

```ts
type ErrorResponse = {
  error: {
    code: string;
    message: string;
    request_id: string | null;
  };
};
```

Error rules:

- use plain recoverable messages
- do not leak ingestion or provider internals
- frontend should keep the explorer frame visible on error

## `GET /api/v1/explorer/bootstrap`

Loads startup geography for the explorer.

### Query Parameters

| Name           | Required | Example        | Notes                                     |
| -------------- | -------- | -------------- | ----------------------------------------- |
| `country_code` | yes      | `CO`           | Only `CO` is supported in prototype v1.   |
| `city_name`    | yes      | `Barranquilla` | Barranquilla is the first supported city. |

### Success Response

```ts
type ExplorerBootstrapResponse = {
  default_area_id: string | null;
  areas: Area[];
  data_label: string;
};
```

### Response Rules

- `default_area_id` should point to the broadest Barranquilla option.
- `areas` should include the city-level area and any supported named areas.
- `data_label` should describe the dataset in user-safe language, such as
  `Prototype data`.

### Empty And Error Behavior

- If the city is valid but no areas are available, return `200` with
  `areas: []` and `default_area_id: null`.
- If the city or country is unsupported, return `404`.

## `GET /api/v1/explorer/areas/{area_id}`

Loads the full selected-area payload for the map and ranked chart.

### Path Parameters

| Name      | Required | Example      | Notes                                         |
| --------- | -------- | ------------ | --------------------------------------------- |
| `area_id` | yes      | `alto-prado` | A supported area from the bootstrap response. |

### Success Response

```ts
type ExplorerAreaResponse = {
  area: Area;
  summary: AreaSummary;
  properties: PropertyRecord[];
  sort: SortMetadata;
  data_label: string;
};
```

### Response Rules

- properties should belong to the requested area or its included child areas.
- properties should be sorted by the default sort contract.
- an area with no matching properties should return `200` with
  `properties: []`.
- the frontend should treat an empty property list as an empty data state, not an
  error.

## Frontend State Mapping

| Frontend state | API condition                                                            |
| -------------- | ------------------------------------------------------------------------ |
| `loading`      | bootstrap or selected-area request is pending                            |
| `ready`        | selected-area response has one or more properties                        |
| `empty`        | selected-area response succeeds with `properties: []`                    |
| `error`        | network failure, unsupported area, malformed response, or server error   |
| `estimated`    | property has `metric_status = estimated_input` or estimated source types |

## Open Questions

- Should the next backend implementation support only named areas, or also
  viewport-based queries?
- Should future metric status be split into per-input or per-metric status?
- Should listing source attribution be a required visible field beside
  `listing_url` once real providers are used?
- Should the first backend return only rankable properties, or return all
  properties with unrankable records separated into a secondary collection?
