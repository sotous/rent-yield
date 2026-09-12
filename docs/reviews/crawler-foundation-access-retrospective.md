# Crawler foundation ticket 3 retrospective

## Outcome

Ticket 3 implements fixture-only source-candidate registration and access
assessment. Candidates and assessments are validated against the shared v1
runtime schemas and retained append-only in memory. Candidate corrections use
explicit supersession; exact retries are idempotent and changed reuse of an ID
fails. Access outcomes are derived from technical and contractual findings,
evidence, unknowns, and typed issues rather than accepted from a caller.

Only a current `allowed_for_probe` assessment permits the next mocked workflow.
Blocked, unknown, approval-required, absent, expired, and ambiguous assessment
states fail closed. A later assessment supersedes the earlier access conclusion
for future checks while preserving both records.

## TDD and review

The initial focused test failed because the application module did not exist.
Implementation then made 14 behavior cases pass. A second RED cycle exposed the
lack of explicit candidate supersession; the shared schema and application
rules were extended. Storage review produced a third RED cycle: set-equivalent
retries conflicted and assessments were not tied to candidate versions. Retry
identity now canonicalizes declared sets, every assessment references its exact
candidate, and a correction invalidates inherited access. The focused suite now
passes 16 cases.

The result keeps research hypotheses visible through evidence and unknowns and
does not treat robots observations or empty evidence as permission. Exact scope
matching treats listing roles as a declared set. Equal latest assessment times
are ambiguous rather than dependent on insertion order.

## Boundaries and next iteration

This memory workflow is deliberately not a durable repository and supplies no
network transport. It does not decide whether a real source may be accessed.
It only records explicit findings and applies the approved deterministic gate.
The next ticket implements bounded probe validation with mocked transport,
redirect, address, and budget behavior.

Data Storage reviewed the shared boundary after implementation. Its two
blockers—set-equivalent retry identity and candidate-version-bound
assessments—were reproduced in tests and corrected. Storage then approved the
ticket with no remaining boundary blocker. Repository type checking and
linting pass, as do all 127 tests: 44 shared contracts, 22 Crawlers, 23 Backend,
35 Frontend, and 3 Rent Model. Targeted formatting and diff validation pass.
