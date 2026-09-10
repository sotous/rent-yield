# Crawler foundation ticket 4 retrospective

## Outcome

Ticket 4 implements bounded listing-discovery probes against an injected mock
transport. The trusted access gate supplies the current assessment identity and
digest plus maximum host, path, and budget constraints before simulated I/O;
callers cannot inject policy state, assessment references, or widen those
constraints. Each target uses HTTPS, an exact host allowlist, constrained path
prefixes, and public resolved addresses. Redirects are counted and revalidated,
including a fresh address resolution that blocks simulated DNS rebinding.

The workbench enforces request, byte, duration, redirect, source-wide request,
and concurrent-source limits. The transport receives the validated address set
and remaining byte and time limits, tying DNS validation and streaming cutoffs
to the connection boundary. DNS resolution receives the remaining deadline and
can report budget exhaustion before dispatch. It stops without retry on policy or robots
conflict, `401`, `403`, `429`, authentication, challenges, unexpected HTTP
failures, invalid targets, non-public addresses, and exhausted budgets. The
result is a typed probe receipt containing sanitized reason codes, usage, HTTP
metadata, and complete or partial entity-body digests. Source bodies never enter
the receipt.

## TDD and review

The first RED run failed because the bounded-probe module did not exist. GREEN
implemented the end-to-end simulated boundary. Subsequent RED cycles exposed
unexpected HTTP success, missing cross-probe concurrency enforcement, unsafe
path-prefix configuration, a caller-controlled assessment digest, detached DNS
validation, and post-hoc response budget checks. Each behavior was corrected at
its narrow boundary. The focused suite includes successful research-gate
integration, DNS rebinding defenses, and complete and partial response evidence.
The bounded-probe file now has 44 passing cases; the crawler package has 66.

The implementation reuses the candidate-version-bound access gate from ticket 3. Assessment hashes use the agreed canonical JSON representation. The shared
budget ledger makes simultaneous source probes fail closed when their approved
concurrency is exhausted. URL checks also reject ambiguous encoded path
separators and dot segments, while the address classifier blocks private,
special-use, translated, and mapped address ranges.

## Boundaries and next iteration

This is a deterministic simulation. It does not include a production DNS or
HTTP adapter, browser, live source, retry engine, scheduler, or durable budget
store. A full response classifier and parser belong to fixture extraction work;
durable source-health reporting belongs to the shared storage port slice.

The next ticket implements redacted fixture envelopes, deterministic redaction,
prohibited-data scanning, and immutable fixture successors.

The normative requirements and requirement-to-test mapping are recorded in
[`specs/crawler-research-spec.md`](../specs/crawler-research-spec.md). The
crawler and shared-contract READMEs document the mock transport obligations,
temporary gate defaults, receipt evidence, and production boundary.
