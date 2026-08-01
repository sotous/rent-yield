# Backend Prototype v1 Architecture Notes

## Summary

The first backend prototype lives in `apps/backend`.

It implements the read-only explorer API defined by:

- `specs/backend-api-spec.md`
- `docs/api/prototype-v1.md`
- `docs/api/prototype-v1-consumer-contract.md`

The backend is intentionally narrow. It serves prototype Barranquilla explorer
data so the frontend can later replace direct fake-data reads with an API-backed
workflow.

## Stack

- `Node.js` + `TypeScript`
- `Fastify` for the HTTP adapter
- `Zod` for request and response boundary validation
- `Vitest` for domain, application, persistence-adapter, and HTTP contract tests
- `tsx` for local development
- root `pnpm`, `ESLint`, `Prettier`, and TypeScript checks

## App Shape

```text
apps/backend/
  src/
    adapters/
      http/
        routes/
        schemas/
      persistence/
        memory/
    application/
      errors/
      explorer/
      ports/
    domain/
      areas/
      metrics/
      properties/
      sorting/
      summaries/
    app.ts
    main.ts
```

## Boundaries

The domain layer owns pure business behavior:

- annual rent calculation
- gross rent yield calculation
- sale-to-rent ratio calculation
- metric status derivation
- property ranking
- area summary aggregation

The application layer owns explorer use cases:

- `getExplorerBootstrap`
- `getExplorerArea`

Application services depend on repository ports, not concrete storage. They
compose domain rules, return contract-shaped DTOs, and keep valid empty areas as
successful responses.

The HTTP adapter owns transport concerns:

- Fastify route registration
- query and path parsing
- Zod request validation
- Zod response validation
- status codes and error envelopes

The memory persistence adapter owns disposable prototype data:

- supported Barranquilla areas
- source property records
- city-level and neighborhood-level property lookup

The memory adapter is not a database design.

## Implemented API

The backend currently serves:

```text
GET /api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla
GET /api/v1/explorer/areas/{area_id}
```

Supported prototype areas:

- `barranquilla`
- `alto-prado`
- `riomar`
- `villa-santos`
- `sample-empty-area`

The `sample-empty-area` record exists to verify the empty-state contract before
frontend integration.

## Contract Behavior

The backend derives canonical metrics from source inputs:

- `annual_rent = monthly_rent_amount * 12`
- `gross_rent_yield = annual_rent / sale_price_amount`
- `sale_to_rent_ratio = sale_price_amount / annual_rent`

Metric inputs must be present, positive, and finite. Invalid inputs are not
rankable.

Selected-area properties are sorted by:

1. descending `gross_rent_yield`
2. ascending `sale_to_rent_ratio`
3. descending `monthly_rent_amount`

Error responses use:

```ts
{
  error: {
    code: string;
    message: string;
    request_id: string | null;
  }
}
```

## Running The Backend

From the repository root:

```sh
pnpm install
pnpm dev:backend
```

The default local URL is:

```text
http://127.0.0.1:3001
```

Useful checks:

```sh
pnpm --filter @rent-yield/backend test
pnpm --filter @rent-yield/backend typecheck
pnpm --filter @rent-yield/backend lint
pnpm check
pnpm build
```

## Verification Notes

Current backend verification covers:

- metric formula behavior
- non-finite and invalid metric input handling
- property ranking tie-breakers
- area summary aggregation
- valid empty area summaries
- explorer application use cases
- prototype memory repositories
- HTTP contract scenarios through `fastify.inject`
- request validation and response validation

Manual scenario checks were also run for:

- bootstrap
- populated area
- empty area
- missing area
- malformed bootstrap request

## Follow-Up

The next implementation slice should pause on frontend integration until the
backend scenarios feel right.

After review, the next tracked tasks are:

- integrate the frontend explorer with the prototype backend API
- add frontend API consumer integration coverage

Still out of scope for this backend prototype:

- production database schema
- ingestion or scraping
- rent estimation model
- authentication
- advanced underwriting
- filters
- metric toggles
- property detail pages
- transactions
- deployment
