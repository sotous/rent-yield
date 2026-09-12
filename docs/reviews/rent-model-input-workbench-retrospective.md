# Rent Model Input Workbench Retrospective

## Scope reviewed

This retrospective covers the first implementation slice of
`plan/rent-model-v1.md`: the standalone package scaffold and the boundary that
turns a listing-shaped record into a sale-subject request for the future Rent
Model.

It does not declare the full Rent Model complete.

## Outcome against the plan

The workbench establishes several foundational decisions from the approved
plan:

- sale and rental listings have distinct roles;
- sale price is excluded from the Rent Model request;
- required subject, storage, and crawler fields are explicit;
- missing subject fields produce an inspectable readiness result;
- the included Barranquilla fixture is labeled synthetic.

The estimator, comparable selector, evidence store, deduplication resolver,
benchmark fallback, confidence classification, and reproducibility suite have
not been implemented.

## Divergence and lessons

The implementation started with an input-boundary probe before the full plan
was decomposed into tracked execution tasks. That was useful for exposing the
data dependency, but it left the repository in an ambiguous state where the
presence of `apps/rent-model` could be mistaken for completion of Rent Model
V1.

The package README and plan status now state the narrower scope. Future slices
should follow the approved plan and use fixtures and fake data until the model
contracts and deterministic behavior are stable.

## Ergonomics

The CLI provides a small, direct way to inspect a fixture and understand what
the model boundary needs. The returned separation between readiness, storage
requirements, crawler requirements, and the model request makes missing data
visible during development.

## Next iteration

Before connecting live crawler output, decompose the remaining Rent Model plan
into Notion tickets and implement it through focused RED, GREEN, and refactor
cycles. The next useful slice is a fixture-backed rental-evidence contract with
explicit provenance, observation dates, and rejection of modeled rents as
comparables.

## Documentation updated

- `plan/rent-model-v1.md` records the current partial implementation status.
- `apps/rent-model/README.md` explains the workbench boundary and fixture.
- The root `README.md` links the plan, workbench, and this retrospective.
