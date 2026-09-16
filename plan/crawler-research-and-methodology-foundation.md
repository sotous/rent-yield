# Crawler research and methodology foundation

## Status

Proposed on 2026-09-04; approved with its 12-ticket execution breakdown on
2026-09-08. All 12 tickets were created as Not started in
[Prototype v1 Tasks](https://app.notion.com/p/e859027b50fa4a228ec3184cd63d7a7a),
using Plan Slug `crawler-research-and-methodology-foundation`.
This prerequisite supplies safe, versioned inputs to the fixture-backed
crawler workbench; it does not activate a real crawler.

Current execution status: tickets 1 through 10 are complete. Ticket 11 is in
progress; ticket 12 has not started. Normative crawler behavior and requirement traceability now live in
[`specs/crawler-research-spec.md`](../specs/crawler-research-spec.md).

Execution begins with [scope reconciliation and shared-contract agreement](https://app.notion.com/p/3d5dd702274081c09d9dccb38b5c537d).
Joint agreement with Data Storage blocks dependent shared-contract implementation.
The approved order is: contract agreement; test harness/runtime schemas;
candidate/access assessments; mocked probe rules; fixture redaction/integrity;
offline extraction/provenance; manifest proposals/validation; review/effective
lookup; memory ports/conformance; research skill; retrospective; documentation.
Offline fixture parsers are developed before methodology approval; approval
gates runnable methodology selection, not offline proposal validation.
Durable provider implementation remains with Data Storage. Chrome DevTools
installation and live exploration are not authorized by this breakdown.

The named follow-up is
[`plan/crawler-first-real-world-canary.md`](crawler-first-real-world-canary.md).
Its source research may begin independently, while its single live execution
remains blocked until foundation tickets 5 through 8 and the canary approval
gate are complete.

## Goal

### Ticket 11 execution refinement — 2026-09-16

Review the complete fixture-only workflow against the approved lifecycle and
run the crawler and shared-contract checks. Confirm that sale-price independence,
fee/area/date ambiguity, redaction, approval gates, immutable hashes, replay,
and idempotent ingestion are covered without a live network or database. Record
the outcome and any documentation gaps in a retrospective. Do not conceal
implementation or durable-provider work inside this review: Data Storage must
separately validate its durable provider against the shared conformance vectors.

### Ticket 10 execution refinement — 2026-09-14

Create the portable `.codex/skills/crawler-research/SKILL.md` as a runbook for
the already-tested fixture-only runtime tools in `apps/crawlers/src/`. It routes
candidate, assessment, fixture, extraction, validation, proposal, review, and
handoff work without replacing the runtime or creating duplicate skills under
other agent directories. It must stop on typed failures, preserve provenance,
keep raw sensitive captures out of prompts, and explicitly prohibit live source
access, permission declarations, and methodology activation.

### Ticket 9 execution refinement — 2026-09-14

Define the agreed v1 ingestion submission, immutable receipt, receipt-status,
and sanitized failure schemas in the shared contract package, then implement an
offline memory provider in Crawlers. Submission identity will bind source,
capture event, immutable capture metadata/body digest, methodology and adapter
identity, and normalized outcome; it excludes the idempotency key and receipt
state. The provider will keep idempotency source-scoped, preserve the original
receipt on exact retry, reject changed payloads under the same key, and retain
distinct capture events when new keys carry matching bytes.

Publish contract-owned reusable conformance vectors for lookup, ingestion,
receipt lifecycle, and typed failures. Crawler runs them against its memory
provider; Data Storage can import the same vectors for a durable provider later.
Start with failing vector tests for replay, conflict, distinct captures,
quarantine, failure sanitization, and source-health behavior. This remains
fixture-only: no database, object store, scheduler, real credentials, or source
access is introduced.

### Ticket 8 execution refinement — 2026-09-14

Implement the existing review-lifecycle and effective-methodology lookup task as
an append-only, in-memory fixture-workbench boundary. Proposal intake verifies
the canonical manifest and report hashes and adapter registration; it never
approves or activates a proposal. Failed reports remain review evidence, while
an approval requires the exact hash of a passed report. A separate trusted review
input receives a repository-assigned sequence. Resolver inputs supply both
effective and recorded-as-of clocks and require an exact v1 scope.

The resolver must fail closed for invalid or missing proposal pins, expired
rechecks, incompatible adapters, no eligible approval, competing approved
manifests, non-approval lifecycle states, and later health blocks. A later
trusted approval may resume a health-paused methodology. Tests begin RED-first
for event ordering, interval boundaries, recorded cutoffs, ambiguity, hash and
adapter substitution, validation-report mismatch, health pause/reactivation,
and input-order determinism. This does not provide real reviewer identity,
durable storage, policy authorization, or network execution.

### Ticket 7 execution refinement — 2026-09-14

Build the existing immutable-manifest and fixture-validation task as a pure,
offline application slice. It accepts only declarative, schema-valid v1
manifests; canonicalizes declared sets before hashing; validates adapter identity
against an injected registry; and replays only integrity-checked, manifest-pinned
fixtures through their exact extraction contracts. Results are sanitized reports
that pin the manifest, adapter, fixture, and extraction hashes.

Proposal production has no approval, publication, persistence, clock, or
transport capability. A failed report remains reviewable evidence but cannot be
used by the later approval lookup. Tests will begin RED-first with semantic-set
hash stability, immutable hash inputs, registry mismatches, pin mismatches,
fixture replay outcomes, and failure sanitization. No live source, browser,
credential, storage-provider, or review-decision work is in scope.

### Ticket 6 execution refinement — 2026-09-12

Continue the existing [offline extraction task](https://app.notion.com/p/3d5dd7022740810f9cf6f9a5a79889f9)
from the clean PR #6 merge (`654f2d1`). This is an implementation refinement of
the approved slice, not a new task or live-source authorization.

- Add additive v1 observation, field-provenance, rental-evidence, and extraction
  outcome schemas under the existing joint contract agreement. Preserve legacy
  draft DTOs. Storage providers and model execution remain separate.
- Infer declarative mappings for the representative JSON fixture vocabulary;
  replay only JSON pointers and allowlisted transforms. Unsupported HTML/text
  locators fail explicitly until representative fixtures justify an adapter.
- Support one listing, listing arrays, and separate offers on a listing. Empty
  discovery with an explicit pagination end is capture-only; shape drift is a
  parse failure. No dynamic code, source requests, or implicit approval.
- Preserve raw scalar values and absolute paths, transform/parser versions,
  immutable fixture links, source dates, collection time, identity candidates,
  separate fees, and built/private/interior area claims. Never invent dates or
  infer base rent from a separate administration fee alone.
- Admit rental evidence only for permitted-source, active, long-term residential
  offers with positive base monthly COP rent and explicit positive built area.
  Keep synthetic replay distinct from observed evidence. Sale observations never
  enter the rental DTO, including in dual-offer fixtures.
- Canonical stable listing URLs must be explicit HTTPS detail locators (no
  query/fragment/credentials); envelope origin is not a fallback listing URL.
  Versioned quality rules deduct for missing URLs and keep blocking issues
  explicit. Stable source ID plus fixture provenance permits a missing URL;
  absence of both identifiers quarantines.
- Work primarily in `apps/crawlers/src/application`, shared contracts, focused
  synthetic fixtures/tests, crawler README/spec, and a ticket retrospective.
- Validate through repeated RED/GREEN cycles for contracts, replay/provenance,
  URL/identity, ambiguity, rental isolation, drift, and integrity. Finish with
  repository checks and a reviewable PR targeting `main`.

Risks: source wording is not universal; inference is fixture-vocabulary-specific
and never asserts source permission. Decimal parsing must preserve precision
and reject ambiguous locale formatting. Mixed-quality payloads must retain
rejected claims without letting clean offers conceal quarantine.

Produce consumable source candidates, access assessments, permitted probe
results, redacted fixtures, extraction contracts, approved methodology
manifests, and a shared crawler/Data Storage contract.

```text
candidate -> access assessment -> permitted probe -> redacted fixture
  -> extraction contract -> proposed manifest -> fixture validation
  -> human/compliance decision -> approved-effective methodology
  -> future crawler adapter
```

## Scope and ownership

| Owner            | Responsibility                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| Crawlers         | Research skill/tools, fixture and methodology producers, adapter registry, in-memory fakes, consumer tests. |
| Data Storage     | Durable persistence, object storage, migrations, provider tests, retention enforcement, snapshots.          |
| Joint            | Versioned DTOs/schemas, conformance vectors, approval of breaking contract changes.                         |
| Human/compliance | Permission, probe authorization, methodology approval/pause/retirement/reactivation.                        |

Out of scope: production source adapters, scheduled/live crawling, database or
object-storage clients, credentials, CAPTCHA/auth bypass, and Rent Model
execution.

## Decisions

### Policy-controlled lifecycle

Use append-only lifecycle records:

```text
candidate -> researching -> access_unknown | access_blocked | probe_permitted
probe_permitted -> probed -> methodology_proposed -> pending_review
pending_review -> approved_active | paused | rejected | retired
```

- An access assessment returns `allowed_for_probe`, `approval_required`,
  `disallowed`, or `unknown`. Only `allowed_for_probe` permits an automated
  probe; all other outcomes fail closed.
- A methodology is runnable only when approved, effective, non-revoked, and
  non-paused. Policy changes, access blocks, or parser drift pause it.
- Corrections create a new version. Resume requires a new review decision.

### Crawler Research skill and deterministic tools

The skill guides research; tools have strict typed input/output contracts:

- `registerSourceCandidate`
- `inspectSourceAccess`
- `probeListingDiscovery`
- `captureRedactedFixture`
- `inferExtractionContract`
- `validateMethodologyFixtures`
- `proposeMethodology`

AI may summarize public evidence and suggest mappings, but it cannot declare
permission, activate a methodology, create credentials, or receive raw
sensitive captures by default. Its proposals validate against schemas and
declare confidence and unknowns.

### Bounded probe policy

Probe restrictions are enforced in code:

- HTTPS plus approved host/path allowlists; every redirect is revalidated.
- Reject loopback, private, link-local, and metadata-service IPs.
- No credentials, cookies, authentication, account creation, proxying, or
  arbitrary headers.
- Fixed request, byte, duration, redirect, concurrency, and source-budget caps.
- Stop without evasion/retry on robots conflict, policy mismatch, `401`, `403`,
  `429`, CAPTCHA/challenge, or authentication requirement.
- Emit a sanitized receipt with policy/assessment version and reason code.

### Declarative methodology manifest

Methodologies are schema-validated canonical JSON, content-addressed by
SHA-256, and never executable code. The immutable payload excludes its own
hash and mutable review/lifecycle state. A manifest pins:

- source, Colombian geography, methodology capability, and allowed
  `for_sale`/`for_rent` listing roles;
- assessment/evidence hashes and recheck requirements;
- adapter key/artifact hash, parser/normalizer compatibility, and contract
  version;
- host/path scope, permitted operations, strategy type, budgets, limits, and
  circuit-breaker policy;
- fixture and extraction-contract hashes, mappings, allowed transforms,
  redaction, and retention requirements.

Validation reports reference exact payload, fixture, and adapter hashes.
Append-only privileged review decisions reference the payload and validation
report and carry effective/recording times. Resolution returns payload/hash
plus the effective decision. This avoids circular hashes and permits offline
validation before approval. Detailed joint boundary decisions are in
`docs/architecture/crawler-foundation-contract-agreement.md`.

The crawler resolves exactly one approved-effective methodology by source,
geography, capability, listing role, and time. It verifies the hash/schema and
uses the allowlisted adapter registry before network I/O. Unknown, incompatible,
paused, or retired manifests fail closed.

Mappings use restricted locators and allowlisted transforms only—never scripts,
arbitrary selectors, headers, credentials, proxies, or URLs.

### Fixture and Rent Model boundary

The foundation owns a `FixtureEnvelope` standard, not production raw-data
storage. Fixture classes are clearly separate:

- redacted permitted-source fixtures for parser/provenance fidelity;
- synthetic edge-case fixtures, never represented as source claims.

Each fixture envelope pins payload/redaction digests, source-or-synthetic origin,
timestamps, content metadata, permitted-use/retention class, methodology
research session, parser compatibility, expected classification, and the
superseded fixture when corrected. A fixture cannot reference a methodology
proposal that is created later in the lifecycle; the eventual proposal pins the
fixture digest instead.

A permitted-source origin requires the canonical HTTPS page URL without
credentials, query parameters, or a fragment, plus source key, collection time,
assessment digest, and original entity-body digest. A synthetic origin records
only its scenario and generation time and cannot claim source provenance.
Extraction retains a stable canonical listing URL when available; otherwise it
records `null`, the `missing_stable_listing_url` issue, and a lower deterministic
quality index under a versioned scoring ruleset. A missing URL alone is
non-blocking when stable source identity and immutable capture provenance
remain available; missing both a stable URL and stable source listing ID
quarantines the result. The fixture envelope remains the authoritative origin
even when the redacted payload contains URL-shaped source content.

The foundation does not archive production raw documents or source-policy
pages. Its durable counterpart retains a full permitted source response only
for parser replay or evidence audit; it records policy-page URLs, metadata, and
minimal supporting excerpts unless compliance requires a permitted full
snapshot.

Redact before Git/mock storage. Default-exclude images/binaries; remove or
deterministically replace contacts, exact units, agent/owner identifiers,
cookies, tokens, tracking parameters, and user-generated PII. Preserve parser
paths plus price/currency/frequency, fee scope, built-area kind/value,
city/area-level geography, source dates, and operation. CI scanners reject
secrets, prohibited PII, and binaries/images.

Only positive, observed, base, monthly COP rent can become rental evidence.
Unknown currency, frequency, or fee scope is quarantined; built area is never
substituted with private/interior area. Rental-evidence DTOs contain no sale
price. Model-relevant fields retain raw value, path, transform, and typed
quality issues.

### Shared contract

`@rent-yield/listing-storage-contracts` is jointly owned. It exports TypeScript
DTOs, Zod validators, JSON Schemas, examples, typed errors, and conformance
tests. All envelopes include `contract_version: "v1"`; breaking changes require
a new major version.

The contract must provide:

- methodology lookup by source, geography, capability, listing role, effective
  time, and accepted contract version, returning the manifest and hash;
- proposal intake for research tools, with no crawler operation able to approve
  or publish;
- ingestion request idempotency key, canonical payload hash, capture event ID,
  methodology hash, and adapter/parser build identity;
- immutable initial receipts (`accepted`, `committed`, `quarantined`), separate
  progress lookup and duplicate-delivery metadata, and typed
  failures for policy block, incompatibility, validation, idempotency conflict,
  and unavailable storage;
- typed sanitized source-health events.

The same conformance suite runs against crawler memory fakes and Data Storage's
durable provider. Replaying the same idempotency key/payload returns the same
receipt; key reuse with a new payload rejects; a new key creates a new capture
event even when bytes match. Reinterpreting the same immutable capture with a
new parser/normalizer and submission key appends an interpretation, not another
fetch. Capture-only, parse-failed, quarantined and multi-observation outcomes
must not require fabricated observation identifiers.

## TDD delivery slices

1. Define schemas for candidates, assessments, probes, fixtures, extraction
   contracts, manifests, review decisions, health events, and versions.
2. RED/GREEN lifecycle and access assessment rules, including fail-closed probe
   authorization and policy-recheck pausing.
3. RED/GREEN bounded-probe validation: host, redirect, IP, budget, and
   challenge/rate-limit stop behavior.
4. RED/GREEN fixture envelope, deterministic redaction, prohibited-data scanner,
   immutable successors, and synthetic-fixture labels.
5. RED/GREEN extraction/replay/provenance, rent-fee-area-date semantics, and
   typed quarantine.
6. RED/GREEN manifest canonicalization, hashing, resolver, adapter compatibility,
   and fail-closed validation.
7. Extend shared contracts; run identical consumer/provider conformance vectors
   against memory fakes and Data Storage.
8. Document the skill/tool runbook, retrospective, and crawler-plan consumption.

## Minimum fixture corpus

- valid rent-only, sale-only, and dual-offer listings;
- separate, included, and ambiguous administration/utility fees;
- non-COP/non-monthly/unknown-currency rent;
- built/private/interior conflict plus missing/invalid area;
- source-date precedence and ambiguity;
- contact/PII-heavy redaction input;
- pagination end, inactive listing, `403`, `429`, challenge, and parser drift.

## Success criteria

- Unknown/blocked sources cannot probe; host escapes and private targets fail.
- Every approved methodology is immutable, hash-verified, and deterministic.
- Fixtures are replayable and contain no prohibited data.
- Rent evidence traces to a redacted source path and excludes sale price and
  ambiguous rent/area semantics.
- Memory fakes and durable storage pass the same conformance suite without live
  source requests.

## Risks

- Robots rules do not confer legal permission: record technical and contractual
  decisions separately; absence of robots restrictions is not authorization.
- Unsafe agent exploration: hard probe policy, strict schemas, and human gates.
- Fixture privacy/license exposure: deterministic redaction, minimal retention,
  restricted intake, and CI scanning.
- Configuration/code drift: manifest hashes, adapter artifact hashes, and shared
  contract vectors.
