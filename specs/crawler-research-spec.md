# Crawler Research and Fixture Workbench Specification

## Purpose

This specification defines the current crawler research foundation for
`rent-yield`. It is the source of truth for source research, fixture-only probe
simulation, shared research contracts, and the boundary with future production
crawlers and Data Storage.

The workbench exists to turn reviewed source evidence into deterministic,
replayable crawler inputs without making live crawling an implicit part of
development.

## Status

Foundation tickets 1 through 4 are complete. Fixture capture,
extraction, methodology resolution, storage conformance, the research skill,
and production adapters remain later work.

The approved execution plan is
[`plan/crawler-research-and-methodology-foundation.md`](../plan/crawler-research-and-methodology-foundation.md).

## Product and Domain Alignment

- Colombia is the only supported country in version one.
- Barranquilla is the first research city.
- For-sale and for-rent offers remain separate source observations.
- A sale asking price never becomes rental evidence or a modeled rent input.
- Crawlers preserve source claims and uncertainty; they do not calculate rent,
  gross rent yield, or sale-to-rent ratio.
- The backend explorer consumes a future curated projection. It does not expose
  crawler, raw-capture, or storage-provider internals.

## Current Scope

The current foundation provides:

- strict versioned schemas and synthetic examples;
- canonical JSON and schema-declared set handling;
- append-only in-memory source candidate registration;
- candidate-version-bound access assessments;
- fail-closed probe authorization;
- bounded listing-discovery simulation through an injected mock transport;
- sanitized probe receipts containing metadata and body digests rather than
  response bodies.

It does not provide a production HTTP or DNS adapter, live source access,
credentials, a browser, scheduling, retries, durable storage, source activation,
or Rent Model execution.

The first planned live-source boundary is the separately gated
[`crawler-first-real-world-canary`](../plan/crawler-first-real-world-canary.md).
It may execute once only after fixture redaction, extraction/provenance,
methodology validation, effective lookup, source assessment, and canary
preflight requirements pass.

## Required Research Lifecycle

```text
candidate -> access assessment -> permitted probe -> redacted fixture
  -> extraction contract -> proposed manifest -> fixture validation
  -> human/compliance decision -> approved-effective methodology
  -> future production adapter
```

Only an unexpired `allowed_for_probe` assessment for the current candidate
version permits a probe. Unknown, missing, ambiguous, blocked,
approval-required, and expired assessments fail closed. Candidate corrections
create a new candidate identity and invalidate inherited access.

Methodology approval is a later and separate authority. A successful probe does
not approve a source or make a methodology runnable.

## Bounded Probe Requirements

### Authorization and target scope

- The access gate supplies the authoritative assessment ID, assessment digest,
  allowed hosts, allowed path prefixes, and maximum budgets.
- Callers may request narrower constraints but cannot widen gate constraints.
- The start URL and every redirect must use HTTPS, contain no credentials, and
  remain within the effective host and path scope.
- Ambiguous percent-encoded path separators and dot segments are rejected.
- Cookies, arbitrary headers, proxies, account creation, and authentication
  material are outside the command contract.

The memory gate currently derives its host and path constraint from the current
candidate's `homepage_url`. This is a fixture-only bridge until approved
methodology lookup supplies the manifest's explicit `access_scope`. A candidate
URL whose path is `/listings` therefore authorizes only that path subtree in the
current workbench. This derivation must not be reused as production policy.

### Network boundary

- DNS resolution receives the remaining timeout and returns either validated
  addresses or explicit budget exhaustion.
- Every resolved address must be globally routable. Loopback, private,
  link-local, metadata, documentation, translated, mapped, and other special-use
  ranges fail closed.
- The transport request receives the validated address set. It must connect to
  one of those addresses while retaining the URL hostname for TLS verification,
  SNI, and the HTTP host.
- Redirects repeat URL validation and DNS resolution before another request.
- The mock transport is the only transport supplied by this foundation.

### Budgets and stopping

The fixture-only memory gate currently caps a probe at:

| Budget                         |  Maximum |
| ------------------------------ | -------: |
| Requests per probe             |        3 |
| Response bytes                 |    1,024 |
| Duration                       | 1,000 ms |
| Redirects                      |        1 |
| Concurrent requests per source |        1 |
| Requests per source ledger     |        4 |

These are conservative workbench defaults, not production recommendations.
Approved methodology manifests will own production limits.

The transport receives the remaining response-byte and time allowance before
each request. It must stop reading when either allowance is exhausted and return
a typed budget outcome with only the bytes received. The source ledger binds its
first effective request and concurrency policy and rejects later attempts to
raise it.

The probe stops without retry or evasion on policy or robots conflict, `401`,
`403`, `429`, challenge detection, authentication requirements, scope escape,
non-public or substituted addresses, unexpected HTTP failures, and exhausted
budgets.

### Receipt evidence

Every result records the gate-supplied assessment reference when available,
scope, budget, usage, completion time, and a typed outcome. Response evidence is
bounded and sanitized:

- URL without credentials, query, or fragment;
- collection time, status, and content type;
- complete entity-body SHA-256 and byte length; or
- partial received-body SHA-256 and byte length after a budget cutoff;
- sanitized redirect location when present.

Response bodies, credentials, headers, cookies, tokens, and arbitrary source
content never enter a probe receipt.

## Fixture Product and URL Traceability

A development fixture is a pair of immutable artifacts:

- a fixture envelope containing origin, integrity, retention, compatibility,
  research-session, lineage, and expected-classification metadata; and
- a separate UTF-8 payload containing the redacted HTML, JSON, or text replayed
  by a parser.

For a permitted-source fixture, `origin.source_url` is required and identifies
the page whose response produced the fixture. The retained URL must use HTTPS
and must be canonicalized without credentials, query parameters, or a fragment.
`origin.source_key`, collection time, the governing assessment digest, and the
original entity-body digest preserve the rest of the acquisition trace.

A synthetic fixture records only its scenario and generation time. It must not
claim a real source URL, source key, assessment, or original entity digest. If a
synthetic scenario needs a URL-shaped value inside its payload, it must use a
reserved non-source example and remains synthetic evidence.

Every fixture references the research session that created it. Because fixture
capture precedes methodology proposal in the lifecycle, the fixture never
claims a future proposal identity. A later proposal pins the immutable fixture
digest. Corrections are append-only: the new fixture records
`supersedes_fixture_id`, while the predecessor remains unchanged.

Extraction produces a separate normalized observation. It retains the
canonical source listing URL as `listing_url` when the source exposes a stable
listing locator. If no stable locator exists, `listing_url` is `null`, the
observation records `missing_stable_listing_url`, and its deterministic quality
index must be lower than an otherwise identical observation with a stable URL.
The index uses an explicitly versioned scoring ruleset and cannot conceal
blocking quality issues. A missing URL alone does not quarantine an observation
when a stable source-qualified listing ID and immutable capture provenance are
available. If both the stable URL and stable source listing ID are unavailable,
the result is quarantined rather than normalized.

The normalized observation also links every model-relevant value to field
provenance and, through the ingestion boundary, to the immutable fixture or raw
capture. A URL inside the redacted payload is source content; the envelope
origin is the authoritative fixture provenance.

## Shared Contract Boundary

`@rent-yield/listing-storage-contracts` owns the strict runtime schemas,
TypeScript types, examples, JSON Schema projections, and canonicalization
helpers. Runtime validation is authoritative where JSON Schema cannot represent
refinements.

Data Storage owns durable providers, object storage, migrations, retention
enforcement, and provider conformance. Current memory repositories simulate
behavior only and make no durability claim.

## Requirement Traceability

| ID     | Requirement                                                       | Execution ticket | Implementation                                                | Verification                                          | Status      |
| ------ | ----------------------------------------------------------------- | ---------------: | ------------------------------------------------------------- | ----------------------------------------------------- | ----------- |
| CR-001 | Fixture/mock-only boundary; no live adapter                       |              1–4 | `apps/crawlers` has only injected ports and memory workflows  | `workbench.test.ts`, `bounded-probe.test.ts`          | Implemented |
| CR-002 | Strict v1 research and methodology envelopes                      |                2 | `packages/listing-storage-contracts/src`                      | package schema, catalog, example, and canonical tests | Implemented |
| CR-003 | Append-only candidate versions and idempotent retry               |                3 | `source-research.ts`                                          | `source-research.test.ts`                             | Implemented |
| CR-004 | Candidate-bound, fail-closed access assessment                    |                3 | `source-research.ts`                                          | `source-research.test.ts`                             | Implemented |
| CR-005 | Trusted assessment, host, path, and budget constraints            |                4 | `source-research.ts`, `bounded-probe.ts`                      | target and budget substitution tests                  | Implemented |
| CR-006 | HTTPS, path, redirect, credential, and encoded-path validation    |                4 | `bounded-probe.ts`                                            | bounded target and redirect cases                     | Implemented |
| CR-007 | Deadline-aware DNS and validated-address connection binding       |                4 | `probe-transport.ts`, `bounded-probe.ts`                      | timeout, rebinding, and substituted-address cases     | Implemented |
| CR-008 | Request, byte, time, redirect, source, and concurrency limits     |                4 | `bounded-probe.ts`                                            | boundary, partial-response, and shared-ledger cases   | Implemented |
| CR-009 | Stop without retry on access, status, auth, or challenge failures |                4 | `bounded-probe.ts`                                            | typed stop-reason cases                               | Implemented |
| CR-010 | Sanitized receipt with complete or partial body evidence          |                4 | `research.ts`, `bounded-probe.ts`                             | schema and deterministic receipt cases                | Implemented |
| CR-011 | Redacted fixtures, source-URL traceability, integrity, successors |                5 | `fixture-capture.ts`, committed synthetic fixture, CI scanner | fixture capture, directory, and shared-contract tests | Implemented |
| CR-012 | Extraction, URL quality penalty, provenance, and quarantine       |                6 | Pending                                                       | Pending RED tests                                     | Planned     |
| CR-013 | Manifest proposal, validation, review, lookup, and conformance    |              7–9 | Schemas exist; application behavior pending                   | Schema tests currently; behavior tests pending        | Partial     |
| CR-014 | Agent research skill, workflow review, and runbook                |            10–12 | Pending                                                       | Workflow review pending                               | Planned     |

## Completion Gates

A foundation ticket is complete only when its Notion state, plan, executable
behavior, tests, retrospective, and affected documentation agree. Production
crawling requires a separate approved plan and cannot begin from this
fixture-only specification alone.
