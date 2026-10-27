# Crawler runtime MVP runbook

## Purpose

This runbook describes readiness for the bounded-discovery MVP. It does not
authorize or perform a live collection run. The completed offline path loads a
Storage-owned active profile, applies bounded transport rules, redacts in
memory, and writes only a validated sanitized fixture or typed result. The
local manual command composition exists and has been validated offline; it has
not been invoked against a live source.

## Preconditions

- Storage returns exactly one active discovery profile for the requested source
  key. Its deterministic provenance is retained with the sanitized fixture.
- The profile fixes Colombia, Barranquilla, `for_rent`, hosts, path prefixes,
  budgets, and permitted media types. Caller input cannot widen it.
- Local kill switch is off; the redaction/scanner, fixture writer, and typed
  quarantine path are available.
- Lint, typecheck, and offline transport/orchestration/fixture tests pass.
- A dry run passes without DNS or HTTP.
- Explicit user authorization is received for one external request. Neither an
  active profile nor a passing dry run supplies this authorization.

## Local preflight and dry run

1. Resolve the exact active Storage profile. Fail locally if it is missing,
   ambiguous, invalid, or outside the requested country/city/listing-role
   scope.
2. Verify all fixed limits and permitted media types, confirm the kill switch is
   off, and render a sanitized plan. Do not perform DNS or HTTP.
3. Exercise the same orchestration in dry-run mode. It must allocate no
   capture, write no fixture, and make no external request.
4. Stop here until the user explicitly authorizes one live request.

## Bounded live flow after authorization

1. Revalidate profile scope and remaining budgets before each request. Stop
   without retry or evasion on robots denial, `401`, `403`, `429`, login,
   authentication, CAPTCHA/challenge, scope/redirect/DNS/address failure,
   unsupported media type, or budget exhaustion.
2. Decode the received response in memory. Record the observed original-response
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
separately scoped run. The MVP execution path has no candidate-registration,
access-assessment, trusted-review, or approved-methodology gate. It does retain
all mandatory transport and source block stops, and it cannot turn a single
run into scheduled or production crawling.
