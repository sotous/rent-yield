# Crawler Research skill retrospective

## Outcome

Ticket 10 adds a portable repository skill at
`.codex/skills/crawler-research/SKILL.md`. It routes agents through the existing
fixture-only crawler workflow without conflating the runbook with runtime code.

## What met the plan

- The skill directs agents from source candidate and assessment through redacted
  fixtures, extraction, validation, proposal, and trusted-review handoff.
- It treats typed policy, health, validation, compatibility, and ambiguity
  failures as stopping conditions.
- It prohibits live source access, permission claims, activation, credentials,
  raw sensitive captures, and duplicated agent-skill directories.

## Next iteration

Ticket 11 will review the complete fixture workflow using this skill and record
the final foundation retrospective.
