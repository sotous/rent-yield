# prototype v1 frontend tech stack decision

## Summary

Use a deliberately small React frontend stack for the first `rent-yield`
prototype:

- app framework: `Vite` + `React` + `TypeScript`
- package manager and workspace: `pnpm`
- styling: `Tailwind CSS` with app-level CSS tokens
- map: `MapLibre GL JS`
- chart: custom accessible ranked-bar list, not a charting library
- unit/component tests: `Vitest`
- browser verification: `Playwright`
- lint and format: `ESLint` + `typescript-eslint` + React rules + `Prettier`

This stack is chosen for a fake-data-first, browser-heavy, single-screen
Barranquilla explorer. It avoids introducing server rendering, auth, route
handlers, advanced analytics tooling, or a backend-for-frontend layer before the
frontend prototype reveals the real data contract.

## Decision Drivers

The stack must support:

- one main explorer screen
- fake Barranquilla property data
- map-plus-chart interaction
- named-area and viewport-oriented exploration
- chart and map cross-highlighting
- responsive desktop and mobile layouts
- clear labels for estimated values
- a later backend prototype contract
- low implementation ceremony for version one

## Recommended Stack

### Framework: Vite React SPA

Use `Vite` with the React TypeScript template inside `apps/frontend`.

Why:

- The prototype is dominated by browser interaction: map events, chart hover and
  focus state, responsive layout, and fake data.
- Static build output is enough for the first prototype.
- It keeps the backend boundary clean until the backend contract is defined.
- It avoids Next.js App Router concepts that do not yet serve the product:
  Server Components, route handlers, server data loading, or full-stack routing.

Rejected alternatives:

- `Next.js App Router`: good later if the product needs SSR, route handlers,
  public SEO pages, auth, or frontend-owned server functionality. It is more
  framework surface than this fake-data-first explorer needs.
- `React Router Framework Mode`: useful when routing and route data become a
  product concern. Version one has one primary screen.
- `TanStack Start`: powerful, but too broad for this prototype slice.

### Workspace: pnpm

Use `pnpm` at the repository root with a workspace file that includes:

- `apps/*`
- `packages/*` later if shared code becomes necessary

Do not create shared packages in the first scaffold. Keep domain helpers inside
`apps/frontend` until the backend contract proves which types or calculations
need to be shared at runtime.

Recommended root scripts:

```json
{
  "dev": "pnpm --filter @rent-yield/frontend dev",
  "build": "pnpm -r build",
  "typecheck": "pnpm -r typecheck",
  "lint": "pnpm -r lint",
  "format": "prettier . --write",
  "format:check": "prettier . --check",
  "test": "pnpm -r test",
  "check": "pnpm typecheck && pnpm lint && pnpm format:check && pnpm test"
}
```

Recommended frontend scripts:

```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "typecheck": "tsc -b --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

### TypeScript

Use strict TypeScript from the first scaffold.

Recommended compiler posture:

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`

Why:

- The domain spec has explicit missing, invalid, and estimated metric states.
- Loose optional fields would make metric presentation and data quality bugs
  harder to catch.

### Styling And UI Foundations

Use `Tailwind CSS` for layout and component styling, with CSS custom properties
for durable product tokens.

Do not add a full component library in version one.

Allowed small additions:

- `lucide-react` if iconography is useful for tooltips, help affordances, or map
  controls

Rejected alternatives:

- `MUI`, `Chakra`, `Ant Design`: too much generic application surface for the
  first explorer.
- `shadcn/ui`: useful later if the app grows a broader component system, but the
  first version mostly needs a map shell, summary panel, and ranked rows.

### Map: MapLibre GL JS

Use `MapLibre GL JS` directly from React.

Why:

- It avoids making Mapbox account, token, pricing, or platform choices the
  default product dependency.
- Fake property records can be converted into GeoJSON points cleanly.
- It has a stronger future path for styled boundaries, vector data, and
  backend-provided geometries than a purely raster-marker map.
- The app can keep `selectedArea`, `mapViewport`, `highlightedPropertyId`, and
  `selectedPropertyId` as ordinary React state while the map reflects that
  state.

Implementation rules:

- Keep the basemap style URL isolated in configuration.
- Treat basemap hosting as a separate scaffold-time decision.
- Use DOM markers for interactive properties in version one.
- Make markers keyboard-focusable and label them accessibly.
- Update viewport state on settled map movement, not every tiny movement.
- Do not let casual panning replace an explicitly selected named area.

Rejected alternatives:

- `Leaflet`: a strong fallback if the scaffold needs the simplest marker map
  possible. It has lower conceptual weight, but a weaker path for vector style
  and future geometry rendering.
- `Mapbox GL JS`: technically strong, but introduces vendor account and token
  concerns before the product needs Mapbox services.
- `OpenLayers`, `deck.gl`, `Google Maps`: broader or more vendor-coupled than
  version one requires.

### Chart: Custom Accessible Ranked-Bar List

Build the ranked property chart as a custom React component using semantic HTML
rows and CSS bar fills.

The chart should default to horizontal ranked bars at all breakpoints for the
first scaffold. The product spec allows vertical bars on larger screens, but the
version-one data is easier to scan as horizontal rows because labels, yields,
estimated badges, sale prices, and rent values need room.

Why:

- One row equals one property, which directly matches the interaction model.
- Native scrolling is simpler than chart pagination or zooming.
- Hover and keyboard focus can expose the same summary without fighting chart
  library internals.
- Map cross-highlighting can share `highlightedPropertyId` directly.
- Bar graphics can be decorative while real text carries the accessible value.

Recommended component shape:

```ts
type RankedYieldChartProps = {
  properties: PropertyRecord[];
  highlightedPropertyId: string | null;
  selectedPropertyId: string | null;
  onHighlightProperty: (propertyId: string | null) => void;
  onSelectProperty: (propertyId: string) => void;
};
```

Rejected alternatives:

- `Recharts`: the best fallback if the chart becomes more graphical, but version
  one would still need custom labels, focus behavior, scrolling, and external
  highlight control.
- `visx` or `D3`: excellent for bespoke analytics, too much low-level chart work
  for a single ranked metric.
- `ECharts`: powerful but heavier and more imperative than the current React
  state contract needs.
- `Chart.js`: canvas-first, which would require a parallel accessible structure
  for keyboard and screen-reader behavior.

### Testing

Use two layers:

- `Vitest` for metric calculation, sorting, filtering, area summaries, formatters,
  and React component state where practical.
- `Playwright` for browser-level explorer verification: map/chart
  cross-highlighting, responsive layout, keyboard focus, and empty/error states.

Do not over-test map internals in `jsdom`. Browser verification is the better
place to catch map integration behavior.

## Suggested First Scaffold Shape

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
    features/
      explorer/
        ExplorerScreen.tsx
        explorerSelectors.ts
        explorerState.ts
    lib/
      formatCurrency.ts
      formatPercent.ts
    styles.css
  tests/
    e2e/
```

This shape is intentionally provisional. The scaffold should keep files small
and move code only when real duplication or clarity pressure appears.

## Risks

- MapLibre still requires a real basemap provider or hosted style. The scaffold
  should not hide that decision inside component code.
- DOM markers must be implemented carefully for keyboard and screen-reader
  access.
- Custom bars mean the app owns basic scale and label behavior. Keep the first
  scale simple: `0` to the rounded-up maximum visible yield.
- If property counts exceed roughly `75-100` visible rows, revisit list
  virtualization.
- If future product scope adds multi-metric analytics, grouped series, zooming,
  or statistical overlays, revisit `Recharts` or `visx`.

## Validation For The Next Step

The next scaffold task is ready when:

- `apps/frontend` is created as a Vite React TypeScript app,
- root `pnpm` workspace files exist,
- strict TypeScript is configured,
- Tailwind is wired into the Vite app,
- MapLibre can render in a client-side component,
- the fake data model can support the interaction spec,
- initial tests can validate metric formatting and sorting.

## Sources Checked

- [Vite guide](https://vite.dev/guide/) and
  [production build behavior](https://vite.dev/guide/build)
- [React documentation for starting a new React project with a build tool](https://react.dev/learn/build-a-react-app-from-scratch)
- [pnpm workspace documentation](https://pnpm.io/workspaces)
- [TypeScript `strict` TSConfig documentation](https://www.typescriptlang.org/tsconfig/strict.html)
- [Tailwind CSS Vite installation documentation](https://tailwindcss.com/docs/installation/using-vite)
- [MapLibre GL JS documentation](https://www.maplibre.org/maplibre-gl-js/docs/)
- [Leaflet accessibility documentation](https://leafletjs.com/examples/accessibility/)
- [Recharts bar chart documentation](https://recharts.org/en-US/api/BarChart)
- [Chart.js accessibility documentation](https://www.chartjs.org/docs/latest/general/accessibility.html)
- [Vitest guide](https://vitest.dev/guide/)
- [Playwright getting started documentation](https://playwright.dev/docs/intro)
