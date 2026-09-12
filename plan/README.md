# Plans

Plans describe the intended delivery of a scoped change. They are the source
of truth for intent; approved non-trivial plans are also broken into tracked
execution tasks.

## Status labels

Record a plan's status near the beginning of the file using one of these
labels:

- `draft`: being shaped; not ready for execution.
- `approved`: decision-complete and authorized for execution.
- `in-progress`: implementation or its required review is underway.
- `completed`: delivery and validation are finished.
- `superseded`: replaced by a named newer plan or decision.

Do not infer a status from a plan's age. A plan enters `plan/archive/` only
after its `completed` or `superseded` status has been verified against the
implementation and tracker.

Verified historical plans live in [archive/](archive/).

## Related documentation

- [Documentation navigation](../docs/README.md)
- [Repository organization plan](repository-organization.md)

Use repository-relative links in plans so they work across clones and
worktrees.
