# Crawler runtime MVP foundation retrospective

## Result

The fixture-first runtime foundation now produces a complete local flow from a
successful preflight through sanitized artifact handling, deterministic
interpretation, minimum health reporting, normalized-only submission creation,
and a Storage-owned immutable receipt.

## What changed

- Original response bytes remain in memory only. The runtime records their
  digest and length, then discards them after redaction/scanning.
- A retained redacted fixture has separate digest and length. Fixtures above the
  inline cap are discarded without truncation or a Storage reference.
- The only health events are `parser_drift` and `artifact_safety_block`.
- `quarantined`, `parse_failed`, and `capture_only` stay local and transient.
  Only a nonempty normalized interpretation crosses the Storage boundary.
- The crawler validates the receipt returned by the shared provider port but
  keeps no durable idempotency or receipt state.

## Validation

The Crawler package passes lint, typecheck, and its full frozen-fixture test
suite. The coordinator tests prove unsafe input stops before parser or Storage,
and a normalized result returns Storage's immutable receipt.

## Scope

No live source, canary, browser, credential, permission, compliance, database,
object store, original-body retention, or historical-response replay behavior
was added. Parser improvements continue to use redacted fixtures and take
effect through a new separately approved collection run.
