# DurableSubmissionV2 provider conformance

Every future durable Data Storage provider must prove the shared V2 boundary
before it can be described as conformant. The executable baseline is
`packages/data-storage-conformance`, which imports the shared contract, runner,
and vectors from `@rent-yield/listing-storage-contracts` as merged by PR #18.

A provider implements the production `DurableSubmissionV2Provider` port. Its
test suite also supplies the separate, conformance-only
`DurableSubmissionV2ConformanceFixtures` adapter. That adapter seeds and
invalidates the provider's own issued references; issuance is never added to
the production port.

Provider CI must run:

```ts
await runDurableSubmissionV2Conformance(provider, fixtures);
```

The runner verifies source-scoped replay, capture and interpretation conflicts,
derived outcome identity, seeded opaque-reference safety, accepted receipts,
and terminal progress shape. The provider must also retain its own tests for
durable concerns such as transaction recovery, reference expiry, object
finalization, retention, reconciliation, and migrations.

The in-memory harness proves contract behavior only. It does not certify a
database, object store, PostGIS, migration, network, or live-crawler path.
