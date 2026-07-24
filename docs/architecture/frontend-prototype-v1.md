# Frontend Prototype v1 Architecture Notes

## Summary

The first runnable frontend prototype lives in `apps/frontend`.

It implements the Barranquilla-first explorer described by the product and
interaction specs:

- named demo-area selection
- MapLibre map with property markers
- area summary panel
- custom ranked rent-return bars
- metric explainer
- fake property data shaped from the shared domain spec

The prototype is intentionally frontend-only. It does not introduce
authentication, backend route handlers, ingestion, advanced underwriting, metric
toggles, filters, property detail pages, or comparison workflows.

## Stack

- `Vite` + `React` + `TypeScript`
- `pnpm` workspace
- `Tailwind CSS` Vite plugin plus app CSS
- `MapLibre GL JS` for the map
- custom accessible ranked-bar list for the chart
- `Vitest` for unit smoke tests
- `Playwright` for browser smoke tests
- `ESLint` and `Prettier`

MapLibre is lazy-loaded so the main app shell does not eagerly load the map
renderer. Vite excludes `maplibre-gl` from dependency optimization because its
worker bundle can otherwise produce local-dev optimizer warnings.

## App Shape

```text
apps/frontend/
  src/
    components/
      AreaSummary.tsx
      ExplorerMap.tsx
      MetricExplainer.tsx
      RankedYieldChart.tsx
    data/
      barranquillaDemoAreas.ts
      barranquillaDemoProperties.ts
    domain/
      metrics.ts
      propertyTypes.ts
      sorting.ts
      summaries.ts
    features/explorer/
      ExplorerScreen.tsx
    lib/
      formatters.ts
```

## Interaction Model

The current explorer state is local to `ExplorerScreen`.

Tracked state:

- selected demo area
- highlighted property id
- selected property id
- latest map viewport

The map and chart share property ids for cross-highlighting. Chart rows are real
buttons with visible rent-return text; bar fills are decorative.

## Fake Data Boundary

Fake data lives under `apps/frontend/src/data`.

The records intentionally use the shared domain language:

- `sale_price_amount`
- `monthly_rent_amount`
- `annual_rent`
- `gross_rent_yield`
- `sale_to_rent_ratio`
- source type fields
- metric status

The fake records are plausible enough to validate layout, sorting, summaries,
and interaction behavior. They are not a market study.

## Running The Prototype

From the repo root:

```sh
pnpm install
pnpm dev
```

Useful checks:

```sh
pnpm check
pnpm --filter @rent-yield/frontend test:e2e
```

If Playwright browsers are missing locally:

```sh
pnpm --filter @rent-yield/frontend exec playwright install chromium
```

## Verification Notes

Current verification covers:

- TypeScript typecheck
- ESLint
- Prettier format check
- Vitest unit smoke test
- Playwright browser smoke test
- manual screenshot review at desktop and mobile sizes

The production build currently emits a chunk-size warning for the lazy MapLibre
chunk. That is acceptable for prototype v1 because the map renderer is isolated
from the main shell. Revisit if bundle size becomes a product or deployment
concern.

## Follow-Up

The next implementation slices should focus on:

- strengthening the map explorer shell behavior
- expanding browser tests for area switching and cross-highlighting
- refining the ranked chart ergonomics after hands-on review
- deriving the backend prototype contract from the fake data shape
