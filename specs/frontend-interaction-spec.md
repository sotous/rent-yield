# Frontend Interaction Spec

## Purpose

This document defines the version-one interaction contract for the `rent-yield`
frontend explorer.

It turns the product behavior in `frontend-spec.md` and the metric semantics in
`domain-spec.md` into implementable UI state, map behavior, chart behavior, and
responsive rules.

## Version-One Interaction Goal

The prototype should help the user answer one question quickly:

`In this selected Barranquilla area, which properties have the strongest gross rent yield?`

The main interaction should stay focused on:

1. choosing or focusing an area,
2. seeing the matching properties,
3. scanning the ranked yield chart,
4. understanding which values are estimated.

## Explorer Screen Model

Version one has one primary screen: the explorer.

The explorer contains:

- a map region for geography and spatial context,
- an area summary region for the current selection,
- a ranked property chart for comparison,
- lightweight metric explanation affordances.

The screen should not introduce account flows, property detail pages, advanced
filters, custom underwriting inputs, or transaction workflows.

## Initial State

On first load, the prototype should default to Barranquilla.

Initial state:

- `selectedCountry = CO`
- `selectedCity = Barranquilla`
- `selectedAreaType = city` or the default Barranquilla demo area
- map viewport centered on Barranquilla
- chart populated from fake Barranquilla property data
- chart sorted by descending `gross_rent_yield`
- area summary visible for the selected geography

If the fake dataset is split into smaller demo areas, the first selected area
should be the broadest Barranquilla option rather than an arbitrary property.

## Area Selection Contract

Version one should support simple area-driven exploration before freeform
geographic drawing.

Supported first interactions:

- choosing a named demo area, such as a neighborhood or city-level option,
- moving or zooming the map enough to update the active viewport area,
- selecting a map area marker or boundary if the chosen map library makes this
  straightforward.

Explicitly out of scope for the first prototype:

- custom polygon drawing,
- saved search areas,
- multi-area comparison,
- precise cadastral boundary editing.

### Area Selection Priority

When both named areas and viewport movement exist, the UI should keep one active
selection at a time.

Priority:

1. A user-selected named area is the active selection.
2. If the user clears or changes away from the named area, the current map
   viewport can become the active selection.
3. Property markers do not replace the selected area; they only highlight a
   property.

This preserves the product principle that the map answers `where` and the chart
answers `which`.

## Core UI State

The frontend should model these states explicitly:

- `selectedArea`: the active geography used to filter properties.
- `mapViewport`: the current map center, zoom, and bounds.
- `visibleProperties`: properties matching the selected area.
- `highlightedPropertyId`: the property currently hovered or focused.
- `selectedPropertyId`: optional persistent property selection.
- `sortMetric`: fixed to `gross_rent_yield` in version one.
- `sortDirection`: fixed to descending in version one.
- `dataState`: `loading`, `ready`, `empty`, or `error`.

The first prototype may keep these states local to the explorer screen as long
as the boundaries are clear enough to later connect to backend data.

## Map Behavior

The map should make the current area obvious.

Required behavior:

- center on Barranquilla by default,
- show markers for properties in the active area,
- visually distinguish highlighted or selected properties,
- show or label the active area when practical,
- preserve enough city context that the user understands where they are.

Map movement behavior:

- panning and zooming may update `mapViewport`,
- viewport changes should not aggressively replace a named area while the user is
  still interacting with the map,
- if viewport-driven selection is implemented, update the chart after movement
  settles rather than on every tiny map event.

Map marker behavior:

- hovering or focusing a marker should set `highlightedPropertyId`,
- clicking a marker may set `selectedPropertyId`,
- marker hover should highlight the matching chart bar,
- marker click should not navigate away from the explorer in version one.

## Chart Behavior

The ranked chart is the main comparison surface.

Required behavior:

- one bar represents one property,
- default metric is `gross_rent_yield`,
- sort descending by `gross_rent_yield`,
- use the domain tie-breakers when needed:
  - ascending `sale_to_rent_ratio`,
  - descending `monthly_rent_amount`,
- display yield as a percentage,
- keep estimated values visibly labeled,
- allow scrolling when property count exceeds comfortable screen space.

Hover and focus behavior:

- hovering a bar should expose the property's key numbers,
- hovering a bar should highlight the matching map marker,
- keyboard focus on a bar should expose the same information as hover,
- the highlighted state should clear when hover or focus leaves the property.

Optional version-one behavior:

- clicking a bar may pin `selectedPropertyId`,
- a selected bar may keep its tooltip or summary visible,
- selecting a bar may pan the map toward the property if this feels stable.

Out of scope:

- metric toggles,
- chart grouping,
- chart pagination,
- advanced filtering,
- multi-property comparison mode.

## Property Summary On Hover

Hover and focus states should use a compact property summary.

Recommended fields:

- location label or address label,
- property type,
- bedrooms and bathrooms when available,
- interior area in square meters when available,
- sale price in COP,
- monthly rent in COP,
- gross rent yield as a percentage,
- rent source type or estimated label.

The UI should prefer readable approximations over excessive precision. For
example, display `7.5%` rather than `7.492813%`.

## Area Summary Behavior

The area summary should explain the selected geography without becoming a
dashboard.

Recommended fields:

- selected area display name,
- property count,
- median sale price,
- median monthly rent,
- median gross rent yield,
- data source or fake-data label during prototyping.

The summary should update whenever `selectedArea` changes.

## Data States

The prototype should handle basic states even with fake data.

### Loading

Show a stable layout with a lightweight loading state for map properties and the
chart.

### Ready

Show the map, area summary, and ranked chart for the active area.

### Empty

If an area has no properties, keep the selected area visible and explain that no
properties are available for that area in the prototype dataset.

### Error

If data loading fails, keep the explorer frame visible and show a recoverable
message. Do not replace the whole product with a generic crash view.

## Responsive Behavior

The explorer should adapt without changing the core workflow.

Desktop and wide tablet:

- map and chart can sit side by side,
- map should preserve enough width to support geographic scanning,
- chart should preserve enough width for labels and values.

Small tablet and mobile:

- use a stacked layout,
- keep area selection and summary above the chart,
- prefer horizontal ranked bars for label readability,
- keep the map usable but avoid forcing a tall map before the user can reach the
  ranking.

The chart orientation may change by viewport size:

- wider screens may use vertical bars if labels remain readable,
- narrower screens should use horizontal ranked bars.

## Accessibility Expectations

The first prototype should keep interaction accessible enough to avoid rework.

Minimum expectations:

- chart bars are keyboard-focusable if they expose hover details,
- hover-only information is also available on focus,
- selected and highlighted states are not conveyed by color alone,
- map markers have accessible labels,
- metric explanations are reachable by keyboard,
- empty and error states use plain text.

## Fake Data Requirements

Fake data should follow the shared domain model closely enough that the backend
contract can be derived later.

Each fake property should include:

- `property_id`
- `country_code`
- `city_name`
- `area_id` or neighborhood/locality label
- `address_label` or location label
- `latitude`
- `longitude`
- `property_type`
- `bedrooms`
- `bathrooms`
- `interior_area_sqm`
- `sale_price_amount`
- `sale_price_currency`
- `monthly_rent_amount`
- `monthly_rent_currency`
- `annual_rent`
- `gross_rent_yield`
- `sale_to_rent_ratio`
- `rent_source_type`
- `sale_price_source_type`
- metric status where useful

Fake data should be plausible for Barranquilla but does not need to be a market
study. It should be good enough to validate layout, ranking, states, and
cross-highlighting behavior.

## Success Criteria

This interaction spec is satisfied when the prototype can demonstrate:

- Barranquilla loads as the default geography,
- the user can change the active area through simple map or named-area behavior,
- the chart updates to properties in the active area,
- properties are ranked by descending `gross rent yield`,
- chart hover or focus highlights the matching map marker,
- map marker hover or focus highlights the matching chart bar,
- estimated values are visibly labeled,
- empty and error states keep the explorer understandable,
- desktop and mobile layouts preserve the same map-plus-chart workflow.

## Open Questions

- Which map library best supports the simplest version of named areas and marker
  highlighting?
- Should the first scaffold implement viewport-driven area selection immediately,
  or start with named Barranquilla demo areas plus map movement?
- What property count makes the chart feel crowded enough to require a second
  interaction pattern beyond scrolling?

## Relationship To Other Specs

- [frontend-spec.md](/Users/soto/Documents/rent-yield/specs/frontend-spec.md)
  defines the product framing and frontend scope.
- [domain-spec.md](/Users/soto/Documents/rent-yield/specs/domain-spec.md)
  defines the metric formulas, entities, and field semantics.
- The future frontend stack decision should choose libraries that can implement
  this interaction contract without widening version-one scope.
- The future backend prototype contract should use this interaction contract to
  confirm the minimal property, area, and area-summary payloads.
