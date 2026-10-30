# Crawler PoC Implementation Plan

## Status

Draft for approval. The behavior and boundaries in
[the crawler PoC specification](../specs/crawler-poc-spec.md) are approved;
implementation has not started. After this plan is approved and
decision-complete, break it into tracked Notion tasks before coding.

## What we are building

Add a developer-invoked crawler package under `apps/crawlers/crawler`. Given
one saved `AdapterCandidate` JSON file, it will build the source adapter, make
one bounded HTTPS GET for each configured operation, pass each response to
`SourceAdapter.parse()`, and save a local JSON run artifact containing operation
statuses and normalized `ListingInput` rows.

The crawler is the acquisition boundary only. It will not paginate, schedule,
write to a database, register sources, or call the Rent Model. The output
contract is the one in `docs/specs/crawler-poc-spec.md`.

## Why

The source-adapter builder can already build adapters for rent and sale and
parse supplied JSON, HTML, CSV, or XML bodies. The missing link is exercising
those adapters against candidate-configured requests and producing a usable,
inspectable run artifact. This PoC will prove the candidate → builder → fetch →
parse → local output pipeline with both JSON and HTML candidates before any
larger acquisition or storage system is considered.

## Relevant references

- `docs/specs/crawler-poc-spec.md` — approved runtime behavior and acceptance.
- `apps/crawlers/source-adapter-builder/README.md` — adapter build and parse
  contract.
- `apps/crawlers/source-adapter-builder/src/source-adapter-builder.ts` —
  `SourceAdapter`, `SourceResponse`, and `ListingInput` implementation.
- `apps/crawlers/source-adapter-builder/src/adapter-candidate.ts` — candidate
  types and validation behavior.
- `docs/plans/poc-crawler-reset.md` — deliberate PoC scope and exclusions.
- `docs/specs/rent-model-spec.md` — downstream input gap; direct model wiring is
  outside this plan.

## Proposed approach

### Slice 1: expose the builder boundary for workspace use

- Add a small public entry point for candidate types, adapter types, and
  `buildSourceAdapter` in the builder package.
- Declare the builder as a workspace dependency of the crawler package.
- Keep fetching and file output out of the builder.
- Add focused contract tests for the public entry point if needed by the
  package's module-resolution setup.

### Slice 2: implement an injectable one-operation HTTP runner

- Create the crawler package with strict TypeScript settings and a
  developer-facing `crawl` script.
- Implement a runner that accepts a candidate and an injectable fetch function,
  builds one adapter, then processes supported operations in declared order.
- For each operation, fetch its exact adapter URL once, enforce HTTPS-only
  redirects (up to five), a 30-second timeout, and a 10 MiB response limit.
- Pass the original configured request URL, actual response content type, body,
  operation, and a UTC ISO timestamp to the adapter parser.
- Continue to later operations after individual failures. Preserve successful
  listings and typed per-operation failure details.
- Use the platform `fetch` implementation; do not add a transport dependency.

### Slice 3: implement the CLI and run artifact

- Support `--candidate <path>` and optional `--output <path>`; reject unknown,
  missing, or duplicate arguments with a clear typed failure.
- Default output to a unique JSON artifact under
  `data/crawler-runs/<sourceKey>/<startedAt>.json`; never overwrite.
- Add the generated run directory to `.gitignore`.
- Write the schema-versioned artifact from the approved spec, including source
  identity, timestamps, per-operation URLs/status/counts, and successful
  normalized listings. Do not retain raw response bodies.
- Print a concise summary and artifact path. Exit nonzero for build or
  operation failures while keeping a partial artifact when the build succeeded.

### Slice 4: prove operation and format coverage

- Add synthetic fixture-backed integration tests that exercise candidate load,
  adapter construction, injected HTTP responses, parse invocation, run artifact
  shape, exit status, and partial failures without accessing public sites.
- Cover a successful rent-and-sale run, valid empty response, fetch failure,
  parse failure, timeout, non-2xx response, redirect violation, response-size
  limit, malformed candidate, output collision, and partial success.
- Run manual smoke checks against the checked-in Ciencuadras HTML candidate and
  D.C. Colombia JSON candidate. Verify rent and sale each produce at least one
  normalized listing with no fetch or parse failures. Treat live results as
  manual evidence, not a network-dependent automated test.

### Slice 5: document and retrospect

- Add a crawler package README with setup, invocation, output schema, and
  failure behavior.
- Update root and docs navigation to identify the implemented crawler path and
  keep the crawler spec linked as the behavior source of truth.
- Write a retrospective against this plan and the spec; record any deviations
  and whether a follow-up is needed to map `ListingInput` to
  `ResidentialListing`.

## Test-first execution

Implement each behavior in the order above with the repository's RED → GREEN →
REFACTOR cycle. Start with runner unit tests using an injected fetch function,
then CLI/output tests, then an integration test that runs the candidate through
the builder and crawler together. Add each test before the corresponding
implementation and confirm it fails for the intended reason. Existing builder
tests remain regression coverage; they do not replace crawler tests.

## Likely files and modules

- `apps/crawlers/crawler/package.json`
- `apps/crawlers/crawler/tsconfig.json`
- `apps/crawlers/crawler/src/crawler.ts`
- `apps/crawlers/crawler/src/cli/crawl.ts`
- `apps/crawlers/crawler/src/*.test.ts`
- `apps/crawlers/crawler/README.md`
- `apps/crawlers/source-adapter-builder/src/index.ts` (public package entry)
- `apps/crawlers/source-adapter-builder/package.json`
- `pnpm-lock.yaml`
- `.gitignore`
- `README.md`
- `docs/README.md`
- `docs/reviews/crawler-poc-retrospective.md`

## Risks and assumptions

- Candidate URLs and response shapes can change between discovery and a live
  smoke run. Synthetic tests must prove deterministic behavior independently of
  external sites.
- A source may return an empty but valid operation response. The crawler should
  record that as parsed with zero listings; the integration acceptance check
  still requires at least one listing per operation.
- The builder currently treats a response atomically. One invalid mapped row
  fails the entire operation, including otherwise valid rows. This plan keeps
  that behavior; row-level recovery would be a separate builder change.
- Node/runtime support for `fetch`, redirects, timeout cancellation, and
  package exports must match the repository's configured Node version. Confirm
  this before finalizing the package entry point.
- The candidate currently includes source identity and city, but normalized
  `ListingInput` lacks city and property type, and does not include bathrooms or
  social stratum. Do not solve this inside the crawler; resolve it in a
  separate downstream mapping plan before Rent Model ingestion.
- Do not accidentally include live run artifacts or raw source responses in
  version control.

## Success criteria

- A developer can invoke the crawler with an existing candidate JSON file and
  receive a saved run artifact without editing that candidate.
- Each configured operation is fetched once and passed to its generated
  adapter using the declared URL and actual response metadata.
- Errors are visible per operation; successful operation listings survive an
  independent operation failure, and the command exits nonzero for a partial
  run.
- Unit and integration tests cover the HTTP boundary, parse handoff, CLI,
  artifact, and failure cases without live network dependencies.
- Manual runs against at least two distinct candidates (Ciencuadras HTML and
  D.C. Colombia JSON) cover both rent and sale, produce at least one listing
  for each operation, and report no fetch or parse failures.
- No pagination, scheduling, database, adapter registry, source governance, or
  direct Rent Model integration is introduced.

## Approval and next step

This plan is ready for review. Once approved, decompose it into scoped Notion
tasks with acceptance criteria, then implement in the test-first sequence
above.
