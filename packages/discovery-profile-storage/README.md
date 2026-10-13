# Discovery-profile Storage

This package is the temporary Storage-owned persistence boundary for bounded
discovery profiles. Its JSON adapter is deliberately read-only and fixture-only:
it lets Crawler request the one operationally active profile for a known source
without taking ownership of source facts or file parsing.

## Public contract

`DiscoveryProfileRepository.findActiveBySourceKey({ source_key })` resolves to
one validated `ActiveDiscoveryProfileV1` or `null`. An active profile includes
its complete bounded configuration and deterministic profile provenance.

The required `extraction` rule is a strict discriminated union. An
`unreviewed` rule supplies no candidate configuration and must not run an
extractor. A `reviewed` rule is limited to declarative `html_anchor_href`
extraction with a versioned extractor identity, exact extractor-artifact hash,
candidate host/path allowlists, and an explicit no-candidates policy/rationale.
It contains no CSS selector, script, source body, or imperative source logic.

`deriveDiscoveryExtractionProvenance` returns `null` for an unreviewed rule.
For a reviewed rule it returns the extractor kind/version, its exact artifact
hash, and a deterministic configuration hash. The complete rule also feeds the
profile provenance hash, so a candidate-rule or extractor change cannot be
silently substituted.

The repository rejects a registry with invalid JSON or schema, duplicate
source/profile versions, or more than one active profile for a source. It never
chooses a profile arbitrarily.

`JsonFileDiscoveryProfileRepository` is the initial adapter. Point it at the
versioned registry in
[`fixtures/discovery-profiles.v1.json`](fixtures/discovery-profiles.v1.json).
It validates that every profile has Colombia/city/discovery-role scope, bounded
hosts and path prefixes, bounded request limits, and an explicit permitted media
type list before returning any record.

## Boundary and replacement

The registry holds only bounded operational facts. `state: "active"` means the
fixture is available for the crawler to read; it does **not** represent source
permission, candidate registration, access assessment, trusted review, or
canary approval. This package makes no live request and has no write, database,
or object-storage operation.

A future Data Storage provider may replace the JSON adapter while preserving the
read-only `DiscoveryProfileRepository` contract. Crawler should depend on that
contract and must not import source-specific facts from this package's fixture.
