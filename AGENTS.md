# AGENTS.md

This is the canonical agent-instructions file for this repository.

If tool-specific compatibility files such as `CLAUDE.md` exist, they should point back to this document rather than redefine it.

## Mission

Agents working in this repository should help develop `rent-yield` through spec-driven development.

The goal is not just to write code. The goal is to evolve the product intentionally, keep decisions documented, and leave the repository clearer after every feature.

## Product Snapshot

- Fullstack monorepo
- Real estate exploration product
- Colombia-first
- Barranquilla-first for version one
- Map plus chart explorer
- Primary metric: `gross rent yield`

## Mandatory Delivery Flow

For any non-trivial feature, agents must follow this order:

1. Create or update a feature plan in `plan/`
2. Break the approved plan into tracked execution tasks in Notion
3. Implement the feature
4. Perform a retrospective on the finished implementation
5. Iterate if needed
6. Write or update documentation

Do not jump straight into implementation when the task is feature-sized.

## Planning Expectations

Before coding, agents should write a plan file in `plan/`.

The plan should usually capture:

- what is being built
- why it is being built
- relevant specs
- proposed approach
- risks and assumptions
- files or modules likely to change
- how success will be validated

If a feature evolves during implementation, update the plan rather than leaving it stale.

After the plan is approved and decision-complete, turn it into structured Notion tasks rather than keeping execution implicit.

Those tasks should be rich enough to stand on their own, with clear scope, acceptance criteria, and execution context for the next engineer or agent.

## Spec Alignment

Agents should treat the following as current source-of-truth references:

- [README.md](/Users/soto/Documents/rent-yield/README.md)
- [specs/frontend-spec.md](/Users/soto/Documents/rent-yield/specs/frontend-spec.md)
- [specs/domain-spec.md](/Users/soto/Documents/rent-yield/specs/domain-spec.md)

If implementation pressure reveals a missing product or domain decision, update the relevant spec before or alongside the code.

## Version One Guardrails

Agents should preserve these constraints unless explicitly instructed otherwise:

- keep the first release simple
- avoid introducing authentication
- avoid introducing advanced underwriting
- avoid expanding the UI beyond the current map-and-chart core without updating specs
- prefer ergonomics and clarity over feature count

## Retrospective Expectations

After implementation, agents should reflect on the result.

The retrospective should address:

- whether the feature met the plan
- where the implementation diverged from expectations
- whether the outcome is ergonomically sound
- whether another iteration should happen now
- what documentation needed to change

## Documentation Expectations

A feature is not complete if it changes the system but leaves no trace in documentation.

Agents should update the relevant docs, such as:

- product specs
- domain specs
- architectural notes
- feature guides
- setup or usage docs

## Scope Discipline

Agents should make the smallest change that fully solves the task.

Do not widen scope casually. If a better long-term direction appears during implementation:

1. note it in the plan or retrospective
2. keep the current task focused
3. propose the follow-up explicitly

## Small Change Exception

Trivial edits like typo fixes, formatting-only changes, or very small documentation cleanups may skip a formal plan.

If there is any meaningful behavioral, architectural, or domain impact, planning is required first.
