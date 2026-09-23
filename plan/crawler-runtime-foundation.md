# Crawler runtime foundation

## Status

Drafted on 2026-09-17. This plan proposes the runtime layer that consumes the
completed crawler research and methodology foundation. It requires approval
before its execution work is broken into Notion tasks.

## Goal

Define and implement a deterministic, fixture-first crawler runtime that takes
one approved-effective methodology and produces a sanitized, versioned crawler
run result. The runtime is the consumer of research output; it does not conduct
research, approve access, or own durable storage.

## Relevant sources of truth

- `AGENTS.md`
- `specs/crawler-research-spec.md`
- `specs/crawler-runtime-spec.md`
- `plan/crawler-research-and-methodology-foundation.md`
- `plan/crawler-first-real-world-canary.md`
- `plan/colombian-listing-crawlers-and-ingestion.md`
- `docs/architecture/listing-storage-contract.md`
- `docs/architecture/crawler-durable-provider-handoff.md`
- `specs/data-storage-spec.md`

## Scope

The runtime will:

- own methodology lookup by exact source, city, capability, listing role,
  effective time, and recorded-as-of time;
- accept only the resolved methodology's pinned adapter, parser, normalizer,
  extraction contract, access scope, and budgets;
- execute against injected fixture and transport ports, keeping received bytes
  in memory until redaction and prohibited-data scanning succeed;
- produce typed run results: sanitized receipt, redacted fixture reference,
  `normalized`, `quarantined`, `parse_failed`, or `capture_only`
  interpretation, health event, and a versioned Data Storage submission;
- use immutable interpretation identity to detect duplicate delivery and
  deterministic drift; and
- expose fixture-first tests and a narrow manual canary orchestration boundary.

The runtime will not:

- decide source permission, approve/revoke/re-activate methodologies, or infer
  broader scope from a source URL;
- add a database, object store, credentials, scheduler, browser automation,
  proxy, retries, pagination harvesting, or production adapter;
- retain original source bodies after redaction; or
- claim durable acceptance, Rent Model execution, identity resolution, or
  explorer publication.

## Proposed architecture

```text
runtime lookup request
  -> approved-effective methodology
  -> runtime preflight
  -> injected bounded transport or frozen fixture
  -> in-memory raw bytes
  -> deterministic redaction + scanner
  -> immutable fixture
  -> pinned parser/normalizer/extraction
  -> normalized | quarantined interpretation
  -> sanitized run result + health event + submission candidate
```

The runtime owns orchestration and pure application behavior. Ports isolate
methodology lookup, transport, fixture/artifact output, clock, health reporting,
and future ingestion. The live canary may supply a real transport only under its
separate plan and approval gate; all normal development remains fixture-backed.

## Determinism and identity

Capture identity is the runtime-allocated source-scoped pair of `source_key` and
opaque `capture_event_id`; fixture identity is a derivative artifact and cannot
replace it. For durable-submission V2, interpretation identity is the five-field
tuple of methodology manifest hash, adapter artifact hash, parser version,
normalizer version, extraction-contract hash. It
is always bound to the separate source-scoped capture identity. The accepted-
submission hash additionally binds the complete typed outcome and provenance,
so those values cannot silently change while retaining the same outcome hash.

- Exact replay under the same `(source_key, submission_id)` returns the
  original immutable receipt.
- A changed submission under that pair fails closed with
  `submission_conflict`; a changed capture fingerprint under the same capture
  identity fails closed with `capture_event_conflict`; and an incompatible
  interpretation fails closed with `interpretation_conflict`.
- A changed durable-submission interpretation identity for the same immutable
  capture is a distinct submission candidate, subject to Storage conflict rules.

Fixture payloads, methodologies, and declared artifacts remain hash-pinned to
make replay and drift detection verifiable. Hashes are internal provenance
metadata; they do not authorize access or replace review.

## Execution slices

1. Jointly evolve the methodology and ingestion contracts to V2, including the
   complete submission/artifact alternatives, capture and interpretation
   identities, receipt/progress semantics, and provider-neutral runner.
2. Define runtime schemas, discriminated result/failure envelopes, ports,
   identity allocation, terminal-state matrix, and fixture-first vectors.
3. Implement runtime-owned methodology/assessment preflight and fail-closed
   artifact, scope, budget, query, and retention verification against memory
   ports.
4. Implement the in-memory redaction-before-write pipeline, scanner, artifact
   disposition, and original-byte disposal on every terminal path.
5. Implement deterministic parser/normalizer/extraction orchestration,
   duplicate/drift semantics, health events, and submission production.
6. Integrate the bounded manual canary command only after its separate access,
   reviewer, V2-methodology, and live-transport gates are met.
7. Review ergonomics, document the runtime runbook, and reconcile the canary
   plan and Data Storage handoff.

Each behavioral slice follows RED → GREEN → REFACTOR. Shared contract changes
require joint agreement with Data Storage before implementation.

## Risks and dependencies

- V1 cannot express the complete submission, allowed media/query/redirect/
  transport policy, or same-capture reinterpretation semantics. V2 is a joint
  prerequisite; runtime implementation starts only after its contract review.
- Live transport belongs only to the separately approved canary. A fixture-first
  runtime must not create an implied live-crawling capability.
- Data Storage must supply durable policy, reviewer-identity, artifact, and
  provider-conformance behavior before a run can be treated as durably stored.

## Validation

- Identical explicit inputs replay to the same derived artifact, provenance,
  interpretation, and outcome hashes. Whole run records are compared only when
  their clocks and identity allocators are also fixed.
- Scope, approval, artifact, integrity, policy, redaction, scanner, parser, and
  storage-boundary failures stop before a result is published.
- Capture conflict, duplicate delivery, changed interpretation, parser drift,
  health-report failure, and pre-acceptance storage unavailability produce their
  specified typed outcomes.
- Tests use frozen fixtures and injected fakes; no test contacts a live source
  or needs a database.
- The manual canary executes only after its own explicit gates pass.

## Milestone 1: V2 durable-submission contract freeze

Status: active on 2026-09-22. This milestone is limited to the shared package
`@rent-yield/listing-storage-contracts`; it does not create a crawler runtime,
a transport, a database, or a durable Storage provider.

### Deliverables

- Strict V2 schemas for `DurableSubmissionV2`, `AcceptedReceiptV2`,
  `ReceiptProgressV2`, artifact representations, and sanitized typed errors.
- Normative rules for source-scoped idempotency, capture and interpretation
  conflicts, and the canonical accepted-submission hash preimage.
- Canonical test vectors and a provider-neutral conformance runner.

### Agreed boundary

- Idempotency is keyed by `(source_key, submission_id)`; an exact retry returns
  the original immutable receipt.
- Every artifact disposition includes immutable body digest and byte length,
  including `no_retained_bytes`.
- Any staged or verified immutable reference is opaque and Storage-issued. It is
  bound to contract version, source key, capture event ID, the complete
  five-field interpretation identity, and its outcome or artifact hash. Artifact
  references additionally bind their declared body digest.
- The artifact union is `inline_redacted`, `no_retained_bytes`,
  `staged_reference`, or `verified_immutable_reference`. Every variant carries
  media type, encoding, body SHA-256, and byte length; `no_retained_bytes`
  omits retained bytes, never acquisition evidence. Outcomes are either the
  complete typed outcome plus provenance or a distinct verified immutable
  outcome reference.
- The accepted-submission hash is the canonical durable submission after
  validation. It includes command context, capture fingerprint, interpretation
  identity, complete typed outcome/provenance or their verified reference, and
  artifact disposition/metadata. It deliberately excludes `submission_id` and
  `submitted_at`, as well as receipt/provider-generated fields,
  duplicate-delivery metadata, and progress state. `submitted_at` records
  delivery time and must not make an otherwise exact retry a new submission.
- Acceptance produces an immutable `accepted` receipt. Later receipt progress
  is append-only, ordered by a positive sequence, and has only `committed`,
  `quarantined`, or `failed` state plus nullable sanitized code and reason.

### Test-first validation

Focused contract tests must first fail for each schema, hash inclusion/exclusion
(including deliberate `submitted_at` exclusion), all four artifact variants,
complete and verified-reference outcomes, source-scoped replay/conflict,
capture conflict, interpretation conflict, rejected mismatched or untrusted
references, immutable receipt shape, sanitized errors, and ordered receipt
progress. The provider-neutral runner parses strict receipts and progress and
then executes the same vectors against a fake provider. Data Storage owns
provider CI; Crawlers owns producer conformance and fakes.

## Milestone 2: Fixture runtime preflight

Status: active on 2026-09-23. This slice introduces no acquisition transport
and performs no live or canary work. It defines the fixture-only runtime input,
trusted methodology resolver and artifact-verification ports, runtime-owned
opaque capture-event allocation, and the preflight boundary that rejects every
invalid run before a fixture can be read.

The command contains only an exact V2 lookup scope and a fixture identifier.
It deliberately has no field for a methodology manifest, candidate, assessment,
approval, artifact binding, or transport. The resolver supplies the approved
effective manifest from trusted state. Preflight validates the manifest digest,
the exact lookup scope, expiry, the declared fixture hash, and its pinned
adapter/extraction/redaction/retention artifacts. It allocates a source-scoped
opaque capture event only after all checks pass.

Focused RED tests cover successful fixture preflight and invalid input,
resolver failure, scope mismatch, expiration, artifact verification failure,
and attempts to inject a methodology or candidate binding. The tests prove the
allocator is never called on a failed preflight and use only injected fakes.
