# Discovery-profile Storage

This package is the temporary Storage-owned persistence boundary for bounded
discovery profiles. Its JSON adapter is deliberately read-only and fixture-only:
it lets Crawler request the one operationally active profile for a known source
without taking ownership of source facts or file parsing.

## Public contract

`DiscoveryProfileRepository.findActiveBySourceKey({ source_key })` resolves to
one validated `DiscoveryProfileV1` or `null`. The repository rejects a registry
with invalid JSON or schema, duplicate source/profile versions, or more than one
active profile for a source. It never chooses a profile arbitrarily.

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
