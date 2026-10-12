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

Offline validation passed across the workspace. The later authorized live run
is recorded in the iteration below; any subsequent run still requires a
merged-main dry run and new explicit authorization.

## Canary iteration 2 — 2026-10-12

The first authorized run proved the robots-first sequence and all stopping
boundaries. Its robots response used 580 bytes; the discovery response reached
the remaining 64,956 bytes, exhausting the 65,536-byte total budget before a
complete body could be redacted. The command retained no original body and
wrote no fixture.

This iteration changed only the Storage-owned `max_bytes` budget from 65,536
bytes (64 KiB) to 262,144 bytes (256 KiB). It preserved one robots-policy
request followed by at most one discovery request, one redirect, one concurrent
request, ten-second duration, the same host/path/media scope, and every typed
stop condition. The separately authorized run also exhausted this budget, after
receiving 261,564 discovery bytes; no fixture or original body was retained.

Success is a complete bounded discovery response that can pass redaction and
produce a source-derived fixture or a typed quarantine result. A second budget
exhaustion remains a valid stop and triggers evidence review rather than an
automatic limit increase.

## Canary iteration 3 — 2026-10-12

The first two attempts established that the configured discovery page exceeds
both 64 KiB and 256 KiB. For the MVP, byte size is not a source-approval or
business gate: the active Storage profile now uses a 10 MiB technical failsafe
(`max_bytes: 10,485,760`) to prevent an unbounded in-memory response while
allowing ordinary modern listing pages to complete. The profile is advanced to
version 3 so any fixture or receipt attributes this change unambiguously.

The request count, duration, redirects, concurrency, host/path scope, media
policy, robots-first order, redaction-before-write rule, and all typed blocks
remain unchanged. This explicit user-authorized invocation tests the new
profile once; it does not establish a precedent for automatic retries or a
further automatic limit increase.

## Canary iteration 4 — 2026-10-12

The version-3 run received the complete 496,229-byte discovery response within
the 10 MiB transport cap. It then exposed a separate, older 64 KiB
inline-redacted-fixture contract limit: the artifact handoff correctly declined
to persist an oversized redacted payload, but reported it as a generic
`transport_error`.

For the MVP, the inline redacted-fixture limit is raised to the same 10 MiB
technical failsafe. The handoff now emits the explicit
`capture_limit_exceeded` typed stop if that limit is reached in the future.
This preserves redaction-before-write and raw-body disposal; it does not retain
an original response or broaden any live request scope.

## Canary iteration 5 — 2026-10-12

With both the transport and inline-fixture limits at 10 MiB, the next
authorized run again completed the 496,229-byte discovery response (496,809
bytes including robots) in 2.264 seconds and made no redirects. No fixture was
written because the in-memory capture path rejected the HTML before its writer,
but the old result exposed this only as `transport_error`.

The remediation keeps that rejection raw-free and observable: HTML may first
strip removable media and `data-*` attributes, then must pass the final
prohibited-data scan; non-HTML embedded binary and any remaining prohibited
data still stop. Manual output now returns a constrained `capture_rejected`
reason (rather than an ambiguous transport failure). No live retry is made by
the remediation itself; one remains separately user-authorized work after
review of the merged change.

## Execution task set

1. Define the Storage-owned Ciencuadras discovery profile and executable
   checklist.
2. Implement the bounded live DNS/HTTPS transport with offline conformance
   tests.
3. Implement the manual canary command and redaction-before-write pipeline.
4. Execute one Barranquilla rental canary and retain only approved artifacts.
5. Review the outcome and record the next-source decision.
6. Document the canary runbook, evidence, and retrospective.
