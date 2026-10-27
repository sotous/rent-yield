# Source Adapter Builder

## Status

Implemented and reviewed on 2026-10-26. The approved execution tasks delivered
the shared contract, generic fixture boundary, Ciencuadras structural-fixture
adapter, and Rent Model handoff described below.

## Goal

Turn one selected listing-source candidate into one source-specific adapter
that turns frozen source fixtures into the shared `ListingInput` contract.

The first adapter is for the selected `ciencuadras` candidate, limited to
Barranquilla, Colombia rental listings. It is a fixture-first parser and
normalizer: it does not make requests or coordinate crawler execution.

## Why

The crawler workbench has generic fixture extraction and a Ciencuadras source
directory, but no simple source-adapter contract explaining what a source-local
module must produce. A single `ListingInput` boundary lets each source own its
own response shape while downstream storage and the Rent Model receive the
same listing representation.

## Sources of truth

- `AGENTS.md`
- `README.md`
- `specs/domain-spec.md`
- `specs/crawler-research-spec.md`
- `specs/rent-model-spec.md`
- `specs/source-adapter-spec.md`
- `apps/crawlers/README.md`
- `plan/colombian-listing-crawlers-and-ingestion.md`

## Decisions

### One output contract

Every source adapter emits `ListingInput` as specified in
[`specs/source-adapter-spec.md`](../specs/source-adapter-spec.md). It represents
one observed source listing, preserving source identity, listing role, location,
property facts, asking-price facts, source dates, and field provenance.

The adapter emits only explicit source claims. Missing or ambiguous source
values remain `null` or a documented unknown; an adapter never estimates rent,
yield, fees, location, area, or property attributes.

`ListingInput` is not a Rent Model request. In particular, a sale listing never
becomes rental evidence merely because it contains a sale price. Downstream
components decide eligibility and use the adapter's provenance to explain a
value's origin.

### One source-local location

All source-specific adapters and their source-only fixtures live at:

```text
apps/crawlers/src/sources/<source-key>/
```

For example, the first adapter belongs at
`apps/crawlers/src/sources/ciencuadras/`. The repository must not introduce or
document `apps/crawlers/src/adapters/sources/`; that older proposed location is
superseded by this decision.

Each source directory contains the adapter implementation, its focused tests,
and fixture metadata needed by those tests. Generic contracts, normalization
helpers, and shared tests stay outside source directories.

### Minimal adapter shape

The shared interface is deliberately small:

```ts
type SourceAdapter = {
  sourceKey: string;
  parseFixture(input: SourceFixture): SourceAdapterResult;
};
```

`parseFixture` accepts an already frozen, locally available fixture and returns
one typed `SourceAdapterResult`: either ordered `ListingInput` records, an
empty recognized discovery result, or a typed parse failure. It must reject an
unrecognized fixture shape rather than guessing. The adapter does not accept
URLs, request options, credentials, page cursors, retry settings, or a
transport.

### Ciencuadras v1 scope

| Dimension                                       | Decision                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| Source key                                      | `ciencuadras`                                                     |
| Geography                                       | Barranquilla, Colombia                                            |
| Listing role                                    | `for_rent` only                                                   |
| Input                                           | frozen source fixture with a documented, supported response shape |
| Output                                          | one `ListingInput` per recognizable rental listing                |
| Detail pages, sale listings, second source/city | deferred                                                          |

The adapter is implemented only after a representative sanitized fixture or a
documented structural fixture is available. A structural fixture preserves only
source structures confirmed during in-memory inspection; listing-specific
scalars are deterministic non-source test values, while a required page-level
metadata claim may be retained to prove its mapping. It is never crawler output.
Until one of those inputs exists, no parser assumptions should be encoded.

### Discovered fixture-handoff dependency

Before a source-derived fixture can unblock the Ciencuadras parser slice, the
bounded discovery runtime must pass its completed in-memory response to fixture
capture together with the active Storage discovery-profile provenance. That
handoff is source-neutral: it carries the selected source key, canonical
response URL, collection time, permitted media type, response bytes, and the
profile version/hash. Fixture capture records that provenance in the permitted
source origin; it does not retain the obsolete access-assessment hash. This
runtime dependency supplies a redacted fixture for later adapter work without
adding source parsing, transport behavior, or source discovery to this plan.
The bounded layer accepts an unclassified response only when its media type is
fixture-safe; it does not decide whether that response contains recognizable
listings. Unsupported media remains an explicit transport failure, while the
adapter/parser owns response-shape recognition during fixture replay.
The allowlist compares normalized base media types, so standard response
parameters such as `text/html; charset=utf-8` do not prevent fixture capture.

### Resolved shared downstream handoff

The Rent Model now receives a validated, source-neutral handoff from
`ListingInput` to its existing `ResidentialListing` input. It preserves listing
role, separate sale/rental amounts, collection time, and field provenance. A
missing model-required value remains `null`, allowing the existing workbench to
report incompleteness rather than inventing a subject field. The handoff has no
source-specific imports; the Ciencuadras integration test remains source-local.

### Versioning and change rule

An adapter has a human-readable version. A response-shape or mapping change is
a new adapter version, with an added fixture and regression tests. Refactoring
that leaves fixture inputs and `ListingInput` outputs identical does not require
a new adapter version.

## Delivery slices after approval

1. **Shared contract RED/GREEN:** add failing schema and example tests for
   `ListingInput`, including source identity, listing-role separation, null
   handling, money facts, dates, and provenance; implement the shared contract
   in the existing listing-storage-contracts package.
2. **Adapter interface RED/GREEN:** add failing tests for recognized empty
   fixtures, malformed fixtures, source-key mismatch, source-order retention,
   and no invented fields; add the minimal `SourceAdapter` interface and test
   helpers in `apps/crawlers`.
3. **Ciencuadras RED/GREEN:** after a representative fixture exists, write
   source-local failing tests for the exact response shape and mappings; add
   only the Ciencuadras rental adapter needed to pass them.
4. **Contract integration RED/GREEN:** prove the emitted records validate as
   `ListingInput` and remain consumable by the existing shared listing and Rent
   Model boundaries without source-specific imports.
5. **Documentation and retrospective:** update adapter documentation, record
   limitations exposed by the real fixture, and complete the repository
   retrospective after implementation.

## Validation

- Every fixture record produces a deterministic `ListingInput` or a typed parse
  failure; none is silently dropped or guessed.
- Each output has the selected source key, at least one stable source-local
  identity (listing ID or URL), its listing role, and provenance for every
  populated value.
- Rental and sale amount fields remain distinct; sale price cannot populate
  monthly rent.
- Empty recognized input produces `[]`; malformed or unsupported input fails
  explicitly.
- Ciencuadras code cannot parse another source key, city, or listing role.
- Source-specific tests use frozen fixtures only; no adapter test performs a
  network request.
- Crawler, shared-contract, and Rent Model checks remain green.

## Out of scope

- live collection, scheduling, pagination, detail-page retrieval, browser
  automation, credentials, request policy, and retry behavior;
- source selection, access decisions, durable persistence, or data publishing;
- Rent Model calculation, yield calculation, identity resolution, and explorer
  changes;
- adapters beyond Ciencuadras rental discovery.

## Risks and assumptions

- A representative fixture may show that the selected source shape is not a
  fit. In that case, record the parse limitation and do not invent a fallback.
- The first source may omit fields needed by later consumers. Preserve them as
  missing and let downstream eligibility reject or defer the record.
- Mapping rules can drift as a source changes. Fixture regression tests and
  explicit adapter versions make the change visible.

## Retrospective

The implementation met the plan: `ListingInput` is the shared source-neutral
contract; `SourceAdapter` validates fixture and output invariants without
runtime concerns; and the Ciencuadras adapter remains confined to its
source-local structural fixture, parser, and tests. The Rent Model handoff
proves that validated rental role, separate price semantics, collection time,
and field provenance cross the shared boundary without a source-specific import.

The only deliberate deviation is evidence fidelity: a documented structural
fixture stands in for a retained redacted discovery response. It proves the
confirmed JSON-LD shape and no more. During implementation, bounded response
handoff, media-type normalization, and the shared Rent Model mapper were added
as narrow enabling seams. Review also found that an exact decimal could become
`Infinity` at the number-based Rent Model boundary; the mapper now rejects that
case explicitly rather than silently changing the value.

The result is ergonomic for downstream work: source parsers produce explicit
claims or `null`, the common schema enforces provenance and sale/rent
separation, and the Rent Model reports missing subject fields instead of
inventing them. No further iteration is justified now. A future real redacted
fixture may justify a new adapter version and focused mapping tests; detail
pages, another city/source, persistence, and model execution remain separate
work.

The source-adapter specification and crawler README already describe the
fixture-first contract and source-local layout. This plan records the runtime
and Rent Model handoff decisions; a future real-fixture iteration must update
the source-local fixture documentation and mapping notes for its newly observed
shape.
