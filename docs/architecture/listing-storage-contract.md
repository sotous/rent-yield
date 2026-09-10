# Colombian listings durable-storage contract

## Status and boundary

This is the authoritative durable-storage contract for the Colombian
residential-listings initiative. The crawler package remains fixture/mock-only:
it must not add migrations, database clients, object-storage clients, or
persistence adapters. It calls the two ports exported by
`@rent-yield/listing-storage-contracts` and may provide in-memory fakes.

## Recommended implementation

Use PostgreSQL 16+ with PostGIS 3.4+ locally and in Aiven. This remains the
right fit for transactions, constraints, generated views, `numeric`
calculations, migrations, canonical geography, and spatial indexes. Store
relational metadata and normalized facts in PostgreSQL. Store only retained raw
source documents in private S3-compatible object storage; do not use it for
listing images by default.

Object keys derive from the plaintext SHA-256 digest. PostgreSQL records the
digest, byte size, media metadata, retention class, and capture linkage. The
storage adapter hashes the exact uncompressed bytes supplied by the crawler. A
digest identifies an immutable `raw_blob`; each fetch is a distinct
`raw_capture`/`source_fetch` occurrence that refers to that blob, even when two
responses have identical bytes.
Use a PostGIS Docker image plus MinIO locally; use Aiven PostgreSQL/PostGIS and
a private S3-compatible bucket in production. Crawlers know neither connection
strings nor object-key conventions.

### Raw-document retention

The system retains a full raw HTML, JSON, XML, CSV, or PDF document only when
it is a permitted source response and at least one of these purposes applies:

- parser or normalizer replay after source shape/semantics change, without
  re-requesting a volatile source; or
- audit of a model-eligible or published price, rent, fee, area, or date where
  field provenance alone cannot demonstrate the source content at collection.

This is evidence storage, not media collection. Listing images and other
binaries are excluded by default. Store at most a permitted source image URL or
hash if a separately approved visual or quality workflow needs it; downloading
or retaining the image requires its own privacy, licensing, and retention
decision.

For source-policy material, PostgreSQL stores the URL, retrieval time,
effective/version date where known, content hash, assessor conclusion, and the
minimal supporting excerpts. Retain a full policy-page/PDF snapshot only when
compliance requires durable proof and the terms permit retention.

Retention is tiered: ordinary permitted captures have a short parser-drift
window; documents supporting a published explorer record or immutable Rent
Model snapshot receive the approved evidence-retention period. Lifecycle rules
must enforce expiry, encryption, private access, and audit logging.

## Invariants

- Captures, source claims, normalized observations, provenance, identity
  decisions, methodologies, snapshots, assessments, and selected comparables
  are append-only. “Current” state is a derived view.
- Retrying a request with the same idempotency key is idempotent; a later
  capture always appends new observation history, including where it refers to
  a previously stored raw blob.
- Original source strings, source-declared dates, collection time, parser
  paths, transformations, and quality warnings are retained.
- `(source_provider_id, source_listing_id)` is source identity. Cross-source
  decisions never destroy either record; V1 auto-matches only strong
  address/unit or source-reference evidence.
- `for_sale` and `for_rent` are distinct offer records. Only an observed,
  positive, base, monthly `for_rent` COP offer can enter Rent Model evidence.
  Sale price never crosses that boundary.
- Monetary and calculated database values use `numeric`; application ports use
  decimal strings. Timestamps are UTC ISO-8601; source-declared text remains
  separate.

## Persistent model

| Area                  | Records                                                                                                                                                                                         | Key constraint                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Source governance     | `source_provider`, `source_assessment`, `source_methodology_version`, `permitted_probe`, `source_fixture`                                                                                       | Access/terms/robots/API/privacy/retention assessments and methodology approval are versioned.            |
| Raw evidence          | `crawl_run`, `source_fetch`, `raw_capture`, `raw_blob`                                                                                                                                          | SHA-256-addressed permitted raw documents and each distinct acquisition event are retained under policy. |
| Source claims         | `source_listing`, `source_listing_identifier`, `source_listing_observation`                                                                                                                     | Source-qualified identity and recrawl history are retained.                                              |
| Canonical facts       | `normalized_listing_observation`, `listing_offer_observation`, `observation_field_provenance`, `observation_quality_issue`, `geographic_area`, `observation_geography_assignment`               | Every model-relevant normalized field has raw-artifact provenance.                                       |
| Identity/dedupe       | `resolved_property`, `identity_evidence`, `identity_resolution_decision`, `identity_membership`, `deduplication_selection`                                                                      | Decisions, including non-matches and ambiguous results, are auditable.                                   |
| Model reproducibility | `rental_benchmark_version`, `model_definition`, `model_configuration_version`, `rent_model_input_snapshot`, `rent_model_input_snapshot_member`, `rent_assessment`, `rent_assessment_comparable` | Snapshots, output, and canonical membership never mutate.                                                |

Use rejection triggers and role privileges to reject updates/deletes of immutable
rows. Add `CHECK` constraints for positive money/area, coordinates, stratum
1–6, country `CO`, and offer semantics. Index source identity, artifact digest,
observed city/type, snapshot membership, and valid rent evidence; use a PostGIS
GiST index for observed points. Partition high-volume tables only when volume
warrants it. Retention, privacy, or licensing removal uses a governed
redaction/tombstone record with reason, authorizer, time, and required
derived-data invalidation; it is never a silent deletion.

## Rent Model snapshots

`rent_model_input_snapshot` stores a canonical JSON manifest plus SHA-256. Its
manifest includes ordered member observation IDs and content digests, member
roles/exclusions, as-of date, identity and dedupe decisions, benchmark
versions, model definition/code hash, and configuration hash. The membership
sort key is stored and deterministic rather than dependent on insertion or
query order.

The evidence read model excludes subject identity and duplicates and admits
only valid observed base monthly rent. It returns a dedicated rental-evidence
DTO containing no sale-price field. Recrawls, normalizer changes, corrected
identity decisions, and model re-runs create a new snapshot and assessment.

## Crawler-facing ports

First call `SourceMethodologyRepository.findApproved` by source, city, and
role; it must resolve one approved, effective, non-revoked methodology version.
Without one, do no work. Then submit raw capture and normalized outcome through
`ListingIngestionSink.ingest`:

```ts
await ingestionSink.ingest({ capture, observation });
```

`capture.response.body` accepts a string or `Uint8Array`, so crawler tests can
remain fixture-only. PostgreSQL and object storage cannot share one transaction:
the durable adapter uses an idempotency key, staged blob state, a transactional
outbox/finalizer, integrity verification, and reconciliation for orphaned blobs
or rows before recording the capture as committed. Crawlers must not precompute
database IDs, write object keys, mutate prior results, or call a Rent Model
endpoint. Exact exported shapes live in
`packages/listing-storage-contracts/src/index.ts`.

## Source governance

`source_assessment` records source candidates plus versioned access, terms,
robots, API/licensing, privacy, and retention assessments. Methodology versions
declare `discovery`, `detail`, or `rental_evidence` roles; allowed listing
roles; permitted probes/fixtures; rate/concurrency limits; and
`proposed`/`approved`/`retired` status. 403/429, login/CAPTCHA/challenge pages,
terms/robots concerns, and parser drift become source-health events and pause
work; they never trigger bypass attempts.

## Delivery validation

Storage implementation follows the approved plan through TDD: migration and
immutability tests; atomic/idempotent ingestion and provenance tests; false-
merge prevention tests; and input-order/as-of/sale-price-exclusion snapshot
tests. Run equivalent migrations against an Aiven compatibility environment
before production rollout. No test fetches a live source.
