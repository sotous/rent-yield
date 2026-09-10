# Crawler and ingestion data lake architecture

> The authoritative schema, governance, and crawler-facing port definition is
> [the durable-storage contract](listing-storage-contract.md). This document
> remains the high-level architectural companion.

## Ownership

This document is a requirements handoff from the **Crawlers** task. The
**Data Storage** task owns the authoritative schema, migrations, object-store
integration, database testing, and subsequent updates to this document. The
Crawlers task uses fixture-backed storage ports only.

## Purpose

This architecture defines the evidence store that future Colombian listings
crawlers will populate. It supports historical analysis and reproducible Rent
Model assessments; it is not the current in-memory backend persistence layer.

## Evidence flow

```text
approved source adapter
  -> crawl run -> source fetch -> raw capture -> raw blob (immutable, policy-retained)
  -> source listing observation -> normalized listing observation (immutable)
  -> offer, provenance, geography, identity decisions
  -> model snapshot manifest (immutable) -> rent assessment (immutable)
```

All facts are append-only. “Current” listing state is a derived view selected
from observation history, never an update to an old source claim.

## Storage

Use PostgreSQL plus PostGIS. Store relational metadata, normalized data,
identity decisions, and snapshot manifests in PostgreSQL. Store only permitted
raw HTML, JSON, XML, CSV, or listing/source PDFs in private object storage,
addressed by SHA-256, when needed for parser replay or evidence audit. Listing
images and other binaries are not retained by default. Small structured
payloads may be retained as `jsonb` when policy permits.

## Logical schema

| Group             | Tables                                                                                                                                                                                          | Responsibility                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Source operations | `source_provider`, `crawl_run`, `source_fetch`, `raw_capture`, `raw_blob`                                                                                                                       | Permission metadata, run history, distinct capture events, and retained raw-document integrity. |
| Source identity   | `source_listing`, `source_listing_identifier`, `source_listing_observation`                                                                                                                     | Stable portal manifestation, changing IDs/URLs, extracted appearance history.                   |
| Canonical facts   | `normalized_listing_observation`, `listing_offer_observation`, `observation_field_provenance`, `geographic_area`, `observation_geography_assignment`                                            | Versioned Colombian interpretation, sale/rent terms, per-field lineage, canonical geography.    |
| Deduplication     | `resolved_property`, `identity_evidence`, `identity_resolution_decision`, `identity_membership`                                                                                                 | Conservative cross-source links; candidates and non-matches stay auditable.                     |
| Model evidence    | `rental_benchmark_version`, `model_definition`, `model_configuration_version`, `rent_model_input_snapshot`, `rent_model_input_snapshot_member`, `rent_assessment`, `rent_assessment_comparable` | Dated benchmark facts, exact reproducible inputs, model output, and selected-comparable trace.  |

### Raw source and observations

`raw_blob` has a content checksum, content type/encoding/size, storage
reference, and approved retention class. `raw_capture` records each acquisition
event and points to a blob, so two captures with identical bytes are not
collapsed into one historical event. A full raw document is retained only for
parser replay or evidence audit and only where the applicable source policy
allows it. It is immutable.

`source_listing_observation` stores source-shaped extraction output linked to a
raw capture/blob, extraction version, the source claim date(s), collection date,
and warnings. Its uniqueness key is `(raw_capture_id, extraction_version,
source_listing_id)`.

`normalized_listing_observation` is one versioned canonical interpretation of
a source observation. It stores `country_code = CO`, labels and canonical IDs
for Colombian geography, residential type, title/address labels, built/private/
interior areas with an explicit area kind, beds/baths/stratum, coordinates and
precision, status, and content/normalizer versions. Unknown values remain
null—normalization must not fabricate them.

`listing_offer_observation` prevents overloading a listing with one ambiguous
price: it records `for_sale` or `for_rent`, original amount/currency/frequency,
canonical COP value, and amount scope (`base`, `includes_admin`, `unknown`).
Administration, utilities, and parking charges are separate when disclosed.
Only observed, positive, base monthly rent can qualify as Rent Model evidence.

`observation_field_provenance` links each canonical field to its raw capture/blob,
source path/label, raw value, transform version, extraction method, and any
quality issue. A source URL alone is insufficient provenance for model inputs.

### Time semantics

- `collected_at`: when our crawler acquired a document, UTC.
- `observed_at`: the model-relevant observation instant, UTC, normally the
  detail capture time unless source semantics support a stronger time.
- `source_published_at` / `source_updated_at`: source-declared dates preserved
  independently, with original text/time-zone ambiguity when relevant.
- `valid_from` / `valid_to`: validity of an identity or geography resolution,
  not a rewrite of source history.

## Identity and deduplication

Source identity begins with `(source_provider_id, source_listing_id)`. URL
fingerprints and source aliases corroborate it. Repeated captures of the same
source listing produce new observations rather than being discarded.

Cross-source identity is separate. `identity_resolution_decision` records its
ruleset version, evidence, decision (`match`, `not_match`, `manual_override`),
score where applicable, and timestamp. `identity_membership` points to that
decision. V1 auto-matches only strong signals, such as a documented exact
address/unit match or stable source cross-reference; titles and price
similarity alone never merge property records.

Analytical deduplication selects representatives under a versioned policy and
records exclusions/reasons. It never deletes a capture, source listing, or
observation.

## Rent Model reproducibility

`rent_model_input_snapshot` is content-addressed. Its manifest includes:

- canonical, ordered normalized-observation IDs and each content hash;
- inclusion/exclusion reasons and resolved identity decisions;
- `as_of_date` and selection-policy version;
- benchmark version(s);
- `model_id`, model version, code artifact hash, and configuration hash.

`rent_model_input_snapshot_member` records membership roles such as subject
candidate, rental evidence, or benchmark and its deterministic sort key. A
`rent_assessment` references one snapshot and stores its output. Ordered
`rent_assessment_comparable` rows record the actual selection/calculations.

The system creates, rather than mutates, a snapshot and assessment after any
later correction, recrawl, normalization change, or model re-run. This is how
the Rent Model's deterministic, immutable-snapshot contract is enforced.

## Constraints and indexes

- `numeric` is required for monetary/calculation values; money/areas must be
  positive when present. COP publication rounding happens only at the defined
  model/output boundary.
- Check country code, residential enum, stratum `1..6`, lat/long ranges, and
  rent/offering semantics.
- A comparable requires a for-rent observed offer, positive base monthly COP
  rent, usable built area, date, source provenance, and no selected duplicate
  or subject identity.
- Prevent `UPDATE` and `DELETE` on retained raw blobs/captures, normalized observations,
  benchmark versions, snapshots, and model outputs with database privileges and
  rejection triggers.
- Index source identities, URL fingerprints, content hashes, observed date plus
  city/area/type, snapshot memberships, and assessment lookup. Use a PostGIS
  GiST index for normalized points and a partial rent-evidence index for valid
  rental observations. Partition high-volume fetch/artifact/observation tables
  only when observed volume warrants it.

## Source-operation policy

Each adapter has a documented permission and retention record. It uses per-
source concurrency/rate limits, durable cursors, retries only for retryable
errors, exponential backoff, and circuit breakers. `403`, `429`, CAPTCHA or
challenge pages, authentication requirements, robots/terms concerns, and
parser-shape drift create source-health events and pause escalation; they are
never signals to evade controls.

Store source-policy metadata and the minimal supporting excerpts in PostgreSQL.
Do not archive a full policy page unless compliance requires durable proof and
the terms permit its retention. Images are excluded from evidence storage unless
a separately approved use case authorizes their collection and retention.
