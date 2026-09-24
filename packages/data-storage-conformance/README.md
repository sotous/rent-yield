# Data Storage V2 conformance harness

This package is the Data Storage-side executable check for the shared
`DurableSubmissionV2` boundary. It imports the runner and vectors from
`@rent-yield/listing-storage-contracts`; it does not duplicate either.

The in-memory provider is deliberately not durable. Its only purpose is to
demonstrate provider behavior in a fast, isolated test: source-scoped replay,
capture and interpretation conflicts, seeded opaque-reference checks, accepted
receipts, and one immutable terminal progress event.

## Run it

```sh
pnpm --filter @rent-yield/data-storage-conformance typecheck
pnpm --filter @rent-yield/data-storage-conformance lint
pnpm --filter @rent-yield/data-storage-conformance test
```

## Adopt it in a future durable provider

1. Keep the production adapter limited to `DurableSubmissionV2Provider`.
2. Add a test-only `DurableSubmissionV2ConformanceFixtures` adapter that seeds
   and invalidates references using the durable provider's own staging or
   issuance path.
3. Run `runDurableSubmissionV2Conformance(provider, fixtures)` in that
   provider's CI suite.
4. Add provider-specific tests for transaction recovery, object finalization,
   retention, and migrations in the separately approved durable-provider work.

Passing this package does not prove PostgreSQL, object storage, migrations, or
recovery behavior. Those capabilities remain outside this harness.
