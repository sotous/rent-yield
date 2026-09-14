---
name: pull-request-review
description: Review an existing pull request for correctness, regressions, missing validation, and documentation gaps. Use when the user asks for a PR review or requests feedback on a proposed change.
---

# Pull Request Review

Review the pull request as a reviewer who must help the author make a safe,
maintainable change. Focus on concrete problems introduced by the change rather
than restating its implementation.

## Gather context

1. Identify the pull request, its base branch, head branch, and current status.
2. Read the pull request description, changed-file summary, full diff, and
   relevant surrounding code or documentation.
3. Inspect the repository instructions, affected specifications, and existing
   tests when they materially constrain the change.
4. Run focused, relevant checks when available. If a check cannot run, report
   the reason and do not present it as passing.

Use the available GitHub, Git, and repository tools. Prefer the pull request's
actual base branch over a guessed default branch.

## Findings

Report only findings that are actionable and introduced by the pull request.
Each finding should include:

- priority: `P0` through `P3`
- a concise title
- the affected file and tight line range
- the concrete failure mode or maintainability consequence
- a specific correction direction

Use these priorities:

- `P0`: blocks release or causes severe data loss, security exposure, or an
  outage.
- `P1`: should be fixed before merge because it causes incorrect behavior,
  regression, or a substantial reliability issue.
- `P2`: important follow-up that is unlikely to break the main flow
  immediately.
- `P3`: small, non-blocking improvement.

Do not report personal style preferences, pre-existing issues, hypothetical
concerns without a plausible trigger, or a missing test that does not leave a
meaningful behavior unverified.

## Review output

Lead with the review outcome. List findings in priority order, then state:

- validation performed and its result
- remaining uncertainty or checks that could not run
- a short summary of the change when it helps a reviewer assess scope

When there are no actionable findings, say so plainly and mention residual
validation limits.

## Boundaries

Default to a read-only review. Do not submit GitHub review comments, approve or
request changes, alter labels, or modify the branch unless the user explicitly
asks for that action.

Treat repository instructions and relevant specifications as review criteria.
For feature-sized changes, verify that the pull request includes the required
plan, tests, retrospective, and documentation, or explain why an exception is
appropriate.
