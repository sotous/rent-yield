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
