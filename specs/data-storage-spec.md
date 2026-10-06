# Data Storage System Specification

## Purpose

The storage system must let us answer four questions reliably:

1. What did a source show, and how did we interpret it?
2. What exact evidence did the Rent Model use?
3. What complete data release should the backend show to users?
4. Who approved, changed, blocked, or removed something, and why?

The design should remain simple in version one. We will use one logical
PostgreSQL/PostGIS database. Original-source object storage is post-POC; it is
not an MVP component or a second application database.

## Who the system serves

| Consumer                | What storage provides                                                                                                              | Why                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Crawlers                | Approved methodology lookup and a durable submission boundary for captures, fixtures, observations, provenance, and quality issues | Crawlers should collect data without knowing database tables, credentials, or object keys.        |
| Rent Model              | Frozen input snapshots and a rental-only evidence view                                                                             | A past rent assessment must be reproducible, and sale price must never influence a rent estimate. |
| Backend explorer        | A small, read-only publication layer                                                                                               | The map and chart need one complete, consistent release instead of crawler and model internals.   |
| Reviewers and operators | Source decisions, health blocks, retention actions, and audit history                                                              | Access and data handling decisions must be explainable and enforceable.                           |

## Storage use cases

This is a responsibility map, not an ERD or a data-flow diagram. It shows what
each actor needs Storage to do; the detailed records and relationships appear
later in this specification and its supporting architecture documents.

```mermaid
flowchart LR
  crawler[Crawler runtime]
  reviewer[Trusted reviewer]
  model[Rent Model]
  projector[Publication projector]
  backend[Backend API]
  operator[Storage operator]

  subgraph storage[Data Storage System]
    methodology([Resolve approved methodology])
    ingest([Accept capture and interpretation])
    governance([Record source decisions and health])
    evidence([Provide rental evidence and snapshots])
    publish([Publish coherent explorer release])
    read([Read current explorer publication])
    retain([Enforce retention, audit, and recovery])
  end

  crawler --> methodology
  crawler --> ingest
  crawler --> governance
  reviewer --> governance
  model --> evidence
  projector --> publish
  backend --> read
  operator --> retain
```

## Simple architecture

The database uses three schemas to make ownership clear:

| Schema      | Purpose                                                                                 | Typical writers                                      |
| ----------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ingestion` | Source governance, captures, extracted observations, provenance, and identity decisions | Controlled crawler ingestion and reviewer operations |
| `model`     | Benchmarks, frozen model inputs, rent assessments, and selected comparables             | Rent Model                                           |
| `app`       | Complete releases prepared for the backend explorer                                     | Publication projector                                |

The schemas are organizational boundaries. Database roles and controlled
operations provide the security boundary.

```text
source review and crawler
          |
          v
  ingestion schema -----> structured evidence + redacted fixtures
       |       |
       |       v
       |   model schema
       |       |
       +---+---+
           v
       app schema -----> backend API -----> frontend
```

Use PostgreSQL with PostGIS and preserve compatibility with Aiven PostgreSQL.
The MVP/POC does not retain original source bodies or require private object
storage for them. It preserves structured outcomes, provenance, capture
metadata, parser/normalizer/extraction versions, and exact body digest/length.
Redacted fixtures remain permitted, but their durable-storage policy is a
separate future decision. The contracts must not depend on a particular ORM or
object-storage vendor.

## Core rules

- Evidence is append-only by default. A correction creates a new record and
  preserves the prior record.
- “Current” data is a derived view, not an overwrite of history.
- Collection events remain distinct even when their content is identical.
- Source listings, resolved properties, and published explorer rows are
  different concepts and must not share one overloaded identity.
- Sale and rental offers are separate records.
- Only eligible observed monthly asking rent may enter rental evidence; fees
  and explicitly bundled parking follow the Rent Model rules below.
- Sale price and values derived from it cannot cross the Rent Model boundary.
- Model inputs and published explorer releases are immutable versions.
- Unknown values remain unknown. Storage and normalization must not invent
  missing facts.
- Durable V2 ingestion admission and Rent Model evidence eligibility are
  separate gates. A durable receipt proves only that Storage accepted a
  quality-passing normalized listing outcome; it never proves that any offer
  can be used as rental evidence.
- Retention, privacy, or licensing removals use an authorized tombstone or
  redaction record. They are never silent deletions.

## What must be stored

The names below describe the durable record groups. Implementations may add
supporting indexes and operational tables, but should keep these names and
meanings recognizable.

### Source governance

| Record                                    | What it means                                                                               | Why it exists                                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ingestion.source_provider`               | A source we have considered using                                                           | Gives every assessment, methodology, and capture a stable source identity.                                |
| `ingestion.source_candidate`              | One immutable version of a proposed source and scope                                        | Keeps corrected proposals from silently inheriting an older assessment.                                   |
| `ingestion.source_assessment`             | A dated assessment of access, terms, robots, API, privacy, and retention                    | Records what was reviewed, the evidence, unresolved questions, and the next review date.                  |
| `ingestion.sanitized_probe_result`        | Scope, budget usage, response digest and size, outcome, and issues from one permitted probe | Proves what was tested without retaining bodies, credentials, cookies, headers, or arbitrary source text. |
| `ingestion.extraction_contract_version`   | The immutable source-to-canonical field mapping used by a parser                            | Makes a referenced mapping available for replay and audit instead of storing only its hash.               |
| `ingestion.source_methodology_version`    | One immutable methodology manifest proposed for review                                      | Preserves the exact scope, limits, adapter, parser, extraction contract, and retention rules.             |
| `ingestion.methodology_validation_report` | The immutable result of testing a methodology against named fixtures                        | Shows what was verified before review.                                                                    |
| `ingestion.methodology_review_decision`   | Approval, rejection, pause, revocation, or retirement by a trusted reviewer                 | Separates technical research from authorization. A later approval records reactivation.                   |
| `ingestion.source_health_event`           | A parser drift, access failure, rate limit, challenge, or emergency block                   | Lets the resolver fail closed when a source is unsafe or unhealthy.                                       |
| `ingestion.source_fixture`                | Metadata for a synthetic or permitted redacted replay fixture                               | Makes parser testing reproducible without live source access.                                             |
| `ingestion.retention_policy_version`      | Allowed representations and uses, expiry rule, and deletion behavior                        | Makes retention enforceable instead of implied.                                                           |
| `ingestion.redaction_policy_version`      | The immutable rules used to remove sensitive or unnecessary content                         | Makes sanitized artifacts reproducible and reviewable.                                                    |

Normally, a source-policy review stores its URL, retrieval time, effective date
when known, content digest, conclusion, and the smallest useful supporting
excerpt. A full policy page or PDF is retained only when compliance requires
durable proof and the applicable terms allow it.

### Collection and interpretation

| Record                                     | What it means                                                                                   | Why it exists                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `ingestion.crawl_run`                      | One execution under one approved methodology version                                            | Groups operational events without becoming listing identity.                                     |
| `ingestion.source_capture`                 | One acquisition event, including request/response metadata, collection time, and observed original-response digest and length | Two fetches are two historical events even when their bytes match; the digest does not retain the original body. |
| `ingestion.retained_source_artifact`       | Metadata for a permitted redacted fixture, if one is retained or supplied inline               | Keeps the fixture's separate digest, media type, and size without exposing bytes or object keys to consumers.    |
| `ingestion.source_listing`                 | A source-qualified listing identity                                                             | Prevents an identifier from one source being mistaken for the same identifier at another source. |
| `ingestion.normalized_listing_observation` | One versioned canonical interpretation of an observation                                        | Gives downstream systems consistent types without rewriting the source claim.                    |
| `ingestion.listing_offer_observation`      | One sale or rental offer observed at a point in time                                            | Keeps sale price, base rent, fees, currency, and frequency explicit and separate.                |
| `ingestion.observation_field_provenance`   | The source path, original value, transformation, and issue for a normalized field               | Lets a reviewer trace a price, rent, area, or date back to evidence.                             |
| `ingestion.observation_quality_issue`      | A typed warning or blocking problem                                                             | Supports quarantine without losing the submitted evidence.                                       |

An interpretation is identified by its capture plus the methodology manifest
hash, adapter artifact hash, parser version, normalizer version, and
extraction-contract hash. Its output hash verifies the result; it is not part
of the identity. This allows the same capture to be reinterpreted after a
methodology, parser, or normalization change.

### Property identity and deduplication

| Record                                   | What it means                                                  | Why it exists                                                             |
| ---------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ingestion.resolved_property`            | A conservative candidate for one real-world property           | Provides a stable analytical identity without deleting source identities. |
| `ingestion.identity_resolution_decision` | A versioned match, non-match, or manual decision with evidence | Makes cross-source linking reviewable and reversible.                     |
| `ingestion.identity_membership`          | The source observations covered by an identity decision        | Shows why a resolved property has its members.                            |
| `ingestion.deduplication_selection`      | A versioned choice of which observations count in an analysis  | Prevents duplicate evidence while retaining every original record.        |

Version one may automatically match only strong evidence, such as a documented
exact address and unit or a stable cross-source reference. Similar titles or
prices alone are not enough.

### Rent Model history

| Record                                   | What it means                                                                                                     | Why it exists                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `model.rental_benchmark_version`         | An immutable benchmark with vintage, scope, sample information, uncertainty, and provenance                       | A fallback estimate must not drift after publication.                     |
| `model.model_definition_version`         | A model ID and version with its code or artifact hash                                                             | Pins the exact calculation implementation.                                |
| `model.model_configuration_version`      | Matching, freshness, range, percentile, and rounding rules with a content hash                                    | Pins behavior that can change without changing model code.                |
| `model.rent_model_input_snapshot`        | A content-addressed, frozen evidence set                                                                          | Re-running against the same snapshot must use the same inputs.            |
| `model.rent_model_input_snapshot_member` | An ordered subject, rental observation, or benchmark member                                                       | Records exact evidence membership and content hashes.                     |
| `model.rent_assessment`                  | One immutable observed, observed-with-context, comparable-modeled, benchmark-modeled, or insufficient-data result | Consumers can distinguish a fact, an estimate, a fallback, and no answer. |
| `model.rent_assessment_comparable`       | An ordered selected comparable and its relevant calculations                                                      | Explains how a comparable-based result was produced.                      |

A snapshot records its as-of date, canonical ordered evidence and content
hashes, referenced exclusions and identity/deduplication decisions, geography
version, benchmark versions, and model/configuration/code versions. A recrawl,
correction, normalizer change, identity decision, benchmark change, or version
change creates a new snapshot. An identical rerun reuses the snapshot and
creates a separate immutable assessment occurrence.

An assessment records its snapshot, as-of date, explicitly supplied
`generated_at`, kind, model/configuration versions, point and range when valid,
evidence level, matching or fallback tier, ordered reason codes, and exclusion
summary. An insufficient-data assessment stores no amount or range.
Comparable rows store canonical order, observation ID and content hash, rent
per square metre, subject-adjusted rent, and selection tier.

### Backend publication layer

The backend reads only these app-facing records:

| Record                             | What it serves                                                                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `app.explorer_publications`        | Immutable complete publication versions, including their data label, formula version, and default area.                       |
| `app.current_explorer_publication` | The one pointer changed when a validated publication becomes visible.                                                         |
| `app.explorer_areas`               | Stable area IDs, names, hierarchy, display settings, and simplified map geometry or a geometry reference for one publication. |
| `app.explorer_properties`          | Map markers and ranked property candidates for one publication.                                                               |
| `app.explorer_area_summaries`      | Counts and aggregate metrics for one area in one publication.                                                                 |

One `app.explorer_properties` row means:

> One resolved residential property candidate in one published version,
> combining one eligible sale-price basis with one published observed or
> estimated rent basis.

It is not a crawler listing, capture, offer, or Rent Model comparable. Its
public property ID should remain stable across later publications when the
resolved property remains the same.

The table contains only publishable rows that satisfy the backend API's
rankable-property rule. The same population defines `property_count` and every
area summary. Selecting a city includes members of its supported child areas;
selecting a neighborhood returns that neighborhood's members.

Each row includes the location and area, display address, coordinates,
residential type, available property traits, sale-price basis, rent basis,
source labels, publishable listing URL, assessment kind, sale-offer status, and
publication eligibility. Freshness is represented by dates until a versioned
policy defines a derived `stale` status.

Freshness must also remain explicit:

- when the sale offer was observed;
- the rent assessment's as-of date;
- when the projection was built; and
- when the publication became visible.

A single `observed_at` field cannot represent all four meanings. The backend
API should expose the fields its users need without merging them into a false
timestamp.

Areas, properties, and summaries all belong to the same publication version.
The projector is the only writer to `app.explorer_*`. It uses the shared,
versioned domain formulas to calculate property metrics and summaries, then
validates the complete batch. The stored metrics are the publication values;
the backend does not independently recalculate a different answer. It makes a
release visible by atomically changing `app.current_explorer_publication`.
Backend access goes through current-publication views or a controlled query so
ordinary requests cannot mix in older rows. If a refresh fails, readers keep
seeing the previous complete version.

## Crawler-facing contracts

Crawlers use ports, not tables.

### Approved methodology lookup

The lookup takes source, country, city, capability, listing role, effective
time, recorded-as-of time, and accepted contract version. It returns exactly
one approved compatible methodology or a typed reason that no work is allowed.

Effective time asks which decision applied then. Recorded-as-of time asks what
Storage knew then.

The lookup fails closed for missing or overlapping approvals, expiry, pause,
revocation, incompatible adapters, or an active source-health block.

### Durable ingestion submission

The versioned V2 submission contains:

- source and approved methodology identity;
- idempotency key and capture event ID;
- sanitized acquisition metadata plus the observed original-response digest,
  length, and representation;
- a bounded redacted-fixture artifact when applicable, with its own digest and
  length;
- one complete, listing-quality-passing `normalized` outcome;
- field-level provenance and typed quality issues; and
- the interpretation identity and canonical outcome hash.

The MVP Crawler producer sends only a complete normalized outcome with at least
one normalized observation after its pinned extraction-contract quality gate.
Storage is the durable-admission authority: it validates the V2 payload,
bindings, digests, conflicts, and this normalized-only rule before issuing a
receipt. The Crawler owns producer coverage for the extraction-quality gate;
Storage does not reinterpret a parser result to manufacture or repair an
observation.

`quarantined`, `parse_failed`, and `capture_only` are deliberately local,
transient results in this POC. They create neither a durable outcome, a minimal
receipt, nor a tombstone. `parser_drift` and `artifact_safety_block` are the
only Crawler runtime health events; a future durable health-event intake needs
its own shared-contract alignment and is outside this V2 receipt boundary.

Bounded redacted fixture bytes may cross the port, but their durable-storage
policy remains deferred. Storage validates their separate digest and length and
persists only allowed metadata in this POC. Crawlers never construct object
keys. A fixture above the strict inline cap is discarded without truncation or
a Storage-managed reference; its no-retained-bytes metadata remains part of an
otherwise admissible normalized submission. A later post-POC workflow may
revisit fixture persistence and original-body retention separately.

### Receipt behavior

| Situation                                                           | Required result                                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Same source and idempotency key, same canonical submission          | Return the byte-for-byte original immutable receipt; report duplication separately or append a delivery event. |
| Same source and idempotency key, changed submission                 | Return `idempotency_conflict`.                                                                                 |
| Same source and capture event, changed acquisition metadata or body | Return `capture_event_conflict`.                                                                               |
| New capture event and key, identical body                           | Append a new capture with its own metadata and digest; do not infer a retained original-body object.           |
| Same capture, new interpretation identity                           | Append a new interpretation.                                                                                   |
| Same capture and interpretation identity, same outcome hash         | Return the existing interpretation with duplicate-delivery metadata.                                           |
| Same capture and interpretation identity, different outcome hash    | Return `interpretation_conflict`.                                                                              |
| Storage cannot durably accept responsibility                        | Return no successful receipt.                                                                                  |

An immutable `accepted` receipt means storage can recover and finish the work.
It does not mean that the data qualifies for the Rent Model.
Later append-only progress events report:

- `committed`: capture and interpretation are durably linked;
- `quarantined`: evidence is durable but blocked from normal publication by
  typed issues; or
- `failed`: finalization ended with a sanitized terminal cause, and a retry
  needs a new submission key.

The MVP provider persists accepted structured evidence and redacted-fixture
metadata. It does not retain, stage, finalize, or retrieve original response
bodies or redacted-fixture bytes.

The canonical submission hash excludes the idempotency key and
provider-generated fields. It includes canonical capture metadata and its
observed-original digest/length, separate artifact disposition and
digest/length, methodology identity, interpretation identity, outcome,
provenance, and quality issues.

### Admission is not rental evidence eligibility

The ingestion-quality gate answers only whether a normalized listing outcome is
complete and trustworthy enough to preserve as structured ingestion history.
It can preserve sale offers, rental offers that are incomplete for modeling,
and other normalized source claims. It must not depend on a sale price or a
Rent Model configuration.

The later rental-evidence read gate is stricter and evaluates each rental offer
against the Rent Model rules: observed active long-term residential monthly COP
rent, separable fees, positive built area, valid date, geography, property type,
provenance, identity/deduplication decisions, and as-of freshness. Only that
read gate supplies the Rent Model, and its DTO has no sale price or
sale-derived value.

## MVP/POC body and fixture policy

PostgreSQL is the system of record for structured outcomes, provenance,
relationships, parser/normalizer/extraction versions, capture metadata, and
exact body digest/length. The runtime redacts and disposes original response
bodies. It retains no media and builds no original-body object store, retrieval
API, grant, finalizer, or historical-response replay path in the MVP/POC.

Redacted fixtures may be retained for parser validation. Their durable-storage
policy and location are a separate future decision. Parser improvements are
validated using redacted fixtures and applied through a new, separately
approved collection run. Original-body retention or historical reproduction may
be reconsidered after the proof of concept; it does not authorize any live
source, canary, or source-specific permission work now.

## Rent Model evidence boundary

The model receives a dedicated rental-evidence view. An observation qualifies
only when it has:

- an observed, positive monthly long-term asking rent in COP that excludes
  administration, utilities, and variable fees; explicitly bundled parking may
  remain;
- positive built area;
- a supported property type and geography;
- a usable observation date;
- source-qualified identity and provenance; and
- quality information and versioned identity/deduplication decisions needed by
  the snapshot policy.

Fees must remain separate. If eligible rent cannot be separated from
administration, utilities, or variable fees, the observation is not eligible.
Ambiguous identities remain separate and carry an `identity_ambiguous` reason;
the versioned snapshot policy decides their use. A modeled rent can never
become rental evidence for another assessment.

For a given snapshot, evidence must have `observed_at` on or before its as-of
date and pass the Rent Model's inclusive 180-day freshness rule. Storage keeps
the timestamps; the versioned model configuration owns the selection rule.

The model-facing record contains no sale price, price per square metre, yield,
sale-to-rent ratio, ranking, or value derived from sale price. A sale listing
may provide subject characteristics such as location, property type, and built
area, but not its price. Changing sale-price data must be incapable of changing
a rent assessment.

## Money, time, and geography

- PostgreSQL `numeric` is authoritative for money, area, rent per square metre,
  and calculations. Shared ports use canonical decimal strings, not binary
  floating point.
- Timestamps use UTC `timestamptz` where an instant is known.
- `collected_at`, model-relevant `observed_at`, source-declared date text,
  snapshot `as_of_date`, assessment `generated_at`, projection time, and
  publication time remain separate.
- Source-declared date text and its known precision or timezone uncertainty are
  preserved.
- `observed_at` uses a reliable source event time when the approved methodology
  defines one; otherwise it uses collection time. The original source date and
  the choice remain traceable.
- Assessment `generated_at` is supplied explicitly and stored; the model never
  reads the database or server clock to obtain it.
- Stable geography IDs and versioned PostGIS geometry support assignment and
  spatial indexes. The app layer exposes only the display geometry needed by
  the explorer.

## Access, retention, and recovery

Use separate least-privilege roles for migrations/admin, crawler ingestion,
review, model work, projection, and backend reads. In particular:

- crawlers use controlled operations and never receive broad table access;
- the model reads curated rental evidence, not raw objects or sale prices;
- the projector alone writes app publications;
- the backend reads only the current published `app` records; and
- the frontend reaches data only through the backend API.

Database and internal port values remain exact decimals. The HTTP adapter
converts approved explorer values to the numeric JSON fields defined by the
backend API.

Version one does not add a product authentication system for reviewers. It may
use a manually managed stable reviewer key and restricted database role so each
decision still has a durable author.

Production storage uses private networking where available, encryption in
transit and at rest, secret rotation, and access auditing. The MVP/POC has no
original-body object lifecycle to reconcile.

The durable-storage policy for redacted fixtures is deferred. A source-specific
retention registry and its legal/compliance authorizer workflow are also
deferred until before live-source or canary work; neither is an MVP/POC
authorization.

## Version-one simplicity limits

Version one does not require:

- a second application database;
- a data warehouse or lakehouse;
- Kafka or another event-streaming platform;
- retained listing images;
- automatic fuzzy cross-source merging;
- user-specific or authentication data;
- table partitioning before measured volume requires it; or
- direct frontend, backend, crawler, or model access to object keys.

## Implementation acceptance criteria

Durable storage is ready only when provider-neutral tests prove:

- methodology lookup and fail-closed governance behavior;
- immutable history, exact retries, conflicts, reinterpretation, and receipt
  progress behavior;
- quarantine, original-body disposal, structured provenance, and
  redacted-fixture boundary behavior;
- rental-only evidence and sale-price exclusion;
- deterministic immutable snapshots and assessments;
- complete, atomic explorer publication and read isolation; and
- Aiven PostgreSQL compatibility.

No test needs to contact a live listing source. Implementation requires its own
approved delivery plan and tracked tasks before migrations or adapters are
written.
