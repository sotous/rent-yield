# Crawler project status review — 2026-09-12

## Review scope

Three independent reviews examined the crawler research specification, current
implementation, foundation plan, and first real-world canary plan. This record
reconciles their findings after fixture ticket 5 was implemented.

## Current status

Foundation tickets 1 through 5 are implemented. The repository now has strict
research contracts, append-only candidate and assessment workflows, a bounded
mock probe, deterministic redacted fixture capture, immutable fixture lineage,
integrity hashes, a committed synthetic fixture, and a sanitized fixture
directory scanner. No live network adapter exists.

The research and methodology direction remains sound: permission decisions are
separate from technical discovery, unknown access fails closed, methods are
declarative and content-addressed, source bytes are redacted before retention,
and approved-effective lookup is the future execution boundary.

## Remaining foundation path

1. Ticket 6: offline extraction, field provenance, versioned quality scoring,
   stable listing URL behavior, and typed quarantine.
2. Ticket 7: methodology proposal and fixture validation application behavior.
3. Ticket 8: trusted review decisions and approved-effective lookup.
4. Tickets 9–12: memory provider conformance, research skill, retrospective,
   and final documentation.

Tickets 6–8 block the live canary. Tickets 9–12 complete the foundation and
prove the full shared boundary.

## Canary readiness gaps

The canary must not run until all of these are executable and tested:

- A reviewer-authorized access record that cannot be synthesized from caller
  flags or the candidate homepage.
- A methodology that declares allowed content types plus exact discovery,
  detail, host, path, and query scope.
- A bounded live transport that disables automatic redirects, connects only to
  a validated public address, verifies TLS with the source hostname, checks the
  remaining byte allowance before each request, and streams no more than that
  allowance.
- An in-memory response-byte handoff from the transport to deterministic
  redaction. Probe receipts remain sanitized and body-free.
- A manual command with dry run, kill switch, atomic artifact writes, and a
  sanitized run report.
- One selected Barranquilla rental source with a current access assessment and
  approved-effective canary methodology.

The bounded-probe contract also needs a focused pre-canary correction: reject a
request before transport when no byte budget remains, and reject transport
outcomes whose usage exceeds the supplied limits.

## Estimate

With focused parallel work, the first live canary is about 7–12 engineering
days away, plus any waiting time for source/compliance review. Sequential work
is closer to 12–18 days. A blocked or approval-required source pauses the live
run without invalidating the offline foundation.

## Next decision

Proceed with foundation ticket 6. Its output defines the product produced from
a fixture and resolves the URL-quality rule before methodology validation and
live orchestration depend on it.
