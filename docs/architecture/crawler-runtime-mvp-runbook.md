# Crawler runtime MVP runbook

## Purpose

This runbook describes the fixture-only Crawler runtime boundary. It turns an
approved frozen fixture into a local interpretation and, only for a valid
normalized result, a Data Storage submission candidate. It does not authorize
or perform a live collection run.

## Preconditions

- A trusted resolver returns one approved, unexpired methodology for the exact
  source, city, capability, listing role, and time scope.
- The fixture hash and every pinned parser, normalizer, extraction, redaction,
  and retention artifact verify before the fixture is read.
- The caller supplies only a frozen fixture and injected test ports. No browser,
  transport, credential, database, object-storage, or source-permission port is
  present in this runtime.

## Fixture flow

1. Run preflight. Any lookup, scope, integrity, approval, or expiry failure is
   a typed local refusal; no capture ID is allocated and no fixture is read.
2. Decode the fixture response in memory. Record the observed original-response
   digest and byte length, then redact and scan it. Always dispose the original
   bytes before returning.
3. If the redacted fixture is at most 65,536 UTF-8 bytes, retain it inline with
   its own digest and length. If it is larger, discard its bytes without
   truncation and use explicit no-retained-fixture evidence. The runtime never
   requests a staged reference or object location.
4. Replay the pinned extraction contract against the sanitized artifact. The
   local result is one of `normalized`, `quarantined`, `parse_failed`, or
   `capture_only`.
5. Emit `parser_drift` for parser/shape failure or `artifact_safety_block` when
   a fixture cannot be retained safely. These are the only MVP health events;
   they contain only sanitized identity and error-code metadata. A required
   failed health handoff fails closed.
6. Only a nonempty normalized result can become a Storage submission candidate.
   Quarantined, parse-failed, and capture-only results are returned locally and
   discarded; they create no durable outcome, receipt, or tombstone.
7. Deliver the candidate through `DurableSubmissionV2Provider`. Storage alone
   decides idempotency and returns the immutable accepted receipt or a typed
   refusal. The Crawler keeps no receipt ledger.

## Product-use rule

Storage may receive only a normalized, listing-quality-passing observation.
Explorer and Rent Model eligibility remain downstream decisions; the Crawler
does not calculate yield or publish product data.

## Explicit exclusions

The MVP retains no original HTML/JSON body and provides no historical-body
replay. Parser improvements use redacted fixtures and take effect on a new,
separately approved collection run. Live sources, source permissions,
compliance review, credentials, and canary execution remain separately gated.
