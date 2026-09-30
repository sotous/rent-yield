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

The logical ERD, port-contract, and modeling-review artifacts were originally
authored at `f19405d`, `b3d4961`, and `0aed62b`. Stage 0 derives and reconciles
their current versions from the storage use cases, conceptual model, current V2
contract, and this plan; those historical commits are reference material only.
They become the physical-design baseline only after review explicitly accepts
the derivation and any identified gaps. No migration should silently rely on an
absent or unapproved architecture artifact.

## Decisions made by this plan

| Decision                   | Proposal                                                                                                                                                                                                   | Why it stays simple                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Database shape             | One PostgreSQL 16+ database with PostGIS, organized under the existing `ingestion`, `model`, and `app` schemas                                                                                             | One system of record; schemas clarify authority without creating application databases.                    |
| Durable delivery scope     | Implement only `ingestion` governance lookup and V2 intake/finalization records in this plan                                                                                                               | The other schemas have independent model and publication behavior that would obscure provider correctness. |
| Relational source of truth | PostgreSQL holds policy, submission, capture, interpretation, receipt, progress, artifact metadata, and reconciliation state                                                                               | Object storage never becomes a hidden database.                                                            |
| Byte storage               | Private S3-compatible storage holds only policy-permitted original HTML or JSON response bodies for a rolling 30 days; media is never retained                                                             | Bytes are optional evidence, not listing media.                                                            |
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

### Approved MVP retention direction

The user has approved this fixed MVP policy direction. It applies only within a
source/methodology scope that is separately authorized for collection; it does
not imply that any live source scope is currently authorized:

- retain only original text response bodies with media type `text/html` or
  `application/json`;
- retain no media, including listing images, video, audio, or other binary
  objects;
- use a rolling 30-day retention window; and
- at expiry, delete the retained body bytes while preserving capture metadata
  and digest, extracted records, and field-level provenance in PostgreSQL.
- during that window, permit body access only to the crawler/parser replay path;
  the Rent Model and Backend receive structured contract data only and never a
  stored source body.

The MVP purpose is crawler/parser replay only. PostgreSQL is the durable source
of truth for the record of collection and interpretation; object storage holds
only temporary, permitted replay bodies. Policy pages, PDFs, XML, CSV,
arbitrary binaries, redacted fixtures, and a general evidence-audit archive are
not authorized as retained objects in this MVP direction.

This is not blanket authorization to collect or retain from any source. A
general source-by-source legal/compliance workflow, source-specific retention
permissions, and a retention-authorizer mechanism are deferred. They must be
revisited and approved before any live-source or canary execution.

### Required coordinated contract and runtime change

The current V2/runtime flow cannot realize this policy: it redacts the original
response before artifact submission, disposes the original body, and calls its
only inline artifact form `inline_redacted`. That form must not be reinterpreted
as permission to retain an original response.

Before original HTML or JSON retention is implemented, a coordinated,
versioned Crawler/Storage contract change must add a policy-gated
original-response handoff that occurs before redaction and binds the exact body
to the capture digest, media type, fixed MVP policy, replay purpose, and
30-day expiry.
It must let Storage stage/finalize the body privately without returning an
object key or storage credential to the crawler. The restricted crawler/parser
replay path may read and parse the retained original body; it produces a
redacted working representation and normalized structured output. Original
bytes must not leave that path. The Rent Model and Backend contracts receive
only the redacted/normalized structured output and must not represent a
retained-body read capability. The change needs shared contract schemas and
vectors, crawler runtime behavior, provider conformance coverage,
least-privilege access tests, and retention-expiry/reconciliation tests. It is
deliberately not a V2 change in this plan and does not authorize implementation.

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
5. **Retained artifact finalization** — After the coordinated contract/runtime
   change is approved, add private-object staging, outbox, finalizer, and
   reconciliation for policy-gated original HTML/JSON responses. Prove no
   object is created for `no_retained_bytes`, object keys never cross the
   provider boundary, duplicate content is safe, and every crash point is
   recoverable.
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
| Retention            | Test HTML/JSON-only admission, denied media and other representations, 30-day expiry deleting bytes while preserving metadata/provenance, and audit.  |
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

## Resolved baseline and remaining decisions

The reconciled ERD, port contracts, and modeling review are the accepted
physical-design baseline and have merged to `main` in PR #23.

The fixed MVP retention policy is also approved: original HTML and JSON only,
crawler/parser replay only, a rolling 30-day window, no media, and
metadata/provenance preserved after byte deletion. It applies only within a
source/methodology scope separately authorized for collection; no live scope is
currently implied or authorized. General source-by-source legal/compliance
review, source-specific permissions, and a stable retention-authorizer
mechanism are deferred. They must be revisited and approved before any
live-source or canary execution.

The following decisions remain before durable implementation can begin:

1. **Coordinated contract/runtime evolution:** approve the proposed versioned
   original-response handoff before redaction. V2's `inline_redacted` form and
   the current redaction-before-artifact runtime must remain unchanged until
   that coordinated work is specified, tested, and approved.
2. **Deployment choices:** confirm the production PostgreSQL/PostGIS service,
   S3-compatible object-storage provider/region, private-network approach, and
   secret/role administration. The plan remains Aiven-compatible but does not
   provision an account.
3. **Operations:** approve the finalizer/reconciliation retry limit, alerting
   owner, and who may authorize tombstones or retry a terminal failure.
4. **Migration execution:** approve the selected SQL-migration runner and the
   CI environment's ability to run PostgreSQL/PostGIS integration tests.

## Proposed Notion execution sequence after approval

1. Establish PostgreSQL/PostGIS migration and integration-test foundation.
2. Build governance lookup and fail-closed approval/health behavior.
3. Build durable V2 submission, receipt, and conflict ledger.
4. Add the durable reference-fixture adapter and shared conformance CI.
5. Add policy-gated artifact staging, finalization, and reconciliation.
6. Add retention/tombstone enforcement and Aiven-compatible validation.
7. Review the durable provider, document its operational runbook, and perform
   a retrospective before any model or publication work.

These are proposed tickets only. They are not approved or created by this
plan.
