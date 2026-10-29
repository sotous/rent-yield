# Source Adapter Builder Boundary Retrospective

## Result

The prototype was moved from the misleading top-level `listing-import` path to
`apps/crawlers/source-adapter-builder`. Its public responsibility now ends at
building a source adapter and parsing one supplied source response into
`ListingInput[]`.

The adapter builder retains candidate validation, JSON recipe validation,
fixture-backed parsing, typed build/parse failures, and the developer-invoked
`adapter:build` command. It contains no adapter registry, crawler runner,
transport, scheduling, persistence, or live source access.

## Validation

- Focused tests: 15 passed.
- Typecheck and lint passed.
- `adapter:build --candidate fixtures/candidates/example-baq-rentals.json`
  returned a `built` result using only the synthetic fixture.

## Divergence and ergonomics

The former package name made a narrow builder proof look like a product import
application. Its nested path now makes the future crawler relationship visible
without claiming that a crawler runtime exists. Removing the runner also makes
the essential runtime boundary explicit: the adapter receives a response; it
does not fetch one.

## Follow-up

Candidate storage, crawler orchestration, transport, live fixtures, and source
access remain separate decisions. The builder package now keeps synthetic
examples under `fixtures/candidates/`, separate from the append-only
`candidates/` artifact store used by `find-candidates` to save complete new
builder inputs.
