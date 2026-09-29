# Data Storage modeling review

## Result

The restored [logical ERD](data-storage-erd.md) and [port contracts](data-storage-port-contracts.md) reconcile the historical design material with the current storage specification, conceptual model, and merged V2 conformance boundary. They are a reviewable logical baseline for later physical design. They do not authorize SQL, migrations, provisioning, or provider implementation.

## Traceability check

| Consumer   | Need                                                          | Logical coverage                                                     | Boundary              | Result                                 |
| ---------- | ------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------- | -------------------------------------- |
| Reviewer   | Assess, authorize, pause, or revoke source work               | Candidate, assessment, methodology, policy, decision, health         | Methodology lookup    | Covered                                |
| Crawler    | Submit one capture and interpretation without storage access  | Capture, artifact, listing, observation, offer, provenance, quality  | Durable V2 ingestion  | Covered and aligned to exact V2 replay |
| Rent Model | Reproduce a rent assessment from eligible historical evidence | Identity, deduplication, benchmark, snapshot, assessment, comparable | Rental-evidence read  | Covered; rental-only boundary retained |
| Projector  | Publish one consistent explorer release                       | Publication, area, property, summary, current pointer                | Publication write     | Covered                                |
| Backend    | Serve one map-and-chart release                               | Current publication and its rows                                     | Current explorer read | Covered                                |

## Boundary check

| Requirement                   | Review result                                                                                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sale-price firewall           | Passed. Sale and rental offers remain separate. Rental evidence, snapshots, and assessments exclude sale price and sale-derived values.                                                                   |
| V2 receipt behavior           | Passed. The ingestion port now states exact `(source_key, submission_id)` receipt replay, conflict precedence, distinct receipts for linked identical interpretations, and zero-or-one terminal progress. |
| Provenance and retained bytes | Passed. Relational records remain the source of truth. Private content-addressed objects are optional, policy-gated evidence; images remain excluded by default.                                          |
| Immutable history             | Passed. Evidence, decisions, snapshots, assessments, and publications append rather than overwrite. Only the current-publication pointer is mutable.                                                      |
| Crawler authority             | Passed. Crawlers receive neither table access, object keys, reference issuance, nor governance authority.                                                                                                 |
| Backend authority             | Passed. Backend reads the current publication only. Any future geometry reference must be publication-scoped and must not expose an internal object key.                                                  |

## Remaining explicit decisions

The logical baseline leaves these decisions open for the user’s physical-design approval gate:

1. Restore/reconfirm acceptance of these logical artifacts as the physical-design baseline.
2. Approve retention durations, allowed original-body purposes, and reviewer/authorizer process.
3. Confirm the production PostgreSQL/PostGIS and S3-compatible providers, region/networking, and role/secret administration.
4. Approve finalizer/reconciliation retry limits, alerts, and tombstone authority.
5. Select the SQL migration runner and CI integration-test environment.

No unresolved decision above is decided by this review. The current model remains intentionally free of physical table and implementation-class design.
