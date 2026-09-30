# Colombian listings durable-storage contract

## Status and boundary

The authoritative ecosystem requirements now live in the
[Data Storage System Specification](../../specs/data-storage-spec.md). This
document is its detailed listing-ingestion architecture companion. The crawler
package remains fixture/mock-only: it must not add migrations, database
clients, object-storage clients, or persistence adapters. It uses versioned
storage ports and may provide in-memory fakes.

## Recommended implementation

Use PostgreSQL 16+ with PostGIS 3.4+ locally and in Aiven. This remains the
right fit for transactions, constraints, generated views, `numeric`
calculations, migrations, canonical geography, and spatial indexes. The
MVP/POC stores relational metadata, normalized facts, parser/normalizer/
extraction versions, exact body digest/length, provenance, and redacted
fixtures only. It does not retain original source documents in object storage.

### MVP/POC body and fixture policy

The runtime redacts and disposes original response bodies. The MVP/POC retains
no original HTML, JSON, XML, CSV, PDF, image, or other binary source document.
Redacted fixtures are the only permitted replay material; their durable-storage
policy and location are a separate future decision.

Parser improvements use redacted fixtures and a new, separately approved
collection run. Original-body retention, retrieval, object finalization, and
historical reproduction are post-POC and do not grant source permission or
alter the separately gated canary/compliance workflow.

For source-policy material, PostgreSQL stores the URL, retrieval time,
effective/version date where known, content hash, assessor conclusion, and the
minimal supporting excerpts. Full policy-document retention is deferred with
the broader legal/compliance workflow.

## Invariants

- Captures, source claims, normalized observations, provenance, identity
  decisions, methodologies, snapshots, assessments, and selected comparables
  are append-only. “Current” state is a derived view.
- Retrying a request with the same idempotency key is idempotent; a later
  capture always appends new observation history with its own digest metadata.
- Original source strings, source-declared dates, collection time, parser
  paths, transformations, and quality warnings are retained.
- `(source_provider_id, source_listing_id)` is source identity. Cross-source
  decisions never destroy either record; V1 auto-matches only strong
  address/unit or source-reference evidence.
- `for_sale` and `for_rent` are distinct offer records. Rent Model evidence is
  limited to observed, positive monthly long-term COP rent that excludes
  administration, utilities, and variable fees; explicitly bundled parking
  may remain. Sale price never crosses that boundary.
- Monetary and calculated database values use `numeric`; application ports use
  decimal strings. Timestamps are UTC ISO-8601; source-declared text remains
  separate.

## Persistent model

| Area                  | Records                                                                                                                                                                                         | Key constraint                                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Source governance     | `source_provider`, `source_assessment`, `source_methodology_version`, `permitted_probe`, `source_fixture`                                                                                       | Access/terms/robots/API/privacy/retention assessments and methodology approval are versioned.                    |
| Capture evidence      | `crawl_run`, `source_fetch`, `raw_capture`, `source_fixture`                                                                                                                                    | Each distinct acquisition event retains digest/length metadata; redacted fixtures may support parser validation. |
| Source claims         | `source_listing`, `source_listing_identifier`                                                                                                                                                   | Source-qualified identity and aliases are retained.                                                              |
| Canonical facts       | `normalized_listing_observation`, `listing_offer_observation`, `observation_field_provenance`, `observation_quality_issue`, `geographic_area`, `observation_geography_assignment`               | Every model-relevant normalized field has raw-artifact provenance.                                               |
| Identity/dedupe       | `resolved_property`, `identity_evidence`, `identity_resolution_decision`, `identity_membership`, `deduplication_selection`                                                                      | Decisions, including non-matches and ambiguous results, are auditable.                                           |
| Model reproducibility | `rental_benchmark_version`, `model_definition`, `model_configuration_version`, `rent_model_input_snapshot`, `rent_model_input_snapshot_member`, `rent_assessment`, `rent_assessment_comparable` | Snapshots, output, and canonical membership never mutate.                                                        |

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
roles, referenced exclusions and identity/deduplication decisions, as-of date,
benchmark versions, model definition/code hash, and configuration hash. The
membership sort key is stored and deterministic rather than dependent on
insertion or query order.

The evidence read model excludes subject identity and duplicates and admits
only rent allowed by the Rent Model specification. It returns a dedicated
rental-evidence DTO containing no sale-price field. Recrawls, normalizer
changes, corrected identity decisions, or version changes create a new
snapshot. An identical rerun reuses that snapshot and creates a separate
immutable assessment occurrence.

## Crawler-facing ports

The crawler first uses an approved-methodology lookup by source, country, city,
capability, listing role, effective time, recorded-as-of time, and accepted
contract version. Without exactly one compatible, approved, unblocked result,
it does no work.

It then uses a versioned durable-ingestion port. The submission must contain
the complete normalized or quarantined outcome and field provenance, not only
their hashes. For version one, bounded redacted fixture bytes may cross that
port. Storage validates their digest and preserves the structured submission
boundary; durable-fixture storage remains a separate future policy decision.
Crawlers never precompute database IDs or object keys.

The currently exported `SourceMethodologyRepository` and
`ListingIngestionSink` shapes in `packages/listing-storage-contracts` are
fixture-only reference contracts. They require the versioned evolution defined
by the data storage specification before they can be implemented as durable
ports.

The shared `DurableSubmissionV2` provider boundary is exercised by the Data
Storage-owned in-memory conformance harness. Future durable providers reuse its
shared runner and vectors with a provider-owned test fixture adapter; see
[`durable-submission-v2-provider-requirements.md`](durable-submission-v2-provider-requirements.md).

The MVP durable adapter does not store or retrieve original response bodies.
Crawlers must not mutate prior results or call a Rent Model endpoint.

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
