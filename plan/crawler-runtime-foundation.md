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
replace it. An interpretation identity is the tuple of capture identity,
methodology manifest hash, adapter artifact hash, parser version, normalizer
version, and extraction-contract hash. The outcome hash is a result, not part
of that identity.

- Same interpretation identity and outcome hash: return existing interpretation
  with duplicate-delivery metadata.
- Same interpretation identity and different outcome hash: fail closed with
  `interpretation_conflict`.
- Changed interpretation identity for the same immutable capture: append a new
  interpretation.

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
