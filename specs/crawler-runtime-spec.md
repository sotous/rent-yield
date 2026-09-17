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

A command supplies source, Colombian city, capability, listing role, effective
time, recorded-as-of time, and an injected clock. The runtime owns methodology
lookup through a port; callers cannot supply a methodology object or substitute
its artifacts.

Fixture mode is the default. It accepts only frozen fixtures and injected fakes;
it cannot use a live transport.

Canary mode is available only to the separately approved
`crawler-first-real-world-canary` plan. It requires a current,
candidate-version-bound `allowed_for_probe` assessment and a trusted-review
canary authorization after runtime preflight. Its limits intersect methodology
limits: one manual invocation, one source, one discovery and one detail request,
one concurrent request, no retry, no pagination harvesting, and no schedule.

## Methodology V2 requirements

The runtime requires a jointly versioned `MethodologyManifestV2`. In addition
to pinned artifacts, hosts, paths, and budgets, V2 declares:

- allowed request methods and media types;
- explicit path policy;
- a query policy of `forbid`, declared exact non-secret key/value pairs, or
  declared no-value keys;
- redirect policy: HTTPS-only, maximum hops, allowed hosts or same-host rule,
  and revalidation on every hop;
- public-address DNS and connection/response-limit policy; and
- credentials/cookies forbidden plus an approved named non-secret header profile
  only when explicitly declared.

Only declared non-secret query values may be retained. Every other query value,
credential, and fragment is rejected or removed before any artifact, health
event, or storage handoff.

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
5. Retain a transient sanitized artifact or hand off a `source_fixture` only
   when retention permits a redacted-fixture representation, purpose, type, and
   size. Otherwise retain only allowed digest and metadata.
6. Replay the pinned extraction contract through the declared parser and
   normalizer. Never fabricate a listing, rental evidence, or field provenance.
7. Return a runtime outcome, report required sanitized health events, and submit
   the complete result to Data Storage when an ingestion port is injected.

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

Interpretation identity is:

```text
capture identity
+ methodology manifest hash
+ adapter artifact hash
+ parser version
+ normalizer version
+ extraction-contract hash
```

The canonical outcome hash verifies the result and is not part of interpretation
identity. A methodology-only change creates a distinct interpretation.

| Existing interpretation        | Incoming outcome       | Required behavior                                                    |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------- |
| No matching identity           | Any valid outcome      | Append a new interpretation.                                         |
| Same identity                  | Same outcome hash      | Return the existing interpretation with duplicate-delivery metadata. |
| Same identity                  | Different outcome hash | Fail closed with `interpretation_conflict`.                          |
| Same capture, changed identity | Any valid outcome      | Append a distinct interpretation.                                    |

## Runtime outcomes and health

Runtime content quality is distinct from durable storage progress.

| Terminal condition                            | Runtime outcome   | Artifact                                     | Health event                                         | Submission            |
| --------------------------------------------- | ----------------- | -------------------------------------------- | ---------------------------------------------------- | --------------------- |
| Clean extraction                              | `normalized`      | Allowed sanitized artifact                   | Only when policy requires it                         | Complete submission   |
| Blocking quality issue                        | `quarantined`     | Allowed sanitized artifact                   | When source-health applies                           | Complete submission   |
| Parser or shape drift                         | `parse_failed`    | Allowed sanitized artifact                   | Error-level parser drift                             | Complete submission   |
| Valid capture without listing                 | `capture_only`    | Allowed sanitized artifact                   | Only when policy requires it                         | Complete submission   |
| Preflight, transport, redaction, scanner stop | Sanitized failure | No retained artifact; sanitized receipt only | Required for policy, challenge, rate limit, or drift | No submission         |
| Storage unavailable before acceptance         | Submission error  | Runtime result retained                      | Storage-boundary event when applicable               | No successful receipt |

Rental evidence is eligible only when it is observed, active, long-term,
residential, base monthly COP rent with positive explicit built area. All other
rent, fee, area, or date ambiguity remains in the outcome and is quarantined
from rental-evidence use.

Health events are typed, sanitized, and linked to source, methodology, and run.
They contain no source body or prohibited URL material. The runtime cannot clear
a block; trusted review controls pause and reactivation. If the required health
port cannot accept an event, the runtime returns a sanitized reporting failure
and never claims that the event was delivered.

## Data Storage boundary

The runtime does not directly write databases or objects. It submits a versioned
durable-ingestion submission containing:

- context and capture identity/fingerprint;
- all six interpretation-identity fields and canonical outcome hash;
- runtime outcome kind plus either complete typed outcome/provenance or a
  verified immutable Storage reference; and
- fixture/artifact representation and retention disposition, with permitted
  bytes or a Storage-issued staged-artifact reference plus media, encoding,
  digest, and length.

A staged reference is opaque and cannot be invented by the runtime. Original
bytes require explicit policy approval; the first canary supplies only a
redacted fixture and discards originals.

Storage issues an immutable `accepted` receipt only when it can recover the
submission. Later append-only storage progress is separate: `normalized`
typically becomes `committed`; `quarantined` and `parse_failed` become storage
`quarantined`; `capture_only` may become `committed` but is never model evidence;
and finalization failure becomes `failed`. A post-acceptance storage failure
does not create a second runtime outcome.

## Validation

Tests use frozen fixtures, injected identity/clock allocators, and fakes. They
prove:

- lookup, assessment, scope, artifact substitution, and V2 policy failures stop
  before acquisition;
- redaction and scanning occur before every artifact, health, or submission
  handoff, and originals are discarded on every terminal path;
- identical explicit inputs produce identical derived artifact, interpretation,
  provenance, and outcome hashes;
- capture conflict, duplicate delivery, changed outcome under the same identity,
  and every changed interpretation-identity component have specified outcomes;
- receipt acceptance/progress, pre-acceptance `storage_unavailable`, artifact
  representation, and retention disposition conform to shared vectors;
- sale/rent separation, fee/area/date ambiguity, and rental-evidence quarantine
  remain intact; and
- no fixture test performs live access or requires a database.

Shared provider-neutral vectors and their runner live in
`@rent-yield/listing-storage-contracts` under joint Crawler/Data Storage review.
Crawlers runs them against runtime fakes; Data Storage runs them against its
durable provider. The canary adds bounded transport conformance and one manual
execution only after independent source, reviewer, and methodology gates.
