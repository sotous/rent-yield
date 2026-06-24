# Shared Domain Spec

## Purpose

This document defines the shared domain model for `rent-yield`.

Its job is to lock the meaning of the product's core concepts before backend and frontend implementation diverge. This spec should be treated as the source of truth for:

- metric formulas,
- entity definitions,
- field semantics,
- Colombia-first geography concepts,
- version-one assumptions.

## Product Scope

This domain supports a version-one product that answers:

`Within a selected area in Colombia, which properties appear to offer the strongest rental return relative to their sale price?`

The first version is exploratory, not transactional.

## Currency And Units

- Default currency for version one: `COP`
- USD may appear only as a future comparative display, not as the canonical storage currency
- Sale price should be represented as a monetary amount in `COP`
- Monthly rent should be represented as a monetary amount in `COP`
- Interior area should be represented in square meters

## Canonical Metrics

### 1. Annual Rent

Definition:

Annual rent is the monthly rent multiplied by 12.

Formula:

`annual_rent = monthly_rent * 12`

### 2. Gross Rent Yield

Definition:

Gross rent yield expresses the annual rental income as a fraction of the sale price.

Formula:

`gross_rent_yield = annual_rent / sale_price`

Presentation guidance:

- Store as a decimal
- Display as a percentage in the UI

Example:

- sale price: `COP 400,000,000`
- monthly rent: `COP 2,500,000`
- annual rent: `COP 30,000,000`
- gross rent yield: `0.075`
- displayed value: `7.5%`

Interpretation:

- Higher is generally better for rental return
- This is the primary version-one chart metric

### 3. Sale-To-Rent Ratio

Definition:

Sale-to-rent ratio expresses how expensive a property is relative to one year of rent.

Formula:

`sale_to_rent_ratio = sale_price / annual_rent`

Example:

- sale price: `COP 400,000,000`
- annual rent: `COP 30,000,000`
- sale-to-rent ratio: `13.33`

Interpretation:

- Lower is generally better for rental efficiency
- This metric belongs in the shared domain even if it is not a first-version control in the UI

## Metric Safety Rules

- `sale_price` must be greater than zero for yield and ratio to be valid
- `monthly_rent` must be greater than zero for yield and ratio to be valid
- `annual_rent` must be derived, not manually authored
- If required inputs are missing, the metric must be treated as unavailable
- The system should not silently divide by zero or coerce invalid values into numeric outputs

## Metric Status

Each computed metric should be paired with a status:

- `valid`
- `missing_input`
- `invalid_input`
- `estimated_input`

This allows the product to distinguish between strong computed values and values derived from partial or estimated data.

## Core Entities

### 1. Property

A `property` is the central version-one entity.

It represents a residential real estate unit that can be analyzed for rental return.

Required fields:

- `property_id`
- `country_code`
- `city_name`
- `sale_price_amount`
- `sale_price_currency`
- `monthly_rent_amount`
- `monthly_rent_currency`
- `gross_rent_yield`
- `sale_to_rent_ratio`

Recommended fields:

- `source_listing_id`
- `source_name`
- `listing_url`
- `title`
- `address_label`
- `latitude`
- `longitude`
- `property_type`
- `bedrooms`
- `bathrooms`
- `interior_area_sqm`
- `listing_status`
- `rent_source_type`
- `sale_price_source_type`
- `observed_at`
- `neighborhood_name`
- `locality_name`

### 2. Area

An `area` is a geographic region used for map-driven exploration.

In version one, an area is not necessarily a legal administrative object. It can be a map-selected region or a named geographic unit.

Required fields:

- `area_id`
- `country_code`
- `area_type`
- `display_name`

Recommended fields:

- `city_name`
- `parent_area_id`
- `centroid_latitude`
- `centroid_longitude`
- `bounding_box`
- `geometry_reference`

### 3. Area Summary

An `area_summary` is an aggregate view of properties within a selected area.

It supports contextual interpretation on the frontend.

Required fields:

- `area_id`
- `property_count`
- `median_sale_price_amount`
- `median_monthly_rent_amount`
- `median_gross_rent_yield`

Recommended fields:

- `average_gross_rent_yield`
- `min_gross_rent_yield`
- `max_gross_rent_yield`
- `median_sale_to_rent_ratio`
- `data_coverage_score`

## Entity Semantics

### Property Type

Version one should focus on residential inventory.

Allowed initial values:

- `apartment`
- `house`
- `studio`
- `other_residential`

### Listing Status

Suggested initial values:

- `for_sale`
- `for_rent`
- `inactive`
- `unknown`

### Rent Source Type

This field communicates where the rent figure came from.

Suggested initial values:

- `observed_listing`
- `historical_observed`
- `estimated_model`
- `manual_import`
- `unknown`

### Sale Price Source Type

Suggested initial values:

- `observed_listing`
- `historical_observed`
- `estimated_model`
- `manual_import`
- `unknown`

## Colombia-First Geography Model

Version one is Colombia-specific.

The shared domain should therefore support Colombian geographic language without overcomplicating the first release.

### Geography Levels

Suggested hierarchy for the domain:

- `country`
- `city`
- `locality`
- `neighborhood`
- `viewport`

Notes:

- `city` is a strong default anchor for version one
- `locality` is useful in cities where this concept is common
- `neighborhood` is useful when data quality supports it
- `viewport` supports map-based exploration even when formal boundaries are incomplete

### Country

Version-one fixed value:

- `country_code = CO`
- `country_name = Colombia`

### City

A `city` is the most reliable candidate for the first supported geography unit.

Examples of cities that may later be prioritized:

- Bogota
- Medellin
- Cali
- Barranquilla
- Cartagena

This spec does not decide launch cities. That belongs in the Colombia market scope spec.

### Locality

A `locality` is a sub-city geographic grouping used when the city's public or market data commonly supports it.

This should be treated as optional in version one.

### Neighborhood

A `neighborhood` is a smaller descriptive area within a city or locality.

This should be used only when the source data can label it with reasonable confidence.

### Viewport

A `viewport` is the active map window or selected map extent.

This is important because the frontend interaction may rely on map movement even when legal boundaries are not selected.

## Canonical Field Rules

- `sale_price_currency` and `monthly_rent_currency` must match in version one
- Version one should reject or normalize mixed-currency records before metric calculation
- `gross_rent_yield` must be stored as a decimal, not a formatted percentage string
- `sale_to_rent_ratio` must be stored as a number
- `city_name` should be treated as required for version one
- Latitude and longitude are strongly recommended because the core interaction is map-driven

## Missing And Estimated Data

Version one will likely depend on imperfect market data.

The domain must therefore support uncertainty explicitly.

Each property should be able to indicate:

- whether sale price is observed or estimated,
- whether rent is observed or estimated,
- whether the resulting metrics are fully observed or partly estimated.

The system should prefer transparency over false precision.

## Sorting Standard

When the frontend renders the primary chart:

- default sort: descending `gross_rent_yield`
- tie-breaker suggestion: ascending `sale_to_rent_ratio`
- secondary tie-breaker suggestion: descending `monthly_rent_amount`

This is a presentation rule rooted in the shared metric semantics.

## Domain Non-Goals For Version One

This shared domain does not yet need to include:

- financing assumptions,
- mortgage rates,
- cap rate,
- cash-on-cash return,
- taxes,
- maintenance modeling,
- vacancy modeling,
- short-term rental metrics,
- portfolio accounting,
- user accounts or permissions.

These may belong to future versions, but they are intentionally out of scope for the first domain model.

## Open Questions

- Should the first supported exploration unit be `city` or `viewport`?
- Should `locality` be normalized globally, or only for cities where it is meaningful?
- What minimum confidence is required before assigning a `neighborhood_name`?
- Should area summaries rely on median values only in version one?

## Relationship To Other Specs

- [frontend-spec.md](/Users/soto/Documents/rent-yield/specs/frontend-spec.md) defines the user-facing explorer behavior
- [frontend-interaction-spec.md](/Users/soto/Documents/rent-yield/specs/frontend-interaction-spec.md) defines map state, chart state, area selection, responsive behavior, and fake-data interaction requirements
- The future backend spec should implement the ingestion, normalization, and calculation rules defined here
- The future Colombia market scope spec should define which cities or regions launch first
