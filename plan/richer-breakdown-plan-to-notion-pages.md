# richer breakdown-plan-to-notion pages

## Summary

Upgrade the repo-local `breakdown-plan-to-notion` skill so each Notion task page becomes an execution-ready mini-spec instead of a lightweight row with a short note.

## Goal

- Add a richer per-task page template for Notion tickets
- Introduce an explicit introspective pass for each task before it is written
- Require the full breakdown to be drafted for review before creating or updating Notion tasks
- Keep the workflow specific to `rent-yield` and the `Prototype v1 Tasks` database

## Approach

- Update the skill instructions so the breakdown happens in two stages:
  - first draft the proposed tasks for review
  - then write or update Notion tasks after approval
- Add a structured page template with sections for context, scope, acceptance criteria, dependencies, and introspection
- Expand the reference rules so task sizing, task content, and update behavior are all explicit
- Refresh repo docs so the Notion-tracking step is described as structured execution tracking rather than lightweight task logging
- Re-validate the skill and forward-test the richer page content on the existing sample task set

## Constraints

- Preserve `plan/` as the source of truth
- Preserve Notion as the execution tracker
- Keep `Review` and `Document` as mandatory explicit tasks
- Preserve existing task `Status` values on re-runs
- Avoid blindly overwriting manual human notes when a page has already been edited outside the managed task structure

## Completion Checklist

- [x] Update the enhancement plan
- [x] Rewrite the skill workflow
- [x] Expand the reference rules and task-page template
- [x] Update repo docs
- [x] Validate the skill
- [x] Forward-test the richer task content
- [x] Record retrospective notes

## Retrospective

### What was upgraded

- The skill now drafts the breakdown for review before mutating Notion
- Each task now carries a structured page template rather than relying on `Notes`
- The workflow now includes an explicit introspective pass for every task

### What worked well

- The existing title-prefix and `Plan Slug` pairing still works as the stable upsert identity
- The richer Notion page structure renders cleanly with simple headings and checklists
- The local skill validator still passes after the workflow expansion

### What was validated

- The skill passes `quick_validate.py`
- The sample Notion task `[breakdown-plan-to-notion-skill] Validate and test the skill` now contains the richer mini-spec structure
- Its `Status` remained `In progress`, confirming that richer page updates do not require resetting task progress

### Final result assessment

The skill is now much closer to an issue-authoring workflow than a lightweight tracker sync. That better matches the repo's execution model, where Notion tasks should be independently understandable and useful to the next agent.
