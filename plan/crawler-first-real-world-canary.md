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

Run one manually triggered, tightly bounded Ciencuadras request sequence for
apparent long-term residential rentals in Barranquilla. It checks the source's
robots policy first and makes one discovery request only when that policy
permits the fixed discovery path. Convert the permitted response into a
sanitized probe receipt, one redacted source-derived fixture, and an explicit
capture-and-quarantine result.

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
allowed media types, one exact discovery path, and the robots-policy endpoint.

## Canary scope

- Geography: Barranquilla, Colombia.
- Listing role: `for_rent` and long-term residential only.
- Source count: Ciencuadras only.
- Trigger: one manual CLI invocation.
- Request path: one robots-policy request followed by at most one fixed
  discovery request; no detail request in this first run.
- Concurrency: one.
- Redirects: at most one, revalidated before following.
- Authentication: none.
- Persistence: sanitized receipt, redacted fixture envelope and payload, and
  capture-and-quarantine report only.
- Images and other binaries: excluded.
- Scheduling, retries, pagination harvesting, and durable cursors: excluded.

The Storage-owned active discovery profile owns request, byte, duration, path,
and media-type limits. The command cannot widen them.

## Proposed approach

1. Load the immutable active Ciencuadras discovery profile from Storage. It
   declares exact HTTPS host/path, a robots-policy endpoint, accepted media
   types, and conservative budgets. Its two-request budget is reserved for
   robots policy and one discovery request.
2. Implement a canary-only DNS/HTTPS transport behind the existing bounded
   probe port. Bind connections to validated public addresses and enforce all
   limits while streaming. Disable automatic redirects, preserve the validated
   hostname for TLS, enforce the exact remaining byte allowance before every
   request, and return the received body only through a bounded in-memory
   handoff to redaction.
3. Add a terminal command that requires exactly one explicit mode: `--dry-run`
   for local profile/preflight output with no DNS or HTTP, or `--live` for the
   separately user-authorized bounded invocation. It must reject omitted or
   conflicting modes, preserve the local kill switch, validate artifact-output
   readiness, and print only sanitized typed output. Detect robots denial,
   login/CAPTCHA/challenge pages, and media-policy mismatches before capture.
4. Keep received bytes in memory until deterministic redaction and the
   prohibited-data scanner pass. Never write the original response to Git.
5. Write the redacted payload and envelope, and emit a sanitized receipt and
   capture-and-quarantine report with profile provenance. Parser replay and
   normalized submission are deferred until a parser is selected from the
   retained, redacted fixture.
6. Review the evidence and decide whether to stop, repair, run
   another bounded canary, or propose production-source work.

## Required outputs

- Versioned Storage-owned Ciencuadras discovery profile and its deterministic
  provenance.
- Manual terminal command with a network-free dry-run and an explicit live mode.
- Sanitized probe receipt.
- Redacted source-derived fixture envelope and separately hashed payload.
- Canonical source URL without credentials, query parameters, or fragment.
- Sanitized probe receipt and canary run report containing limits, timestamps,
  artifacts, failures, and no arbitrary response content.
- Explicit capture-and-quarantine result carrying profile provenance.
  Normalization is not a prerequisite of this first canary.
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
2. RED/GREEN orchestration tests cover the robots-then-discovery sequence,
   dry-run output-path and kill-switch checks, fixed-scope limits, profile media
   enforcement, challenge detection, redaction-before-write, scanner failure,
   and typed receipt/report output.
3. Existing fixture and extraction suites prove deterministic replay before the
   live invocation.
4. The live execution occurs once, only after its local preflight/dry-run
   checklist passes and the user explicitly authorizes that external request. It is
   validated by inspecting the sanitized artifacts rather than retaining the
   original response.
5. Root typecheck, lint, formatting, and tests remain green.

Success means a reviewer can trace one real bounded response from configured
scope through a sanitized receipt, redacted fixture, and capture-and-quarantine
decision. A future parser must be able to replay the retained fixture without
another network request.

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

## Implementation retrospective — 2026-10-10

The implementation met the revised MVP boundary: the source profile, not the
CLI, owns the exact robots and discovery paths; the two-request budget is
consumed in that order; and a robots denial, unsupported media type, or
high-confidence challenge/authentication page stops before fixture capture.
The local command now validates its output target and emits a body-free receipt
with either a typed stop or capture-and-quarantine report.

The original plan overreached by requiring a detail request, parser replay, and
normalized submission in the first real-source operation. Those need a pinned
parser and a separate follow-up decision, so they are intentionally deferred.
The ergonomics are appropriate for an MVP operator: dry run is explicit and
network-free, while live mode remains an opt-in command requiring separately
supplied writable output location and fixture ID.

Offline validation passed across the workspace. No live source request has
been made; after merge, run the same dry-run command from `main`, review its
sanitized output, then obtain explicit authorization for the one live command.

## Execution task set

1. Define the Storage-owned Ciencuadras discovery profile and executable
   checklist.
2. Implement the bounded live DNS/HTTPS transport with offline conformance
   tests.
3. Implement the manual canary command and redaction-before-write pipeline.
4. Execute one Barranquilla rental canary and retain only approved artifacts.
5. Review the outcome and record the next-source decision.
6. Document the canary runbook, evidence, and retrospective.
