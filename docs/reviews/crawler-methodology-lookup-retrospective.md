# Crawler methodology lookup retrospective

## Outcome

Foundation ticket 8 is complete. The fixture-only crawler workbench now keeps
append-only trusted review decisions and resolves exactly one approved-effective
methodology using explicit effective and recorded-as-of clocks.

## What met the plan

- Proposal intake verifies canonical manifest and validation-report hashes plus
  the injected adapter registry, without granting approval capability.
- The review repository assigns its own monotonic sequence, keeps decisions
  append-only, and requires an approved decision to cite the proposal's exact
  successful validation report.
- Resolution matches the complete source, country, city, capability, and
  listing-role scope. It applies start-inclusive/end-exclusive review intervals
  and excludes decisions recorded after the caller's cutoff.
- Missing approvals, non-approved lifecycle states, expired rechecks, malformed
  pins, adapter incompatibility, overlapping approvals, and error-level source
  health events fail closed. A later approval can resume a health-blocked
  methodology.
- Focused tests cover the two-clock lookup, scope matching, hash tampering,
  failed validation, repository-assigned ordering, interval edges, lifecycle
  state, health pause/reactivation, and ambiguity.

## Divergence and ergonomics

Failed validation reports are retained as review evidence. The initial draft
treated them as corrupt during proposal registration, which would have erased a
useful review record. The finalized boundary separates integrity verification
from eligibility: only approval requires a passed report.

The memory implementation models trusted input but does not authenticate a
reviewer or persist an audit log. A durable provider must keep the same ordering
and resolution semantics before it can replace this fixture reference.

## Next iteration

Ticket 9 should add contract conformance vectors for the memory implementation
and the later durable provider. It should reuse the same no-live-I/O boundary.
