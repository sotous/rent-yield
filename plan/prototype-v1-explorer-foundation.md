# prototype v1 explorer foundation

## Summary

Plan the first executable work package for `rent-yield` prototype v1 so the repo can move from product framing into an implementation-ready frontend explorer foundation.

## Goal

- Keep the first implementation slice aligned with the approved specs
- Finish the remaining planning artifacts needed before coding
- Analyze and select a frontend tech stack that fits the approved v1 specs before scaffolding the app
- Stand up the frontend explorer shell for Barranquilla-first map-plus-chart exploration
- Use fake data to unblock frontend prototyping before the backend contract is finalized
- Preserve explicit review and documentation steps in the tracked workflow

## Relevant Specs

- `specs/frontend-spec.md`
- `specs/domain-spec.md`
- `README.md`
- `AGENTS.md`

## Scope

This plan covers the first coherent execution package for prototype v1:

- frontend interaction planning
- frontend tech-stack analysis
- frontend app scaffolding
- map explorer shell
- ranked gross-yield chart
- review
- documentation
- backend payload contract planning informed by the finished frontend prototype

This plan does not include:

- authentication
- metric toggles
- filtering
- property detail inspection
- property comparison
- full backend ingestion or data-lake implementation

## Approach

1. Lock the remaining interaction details that are still missing from the current specs.
2. Analyze the frontend tech stack choices that best fit the approved v1 specs and monorepo direction.
3. Create the frontend app shell in the monorepo.
4. Implement the main explorer layout around the approved v1 interaction model using fake data:
   - area selection through the map
   - ranked property chart using `gross rent yield`
   - responsive chart orientation by screen size
5. Review the result against ergonomics and spec alignment.
6. Record the resulting architecture and implementation assumptions.
7. Derive the backend prototype contract from the frontend's proven data needs.

## Execution Order

1. Write the frontend interaction spec
2. Analyze and select frontend tech stack
3. Scaffold the frontend prototype app
4. Build the map explorer shell
5. Build the ranked property chart
6. Review prototype v1 ergonomics against the specs
7. Document prototype v1 architecture notes
8. Define backend prototype contract

## Task Slices

### 1. Write the frontend interaction spec

Why this exists:

- The product and domain are defined, but the interaction contract is still missing.
- The frontend implementation should not guess map state, chart state, or responsive behavior.

Outcome:

- A dedicated interaction spec that defines the explorer screen behavior clearly enough to implement without product drift.

### 2. Analyze and select frontend tech stack

Why this exists:

- The first frontend scaffold should follow an explicit technical decision rather than a default habit.
- The stack should match the approved product constraints: monorepo structure, map-plus-chart explorer UI, responsive behavior, and fake-data-first prototyping.

Outcome:

- A written frontend stack decision that explains which framework, UI foundations, mapping approach, charting approach, and supporting tooling best fit prototype v1.

### 3. Scaffold the frontend prototype app

Why this exists:

- The repo is a monorepo but the first frontend application has not been created yet.

Outcome:

- A runnable frontend app inside `apps/frontend` with the initial project structure for the explorer.

### 4. Build the map explorer shell

Why this exists:

- The map is the primary geographic selector in the product.

Outcome:

- The explorer screen has a map region and obvious area-selection behavior centered on Barranquilla-first usage.

### 5. Build the ranked property chart

Why this exists:

- The chart is the primary ranking surface and must make high-yield properties easy to identify.

Outcome:

- A chart that ranks properties by `gross rent yield` and adapts orientation to screen size.

### 6. Review prototype v1 ergonomics against the specs

Why this exists:

- The first pass may technically work while still feeling confusing or too crowded.

Outcome:

- A retrospective-style review of whether the implementation still honors the core `map answers where, chart answers which` principle.

### 7. Document prototype v1 architecture notes

Why this exists:

- The repo workflow requires documentation after implementation.

Outcome:

- Architecture and usage notes covering frontend boundaries, expected data flow, and important implementation assumptions.

### 8. Define the backend prototype contract

Why this exists:

- The frontend prototype will reveal the actual property and area-summary fields that the backend needs to serve.
- The first backend contract should follow the proven explorer needs instead of preceding them.

Outcome:

- A minimal backend-facing contract for property records and area summaries aligned with the domain spec and informed by the frontend prototype.

## Risks And Assumptions

- Fake data is acceptable for the first frontend prototype as long as it stays consistent with the shared domain language.
- The frontend stack decision should be explicit before app scaffolding so early implementation does not drift into accidental framework choices.
- The backend contract may still evolve after a later backend-specific plan, so the first version should stay minimal.
- The chart may need scrolling behavior tuning once real property counts are visible.
- Barranquilla-first support is assumed throughout this slice.
- Early implementation should use mock or static data to unblock frontend prototyping before backend work is specified in detail.

## Validation

This plan is successful if:

- the missing planning artifacts are written before implementation starts
- the frontend explorer shell can represent the approved v1 workflow
- the tracked tasks are small enough to execute without further product decisions
- review and documentation remain explicit tracked work rather than implicit cleanup
