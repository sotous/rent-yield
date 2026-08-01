# prototype v1 backend implementation architecture

## Summary

Plan the first backend implementation slice for `rent-yield` prototype v1.

The backend should be a TypeScript Node service built with DDD-inspired domain
boundaries, hexagonal architecture, and TDD.

This plan follows the completed backend API contract and prepares the repo to
implement the two read-only explorer endpoints without expanding product scope.

## Goal

- Scaffold `apps/backend` as a TypeScript Node workspace package.
- Implement the prototype v1 API contract with a small, testable backend.
- Keep domain logic independent from HTTP, storage, framework, and runtime
  details.
- Make the backend the canonical owner of metric calculation.
- Use TDD from the domain layer outward.
- Start with static or in-memory Barranquilla prototype data behind ports.

## Relevant Specs And Docs

- `README.md`
- `AGENTS.md`
- `specs/domain-spec.md`
- `specs/backend-api-spec.md`
- `docs/api/prototype-v1.md`
- `docs/api/prototype-v1-consumer-contract.md`
- `docs/reviews/backend-prototype-contract-review.md`
- `plan/prototype-v1-backend-contract-and-api-docs.md`

## Scope

This plan covers:

- backend stack selection
- `apps/backend` package scaffold
- DDD-style domain modules for areas, properties, metrics, summaries, and
  ranking
- hexagonal application, ports, and adapters
- TDD strategy
- prototype fixture/in-memory persistence
- HTTP routes for the documented explorer API
- local run and verification commands
- backend architecture documentation and retrospective

This plan does not include:

- production database schema
- ingestion or scraping pipeline
- rent estimation model
- authentication
- advanced underwriting
- filters
- metric toggles
- property detail pages
- saved searches
- transactions
- deployment or hosting
- shared package extraction unless implementation proves it is necessary

## Stack Decision

Use:

- `TypeScript`
- `Node.js`
- `Fastify`
- `Zod`
- `Vitest`
- `tsx` for local development
- existing root `pnpm`, `ESLint`, `Prettier`, and `TypeScript` workflow

Why:

- The current backend contract is small: two read-only endpoints.
- Fastify is lightweight and supports route-level testing with `fastify.inject`.
- Zod gives clear validation at the HTTP adapter boundary.
- Vitest already fits the repo's frontend testing posture.
- A small Fastify app avoids Nest-style module and decorator ceremony before the
  backend has enough complexity to justify it.

Do not introduce OpenAPI generation in the first implementation. The handwritten
contract in `specs/backend-api-spec.md` remains the source of truth until the
runtime API stabilizes.

## Architecture Direction

The implementation should use DDD and hexagonal architecture proportionally.

The goal is not to create many abstractions. The goal is to keep business rules
portable and prevent HTTP or prototype storage details from becoming the
backend's core model.

Proposed shape:

```text
apps/backend/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    main.ts
    app.ts

    domain/
      areas/
        area.ts
        areaTypes.ts
      properties/
        property.ts
        propertyTypes.ts
      metrics/
        rentalMetrics.ts
        metricStatus.ts
      summaries/
        areaSummary.ts
      sorting/
        propertyRanking.ts

    application/
      explorer/
        getExplorerBootstrap.ts
        getExplorerArea.ts
        explorerDtos.ts
      ports/
        areaRepository.ts
        propertyRepository.ts

    adapters/
      http/
        routes/
          explorerRoutes.ts
        schemas/
          explorerSchemas.ts
        errors.ts
      persistence/
        memory/
          prototypeAreaRepository.ts
          prototypePropertyRepository.ts
          prototypeData.ts

    shared/
      result.ts
      errors.ts
```

Tests may live beside source files or under `tests/`, but the first scaffold
should be consistent. Prefer colocated tests for pure domain/application modules
and HTTP contract tests under `src/adapters/http`.

## Boundary Rules

### Domain

The domain layer owns pure business behavior:

- annual rent calculation
- gross rent yield calculation
- sale-to-rent ratio calculation
- metric safety rules
- metric status derivation
- property ranking
- area summary aggregation
- domain enum/value semantics

The domain layer must not import Fastify, Zod, filesystem APIs, databases,
environment variables, or HTTP DTOs.

### Application

The application layer owns use cases:

- `GetExplorerBootstrap`
- `GetExplorerArea`
- `ComputePropertyMetrics`
- `SummarizeArea`

It coordinates repositories through ports, calls domain services, applies the
default sort contract, and returns API-ready DTOs.

Application services may know the prototype supports only `CO` and
`Barranquilla`, but that constraint should be explicit and tested.

### Ports

Ports describe what the application needs:

```ts
interface AreaRepository {
  listSupportedAreas(input: {
    countryCode: "CO";
    cityName: "Barranquilla";
  }): Promise<Area[]>;
  findAreaById(areaId: string): Promise<Area | null>;
}

interface PropertyRepository {
  listRankablePropertiesForArea(areaId: string): Promise<PropertyInputRecord[]>;
}
```

Ports should avoid leaking storage implementation details. A database adapter
can replace the prototype memory adapter later without changing use cases.

### Adapters

HTTP adapters own:

- Fastify route registration
- query and path parsing
- Zod validation
- status codes
- error response mapping
- response shape validation

Persistence adapters own:

- prototype Barranquilla seed data
- mapping static records into application inputs
- area hierarchy lookup

Prototype data should store source inputs, not trust manually authored derived
metrics as authoritative. The backend should compute `annual_rent`,
`gross_rent_yield`, `sale_to_rent_ratio`, and `metric_status` before returning
properties.

## First API Use Cases

### `GET /api/v1/explorer/bootstrap`

Use case:

- `GetExplorerBootstrap`

Input:

- `country_code=CO`
- `city_name=Barranquilla`

Output:

- `default_area_id`
- `areas`
- `data_label`

Behavior:

- return Barranquilla supported areas
- default to the broadest Barranquilla area
- reject unsupported geography with a typed application error

### `GET /api/v1/explorer/areas/{area_id}`

Use case:

- `GetExplorerArea`

Input:

- `area_id`

Output:

- `area`
- `summary`
- `properties`
- `sort`
- `data_label`

Behavior:

- return one full map-plus-chart payload
- sort properties by the backend API contract
- return `200` with `properties: []` for a valid empty area
- return `area_not_found` for unsupported areas

## TDD Strategy

Build from the inside out.

### 1. Domain Tests

Write tests first for:

- `annual_rent = monthly_rent_amount * 12`
- `gross_rent_yield = annual_rent / sale_price_amount`
- `sale_to_rent_ratio = sale_price_amount / annual_rent`
- zero, negative, missing, and estimated inputs
- metric status derivation
- default ranking tie breakers:
  1. descending `gross_rent_yield`
  2. ascending `sale_to_rent_ratio`
  3. descending `monthly_rent_amount`
- median, average, min, and max summary behavior
- empty summary behavior

### 2. Application Tests

Write tests for:

- bootstrap returns Barranquilla areas and default area
- unsupported country/city returns a typed error
- selected area returns area, summary, sorted properties, sort metadata, and data
  label
- valid empty area returns a successful empty payload
- missing area returns a typed `area_not_found` error

### 3. HTTP Contract Tests

Use `fastify.inject()` to test:

- `GET /api/v1/explorer/bootstrap?country_code=CO&city_name=Barranquilla`
- `GET /api/v1/explorer/areas/{area_id}`
- malformed query parameters
- missing area
- valid empty area
- response shape alignment with `specs/backend-api-spec.md`
- error envelope shape:

```ts
{
  error: {
    code: string;
    message: string;
    request_id: string | null;
  }
}
```

## Execution Order

1. Break this plan into Notion tasks after approval.
2. Confirm the API consumers and contract boundaries before implementation.
3. Scaffold `apps/backend` as a TypeScript workspace package.
4. Add backend test tooling and root script integration.
5. Implement metric calculation with TDD.
6. Implement property ranking and area summary with TDD.
7. Define application use cases and repository ports.
8. Add prototype Barranquilla data behind memory adapters.
9. Implement Fastify app factory and explorer HTTP routes.
10. Add HTTP contract tests for the two documented endpoints.
11. Update README with backend run and check commands.
12. Integrate the frontend explorer with the prototype backend API.
13. Add frontend API consumer integration coverage.
14. Write `docs/architecture/backend-prototype-v1.md`.
15. Write `docs/reviews/backend-prototype-implementation-review.md`.

## Notion Task Breakdown Candidates

After this plan is approved, create tracked tasks for:

1. Choose backend TypeScript Node stack and testing posture.
2. Confirm API consumers and contract boundaries.
3. Scaffold `apps/backend` workspace package.
4. Implement domain metric rules with TDD.
5. Implement property ranking and area summary with TDD.
6. Implement explorer application services and repository ports.
7. Add prototype Barranquilla data adapter.
8. Implement HTTP routes for bootstrap and selected area.
9. Add API contract tests.
10. Wire root scripts and local run instructions.
11. Integrate frontend explorer with prototype backend API.
12. Add frontend API consumer integration coverage.
13. Review backend implementation and frontend consumer integration against
    contract and specs.
14. Document backend architecture and consumer integration boundary.

## Risks And Assumptions

- DDD can become theatrical for a two-endpoint backend. Keep abstractions
  directly tied to current use cases.
- The single `metric_status` field may later become too coarse, but it matches
  the current v1 contract.
- City-level area semantics need care because `barranquilla` may include child
  neighborhood properties.
- The prototype memory adapter must remain disposable and should not become a
  hidden database design.
- Frontend fake data currently includes derived metrics. Backend prototype data
  should store source fields and let domain code derive canonical outputs.

## Validation

This plan is successful when the implementation can later satisfy:

- both documented endpoints are implemented or the contract docs are updated
  alongside any intentional change
- domain metric calculations are deterministic and tested
- route handlers do not duplicate domain calculations
- selected-area properties are sorted by the documented backend contract
- empty area responses are successful and frontend-safe
- prototype persistence is isolated behind ports
- the frontend explorer consumes the prototype backend API for bootstrap and
  selected-area payloads
- frontend tests or smoke coverage verify the API-backed ready path and at least
  one loading, empty, or error state
- `pnpm check` includes backend typecheck, lint, and tests
- README explains how to run and verify the backend
- architecture and implementation review docs are written
