# Crawler Runtime Specification

## Purpose

This specification defines the fixture-first runtime that consumes one
approved-effective crawler methodology. It turns a bounded capture into a
deterministic, sanitized crawler result and a versioned submission for Data
Storage.

Research decides whether a source can be proposed and reviewed. The runtime
does not repeat that decision; it follows the methodology made available by
trusted review.

## Product boundary

The runtime resolves and verifies the approved methodology, executes only its
declared scope, redacts before artifact output, replays pinned extraction logic,
and produces a typed result. It produces data that Data Storage can durably
accept and curate for future Rent Model inputs.

It does not grant source permission, approve a methodology, directly write the
production data store, schedule work, calculate yield, or define the
explorer-facing read model. The explorer receives a curated backend projection,
never crawler captures, redacted payloads, policy evidence, methodology hashes,
or other operational details.

## Runtime command and modes

A command supplies source, country, Colombian city, capability, listing role,
effective time, recorded-as-of time, accepted contract version, and an injected
clock. The runtime owns methodology lookup through a port. Candidate and access
assessment provenance remain behind that resolver: callers cannot supply a
methodology object, candidate or assessment binding, or substitute artifacts.

Fixture mode is the default. It accepts only frozen fixtures and injected fakes;
it cannot use a live transport.

Canary mode is available only to the separately approved
`crawler-first-real-world-canary` plan. It requires a current resolver result
that records an upstream `allowed_for_probe` decision and a trusted-review canary
authorization after runtime preflight. Its limits intersect methodology limits:
one manual invocation, one source, one discovery and one detail request, one
concurrent request, no retry, no pagination harvesting, and no schedule.

## Methodology V2 requirements

The runtime requires the separately versioned `MethodologyManifestV2` contract.
It is an immutable policy envelope returned only by the resolver; it deliberately
contains no candidate or assessment identity. In addition to pinned artifacts,
fixture hashes, scope, and budgets, V2 declares:

- `GET` as the only request method and an explicit safe media-type allowlist
  (`application/json`, `text/html`, or `text/plain`);
- declared hosts and path prefixes;
- a query policy of `forbid` or a nonempty declared set of exact non-secret
  key/value pairs and no-value keys; a key cannot be both forms;
- HTTPS-only redirect policy with maximum hops and either same-host or declared
  host routing; the policy cannot exceed the approved budget;
- globally routable address binding, TLS hostname verification, and bounded
  connection and response timeouts; and
- credentials and cookies permanently forbidden, plus a nullable named
  non-secret header profile reference; and
- a default `redacted_fixture` retention representation. The MVP/POC runtime
  does not retain `original_source_body`; original-body replay is post-POC.

The runtime holds original bytes in memory only until redaction and scanning
complete, then always disposes them. The first live canary still permits only
redacted fixtures and always discards originals. The manifest hash is
calculated from a canonical form: every semantic set is
sorted, including hosts, paths, media types, operations, fixtures, and declared
query pairs. Only declared non-secret query values may be retained. Every other
query value, credential, and fragment is rejected or removed before any
artifact, health event, or storage handoff.

## Runtime lifecycle

```text
lookup -> preflight -> frozen fixture or canary-gated bounded transport
  -> in-memory bytes -> redaction + scanner -> artifact handoff
  -> pinned extraction -> runtime outcome -> health + storage submission
```

1. Resolve exactly one approved-effective methodology using command scope and
   clocks. Missing, ambiguous, expired, paused, revoked, retired, unhealthy,
   incompatible, or hash-invalid results stop the run.
2. Resolve every declared artifact through an artifact-registry port. The port
   verifies immutable bytes or configuration by hash, contract compatibility,
   and uniqueness; a version label alone is insufficient.
3. In fixture mode, acquire one frozen capture. In canary mode, the transport
   enforces HTTPS, no credentials, canonical method/path/query policy,
   globally-routable DNS answers, connection binding to a validated address,
   normal TLS hostname verification, manual redirect handling, and streaming
   byte/time limits before each request.
4. Keep original bytes only in memory. Compute their digest, redact according to
   the resolved policy, and scan the result before artifact output. Artifact
   ports receive only post-scan data. Contact details, exact unit identifiers,
   tracking parameters, and user-generated personal data are prohibited. Every
   terminal path discards original bytes.
5. Retain a bounded redacted fixture only when it fits the inline cap. Otherwise
   discard the fixture bytes without truncation and retain only the allowed
   metadata. The capture records the observed original-response digest and
   length; a retained redacted fixture has its own separate digest and length.

For fixture execution, the redaction-before-artifact pipeline decodes original
bytes only in memory, rejects embedded binary/control content, applies the
pinned deterministic redactor, and scans the redacted result before any
artifact boundary. It emits bounded `inline_redacted` or explicit
`no_retained_bytes`; it has no Crawler-facing staging or object-reference path.
The original-byte disposal hook runs on every success and failure path.

6. Replay the pinned extraction contract through the declared parser and
   normalizer. Never fabricate a listing, rental evidence, or field provenance.
   Fixture orchestration consumes only a sanitized artifact and returns exactly
   `normalized`, `quarantined`, `parse_failed`, or `capture_only`. Only a
   normalized interpretation passing the MVP eligibility gate may become a V2
   submission candidate. The other terminal results are local and transient:
   they create no durable record, receipt, or tombstone. Parse failure emits a
   sanitized `parser_drift` event; unsafe artifact retention emits
   `artifact_safety_block`. A failed required health handoff fails closed.
   Exact fixture replay is deterministic, while a changed capture fingerprint
   or outcome under the same five-field interpretation identity is rejected.

7. Return a runtime outcome and, at the separate Data Storage boundary, hand
   off a complete V2 candidate for durable acceptance.

## Capture and interpretation identity

Capture identity is the source-scoped pair `(source_key, capture_event_id)`.
The runtime allocates the opaque immutable `capture_event_id` before submission;
it is never derived from body bytes. A fixture has its own identity and cannot
replace capture identity.

The capture fingerprint contains collection time; sanitized method and canonical
URL; response status, media type/encoding, representation, body SHA-256, and
length; applicable methodology, policy, retention, and redaction references;
and fixture identities when they exist. A changed fingerprint for the same
capture identity is `capture_event_conflict`. A new event ID is a new historical
capture even when bytes are identical.

The durable-submission V2 interpretation identity is:

```text
capture identity
+ methodology manifest hash
+ adapter artifact hash
+ parser version
+ normalizer version
+ extraction-contract hash
```

It is bound to the separate source-scoped capture identity. For a complete
outcome, the canonical outcome hash is derived from outcome kind, typed outcome,
and provenance; it cannot be supplied independently. The accepted-submission
hash also binds that verified outcome, so neither typed outcome nor provenance
can change silently. A methodology-only change creates a distinct
interpretation.

| Existing durable submission                              | Incoming submission | Required behavior                                                   |
| -------------------------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| Same `(source_key, submission_id)` and canonical payload | Exact replay        | Return the original immutable receipt.                              |
| Same `(source_key, submission_id)` and changed payload   | Any change          | Fail closed with `submission_conflict`.                             |
| Same capture identity and changed capture fingerprint    | Any submission      | Fail closed with `capture_event_conflict`.                          |
| Incompatible interpretation binding                      | Any submission      | Fail closed with `interpretation_conflict`.                         |
| Same capture and changed V2 interpretation identity      | Valid submission    | A distinct submission candidate, subject to Storage conflict rules. |

## Runtime outcomes and health

Runtime content quality is distinct from durable storage progress.

| Terminal condition                     | Runtime outcome   | Artifact                          | Health event                                     | Submission            |
| -------------------------------------- | ----------------- | --------------------------------- | ------------------------------------------------ | --------------------- |
| Clean, eligibility-passing extraction  | `normalized`      | Allowed bounded redacted artifact | None by default                                  | Complete submission   |
| Blocking quality issue                 | `quarantined`     | Discarded                         | None                                             | No submission         |
| Parser or shape drift                  | `parse_failed`    | Discarded                         | `parser_drift`                                   | No submission         |
| Valid capture without listing          | `capture_only`    | Discarded                         | None                                             | No submission         |
| Redaction/scanner or fixture-size stop | Sanitized failure | No retained fixture               | `artifact_safety_block` when retention is unsafe | No submission         |
| Storage unavailable before acceptance  | Submission error  | No new durable artifact           | None                                             | No successful receipt |

Rental evidence is eligible only when it is observed, active, long-term,
residential, base monthly COP rent with positive explicit built area. All other
rent, fee, area, or date ambiguity remains in the outcome and is quarantined
from rental-evidence use.

Health events are limited to `parser_drift` and `artifact_safety_block`. They
are typed, sanitized, and linked to source, methodology, and run; they contain
no source body or prohibited URL material. The runtime cannot clear a block;
trusted review controls pause and reactivation. If the required health port
cannot accept an event, the runtime returns a sanitized reporting failure and
never claims that the event was delivered.

## Data Storage boundary

The runtime does not directly write databases or objects. It submits a strict
`DurableSubmissionV2` containing command context; the complete source-scoped
capture fingerprint; the five-field V2 interpretation identity; and an outcome
and artifact variant.

The MVP Crawler producer submits only a complete, eligibility-passing
`normalized` outcome plus provenance. It does not submit a verified immutable
outcome reference. Its artifact is exactly one of:

- `inline_redacted`, carrying at most 65,536 UTF-8 bytes of permitted redacted
  material;
- `no_retained_bytes`, carrying an explicit disposition but no retained bytes.

Every artifact variant, including `no_retained_bytes`, carries the redacted
artifact's media type, encoding, immutable SHA-256, and byte length. The
separate capture fingerprint carries the observed original-response digest and
length used for conflict detection. The absent fixture bytes never excuse
omission of that evidence. Original bytes are always discarded in the MVP.

All outcome and artifact references are Storage-issued and opaque. They bind
the V2 contract version, `source_key`, `capture_event_id`, retention-policy
hash, the complete interpretation identity, and their relevant canonical outcome
or artifact hash. An artifact reference also binds body SHA-256, byte length,
media type, and encoding. The runtime cannot substitute an external reference,
object key, or a reference bound to another source, capture, retention policy,
interpretation, contract, hash, or artifact-evidence value.

Idempotency is scoped to `(source_key, submission_id)`. An exact retry returns
the original immutable `AcceptedReceiptV2`; a changed payload under that pair
is `submission_conflict`. A changed fingerprint for the same capture is
`capture_event_conflict`, and incompatible interpretation binding is
`interpretation_conflict`.

The canonical accepted-submission hash is computed after strict validation. Its
preimage includes command context, complete capture fingerprint, interpretation
identity, complete typed outcome/provenance or their verified outcome reference,
and artifact disposition/metadata. It deliberately excludes `submission_id`
and `submitted_at`: `submitted_at` records delivery time and must not turn an
otherwise exact retry into a new accepted submission. Receipt IDs, acceptance
time, duplicate-delivery status, provider-generated fields, and all progress
are also outside the preimage.

Storage is the sole durable idempotency and receipt authority. It issues an
immutable `accepted` receipt only when it can recover a normalized submission.
The receipt binds contract version, receipt ID, source and submission
identities, capture event ID, accepted-submission hash, acceptance time, and
duplicate-delivery status. A post-acceptance Storage failure does not create a
second runtime outcome. The process-local fixture registry is not durable
idempotency state.

## Validation

Tests use frozen fixtures, injected identity/clock allocators, and fakes. They
prove:

- lookup, assessment, scope, artifact substitution, and V2 policy failures stop
  before acquisition;
- redaction and scanning occur before every artifact, health, or submission
  handoff, and originals are discarded on every terminal path;
- identical explicit inputs produce identical derived artifact, interpretation,
  provenance, and outcome hashes;
- source-scoped exact replay, changed-payload `submission_conflict`, capture
  conflict, interpretation conflict, and every changed interpretation-identity
  component have specified outcomes;
- the Crawler producer emits only bounded inline-redacted or no-retained-bytes
  artifacts; the 65,536-byte UTF-8 boundary discards oversized fixtures without
  a reference; shared vectors continue to cover provider-owned reference
  validation without extending the production Crawler port;
- normalized-only submission candidates and typed Storage errors are strictly
  parsed; accepted-submission hash vectors prove their required inclusions and
  deliberate `submitted_at` exclusion; and
- sale/rent separation, fee/area/date ambiguity, and rental-evidence quarantine
  remain intact; and
- no fixture test performs live access or requires a database.

Shared provider-neutral vectors and their runner live in
`@rent-yield/listing-storage-contracts` under joint Crawler/Data Storage review.
Crawlers runs them against runtime fakes; Data Storage runs them against its
durable provider. The canary adds bounded transport conformance and one manual
execution only after independent source, reviewer, and methodology gates.
