# Task Breakdown Rules

## Notion Target

Use this Notion destination for `rent-yield`:

- Project page ID: `387dd702-2740-81eb-ba63-ffe446364d5a`
- Project page URL: `https://app.notion.com/p/387dd702274081ebba63ffe446364d5a`
- Task database ID: `e859027b-50fa-4a22-8ec3-184cd63d7a7a`
- Task data source URL: `collection://e94c3a57-bade-4e1c-9334-9dc58f7941e3`

## Required Database Properties

The task database is expected to contain:

- `Task`
- `Status`
- `Track`
- `Phase`
- `Priority`
- `Order`
- `Notes`
- `Plan Slug`

## Plan Eligibility

Only break down a plan when all of the following are true:

- the plan is decision-complete
- the plan describes non-trivial feature work
- the plan is stored under `plan/`

Do not create Notion tasks for:

- typo-only edits
- formatting-only work
- tiny cleanup work with no behavioral, architectural, or domain impact

## Plan Slug Rule

Derive `Plan Slug` from the plan filename without the `.md` extension.

Examples:

- `frontend-interaction-spec.md` -> `frontend-interaction-spec`
- `breakdown-plan-to-notion-skill.md` -> `breakdown-plan-to-notion-skill`

Use `Plan Slug` as the stable identifier for all upsert operations.

## Task Title Convention

Prefix every task title with the plan slug in square brackets.

Format:

`[plan-slug] Task title`

Examples:

- `[frontend-interaction-spec] Define chart state model`
- `[breakdown-plan-to-notion-skill] Validate skill and fallback behavior`

Use this title prefix even though the database also stores `Plan Slug`.

Reason:

- it makes task origin visible in the board
- it enables a non-Enterprise Notion fallback path when direct database querying is unavailable

## Task Granularity

Create tasks as implementable slices.

A task is the right size when one engineer or agent can execute it without making new product decisions.

Do not mirror plan headings blindly when they are too broad.

Prefer more small, reviewable tasks over fewer large tasks.

Split a task when it would otherwise:

- mix setup and feature delivery in one step
- hide an unstated dependency
- touch many unrelated files or systems
- lack clear acceptance criteria
- require a second product decision while implementing

## Required Task Set

Every eligible plan should produce:

- implementable execution slices
- one explicit review / retrospective task
- one explicit documentation task

Before mutating Notion, draft the full task set for review so the decomposition can be corrected while it is still cheap to change.

## Task Authoring Standard

Each Notion task page should read like a small execution brief rather than a placeholder.

The ticket should be understandable from Notion alone, even if the reader does not reopen the original plan immediately.

## Managed Task Page Template

Use this structure for every task page:

```md
Managed Source: plan/<plan-file>.md
Managed Slug: <plan-slug>
Managed Phase: <phase>

## Context

<Why this task exists and how it connects to the plan.>

## Goal

<The concrete outcome this task should achieve.>

## Scope

- <specific change 1>
- <specific change 2>

## Acceptance Criteria

- [ ] <observable done condition 1>
- [ ] <observable done condition 2>

## Out of Scope

- <explicit non-goal 1>

## Dependencies / Blockers

- <upstream dependency, blocker, or "None">

## Implementation Notes

- <likely files, modules, or technical guidance>
- <important assumptions>

## Introspective Check

- Size assessment: <why this task is the right size, or why it should be split>
- Hidden dependency check: <dependency risk or "none identified">
- Ambiguity check: <unclear edge, if any>
- Split decision: <keep as one task / split further>

## Plan Reference

- Plan: `plan/<plan-file>.md`
- Plan slug: `<plan-slug>`
- Order: `<order>`
```

When details are unavailable, state the uncertainty explicitly instead of inventing confidence.

## Field Mapping Defaults

### Status

- New tasks: `Not started`
- Existing matched tasks: preserve the current `Status`

### Track

Use these defaults:

- `Planning`: specs, decomposition, planning-only artifacts, review / retrospective
- `Frontend`: UI, interaction, layout, component, and explorer work
- `Backend`: APIs, data modeling, ingestion, metric calculation, and storage work
- `Docs`: documentation updates and architecture notes

### Phase

Use these defaults:

- `Plan`: planning, decomposition, and contract-definition tasks
- `Build`: implementation slices
- `Review`: explicit review / retrospective task
- `Iterate`: follow-up changes discovered during review
- `Document`: explicit documentation task

### Priority

Infer conservatively:

- `High`: critical path work, foundational scaffolding, or blockers for later slices
- `Medium`: default for most tasks
- `Low`: optional polish or non-blocking follow-up

Do not mark a task `High` unless it truly blocks progress or defines the prototype's core behavior.

### Order

Assign `Order` sequentially in execution order.

## Upsert Rule

When re-running the skill for the same plan:

1. Prefer querying the database for existing tasks where `Plan Slug` matches the derived slug.
2. If direct database querying is unavailable, search the same task data source one desired task at a time using each exact full task title.
3. Match existing tasks by the pair:
   - `Plan Slug`
   - `Task`
4. When using the search fallback, match by exact full task title including the slug prefix.
5. For matched tasks:
   - update `Track`
   - update `Phase`
   - update `Priority`
   - update `Order`
   - update `Notes`
   - update the structured task-page content
   - preserve `Status`
6. Create tasks that do not yet exist.
7. Do not delete unmatched old tasks automatically.

If old tasks exist for the same `Plan Slug` but no longer correspond to the current breakdown, report them as stale candidates for manual review.

When updating an existing task page, prefer replacing the managed task structure while preserving human-written notes outside that structure when practical.

## Notes Field

Use `Notes` for a concise execution hint, not for large copied plan sections.

Good notes:

- summarize the slice
- preserve important assumptions
- keep one or two sentences

The detailed execution context belongs in the task page body, not in `Notes`.

## Introspective Pass

Before writing each task page, run a short introspective pass.

Ask:

- Is this task independently implementable?
- Is the boundary clear enough to avoid mid-task product decisions?
- Are the acceptance criteria specific enough to verify completion?
- Is there a hidden dependency or blocker that should become its own task?
- Does the ticket need to be split to stay reviewable?

If the answer reveals unresolved ambiguity, revise the task set or stop for clarification before creating misleading tickets.

## Output Expectations

After running the workflow, report:

- the plan file used
- the derived `Plan Slug`
- whether the review draft was presented before mutation
- tasks created
- tasks updated
- stale tasks found, if any
