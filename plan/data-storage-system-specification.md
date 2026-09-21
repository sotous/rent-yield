# Data storage system specification plan

## Status

Completed on 2026-09-17. This plan covered documentation and design only.
Durable-provider implementation requires a later approved implementation plan
and Notion task breakdown.

## Goal

Create one easy-to-read, authoritative specification for the data storage
system that supports the `rent-yield` ecosystem. The specification should say
what the system must serve, what it must preserve, and why each responsibility
exists.

## Sources of truth

- `specs/domain-spec.md`
- `specs/backend-api-spec.md`
- `specs/crawler-research-spec.md`
- `specs/rent-model-spec.md`
- `docs/architecture/listing-storage-contract.md`
- `plan/rent-model-v1.md`
- `plan/crawler-first-real-world-canary.md`

## Approach

1. Describe the four consumers: Crawlers, Rent Model, backend explorer, and
   operators/reviewers.
2. Define a simple architecture: one logical PostgreSQL/PostGIS database,
   three logical schemas, and private object storage only for permitted
   retained documents.
3. Explain the data lifecycle from source review through ingestion, modeling,
   and explorer publication.
4. Specify the minimum durable records, access boundaries, retention rules,
   idempotency behavior, and reproducibility guarantees.
5. Resolve conflicting legacy port and receipt language without choosing an
   ORM or implementing migrations.
6. State the decisions that must be complete before implementation begins.

## Success criteria

- A product, backend, crawler, model, or infrastructure contributor can tell
  what the storage system provides and why without reading every architecture
  note.
- Sale prices cannot enter the Rent Model evidence boundary.
- Source evidence, model snapshots, and explorer publications remain
  reproducible and auditable.
- The crawler handoff's durable receipt, reinterpretation, retention, and
  governance semantics are represented accurately.
- Backend-facing row grain and publication consistency are explicit.
- The document remains ORM-neutral and avoids premature operational
  complexity.

## Validation

- Review the draft against crawler, Rent Model, and backend requirements.
- Check that related architecture documents point to the new source of truth
  and no longer present legacy ports as authoritative.
- Run Markdown formatting and repository diff checks.

## Out of scope

- Database migrations, adapters, object-store setup, deployment, credentials,
  production crawling, Rent Model implementation, and backend integration.

## Outcome and retrospective

- Added `specs/data-storage-spec.md` as the readable ecosystem source of truth.
- Reviewed the draft independently from crawler, Rent Model, and backend
  perspectives, then resolved their contract and simplicity findings.
- Corrected supporting architecture and crawler-plan language where it
  conflicted with immutable receipts, snapshot reuse, rent eligibility, or the
  new authoritative specification.
- Kept implementation out of scope. The next iteration should begin only when
  the durable-provider delivery plan and tracked tasks are approved.
