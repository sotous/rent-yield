# Crawler First Real-World Canary

## Status

Approved in principle on 2026-09-10. The canary is the first live-source
milestone after the fixture, extraction, and methodology-review foundation is
complete. Execution is tracked in Notion under Plan Slug
`crawler-first-real-world-canary`.

Seven execution tasks were created in
[Prototype v1 Tasks](https://app.notion.com/p/e859027b50fa4a228ec3184cd63d7a7a).
Execution begins with
[candidate-source selection and access assessment](https://app.notion.com/p/3d7dd70227408176be27db8cfdf2ecff).

The source itself is selected through the access-assessment task. No source is
authorized merely by this plan.

## Goal

Run one manually triggered, tightly bounded request path against one reviewed
public source offering long-term residential rentals in Barranquilla. Convert
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

Foundation tickets for fixture redaction and integrity, offline extraction and
provenance, methodology validation, and approved-effective lookup must be
complete before the live execution task. Source research and access assessment
may begin earlier.

The live gate also requires an authorization record from a trusted reviewer;
caller-supplied findings or the fixture-only homepage-derived scope cannot
grant live access. The approved methodology must declare allowed content types,
the exact discovery and detail paths, and whether a query string is permitted.

## Canary scope

- Geography: Barranquilla, Colombia.
- Listing role: `for_rent` and long-term residential only.
- Source count: one reviewed public source.
- Trigger: one manual CLI invocation.
- Request path: at most one discovery request and one detail request.
- Concurrency: one.
- Redirects: at most one, revalidated before following.
- Authentication: none.
- Persistence: sanitized receipt, redacted fixture envelope and payload, and
  normalized output or quarantine report only.
- Images and other binaries: excluded.
- Scheduling, retries, pagination harvesting, and durable cursors: excluded.

The approved methodology may impose stricter request, byte, duration, path, or
retention limits. The canary cannot widen them.

## Proposed approach

1. Select a candidate with apparent Barranquilla long-term rental coverage and
   record public terms, robots, API/feed, sitemap, privacy, and retention
   evidence.
2. Obtain an unexpired `allowed_for_probe` assessment and an approved-effective
   canary methodology for the exact source, city, capability, and listing role.
3. Implement a canary-only DNS/HTTPS transport behind the existing bounded
   probe port. Bind connections to validated public addresses and enforce all
   limits while streaming. Disable automatic redirects, preserve the validated
   hostname for TLS, enforce the exact remaining byte allowance before every
   request, and return the received body only through a bounded in-memory
   handoff to redaction.
4. Add a manual orchestration command with a dry run, explicit methodology
   identity, fail-closed access checks, and a local kill switch.
5. Keep received bytes in memory until deterministic redaction and the
   prohibited-data scanner pass. Never write the original response to Git.
6. Write the redacted payload and envelope, replay the approved parser, and
   emit a normalized observation or typed quarantine result with provenance and
   quality issues.
7. Review the evidence and decide whether to stop, revise the methodology, run
   another bounded canary, or propose production-source work.

## Required outputs

- Versioned source candidate and access assessment.
- Approved-effective canary methodology and exact digest.
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

Do not send a request unless access lookup returns one current, approved scope.
Stop without retry or evasion on:

- terms, robots, assessment, or methodology mismatch;
- `401`, `403`, `429`, login, authentication, CAPTCHA, or challenge response;
- host, path, redirect, DNS, address, byte, duration, or request-budget failure;
- content type outside the approved methodology;
- a missing trusted-reviewer authorization or a caller-derived live scope;
- prohibited data that cannot be deterministically removed; or
- parser drift that invalidates required fields or provenance.

The run must leave no credentials, cookies, arbitrary headers, original body,
contact details, exact unit identifiers, tracking parameters, or user-generated
personal data in committed artifacts.

## TDD delivery and validation

1. RED/GREEN transport conformance tests cover validated-address connection
   binding, TLS hostname handling, streaming limits, redirects, timeouts, and
   stop conditions without contacting a live source.
2. RED/GREEN orchestration tests cover dry run, access and methodology gates,
   hard canary limits, redaction-before-write, scanner failure, and typed
   output.
3. Existing fixture and extraction suites prove deterministic replay before the
   live invocation.
4. The live execution occurs once, only after its gate checklist passes, and is
   validated by inspecting the sanitized artifacts rather than retaining the
   original response.
5. Root typecheck, lint, formatting, and tests remain green.

Success means a reviewer can trace one real permitted response from assessment
and methodology through a sanitized receipt, redacted fixture, and normalized
observation or quarantine decision. Replaying the retained fixture must produce
the same result without another network request.

## Risks and assumptions

- A suitable public source may remain `unknown`, require commercial approval,
  or disallow the proposed access. In that case the canary stops and records
  the decision rather than switching sources silently.
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

1. Select the candidate source and record the access/retention decision.
2. Approve a canary methodology and executable gate checklist.
3. Implement the bounded live DNS/HTTPS transport with offline conformance
   tests.
4. Implement the manual canary command and redaction-before-write pipeline.
5. Execute one Barranquilla rental canary and retain only approved artifacts.
6. Review the outcome and record the next-source decision.
7. Document the canary runbook, evidence, and retrospective.
