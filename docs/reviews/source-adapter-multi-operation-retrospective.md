# Source Adapter Multi-Operation Retrospective

## Result

The source-adapter-builder now builds one adapter from an `AdapterCandidate`
with independent rent and sale request URLs and extraction recipes. The caller
labels each supplied response with its operation. The adapter validates that
the operation is configured and the response URL matches, then emits the
existing `ListingInput` shape with the operation and operation-specific price
mapping applied.

The D.C. Colombia candidate now describes both documented operations. The CLI
build summary reports supported operations and their request URLs so a future
crawler can coordinate the required responses.

## Plan alignment and divergence

The implementation met the plan's candidate contract, parser behavior,
single-operation compatibility, and no-network boundary. The CLI summary also
exposes the built adapter's supported operations and source URLs; this makes the
output useful for future orchestration while keeping request execution outside
the builder.

## Ergonomics

An operation map keeps the URL and field paths together, so rent and sale prices
cannot accidentally share one extraction path. Explicit operation context on
each response avoids inferring transaction type from source-specific response
fields. A source can still be represented with only one operation when public
evidence for the other is incomplete.

## Follow-up

The next pipeline feature is a crawler that iterates the adapter's supported
operations, fetches each configured URL, passes the operation with the response,
and collects normalized listings. This builder change does not verify live
source responses or access permission. No further builder iteration is needed
before that crawler contract is implemented.

## Documentation

Updated the `find-candidates` skill, source-adapter-builder guide, root README,
candidate artifacts, and the multi-operation plan. The Rent Model and
`ListingInput` output semantics remain unchanged.

## Validation

- Focused builder tests passed: 23 tests.
- Source-adapter-builder TypeScript typecheck passed.
- Source-adapter-builder ESLint passed.
- Prettier check passed for changed source, skill, candidate, and documentation
  files.
- The developer CLI built `dc-colombia` and reported both rent and sale request
  URLs. No source request was made.
