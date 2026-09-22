# Durable submission V2 provider requirements

## Purpose

This document defines what a future Data Storage provider must prove against
the shared V2 durable-submission contract. It is a provider handoff, not a
provider implementation or database design.

The shared schemas, vectors, and provider-neutral runner are authored in
`@rent-yield/listing-storage-contracts`. The provider must consume that contract
without importing crawler runtime code.

## Provider responsibilities

### Accept atomically enough to recover

When a provider returns `AcceptedReceiptV2(state: "accepted")`, it has taken
durable responsibility for the complete permitted submission. It may finalize
an object and relational records later, but a crash after acceptance must leave
enough durable state to recover or reach a terminal progress event.

The accepted receipt is immutable. An exact replay under the same
`(source_key, submission_id)` returns the original receipt; it does not create
another capture, interpretation, or receipt.

### Enforce the three identity boundaries

| Boundary       | Provider behavior                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Submission     | `(source_key, submission_id)` is idempotency scope. Same pair plus a different accepted-submission hash returns `submission_conflict`.                                                                                        |
| Capture        | `(source_key, capture_event_id)` is one historical acquisition. A changed capture fingerprint returns `capture_event_conflict`; a new event ID remains a new capture even with identical body bytes.                          |
| Interpretation | A capture plus the complete interpretation identity is one immutable interpretation. Same identity with a changed outcome hash returns `interpretation_conflict`; a changed interpretation identity creates distinct history. |

### Verify artifacts without exposing storage details

The provider verifies body digest, byte length, media/encoding, representation,
retention policy, and retention purpose for every artifact disposition.

- `inline_redacted` can be accepted only within the contract's permitted byte
  bound and only after the provider verifies its metadata and digest.
- `no_retained_bytes` still carries capture body digest and length; it means the
  provider retains no body bytes, not that it loses acquisition evidence.
- `staged_reference` and `verified_immutable_reference` are opaque,
  Storage-issued handles. The provider verifies their immutability and binding
  to the same contract, capture, interpretation, and relevant outcome/artifact
  hash before accepting them.
- Original source-body retention is allowed only when the methodology and
  retention policy explicitly permit its representation, media type, purpose,
  privacy/licensing conditions, and expiry. Listing images remain excluded by
  default.

No crawler-facing error, receipt, progress event, or reference may disclose an
object key, object location, database identifier, source body, secret, or URL
query/fragment.

### Emit append-only progress

After acceptance, the provider emits ordered `ReceiptProgressV2` events. The
only terminal states are `committed`, `quarantined`, and `failed`. Events use a
monotonic sequence per receipt and sanitized reason/code values. A provider
does not rewrite the receipt, invent a second runtime outcome, or report a
model-eligibility decision as storage progress.

## Required conformance execution

The future provider CI must run the shared V2 vectors through the
provider-neutral runner. At minimum, it must prove:

1. exact source-scoped replay returns the original immutable receipt;
2. submission, capture, and interpretation conflicts fail closed;
3. every artifact variant verifies mandatory digest/length and rejects
   untrusted or mismatched references;
4. accepted-submission hashing observes every included field and ignores every
   excluded field;
5. accepted work survives simulated interruption and reaches ordered terminal
   progress without duplicate durable history; and
6. errors, receipts, progress, and references remain sanitized.

## Explicitly deferred

This milestone does not choose tables, migrations, transaction/outbox code,
object-store vendor behavior, provider API routes, or reconciliation jobs. The
next Data Storage delivery plan must make those choices while preserving this
contract and running the same vectors.
