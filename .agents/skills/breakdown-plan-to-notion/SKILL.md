---
name: breakdown-plan-to-notion
description: Convert a completed non-trivial feature plan in `plan/` into actionable Notion tasks for the `rent-yield` project. Use after a plan is decision-complete and approved, when the next step is to break it into implementable execution slices inside the `Prototype v1 Tasks` Notion database. Read the target plan file, draft the breakdown for review, derive a stable plan slug from its filename, create or update structured task pages without duplicating existing work, and always include explicit review and documentation tasks.
---

# Breakdown Plan To Notion

## Overview

Use this skill to turn a finished `rent-yield` plan into tracked execution work in Notion.

Treat the plan file in `plan/` as the source of truth. Treat the Notion task database as the execution tracker.

Read [references/task-breakdown-rules.md](references/task-breakdown-rules.md) before writing or updating tasks.

Do not treat this as lightweight task logging. Each Notion task page should be understandable on its own and should help a future agent or engineer execute the slice without reopening the full plan.

## Workflow

### 1. Confirm the plan is eligible

Only use this skill when all of the following are true:

- the target file lives under `plan/`
- the plan is decision-complete
- the work is non-trivial

Do not use this skill for typo-only, formatting-only, or tiny cleanup work.

### 2. Read the target plan

Read the target plan file completely.

Extract:

- the plan title
- the goal of the work
- the execution order
- the real implementation slices
- the required review step
- the required documentation step

Do not mirror headings mechanically when they are too broad. Convert them into implementable slices.

### 3. Draft the proposed breakdown for review

Before creating or updating anything in Notion, draft the full breakdown for the user.

Include:

- a short overview of what the plan accomplishes
- the proposed tasks in dependency order
- inferred track, phase, and priority for each task
- likely blockers or dependencies
- a note when a task should probably be split further

Use this review draft to surface ambiguous decomposition before the tracking layer is mutated.

If the user has not yet approved the breakdown, stop after presenting the draft.

### 4. Derive the stable plan slug

Derive `Plan Slug` from the plan filename without `.md`.

Use that slug as the stable identifier for all Notion operations.

### 5. Query existing Notion tasks first

Before creating tasks, query the `Prototype v1 Tasks` data source for rows whose `Plan Slug` matches the derived slug.

Use the exact Notion destination defined in [references/task-breakdown-rules.md](references/task-breakdown-rules.md).

Prefer direct data source querying. If it is unavailable in the current workspace, fall back to Notion search against the task data source one desired task at a time using each exact full task title.

Match existing tasks by:

- `Plan Slug`
- `Task`

When using the search fallback, match by exact full task title including the slug prefix.

### 6. Build the target task set

Create a target task set that includes:

- implementable build slices
- one explicit review / retrospective task
- one explicit documentation task

Break tasks down to the size that one engineer or agent can execute without making new product decisions.

### 7. Run an introspective pass on each task

For each candidate task, do a short reasoning pass before writing it to Notion.

Check:

- is the slice small enough for one focused implementation pass
- does it depend on hidden setup or prior work
- are the acceptance criteria observable and testable
- is there a meaningful out-of-scope boundary
- should this be split into two tasks

If the introspective pass reveals an unresolved product decision, stop and ask for clarification instead of encoding a shaky task.

Write the results of this pass into the task page's `Introspective Check` section.

### 8. Compose the structured task page

Each task page should use the template defined in [references/task-breakdown-rules.md](references/task-breakdown-rules.md).

Every page should include:

- `Context`
- `Goal`
- `Scope`
- `Acceptance Criteria`
- `Out of Scope`
- `Dependencies / Blockers`
- `Implementation Notes`
- `Introspective Check`
- `Plan Reference`

The page body should make sense from Notion alone. Do not rely on a one-line note when the page itself can carry execution context.

### 9. Map tasks to database fields

Use the field rules from [references/task-breakdown-rules.md](references/task-breakdown-rules.md).

Defaults:

- `Status`: `Not started` for new tasks
- `Task`: prefix the clean task name with `[plan-slug] `
- `Track`: infer from the task type
- `Phase`: `Plan`, `Build`, `Review`, `Iterate`, or `Document`
- `Priority`: infer conservatively
- `Order`: assign in execution order
- `Plan Slug`: set for every task
- `Notes`: a concise one or two sentence summary of the slice

Preserve the current `Status` for matched existing tasks.

### 10. Upsert tasks safely

When a task already exists for the same `Plan Slug` and `Task`:

- update `Track`
- update `Phase`
- update `Priority`
- update `Order`
- update `Notes`
- refresh the structured task-page content
- preserve `Status`

When a task does not exist:

- create it with the structured task-page content

If a page already contains human-written content outside the managed structure, preserve it when possible rather than deleting it blindly.

If older tasks remain for the same `Plan Slug` but no longer match the current breakdown, do not delete them automatically. Report them as stale candidates for manual review.

### 11. Report the outcome

After the breakdown is complete, report:

- the plan file used
- the derived `Plan Slug`
- whether the draft breakdown was reviewed first
- tasks created
- tasks updated
- stale tasks found, if any

## Rent-Yield Rules

- Assume the project is `rent-yield`
- Assume plans live in `plan/`
- Assume the destination is the existing `rent-yield` Notion project and `Prototype v1 Tasks` database
- Assume review and documentation are mandatory tracked steps
- Assume each task page should stand on its own as a mini-spec
- Prefer stable, conservative updates over aggressive cleanup

## Notes

- If the Notion tools are unavailable, stop and say the skill cannot complete the tracking step.
- If the target plan is not decision-complete, stop and say the plan must be finished before breakdown.
- If the plan is trivial, stop and explain that Notion breakdown is not required.
- If the user wants a quick draft only, stop after the reviewable breakdown and do not mutate Notion yet.
