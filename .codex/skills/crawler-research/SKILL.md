---
name: crawler-research
description: Guide fixture-only listing-source research, methodology proposals, and review handoff for rent-yield without live source access or approval authority.
---

# Crawler Research

Use this skill for work on the repository's Colombian-listing crawler research
workflow. Produce reviewable evidence and typed contract inputs; do not infer
permission, activate a methodology, or perform live source access.

## Workflow

1. Read `specs/crawler-research-spec.md` and the relevant foundation plan.
2. Register a source candidate and record access findings, unknowns, evidence,
   and explicit review dates. Only an existing permitted mock assessment can
   enter a bounded probe simulation.
3. Use redacted, frozen fixtures for capture, extraction, and validation. Keep
   raw captures, credentials, and personal data out of AI prompts and artifacts.
4. Create an immutable methodology proposal with pinned fixture, policy, adapter,
   parser, normalizer, and extraction-contract hashes. Validate it offline.
5. Hand a passed proposal to trusted review. Proposal and research tools cannot
   approve, publish, or reactivate it. Effective lookup remains fail-closed.

## Failure handling

Treat typed validation, compatibility, policy, health, and ambiguity failures as
stopping conditions. Record the sanitized failure and repair the input, fixture,
or review record before retrying. Do not bypass a block with a historical lookup
cutoff or a changed tool invocation.

## Boundaries

The current toolchain is offline and fixture-backed. Chrome DevTools may be a
future research adapter only; a visible endpoint does not establish permission,
reuse rights, or isolation. Durable storage, reviewer identity, browser setup,
credentials, scheduling, and live crawling are outside this skill.

See `apps/crawlers/README.md` for tool behavior and
`docs/architecture/crawler-foundation-contract-agreement.md` for contract
semantics.
