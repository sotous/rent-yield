# Colombian residential listings crawler plan

## Status

Re-scoped on 2026-09-04. This plan owns a fixture-backed crawler workbench and
mocked storage ports. The **Data Storage** task owns all database, object
storage, migrations, durable persistence, and Rent Model snapshot storage.

The approved `plan/crawler-research-and-methodology-foundation.md` owns the
prerequisite research tools, fixture validation, and methodology lifecycle.
This downstream plan consumes those tools rather than implementing them twice.
Its execution scope is offline fixture replay and memory adapters only.

## Goal

Create a safe, test-driven workbench for researching approved Colombian
residential listing sources and converting frozen source fixtures into
normalized for-sale and for-rent observations. The workbench establishes the
crawler contracts that Data Storage will later implement durably.

The first geographic scope is Barranquilla. The design remains Colombia-first.

## Relevant sources of truth

- `AGENTS.md`
- `README.md`
- `specs/domain-spec.md`
- `specs/backend-api-spec.md`
- `plan/rent-model-v1.md`
- `apps/rent-model/src/contracts.ts`
- `docs/architecture/crawler-ingestion-data-lake.md` (Data Storage handoff)
- `docs/architecture/listing-storage-contract.md` (authoritative Data Storage
  contract)

## Decisions

- The crawler accepts and produces transport-neutral records through ports; its
  test implementation is in-memory and fixture-backed. It has no database,
  migration, object-storage, or deployment responsibility.
- Each crawl methodology is a versioned, approved configuration selected by
  source, city, and listing role. Methodology research creates proposals; only
  approved versions are runnable.
- Capture parsing is replayable from frozen fixtures. Durable raw-capture
  retention and replay storage are owned by Data Storage.
- Treat sale and rent as separate listing offers. A source may advertise either
  or both. Rental evidence must be observed long-term base monthly asking rent,
  not a model output or sale-price inference.
- Preserve raw strings, parser paths, transformations, and quality issues for
  every field used by a normalized observation.
- Emit source-qualified identity candidates and extraction/provenance facts;
  durable identity resolution and deduplication are owned by Data Storage.
- Emit the existing Rent Model listing-shaped fields but never calculate rent,
  yield, or snapshots. Data Storage owns immutable snapshot construction.
- Do not enable a source without documented permission, terms/robots review,
  rate limits, retention policy, and privacy assessment. Do not bypass access
  controls, challenges, or CAPTCHAs.

## Proposed workspace

Create `apps/crawlers` as a standalone TypeScript/Vitest worker package:

```text
apps/crawlers/
  src/
    domain/                    # contracts, invariants, identity rules
    application/               # research, discovery, fetch, parse, normalize
    ports/                     # methodology, ingestion sink, clock, mock transport
    adapters/
      sources/<source>/        # versioned offline fixture parser
      memory/                  # test doubles for methodology and ingestion ports
    fixtures/                  # frozen, redacted source payloads
```

`SourceAdapter` is the source-format boundary: this workbench replays discovery
and detail responses from frozen fixtures through mocked transport. It never
returns a Rent Model result. Normalization targets the jointly agreed storage
contracts, preserving decimal strings, source claims, provenance, and temporal
semantics. The current Rent Model `ResidentialListing` is a consumer projection,
not a lossless ingestion contract. Live fetching and scheduling need a separate
production implementation plan.

## Data Storage handoff

Data Storage owns the durable schema and must provide these crawler-facing
ports: approved methodology lookup, raw-capture/normalized-observation ingest,
and source-health reporting. The crawler supplies a methodology version, raw
fixture/capture metadata, parsed source fields, normalized sale/rent records,
field-level provenance, quality issues, and source-qualified identity
candidates. The detailed storage requirements are delegated in
`docs/architecture/crawler-ingestion-data-lake.md`.

### Durable-storage decisions

- Operate one PostgreSQL/PostGIS primary cluster **per environment** (local,
  test, staging, and production are isolated), plus private S3-compatible
  object storage. Separate schemas organize `ingestion`, `model`, and `app`;
  they are not the security boundary.
- Use least-privilege roles: the crawler writes only through controlled ingest
  operations; the model reads curated rental evidence and writes model output;
  the backend has `SELECT` access only to `app.explorer_*`; migrations/admin
  are separately held. Raw capture/blob identifiers and object keys are never exposed by the
  explorer API.
- A raw-content SHA-256 identifies a `raw_blob`, not a collection event.
  `raw_capture`/`source_fetch` records every acquisition event and references
  its blob, including repeated identical responses.
- Retain full permitted HTML/JSON/XML/CSV and listing/source PDFs only for
  parser replay or audit of model-eligible/published facts. Ordinary captures
  use a short parser-drift retention window; evidence supporting a published
  record or immutable snapshot uses its approved retention period. Exclude
  listing images/binaries by default. Store policy URLs, metadata, assessment,
  and minimal excerpts in PostgreSQL; retain a full policy snapshot only when
  compliance requires proof and the terms permit it.
- PostgreSQL and object storage cannot share a transaction. Durable ingestion
  therefore uses a request idempotency key, canonical payload hash, staged
  state (`pending_blob`, `stored`, `committed`, `failed`), transactional outbox
  or finalizer, integrity verification, and reconciliation/quarantine for
  orphaned blobs or rows. The crawler sees only accepted, duplicate, or
  quarantined outcomes.
- “Append-only” is the default evidence rule, not an exemption from law or
  source obligations. Retention, licensing, and privacy events use a governed
  redaction/tombstone process that records scope, reason, authorizer, time,
  and required derived-data rebuilds.
- Methodology lookup is deterministic by source, city, role, effective period,
  approval/revocation state, and version. The exact approved methodology
  version is recorded on every crawl run.
- Source observations, decisions, and geographic assignments retain both
  `observed_at` and `recorded_at`; current/as-of queries must respect both.
- Cross-source identity memberships are supersession- or bitemporal-based.
  Every match/non-match decision records evidence, ruleset version, confidence,
  decision time, and reviewer where manual. Consumer deduplication policy and
  effective/as-of boundary are versioned.
- Rent Model snapshots hash a versioned canonical manifest of immutable member
  content hashes, deterministic ordering, selection ruleset, normalizer and
  geography versions, identity/deduplication decisions, benchmarks, model
  definition, and configuration. Database IDs alone are insufficient proof of
  snapshot content.

### Backend read model

The backend reads only the `app` schema. V1 publishes a coherent batch with a
stable `published_version`; it must never combine map rows, area summaries, and
assessments from different publication vintages.

- `app.explorer_properties` has one row per publishable resolved-property
  analysis candidate per `published_version`, not one row per raw listing or
  offer. It has a stable public identifier and explicit price/rent basis,
  freshness, status, spatial, provenance-label, and assessment-version fields.
  Internal source IDs, raw document locations, and snapshot IDs are not public
  API fields.
- `app.explorer_area_summaries` initially has one row per `area_id` and
  `published_version`. Filter dimensions are added only with a matching,
  documented property-population rule.
- `app.explorer_areas` provides stable geographic IDs, hierarchy, geometry
  version/provenance, and display metadata. Serve simplified geometry or tiles
  rather than indiscriminately returning full PostGIS polygons.
- The projector is the exclusive writer of `app.explorer_*`. Start with
  incrementally maintained projection tables rather than relying on a
  best-effort monolithic materialized-view refresh. Monitor projection lag,
  publication failures, and row-count drift.

## Source exploration strategy

Source exploration is a separate, pre-crawl workflow. Its purpose is to learn
whether a Colombian listing source can be used safely and, if so, to produce a
tested proposed methodology. It must not silently activate crawling or attempt
to evade access controls.

### Skill-guided workflow

Create a dedicated Crawler Research skill that guides an agent through this
fixed sequence:

1. Register a candidate source and its apparent Colombia/city and sale/rent
   coverage.
2. Collect public access evidence: terms, robots policy, documented APIs,
   sitemaps, listing URL patterns, and published rate limits.
3. Use only permitted, low-volume probes to classify the source as a documented
   API/feed, sitemap/list page, server-rendered detail page, client-rendered
   page, or not crawlable.
4. Save redacted representative fixtures and identify expected listing data
   types: operation, price/currency/frequency, fees, area kind/value, traits,
   status, address/geography, coordinates, and source dates.
5. Draft a versioned methodology with its evidence, extraction contract,
   adapter compatibility, schedule/rate limits, and unresolved risks.
6. Run deterministic fixture validation, then hand the proposal to human and
   compliance review. Only their approval makes a methodology runnable.

### Deterministic tools

The skill coordinates tools with narrowly defined inputs and outputs; it does
not replace crawler application code. The first tool surface should include:

- `registerSourceCandidate` — records declared coverage and research context.
- `inspectSourceAccess` — records public terms, robots/API/sitemap evidence and
  blocks disallowed sources.
- `probeListingDiscovery` — makes a bounded permitted probe and classifies the
  response shape.
- `captureRedactedFixture` — produces a replayable fixture plus capture
  metadata without retaining unnecessary personal data in this workbench.
- `inferExtractionContract` — produces proposed source-to-canonical field
  mappings and explicit unknown/ambiguous fields.
- `validateMethodologyFixtures` — runs the parser/normalizer against frozen
  fixtures and reports coverage, type errors, and drift.
- `proposeMethodology` — emits an immutable proposal for the mocked methodology
  repository; it cannot publish one.

The durable records behind these tools are Data Storage's responsibility. The
crawler implements their contracts with memory-backed mocks until that task
provides repositories.

### AI and review handoff

AI may summarize public evidence, suggest extraction mappings, and generate a
methodology proposal. It cannot decide that access is lawful, create live
credentials, bypass authentication/CAPTCHAs, or activate a source. Every
proposal must name its source evidence, fixture IDs, tool results, limitations,
and adapter/parser version. Human review returns one of `approved`, `paused`,
or `rejected`; the crawler runs only the approved version selected through its
methodology port.

```text
AI-guided research -> deterministic evidence tools -> proposed methodology
  -> fixture validation -> human/compliance decision -> approved methodology
  -> crawler run with that exact methodology version
```

## Delivery phases and TDD

1. Complete the approved research foundation and joint contract agreement;
   approve a downstream breakdown before creating its execution tasks.
2. Reuse the foundation's `apps/crawlers` TypeScript/Vitest harness, fixture
   conventions, research contracts, and mocked storage ports.
3. RED/GREEN: consume the foundation's research, access assessment, probe,
   proposal/review, and fixture interfaces without duplicating their lifecycle.
4. RED/GREEN: implement source discovery, permitted detail fetching, parser
   validation, normalization, field provenance, monetary/fee semantics, and
   date handling entirely against frozen fixtures and memory adapters.
5. RED/GREEN: implement methodology lookup and the mocked ingestion-sink
   contract that Data Storage will later satisfy.
6. Validate one Barranquilla fixture parser and its proposed methodology using
   frozen permitted-source samples and synthetic failure cases. Simulate rate
   limits and source-health events in memory. Offline parser validation precedes
   methodology approval; approval gates runnable selection. Live adapters,
   schedules, retries, and durable cursors belong to a later production phase.
7. Add crawler runbooks, source research records, retrospective, and
   documentation updates.

Tests precede each implementation slice. They must cover methodology state,
access-policy rejection, fixture replay, source-qualified identity candidates,
field provenance, fee separation, UTC/source-date semantics, parser drift, and
the ingestion-port payload. No crawler test fetches a live website or requires
a database.

## Validation

- Proposed methodologies cannot run until approved.
- Frozen source fixtures reproduce the same normalized output and provenance.
- Every normalized field used by a future model can be traced to a source path.
- Rental output is independent from any sale-price field at the Rent Model
  boundary.
- Root checks and crawler package tests pass.

## Risks and mitigations

- Source restrictions or legal uncertainty: source-approval gate; prefer APIs,
  licensed feeds, and partnerships.
- Parser drift and anti-bot responses: versioned parsers, frozen raw captures,
  health events, circuit breakers, and manual review—not evasion.
- Uneven fee, area, and date semantics: preserve source values, normalize only
  explicit facts, and quarantine ambiguity.
- Durable identity, retention, and raw-data growth: delegated to Data Storage;
  the crawler keeps its interface explicit and uses redacted fixtures only.

## Out of scope

- Database schema, migrations, object storage, durable ingestion, identity
  resolution, deduplication, benchmarks, Rent Model snapshots/assessments, live
  crawling, source-specific authorization, account automation, CAPTCHA bypass,
  user-facing explorer changes, authentication, underwriting, and modification
  of the current prototype API.

## Retrospective (to complete after implementation)

- Did the delivered crawler preserve replayable evidence and model
  reproducibility?
- Which source semantics required new domain decisions?
- Were the conservative identity and fee/area rules operationally ergonomic?
- Is another source or an identity-quality iteration justified now?
