# breakdown-plan-to-notion skill

## Summary

Create a repo-local skill that converts a completed plan in `plan/` into actionable Notion tasks inside the existing `rent-yield` Notion workspace.

## Goal

- Add a reusable skill under `.codex/skills/`
- Make the skill specific to `rent-yield`
- Use the current `Prototype v1 Tasks` Notion database
- Upsert tasks safely instead of duplicating them on re-runs

## Approach

- Scaffold the skill with the local skill initializer
- Write a workflow-based `SKILL.md`
- Add a reference file for task mapping and Notion-specific rules
- Add a stable `Plan Slug` property to the Notion database to support upserts
- Update repo instructions so approved plans are broken into Notion tasks
- Validate the skill with the provided validator
- Forward-test the skill against a real plan in `plan/`

## Constraints

- Keep the skill repo-specific for now
- Treat repo plan files as the source of truth
- Treat Notion as the execution tracker
- Always create explicit `Review` and `Document` tasks
- Preserve existing Notion task `Status` values on re-runs

## Completion Checklist

- [x] Scaffold the skill
- [x] Write the final `SKILL.md`
- [x] Add the reference file
- [x] Add `Plan Slug` to the Notion database
- [x] Update repo workflow docs
- [x] Validate the skill
- [x] Forward-test the skill
- [x] Record retrospective notes

## Retrospective

### What was built

- A repo-local skill at `.codex/skills/breakdown-plan-to-notion`
- A task-mapping reference file with `rent-yield`-specific Notion rules
- A Notion database enhancement with a `Plan Slug` property
- Repo workflow documentation updates in `AGENTS.md` and `README.md`

### What worked well

- The local skill initializer made the scaffold fast and consistent
- Adding `Plan Slug` gave the workflow a stable identifier for task upserts
- A live Notion create/update cycle verified that repeated runs can preserve task progress

### What was harder than expected

- The Notion `query_data_sources` tool is unavailable in the current workspace plan tier
- The validator script required a local Python virtual environment because the system Python did not have `PyYAML`

### What changed during implementation

- The skill now uses a fallback strategy for non-Enterprise Notion workspaces
- The fallback relies on exact full task titles with a `[plan-slug]` prefix
- The workflow therefore uses both:
  - a `Plan Slug` property
  - a title prefix convention

### Final result assessment

The skill is now aligned with the actual runtime constraints of this workspace instead of assuming ideal Notion capabilities. That makes it more practical and more reliable for day-to-day use in `rent-yield`.

### Follow-up note

If the Notion workspace later gains access to direct data-source querying, the skill can prefer that path while keeping the current exact-title fallback as a safe backup.
