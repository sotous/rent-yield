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

Status: completed on 2026-09-23. This milestone is limited to the shared package
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
- A complete outcome hash is derived canonically from outcome kind, typed outcome,
  and provenance; a caller cannot retain a hash while changing those values.
- Any staged or verified immutable reference is opaque and Storage-issued. It is
  bound to contract version, source key, capture event ID, retention-policy hash,
  the complete five-field interpretation identity, and its outcome or artifact
  hash. Artifact references additionally bind body digest, byte length, media
  type, and encoding.
- The artifact union is `inline_redacted`, `no_retained_bytes`,
  `staged_reference`, or `verified_immutable_reference`. Every variant carries
  media type, encoding, body SHA-256, and byte length. `inline_redacted` is
  limited to 65,536 UTF-8 bytes; larger safe material uses an opaque reference.
  `no_retained_bytes`
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
then executes the same vectors against a fake provider. Reference vectors use a
conformance-only fixture adapter that seeds and invalidates exact provider-owned
bindings; it proves unknown, stale, and metadata-mismatched references fail
closed without adding issuance to the production provider port. Data Storage
owns provider CI; Crawlers owns producer conformance and fakes.

### Retrospective

The shared V2 boundary is complete without introducing a durable provider or
live acquisition. Joint review tightened the outcome and reference integrity
rules beyond schema shape alone: outcomes are derived, references are seeded
and binding-verified, and inline artifacts have a wire-size ceiling. The runner
now proves provider-neutral contract behavior only; it is not evidence that a
database, object store, or live canary is ready. The next iteration remains the
separately scoped fixture runtime and provider-harness work.

## Milestone 2: Fixture runtime preflight

Status: completed on 2026-09-23. This slice introduces no acquisition transport
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

### Retrospective

The implementation met this slice without widening it into fixture reading,
redaction, parsing, storage submission, or canary acquisition. The strict
command boundary is ergonomic for callers because they provide only their
fixture reference and exact lookup scope; trusted methodology remains behind a
small resolver port. No immediate iteration is needed. The runtime plan now
records the delivered boundary and the next slice can add fixture reading and
redaction without changing this command's authority model.

## Milestone 3: Fixture redaction-before-artifact pipeline

Status: completed on 2026-09-24. The fixture-only pipeline decodes raw bytes in
memory, rejects unsafe binary/control input, deterministically redacts and scans
the payload, and only then creates an artifact disposition. It supports bounded
inline redacted bytes, explicit no-retained-bytes evidence, and an injected
opaque staging port. The staging port receives redacted bytes and returns only
an opaque reference ID; it has no object-store or provider dependency.

Every terminal path invokes the caller-owned original-byte disposal hook.
Focused tests cover success, prohibited input, inline bounds, no-retention,
staging, and staging failure. No live transport, credential, browser, database,
or object-storage capability was added.

### Retrospective

The existing fixture redactor and scanner were reusable after exposing a narrow
pure redaction function. Keeping the new pipeline as an application boundary
makes its artifact choices explicit without coupling runtime code to durable
Storage. Future submission work must bind a staged reference to the complete
V2 capture and interpretation context; this slice intentionally does not
produce a durable submission.

## Milestone 4: Fixture interpretation orchestration

Status: completed on 2026-09-24. The fixture-only orchestration boundary accepts
only sanitized artifacts, invokes an injected pinned replay port, returns the
four typed terminal interpretations, and emits a sanitized parser-drift health
event for parse failure. A memory registry enforces immutable capture and
five-field interpretation identity with deterministic exact replay and typed
capture/interpretation conflicts. The candidate builder derives a validated V2
submission candidate but has no delivery or durable-acceptance port.

### Retrospective

This slice reused the existing deterministic fixture replay engine while adding
runtime authority and identity boundaries around it. It intentionally leaves
transport, durable submission delivery, and live canary behavior to later
separately gated work.

## Milestone 5: Versioned retained-body parser replay handoff

### Status

Proposed as a decision-complete addition on 2026-09-30. It is not approved for
implementation or Notion breakdown until this plan addition is accepted. It
does not authorize live sources, a canary, browsers, credentials, or
source-specific legal/compliance and permission work.

### Goal

Allow a restricted crawler/parser replay path to read a policy-permitted,
retained original response body and reproduce parsing without exposing raw
source bodies to the Rent Model, Backend, Explorer, or object storage callers.
The boundary is a joint Crawler/Data Storage change. It is a new versioned
contract, not a reinterpretation of V2's `inline_redacted` artifact.

### Fixed MVP policy and authority boundary

This milestone applies only when a source/methodology scope is separately
authorized for collection. It does not imply any live scope is authorized now.

- Only exact original `text/html` and `application/json` response bodies are
  eligible for retention; media and every other representation are denied.
- Storage retains an eligible body for a rolling 30 days, then deletes the body
  bytes while preserving capture metadata/digest, extracted records, and
  provenance.
- The crawler/parser replay worker is the only raw-body reader. It may parse
  the original bytes but must produce a redacted working representation and
  normalized structured output before anything leaves that path.
- Rent Model, Backend, and Explorer receive structured contract data only.
  Their contracts have no raw-body field, replay handle, retrieval method, or
  object location.
- A general source-by-source legal/compliance workflow, source-specific
  permissions, and a stable retention-authorizer mechanism are deferred until
  before live-source or canary work.

### Intended versioned contract and lifecycle

Add a private, versioned Crawler/Storage replay-retrieval port keyed by the
source-scoped capture ID. Its only successful result is the exact retained
HTML/JSON body with capture digest, media type, collection time, and expiry
metadata sufficient to verify and replay it. It never returns an object key,
pre-signed URL, database credential, source-policy record, or arbitrary-object
lookup capability.

Each retrieval is authorized by a short-lived, single-use, opaque replay grant
bound to the capture ID, contract version, parser/replay caller identity, and
expiry. Storage owns grant issuance and validation; its issuance mechanism is
internal and does not become a general crawler or consumer API. The retrieval
port must return typed, sanitized no-body outcomes for unknown capture, missing
or non-retained body, expired/deleted body, consumed/expired/mismatched grant,
unauthorized caller, forbidden media type, policy block, and integrity failure.

The lifecycle is:

1. A future authorized acquisition flow computes the exact-body digest and
   submits the original HTML/JSON to Storage before redaction, with capture
   binding and the fixed MVP retention policy.
2. Storage validates scope and representation, persists capture/artifact
   metadata, privately stages/finalizes the body, and records its 30-day expiry.
3. A parser replay job obtains a Storage-issued one-time grant and calls the
   versioned retrieval port with its capture ID.
4. Storage atomically validates and consumes the grant, verifies lifecycle,
   media type, policy, and digest, and supplies the exact body only to the
   restricted replay worker.
5. The worker verifies the digest, parses, redacts, normalizes, and emits only
   the existing structured outcome/provenance path. It does not forward, log,
   cache, or persist the original bytes outside the approved restricted path.
6. At expiry, Storage deletes the body bytes and future replay reads return a
   typed unavailable result; capture metadata, digest, extracted records, and
   provenance remain.

V2 fixture/runtime behavior remains unchanged: it redacts and disposes original
fixture bytes, and `inline_redacted` continues to mean redacted bytes only.
The new handoff requires a new contract version, schemas, vectors, and
provider/runtime conformance; it must not alter V2 hashes or receipt behavior.

### Ownership

| Area                               | Owner                                                                    | Responsibility                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared contract design             | Crawlers and Data Storage jointly; Crawlers authors shared-package edits | Versioned request/result/no-body schemas, grant binding, canonical vectors, and compatibility boundary.                                                          |
| Replay caller and output isolation | Crawlers                                                                 | Restricted worker identity, digest verification, parsing/redaction/normalization, original-byte disposal, and proof that downstream outputs are structured only. |
| Retention, grants, and retrieval   | Data Storage                                                             | Private body lifecycle, 30-day expiry, one-time grant issuance/consumption, policy/lifecycle/digest checks, and no object-location leakage.                      |
| Durable integration tests          | Data Storage with Crawler conformance input                              | Provider behavior, private lifecycle, expiry, grant replay resistance, and reconciliation.                                                                       |
| Live-source permission             | Deferred                                                                 | No team implements or infers source-specific authorization in this milestone.                                                                                    |

### Implementation slices after approval

1. **Contract freeze** — Define the next-version original-response submission
   and capture-ID replay-retrieval schemas, opaque replay grant binding, typed
   no-body outcomes, canonical hashing rules, and shared vectors. Preserve V2
   unchanged and publish migration/compatibility guidance.
2. **Crawler replay boundary** — Add a restricted replay worker port and
   in-memory fakes. Prove it can verify and parse retrieved bytes, then emits
   only redacted/normalized structured data.
3. **Storage retention and retrieval provider** — Add policy/lifecycle records,
   private staging/finalization, one-time grant validation/consumption, and
   capture-keyed retrieval without object-location exposure.
4. **Expiry and recovery** — Add clock-driven expiry deletion, metadata
   preservation, typed post-expiry reads, replay-grant retry behavior,
   reconciliation, and least-privilege enforcement.
5. **Joint conformance and review** — Run the shared vectors against Crawler
   fakes and the durable provider, update runbooks/docs, then review before any
   separate live-source/canary proposal.

Each slice follows RED → GREEN → REFACTOR. No slice includes a live transport,
browser, credential, real source request, or canary execution.

### Test and validation strategy

- Contract tests reject V2-as-replay substitutions, media, missing bindings,
  grant/capture/caller mismatches, expired or consumed grants, and unknown
  contract versions.
- Replay tests prove exact digest/media verification, original-byte isolation,
  redaction before structured output, and that Rent Model/Backend/Explorer
  shapes cannot receive a raw body or object location.
- Storage tests prove HTML/JSON-only admission, 30-day clock boundaries,
  byte deletion with metadata/provenance preservation, typed unavailable
  results, grant single use, and object reconciliation without leakage.
- Conformance runs the same canonical vectors against memory fakes and the
  durable provider. Tests use frozen fixtures only; none contact a live source.
- Security tests inspect returned values and logs for raw bodies, object keys,
  URLs, credentials, and unsanitized errors.

### Risks and assumptions

- One-time grants prevent a replay read from becoming a reusable bearer URL,
  but require atomic consumption and clear retry semantics. A failed read after
  grant consumption must return a typed result; recovery must not widen access.
- Capture IDs are source-scoped and opaque at the boundary. If a later physical
  design considers them guessable, the port must use a Storage-issued opaque
  capture reference without changing the authorization rules.
- The new pre-redaction handoff is required before Storage can retain originals;
  current fixture/runtime behavior cannot be upgraded by configuration alone.
- This fixed MVP policy is not a source permission. Legal/compliance and
  source-specific approval remain a hard gate for live or canary work.

### Documentation and tracking after approval

After user approval of this plan addition, update the crawler-runtime and data
storage specifications, the listing-storage contract, the durable-provider
plan, and the crawler/Data Storage contract agreement to name the new version
and the raw-body/structured-output firewall. Then create one new Notion
planning task, not implementation work, titled:

`[crawler-runtime-foundation] Specify versioned original-response replay handoff`

That task must carry this lifecycle, ownership matrix, fixed MVP constraints,
explicit deferred live/compliance gates, and acceptance criteria for the
contract freeze. Only after its design is reviewed and accepted may the
implementation slices be broken into execution tasks.
