# Data storage modeling review

## Scope and result

This review checks the storage use cases, conceptual model, logical ERD, and
shared port contracts against the crawler, Rent Model, and backend
specifications. The artifacts are ready to guide later physical design. They
remain intentionally free of tables, migrations, and implementation classes.

## Traceability result

| Consumer perspective  | Use case                                                          | Conceptual model and ERD coverage                                                                                              | Port boundary                            | Result                                       |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------- |
| Reviewer              | Assess a source, validate a methodology, and authorize collection | Source candidate, assessment, methodology, validation report, review decision, policy versions, and health event               | Approved methodology lookup              | Covered                                      |
| Crawler               | Submit one capture and its interpretation without storage access  | Crawl run, capture, optional retained artifact, source listing, normalized observation, offers, provenance, and quality issues | Durable ingestion submission and receipt | Covered                                      |
| Rent Model            | Reproduce a rental assessment from eligible historical evidence   | Identity decision/membership, deduplication selection, benchmark, input snapshot/member, assessment, and comparable            | Rental-evidence read                     | Covered after selection-ownership correction |
| Publication projector | Release a complete consistent explorer dataset                    | Publication, area, property, area summary, and current pointer                                                                 | Explorer publication write               | Covered                                      |
| Backend               | Serve one coherent map-and-chart release                          | Current publication with its areas, properties, and summaries                                                                  | Current explorer read                    | Covered after geometry-reference correction  |

Every ERD entity is listed with a persistence purpose and at least one use-case
trace in [the ERD](data-storage-erd.md). Each relationship supports one of the
consumer paths above or preserves immutable evidence required by that path.

## Boundary checks

| Required boundary        | Review result                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sale-price firewall      | Passed. Sale and rental offers are separate; the rental-evidence port and snapshot exclude sale price and every sale-derived value. The publication path may combine an eligible sale basis with a rent basis only after the Rent Model boundary. |
| Provenance and retention | Passed. Capture metadata, provenance, and normalized observations remain relational records. Object storage is optional, private, policy-gated evidence storage and never replaces them. Images remain excluded by default.                       |
| Immutable history        | Passed. Captures, observations, decisions, snapshots, assessments, comparables, and publications are append-only. The only mutable app record is the current-publication pointer.                                                                 |
| Publication consistency  | Passed. Areas, explorer properties, and summaries share a publication identity and become visible only by moving the pointer after validation.                                                                                                    |
| Crawler authority        | Passed. Lookup and ingestion ports expose no database credentials, object keys, candidate/assessment authorization, or historical mutation capability.                                                                                            |
| Rent Model authority     | Corrected. Storage enforces rental-only admission and returns dated evidence plus decisions; the Rent Model configuration owns 180-day freshness, subject exclusion, matching, and final comparable selection.                                    |
| Backend authority        | Corrected. The backend reads only the current publication. A geometry reference must be publication-scoped and cannot expose an internal object-storage key.                                                                                      |

## Retrospective

The four artifacts improve clarity without introducing a broad class model:

- the use-case view establishes who needs Storage;
- the conceptual model explains why each durable concept exists;
- the ERD makes historical and cardinality boundaries explicit; and
- the port diagrams make caller authority and data firewalls visible.

The port diagrams earn their place because neither the use-case diagram nor the
ERD alone shows what Crawlers, the Rent Model, and the Backend must _not_
receive.

## Follow-up boundary

No new logical-data-model decision is unresolved. Later physical-design work
must choose how to realize the documented identities, immutable records,
publication views, retention tombstones, and provider-neutral conformance
without changing these boundaries. A future expansion to retain original XML,
CSV, or PDF source documents through the Crawler boundary requires a new
versioned crawler/storage contract; the current V2 runtime allows original HTML
or JSON only.
