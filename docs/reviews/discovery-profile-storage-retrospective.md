# Discovery-profile storage retrospective

## Result

The Storage-owned fixture adapter meets the approved repository slice. It
validates a versioned JSON registry on every read and exposes only one active
bounded-discovery profile for the requested source. Its tests cover active,
inactive, ambiguous, malformed, unsafe, and committed-fixture paths.

## Divergence from the plan

The package deliberately stops at the Storage boundary. Crawler integration is
owned by the concurrent crawler work and remains a separate handoff: Crawler
must construct its bounded run from `DiscoveryProfileRepository` rather than
continue importing a source-specific profile constant. No live source access,
database, registration, assessment, or approval behavior was added.

## Ergonomics

The small source-key lookup is easy for the first fixture-only runner to adopt,
and the returned record carries all bounds needed to construct its run. The
trade-off is explicit: it cannot select among several active city or capability
profiles for a source. That is appropriate for the MVP and prevents accidental
scope selection.

## Follow-up

The 2026-10-09 provenance evolution is the only additional Storage iteration
needed now: active reads derive deterministic profile lineage instead of
borrowing access-assessment terminology. When Crawler needs multiple scopes,
evolve the repository lookup with an explicit versioned scope query and replace
the JSON adapter behind the same read-only boundary.

## Documentation

The package README explains the consumer and replacement boundary, including
the exact derived provenance fields. The architecture note records the fixture
path, fail-closed semantics, canonical profile digest, and the fact that
`active` is not authorization.
