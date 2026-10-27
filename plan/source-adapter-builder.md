# Source Adapter Builder

## Status

The reusable adapter foundation is implemented. The initial source-specific
adapter was removed on 2026-10-27; no source adapter is currently registered.

## Goal

Provide a generator foundation for turning a selected listing-source candidate
and reviewed frozen fixture into a source-specific adapter. The generated
adapter converts that fixture into shared `ListingInput` records; the generator
does not crawl a source or infer its response shape.

## Sources of truth

- `AGENTS.md`
- `README.md`
- `specs/domain-spec.md`
- `specs/source-adapter-spec.md`
- `specs/rent-model-spec.md`
- `apps/crawlers/README.md`

## Retained decisions

### One output contract

Every generated adapter emits `ListingInput` as specified in
[`specs/source-adapter-spec.md`](../specs/source-adapter-spec.md). It preserves
explicit source identity, listing role, location, property facts, asking-price
facts, source dates, and field provenance. Missing or ambiguous values remain
`null`; an adapter never estimates rent, yield, fees, location, area, or
property attributes.

`ListingInput` is not a Rent Model request. A sale listing never becomes rental
evidence simply because it contains a sale price.

### One source-local location

All source-specific adapters and their fixtures live at:

```text
apps/crawlers/src/sources/<source-key>/
```

Each source directory contains implementation, focused tests, and fixture
metadata. Generic contracts, normalization helpers, and shared tests remain
outside source directories. `apps/crawlers/src/adapters/sources/` is not a valid
location.

### Minimal adapter shape

```ts
type SourceAdapter = {
  sourceKey: string;
  parseFixture(input: SourceFixture): SourceAdapterResult;
};
```

`parseFixture` accepts an already frozen local fixture and returns ordered
`ListingInput` records, a recognized empty result, or an explicit parse failure.
It never accepts URLs, request options, credentials, cursors, retry settings,
or a transport.

### Source-specific prerequisite

An adapter is implemented only after a selected source has a representative
sanitized fixture or documented structural fixture. The fixture is evidence for
the supported response shape; no parser assumptions may be encoded without it.
A structural fixture preserves only confirmed structure and deterministic
non-source test values. It is never crawler output.

### Shared downstream handoff

The Rent Model receives a validated, source-neutral handoff from `ListingInput`
to its existing `ResidentialListing` input. It preserves role, separate
sale/rental amounts, collection time, and field provenance. Missing model
values remain `null`; the handoff has no source-specific imports.

## Delivery order for the next adapter

1. Select a candidate and obtain a reviewed frozen fixture.
2. Write a source-local failing test for the fixture shape and mapping.
3. Implement the smallest source-local adapter that passes it.
4. Prove adapter output validates as `ListingInput` and crosses the shared
   Rent Model handoff without source-specific imports.
5. Record limitations, validation, and retrospective updates.

## Validation

- Every recognized fixture record becomes deterministic `ListingInput` or an
  explicit parse failure.
- Each output has selected-source identity, a listing role, and provenance for
  every populated source-derived value.
- Sale and monthly-rent fields stay separate.
- Empty recognized input produces `[]`; malformed or unsupported input fails
  explicitly.
- Source-specific tests use frozen fixtures only and perform no network I/O.
- Crawler, shared-contract, and Rent Model checks remain green.

## Out of scope

- live collection, scheduling, pagination, detail-page retrieval, browser
  automation, credentials, request policy, and retry behavior;
- durable persistence, identity resolution, Rent Model calculation, yield
  calculation, and explorer changes.

## Retrospective

The generic `ListingInput` contract, `SourceAdapter` validation boundary, and
source-neutral Rent Model handoff are ergonomic and remain in place. Removing
the initial source implementation prevents an unrepresentative fixture shape
from becoming a template. The next iteration begins with a new selected
candidate and reviewed fixture, then follows the test-first order above.
