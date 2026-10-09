# Fixture discovery-profile storage boundary

The initial crawler uses a temporary Storage-owned JSON registry for bounded
discovery profiles. The implementation lives in
[`packages/discovery-profile-storage/`](../../packages/discovery-profile-storage/)
and exposes the read-only `DiscoveryProfileRepository` contract.

Crawler asks for an active profile by `source_key`. Storage validates the whole
registry and either returns exactly one profile or returns `null`; invalid JSON,
invalid records, duplicate source/profile versions, and multiple active profiles
for a source fail closed. The committed fixture is at
[`packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json`](../../packages/discovery-profile-storage/fixtures/discovery-profiles.v1.json).

Every active result also includes derived `discovery_profile_provenance`:
`source_key`, `profile_version`, and `profile_sha256`. The digest is SHA-256 of
a canonical complete validated V1 record, so it binds the selected operational
scope, hosts, paths, budgets, and media types. It is generated at read time.
The persisted permitted-source fixture envelope requires this exact object in
`origin.discovery_profile_provenance`, with a source key that matches the
origin. Fixture capture uses it for configuration lineage in place of the
obsolete `assessment_sha256` provenance.

This is a strict append-only migration. Persisted envelopes with the old field
are rejected rather than silently relabeled. New captures use the validated
profile provenance and, when correcting a prior fixture, reference it through
the new envelope's `supersedes_fixture_id`.

Each record scopes an operational discovery run to Colombia, one city, allowed
listing roles, hosts, path prefixes, budgets, and media types. Source-specific
values belong to that Storage fixture rather than generic crawler application
code.

`active` is only fixture availability. It is not approval to contact a source
and does not encode candidate registration, access assessment, trusted review,
or a real-world canary decision. The adapter makes no live request and creates
no database or object-storage dependency.

The JSON file is a replaceable MVP adapter. A later Data Storage provider must
preserve the read-only repository behavior while evolving its lookup inputs
explicitly when multi-city or multi-capability discovery is needed.
