# Frontend Product Spec

## Product

- Repository: `rent-yield`
- Product name: `Rent Yield`

## Product Framing

Rent Yield is a frontend application for exploring residential real estate opportunities through a simple visual question:

`In this area, which properties appear to offer the strongest rental return relative to their sale price?`

The product should make that question easy to answer with a map and a chart.

## Core Interaction

The main experience is:

1. The user selects an area on a map.
2. The application loads properties in that area.
3. The application renders a bar chart where each bar is one property.
4. The bar height represents the investment metric.
5. The user can scan and rank properties from that chart.

This map-plus-chart explorer is the center of the frontend.

## Metric Standard

The default chart metric should be `gross rent yield`, not raw `sale-to-rent ratio`.

Reasoning:

- A taller bar should feel like a better opportunity.
- Higher `gross rent yield` usually means stronger rental return.
- Higher `sale-to-rent ratio` usually means the property is more expensive relative to rent, which is less intuitive for a primary bar chart.

Because of that, the v1 UI standard should be:

- Primary metric: `gross rent yield`
- `Sale-to-rent ratio` remains part of the shared domain, but it does not need a first-version UI control

This keeps the first visualization ergonomically intuitive and reduces version-one complexity.

## Problem Statement

Real estate users can often find sale prices and rent estimates, but they usually cannot compare properties in a selected area through a single clear visual ranking.

Current products often do one of the following:

- show sale data without rental return framing,
- show rent estimates without investment ranking,
- provide advanced calculators after the user already found a property,
- provide area analytics without a simple property ranking view.

Users need a frontend that combines location exploration and investment comparison in one workflow.

## Frontend Goal

The frontend should help users move smoothly from:

- `Where should I look?`

to:

- `Which properties in this area look strongest?`

## Primary Users

### 1. Individual investor

Wants to identify promising properties quickly without doing manual spreadsheet work first.

### 2. Real estate analyst

Wants to compare properties and local patterns visually across neighborhoods or selected regions.

### 3. Curious buyer

Wants to understand whether a property appears strong or weak as a rental opportunity.

## Product Principles

- The map should answer `where`.
- The chart should answer `which`.
- The default metric should be easy to interpret.
- Estimated values must be clearly labeled.
- The path from area exploration to ranked visual understanding should feel immediate.

## Core Domain Terms

- `Sale price`: the listing price or estimated purchase value of the property.
- `Monthly rent`: the observed or estimated monthly rental income.
- `Annual rent`: monthly rent multiplied by 12.
- `Gross rent yield`: annual rent divided by sale price.
- `Sale-to-rent ratio`: sale price divided by annual rent.
- `Selected area`: the region currently active on the map, such as a visible viewport, neighborhood, ZIP code, or drawn boundary.

## Primary Use Case

### Use Case 1: Explore an area and rank its properties

As a user, I want to select an area on a map and immediately see a chart ranking the properties in that area so that I can identify the strongest rental opportunities quickly.

Acceptance signals:

- The user can select or focus an area on the map.
- The chart updates to show only properties in that area.
- Each bar represents a single property.
- The chart defaults to `gross rent yield`.
- The chart makes it easy to spot high-yield and low-yield properties.

## Supporting Use Cases

### Use Case 2: Understand area context

As a user, I want to understand how an individual property compares with the surrounding area so that I can judge whether it is an outlier.

Acceptance signals:

- The UI can show area-level summaries for the currently selected geography.
- The chart or hover state can indicate whether a property is above or below area norms.
- The user can understand area context without leaving the main explorer screen.

## Primary Screen

### Explorer Screen

This should be the main screen of version one.

Core layout:

- Map on one side as the geographic selector
- Bar chart on the other side as the property ranking view

The chart should be tightly linked to the map:

- map change updates chart,
- chart selection, if present, can optionally highlight the location on the map.

## Secondary Screens

### Metric Explainer View or Panel

Simple explanation of `gross rent yield`, `sale-to-rent ratio`, and how each metric should be interpreted.

## Key UI Components

- Interactive map
- Area selection behavior
- Ranked bar chart
- Metric explanation tooltip or help panel
- Area summary panel

## Chart Behavior

The bar chart is a product-defining component and should have clear behavior rules.

- One bar equals one property.
- The default sort should rank by highest `gross rent yield`.
- Bars should support hover states, and selection is optional for version one.
- Bars should expose key summary data on hover.
- The chart should handle many properties primarily through scrolling in version one.
- Grouping, zooming, or pagination can be evaluated later if scrolling proves insufficient.
- The chart orientation should adapt to screen size.
- Vertical bars may be used on larger screens.
- Horizontal ranked bars may be used on smaller screens.

## Map Behavior

- The user should be able to navigate by city, neighborhood, locality, or direct map movement.
- The current geographic selection should always be obvious.
- The map should support area-driven exploration before property-driven inspection.
- A future version may support drawn boundaries or custom polygons, but version one can start with simpler area selection.
- Version one should focus on Colombia.
- Barranquilla should be the first supported region in version one.

## Data the Frontend Expects

At minimum:

- property id
- address or location label
- latitude and longitude
- property type
- bedrooms
- bathrooms
- interior area
- sale price
- monthly rent
- annual rent
- gross rent yield
- sale-to-rent ratio
- listing status
- rent source type such as `observed` or `estimated`
- area identifier such as neighborhood, ZIP code, or city

## UX Rules For Metrics

- When the default chart metric is `gross rent yield`, higher should visually feel better.
- The frontend should never assume the user already understands these metrics.
- If values are estimated, the product should say so plainly.

## Success Criteria

The frontend succeeds if a user can:

- choose an area,
- see properties in that area ranked visually,
- identify likely strong and weak rental opportunities quickly,
- understand the difference between yield and ratio without external help.

## Version One Scope

Version one should prioritize:

- one main explorer screen,
- map selection,
- property bar chart,
- default gross-yield ranking,
- Colombia-first geography support,
- Barranquilla as the first supported region,
- responsive chart orientation based on screen size.

Version one does not need:

- transaction workflows,
- advanced financial modeling,
- portfolio management,
- highly customized underwriting assumptions,
- metric toggle,
- filtering,
- property detail inspection,
- property comparison,
- authentication,
- fully freeform geographic drawing if that slows the first release.

## Open Questions

- What is the most comfortable property count per chart before scrolling becomes visually crowded?

## Suggested Next Specs

1. A shared domain spec that locks the formulas for `gross rent yield` and `sale-to-rent ratio`.
2. A frontend interaction spec for map state, chart state, responsive chart orientation, and area selection behavior.
3. A Colombia market scope spec defining the first cities or regions to support.
4. A backend spec for listing ingestion, rent estimation, metric calculation, and area aggregation.
