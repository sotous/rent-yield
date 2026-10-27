# Crawler First Real-World Canary

## Status

Approved for MVP implementation on 2026-10-07. The canary is the first
real-source milestone after the fixture and extraction foundation is complete.
Execution is tracked in Notion under Plan Slug
`crawler-first-real-world-canary`.

Seven execution tasks were created in
[Prototype v1 Tasks](https://app.notion.com/p/e859027b50fa4a228ec3184cd63d7a7a).
Ciencuadras is the selected MVP source candidate.

## MVP policy decision

The bounded-discovery run is operationally ready once Storage returns its active
source profile and local preflight passes. It has no candidate-registration, access-assessment,
trusted-reviewer, or approved-methodology gate. This is an MVP operational
rule, not a claim that a third party grants reuse rights. The crawler stops
immediately, without retry or evasion, whenever the source or transport signals
a block.

## Goal

Run one manually triggered, tightly bounded request path against Ciencuadras
for apparent long-term residential rentals in Barranquilla. Convert
the permitted response into a sanitized probe receipt, one redacted
source-derived fixture, and one normalized listing observation or typed
quarantine result.

This milestone proves the development contracts against real source behavior.
It does not activate scheduled or production crawling.

## Relevant specifications and prerequisites

- `specs/crawler-research-spec.md`
- `plan/crawler-research-and-methodology-foundation.md`
- `plan/colombian-listing-crawlers-and-ingestion.md`
- `docs/architecture/crawler-foundation-contract-agreement.md`
- `docs/architecture/listing-storage-contract.md`

Fixture redaction/integrity and offline extraction/provenance must be complete
before the live execution task. A checked-in canary configuration declares
allowed media types, exact discovery/detail paths, and query policy.

## Canary scope

- Geography: Barranquilla, Colombia.
- Listing role: `for_rent` and long-term residential only.
- Source count: Ciencuadras only.
- Trigger: one manual CLI invocation.
- Request path: at most one discovery request and one detail request.
- Concurrency: one.
- Redirects: at most one, revalidated before following.
- Authentication: none.
- Persistence: sanitized receipt, redacted fixture envelope and payload, and
  normalized output or quarantine report only.
- Images and other binaries: excluded.
- Scheduling, retries, pagination harvesting, and durable cursors: excluded.

The Storage-owned active discovery profile owns request, byte, duration, path,
and media-type limits. The command cannot widen them.

## Proposed approach

1. Load the immutable active Ciencuadras discovery profile from Storage. It
   declares exact HTTPS host/paths, accepted media types, and conservative
   budgets.
2. Implement a canary-only DNS/HTTPS transport behind the existing bounded
   probe port. Bind connections to validated public addresses and enforce all
   limits while streaming. Disable automatic redirects, preserve the validated
   hostname for TLS, enforce the exact remaining byte allowance before every
   request, and return the received body only through a bounded in-memory
   handoff to redaction.
3. Add a manual orchestration command with dry run, fixed-scope checks, and a
   local kill switch.
4. Keep received bytes in memory until deterministic redaction and the
   prohibited-data scanner pass. Never write the original response to Git.
5. Write the redacted payload and envelope, replay the parser, and
   emit a normalized observation or typed quarantine result with provenance and
   quality issues.
6. Review the evidence and decide whether to stop, repair, run
   another bounded canary, or propose production-source work.

## Required outputs

- Versioned Storage-owned Ciencuadras discovery profile and its deterministic
  provenance.
- Sanitized probe receipt.
- Redacted source-derived fixture envelope and separately hashed payload.
- Canonical source URL without credentials, query parameters, or fragment.
- Normalized observation with a stable `listing_url` when exposed by the
  source, field provenance, and versioned quality assessment; otherwise a
  lower-quality `missing_stable_listing_url` observation when stable source ID
  remains, or an explicit quarantine result when both are absent.
- Canary run report containing limits, timestamps, artifacts, failures, and no
  arbitrary response content.
- Retrospective and updated crawler runbook.

## Safety and stop conditions

Stop without retry or evasion on:

- robots denial or configured-scope mismatch;
- `401`, `403`, `429`, login, authentication, CAPTCHA, or challenge response;
- host, path, redirect, DNS, address, byte, duration, or request-budget failure;
- content type outside the active discovery profile;
- a caller-expanded scope or local kill-switch activation;
- prohibited data that cannot be deterministically removed; or
- parser drift that invalidates required fields or provenance.

The run must leave no credentials, cookies, arbitrary headers, original body,
contact details, exact unit identifiers, tracking parameters, or user-generated
personal data in committed artifacts.

## TDD delivery and validation

1. RED/GREEN transport conformance tests cover validated-address connection
   binding, TLS hostname handling, streaming limits, redirects, timeouts, and
   stop conditions without contacting a live source.
2. RED/GREEN orchestration tests cover dry run, fixed-scope and kill-switch
   hard canary limits, redaction-before-write, scanner failure, and typed
   output.
3. Existing fixture and extraction suites prove deterministic replay before the
   live invocation.
4. The live execution occurs once, only after its local preflight/dry-run
   checklist passes and the user explicitly authorizes that external request. It is
   validated by inspecting the sanitized artifacts rather than retaining the
   original response.
5. Root typecheck, lint, formatting, and tests remain green.

Success means a reviewer can trace one real bounded response from configured
scope through a sanitized receipt, redacted fixture, and normalized
observation or quarantine decision. Replaying the retained fixture must produce
the same result without another network request.

## Risks and assumptions

- Ciencuadras may block, challenge, or expose an incompatible response shape.
  The canary stops and records the typed result rather than switching sources.
- A client-rendered or challenge-protected source may not fit this HTTP-only
  canary. Browser automation requires a separate decision and plan.
- Query parameters may carry tracking or personal data and are removed from
  retained canonical URLs.
- Asking-rent semantics may be ambiguous. Ambiguous currency, frequency, fee
  scope, or area produces quarantine rather than guessed normalization.
- The first canary proves contract viability for one response shape, not source
  stability, data coverage, or production economics.

## Files and modules likely to change

- `apps/crawlers/src/ports/`
- `apps/crawlers/src/adapters/transport/`
- `apps/crawlers/src/application/`
- `apps/crawlers/src/cli/`
- `apps/crawlers/fixtures/`
- `packages/listing-storage-contracts/`
- `specs/crawler-research-spec.md`
- crawler runbooks and retrospective files under `docs/` and `plan/`

## Explicitly out of scope

- Scheduled or continuous crawling.
- Multiple sources, cities, or listing roles.
- Authentication, account creation, CAPTCHA handling, proxying, or evasion.
- Browser automation.
- Bulk pagination or inventory collection.
- Production credentials, queues, databases, object storage, or deployment.
- Deduplication, Rent Model execution, yield calculation, or explorer
  publication.
- Declaring a source production-ready from one canary.

## Execution task set

1. Define the Storage-owned Ciencuadras discovery profile and executable
   checklist.
2. Implement the bounded live DNS/HTTPS transport with offline conformance
   tests.
3. Implement the manual canary command and redaction-before-write pipeline.
4. Execute one Barranquilla rental canary and retain only approved artifacts.
5. Review the outcome and record the next-source decision.
6. Document the canary runbook, evidence, and retrospective.
