# Data Storage durable-provider delivery plan

## Status

Draft for approval on 2026-09-24. This is the prerequisite plan for a durable
PostgreSQL/PostGIS and private-object-storage provider. It authorizes no
implementation, provisioning, migration, or shared-contract change until its
approval and Notion breakdown.

## Goal

Deliver the smallest durable implementation of the already-merged
`DurableSubmissionV2` provider boundary. It must let a crawler receive an
immutable accepted receipt, let Storage recover finalization work, and retain
only policy-permitted evidence without exposing database access or object keys.

The first durable slice is deliberately an ingestion foundation. It does not
attempt to implement the Rent Model evidence view, cross-source identity,
snapshots, explorer publications, or backend replacement of prototype data.

## Baseline and sources of truth

- Merged `main` commit `f76dcc9`, including PR #20's Data Storage conformance
  harness.
- Shared V2 contract revision `ef02bdc`, merged by PR #18.
- [Data Storage System Specification](../specs/data-storage-spec.md).
- [Conceptual model](../docs/architecture/data-storage-conceptual-model.md).
- [Listing storage contract](../docs/architecture/listing-storage-contract.md).
- [V2 provider conformance requirements](../docs/architecture/durable-submission-v2-provider-requirements.md).

The logical ERD, port-contract, and modeling-review artifacts were authored at
`f19405d`, `b3d4961`, and `0aed62b`, but their files are not on current `main`.
This plan uses their documented boundaries as historical design input; restoring
them to `main`, or explicitly reconfirming their content, is a pre-migration
approval gate. No migration should silently rely on an absent architecture
artifact.

## Decisions made by this plan

| Decision                   | Proposal                                                                                                                                                                                                   | Why it stays simple                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Database shape             | One PostgreSQL 16+ database with PostGIS, organized under the existing `ingestion`, `model`, and `app` schemas                                                                                             | One system of record; schemas clarify authority without creating application databases.                    |
| Durable delivery scope     | Implement only `ingestion` governance lookup and V2 intake/finalization records in this plan                                                                                                               | The other schemas have independent model and publication behavior that would obscure provider correctness. |
| Relational source of truth | PostgreSQL holds policy, submission, capture, interpretation, receipt, progress, artifact metadata, and reconciliation state                                                                               | Object storage never becomes a hidden database.                                                            |
| Byte storage               | Private S3-compatible storage holds only approved retained documents or redacted artifacts; images remain excluded                                                                                         | Bytes are optional evidence, not listing media.                                                            |
| Migration style            | Ordered, reviewed SQL migrations with a small runner; no ORM-generated schema                                                                                                                              | SQL makes immutable constraints, indexes, roles, and PostGIS behavior visible and portable to Aiven.       |
| Acceptance boundary        | A receipt is written only after a recoverable database record and, if needed, a finalization outbox record are durable                                                                                     | `accepted` means Storage can finish or report a terminal result after a crash.                             |
| Reference issuance         | Production `DurableSubmissionV2Provider` remains unchanged. Its test-only `DurableSubmissionV2ConformanceFixtures` adapter seeds and invalidates provider-issued references directly in durable test state | The runner proves opaque-reference safety without adding an uploader or object-key API for Crawlers.       |

## Provider boundary

The provider implements the already exported `DurableSubmissionV2Provider`:

- `accept(submission)` validates the shared schema, applies source-scoped
  idempotency, capture, interpretation, and opaque-reference checks, and
  returns the original immutable receipt on exact replay.
- `progress(receiptId, afterSequence)` reads zero or one terminal event. It
  never exposes a database row, object key, or raw body.

The durable provider owns these internal operations, which are not crawler
ports or public APIs:

1. persist and verify reference issuance records for staged, verified-artifact,
   and verified-outcome references;
2. stage an allowed inline artifact, record a finalization outbox operation,
   and later make its internal content-addressed object durable;
3. reconcile a database record with staged, finalized, missing, orphaned, or
   digest-mismatched object state; and
4. write the one terminal `committed`, `quarantined`, or `failed` progress
   event.

The first production caller uses only `inline_redacted` or `no_retained_bytes`.
Staged and verified references exist for shared conformance and provider-owned
workflows, but this plan adds no crawler-facing upload, object-key, or
reference-issuance endpoint.

The shared V2 contract is more specific than older generic receipt language:
an exact retry is only the same `(source_key, submission_id)` and returns the
original receipt unchanged. A different submission ID with the same capture,
five-field interpretation, and verified outcome links to the existing immutable
interpretation while receiving its own acceptance receipt. A changed capture
fingerprint fails with `capture_event_conflict`; a different verified outcome
under that interpretation fails with `interpretation_conflict`. Receipt
progress is zero or one terminal event, not a multi-event workflow history.

## PostgreSQL and PostGIS responsibilities

### Initial physical record groups

The first migration set creates the `ingestion` schema and the minimum durable
records below. It does not create the later `model` or `app` record groups.

| Record group           | Required responsibility                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Governance lookup      | Versioned methodology, retention/redaction policy, review decision, and health-block records sufficient to return exactly one approved effective methodology or a typed no-work decision. |
| Submission ledger      | Source-scoped submission ID, canonical accepted-submission hash, immutable receipt, accepted timestamp, and exact-replay lookup.                                                          |
| Capture ledger         | Source/capture-event identity, canonical capture fingerprint, collection metadata, methodology/policy hashes, and conflict detection.                                                     |
| Interpretation ledger  | The five-field V2 identity, derived outcome hash, typed outcome/provenance JSON, and an immutable capture link.                                                                           |
| Artifact ledger        | Disposition, body digest/length/media/encoding, retention-policy hash, internal lifecycle state, and no externally visible object location.                                               |
| Reference ledger       | Opaque provider-issued ID, kind, full V2 binding, issuance/invalidated state, and expiry metadata when a provider workflow requires it.                                                   |
| Finalization ledger    | Outbox operation, attempt count, sanitized failure, object digest, and terminal receipt-progress linkage.                                                                                 |
| Retention/audit ledger | Authorized redaction or tombstone action, policy reason, actor, time, and required derived-data invalidation marker.                                                                      |

Use canonical JSON values and SHA-256 strings from the shared contract as
stored evidence. Store canonical submission/capture/interpretation preimages
where needed for audit and deterministic conflict diagnosis; do not infer a
new digest in a different format.

The interpretation record has a unique source/capture plus five-field identity.
The submission ledger can reference that record many times only when its
verified outcome is identical. Complete outcomes persist the V2-derived outcome
digest; the provider never accepts a caller-supplied hash that does not match
outcome kind, typed outcome, and provenance. Inline artifacts enforce the
shared 65,536 UTF-8-byte maximum before any staging work begins.

PostGIS is installed and compatibility-tested in the baseline migration, but
geography assignment and spatial publication tables are deferred with the
Rent Model/publication work. This avoids a second physical design in the
ingestion-provider slice.

### Immutability, keys, and access

- Unique constraints and transactional locking enforce `(source_key,
submission_id)`, `(source_key, capture_event_id)`, and capture plus
  five-field interpretation identity.
- Immutable ledgers reject update/delete through roles and database triggers.
  The current-publication pointer is not in this slice.
- Use separate migration/admin, ingestion-provider, review, finalizer,
  reconciliation, model, projection, and backend-read roles. The crawler gets
  only the provider boundary, never table credentials.
- Money, area, and later model values use PostgreSQL `numeric`; the V2 provider
  preserves contract decimals and does not calculate model values.

## Private object-storage responsibilities

Objects are private, encrypted, and content-addressed by the SHA-256 of the
exact permitted bytes. PostgreSQL records the digest, size, media metadata,
retention policy, purpose, and lifecycle; only internal workers know storage
locations.

An object may be retained only for approved parser replay, evidence audit, or
compliance policy-snapshot purposes defined in the storage specification. The
provider rejects original bytes without an approved representation, purpose,
retention policy, and expiry rule. Listing images, arbitrary binaries, and
policy pages not approved for durable proof stay out of object storage.

### Atomicity and recovery flow

PostgreSQL and object storage do not share a transaction. For a retainable
inline artifact, the provider uses this recoverable sequence:

1. validate inline bytes, digest, length, V2 binding, and retention authority;
2. write a private temporary object with a random internal staging location;
3. in one database transaction, persist the immutable submission/capture/
   interpretation/receipt records, artifact metadata in `staged` state, and a
   finalization outbox operation;
4. return `accepted`; and
5. let a finalizer verify the staged bytes, create or reuse the internal
   content-addressed object, mark the artifact finalized, and append exactly
   one terminal receipt event.

If staging fails before the database transaction, return no successful receipt.
If database acceptance fails after staging, reconciliation removes the orphan
or records an auditable cleanup failure. If finalization fails after acceptance,
the finalizer retries idempotently or appends sanitized `failed` progress once
the retry policy ends. A reconciliation worker detects missing, orphaned, or
digest-mismatched objects and either repairs safely or records a terminal
failure; it never silently changes an accepted submission.

`no_retained_bytes` creates no object operation. It can become `committed` once
the database evidence is durable. A quarantined runtime outcome becomes
durable `quarantined` progress only after the same durable checks succeed.

## Delivery stages and test-first behavior

Each stage starts with focused failing tests, then the smallest implementation,
then refactoring with the suite green.

1. **Physical foundation** — Add the provider package, SQL migration runner,
   local PostgreSQL/PostGIS test environment, roles, baseline schema, and
   migration test harness. Prove a clean database can apply and roll forward
   every migration; validate the same SQL against an Aiven-compatible instance.
2. **Governance lookup** — Implement the approved-methodology repository over
   versioned governance data. Prove missing, overlapping, expired, revoked,
   paused, incompatible, and health-blocked states fail closed.
3. **Durable V2 acceptance** — Implement submission/capture/interpretation/
   receipt records and conflict handling. Reuse the exact shared V2 runner and
   vectors; add transaction-boundary tests for exact replay, capture conflict,
   reinterpretation, and immutable receipts.
4. **Durable reference fixtures** — Implement the provider-owned
   `DurableSubmissionV2ConformanceFixtures` adapter in test code. Seed and
   invalidate each reference kind through durable state, then run the shared
   unknown/stale/common-binding/artifact-evidence/outcome-binding matrix in CI.
5. **Retained artifact finalization** — Add private-object staging, outbox,
   finalizer, and reconciliation for allowed inline artifacts. Prove no object
   is created for `no_retained_bytes`, object keys never cross the provider
   boundary, duplicate content is safe, and every crash point is recoverable.
6. **Retention and operational hardening** — Add policy-gated expiry,
   authorized tombstones, cleanup/reconciliation reporting, least-privilege
   checks, and Aiven/object-provider integration validation.

The later source-listing/normalized-observation mapping, rental-evidence view,
identity decisions, Rent Model snapshots, and explorer publication each need
their own approved delivery plan after this provider foundation is stable.

## Required test and CI matrix

| Area                 | Required evidence                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contract      | Run the merged `@rent-yield/listing-storage-contracts` typecheck, lint, and complete V2 suite unchanged.                                              |
| Provider conformance | Run `runDurableSubmissionV2Conformance(provider, fixtures)` against the durable provider and its real test-only reference fixture adapter.            |
| Database behavior    | Run migrations from empty state, enforce immutable rows/roles, test concurrent idempotent delivery, and prove conflict precedence atomically.         |
| Object lifecycle     | Test staging failure, database rollback after staging, finalizer retry, orphan cleanup, missing object, digest mismatch, and content-addressed reuse. |
| Retention            | Test denied retention, allowed purpose/representation, expiry/tombstone audit, and no image retention by default.                                     |
| Security             | Test that crawler-facing responses and logs contain neither object locations, raw bodies, credentials, nor unsanitized provider errors.               |
| Compatibility        | Run migrations and provider integration tests against local PostgreSQL/PostGIS and an Aiven-compatible PostgreSQL/PostGIS target.                     |

No test contacts a live listing source or needs a live canary.

## Explicit exclusions

- provisioning an Aiven account, bucket, credentials, networking, or CI secrets;
- PostgreSQL/PostGIS schema or migration implementation in this planning task;
- object-storage client code, worker code, queues, schedules, or HTTP routes;
- crawler acquisition, parsing, redaction, source access, or reference-upload API;
- Rent Model evidence/snapshot/assessment implementation;
- identity/deduplication, explorer publication, backend persistence migration,
  authentication, or user data; and
- changing `DurableSubmissionV2`, its shared vectors, or Crawler-owned code.

## Approval gates and remaining user decisions

The following must be explicitly approved before Notion implementation tickets
are created or any durable code is written:

1. **Canonical logical artifacts:** restore the ERD and port-contract artifacts
   to `main`, or approve the cited historical versions as the physical-design
   baseline.
2. **Retention policy registry:** approve initial retention durations, allowed
   original-body purposes, and the stable reviewer/authorizer process. Without
   this, the provider may support only `no_retained_bytes` and permitted
   redacted fixtures.
3. **Deployment choices:** confirm the production PostgreSQL/PostGIS service,
   S3-compatible object-storage provider/region, private-network approach, and
   secret/role administration. The plan remains Aiven-compatible but does not
   provision an account.
4. **Operations:** approve the finalizer/reconciliation retry limit, alerting
   owner, and who may authorize tombstones or retry a terminal failure.
5. **Migration execution:** approve the selected SQL-migration runner and the
   CI environment's ability to run PostgreSQL/PostGIS integration tests.

## Proposed Notion execution sequence after approval

1. Restore or reconfirm the logical ERD and port contracts on `main`.
2. Establish PostgreSQL/PostGIS migration and integration-test foundation.
3. Build governance lookup and fail-closed approval/health behavior.
4. Build durable V2 submission, receipt, and conflict ledger.
5. Add the durable reference-fixture adapter and shared conformance CI.
6. Add policy-gated artifact staging, finalization, and reconciliation.
7. Add retention/tombstone enforcement and Aiven-compatible validation.
8. Review the durable provider, document its operational runbook, and perform
   a retrospective before any model or publication work.

These are proposed tickets only. They are not approved or created by this
plan.
