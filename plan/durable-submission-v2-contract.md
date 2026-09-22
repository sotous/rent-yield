# Durable submission V2 contract plan

## Status

In progress on 2026-09-22. This plan freezes the shared V2 contract before any
crawler runtime behavior or durable Storage provider is built.

## Goal

Define and verify one provider-neutral durable-submission interface that lets a
Crawler submit an immutable capture interpretation to Data Storage, receive an
acceptance receipt, and observe later progress without knowing database tables,
object locations, or provider details.

## Authority and ownership

The shared contract lives in `@rent-yield/listing-storage-contracts`.

| Owner        | Responsibility in this milestone                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawlers     | Sole editor of the shared package: V2 schemas, canonical hash functions, vectors, conformance-runner interface, focused contract tests, and exports |
| Data Storage | This plan, provider-facing requirements, review of V2 semantics/vectors, and later durable-provider CI outside this milestone                       |

Existing V1 `ingestion.ts`, `conformance.ts`, and their tests remain unchanged.
No branch may assume the other worktree's files are shared; coordination uses
the approved interface, commit references, and the Crawler/Data Storage task
thread.

## Approved V2 decisions

- Idempotency is scoped by `(source_key, submission_id)`. Exact replay returns
  the original immutable accepted receipt.
- Capture identity is `(source_key, capture_event_id)`. Its fingerprint is the
  conflict preimage and always includes the response body digest and length,
  even when no bytes are retained.
- Interpretation identity contains capture identity, methodology-manifest hash,
  adapter-artifact hash, parser version, normalizer version,
  extraction-contract hash, and canonical outcome hash.
- Submission artifacts are a strict union: inline redacted bytes, no retained
  bytes, an opaque Storage-issued staged reference, or an opaque Storage-issued
  verified immutable reference. No variant exposes object keys or locations.
- A verified reference must be immutable and bound to the same contract,
  capture, interpretation, and relevant outcome/artifact hash. Arbitrary URLs,
  provider references, or external references are invalid.
- Storage issues an immutable `accepted` receipt only after it can recover the
  complete permitted submission. Later progress is append-only:
  `committed`, `quarantined`, or `failed`.
- The accepted-submission hash uses canonical JSON and includes the immutable
  command context, capture identity/fingerprint, interpretation, outcome and
  provenance or verified reference, plus artifact disposition/metadata or
  verified reference. It excludes submission ID, receipt/provider fields,
  duplicate metadata, and progress state.
- Errors are typed and sanitized. They contain no bodies, credentials, URL
  query/fragment content, object keys, or storage layout.

## Scope

1. Add strict `DurableSubmissionV2`, `AcceptedReceiptV2`,
   `ReceiptProgressV2`, artifact-union, and typed-error schemas.
2. Add canonical identity and accepted-submission hash functions with the
   approved preimage rules.
3. Add canonical valid/invalid vectors and a provider-neutral runner that a
   future durable provider can execute.
4. Define focused failing tests before implementations make them pass.
5. Review the resulting contract against the Data Storage provider requirements
   and document the outcome.

## Out of scope

- crawler runtime acquisition, parsing, redaction, or scheduling behavior;
- database schema, migrations, object-store setup, or durable provider code;
- a real queue, event stream, HTTP endpoint, or production source access; and
- changing the approved V1 ingestion contract.

## Execution order

1. Crawlers writes focused red tests and V2 vectors in the shared package.
2. Crawlers implements the smallest strict schemas, canonicalization, and
   runner that make those tests pass.
3. Data Storage reviews all provider-facing cases and reports corrections only
   through the shared task thread.
4. Crawlers applies agreed corrections and reruns package checks.
5. Data Storage records the reviewed provider requirements and prepares the
   later provider-CI handoff; no durable provider is implemented here.

## Focused contract tests

The shared test suite must first fail for the desired reason, then pass while
preserving the V1 suite. It must cover:

- strict V2 envelope validation and rejection of unknown fields;
- source-scoped idempotency: same submission ID is independent across sources,
  exact replay returns the same receipt, and changed payload conflicts;
- capture-event conflict on changed fingerprint, while a new capture event with
  identical body remains new history;
- interpretation conflict on changed outcome under the same interpretation,
  while a changed interpretation identity is distinct history;
- every artifact variant, with body digest and length required even for
  `no_retained_bytes`;
- rejection of arbitrary/external references and mismatched Storage-issued
  references;
- hash invariance when only excluded submission ID, receipt/provider fields,
  duplicate metadata, or progress state changes; and hash change when any
  included preimage value changes;
- immutable acceptance receipt, append-only progress ordering, and sanitized
  typed errors; and
- provider-neutral runner execution against the canonical vectors.

## Files

| Path                                                                          | Owner        | Change                                         |
| ----------------------------------------------------------------------------- | ------------ | ---------------------------------------------- |
| `packages/listing-storage-contracts/src/durable-submission-v2.ts`             | Crawlers     | V2 schemas, identities, hash functions, errors |
| `packages/listing-storage-contracts/src/durable-submission-v2.vectors.ts`     | Crawlers     | Canonical vectors                              |
| `packages/listing-storage-contracts/src/durable-submission-v2.conformance.ts` | Crawlers     | Provider-neutral runner interface              |
| `packages/listing-storage-contracts/src/durable-submission-v2.test.ts`        | Crawlers     | Red/green contract tests                       |
| `packages/listing-storage-contracts/src/index.ts`                             | Crawlers     | Export-only amendment                          |
| `docs/architecture/durable-submission-v2-provider-requirements.md`            | Data Storage | Provider behavior and CI handoff               |

## Validation

- The V2-focused test file first demonstrates each intended failure, then
  passes after implementation.
- Package lint, typecheck, test suite, and `git diff --check` pass.
- Data Storage reviews the exact vectors and runner adapter surface against the
  provider requirements.
- The milestone closes only when both workstreams reference the same approved
  shared-package commit.

## Risks and assumptions

- The exact TypeScript representation of opaque references remains an internal
  contract choice, but it must not permit callers to provide object locations.
- A future large-object upload path may add a Storage-issued staged handle
  without changing V2’s artifact semantics.
- Provider CI belongs to the next durable-provider milestone and must run the
  same V2 vectors without importing crawler runtime behavior.
