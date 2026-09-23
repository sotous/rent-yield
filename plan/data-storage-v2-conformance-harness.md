# Data Storage V2 conformance harness plan

## Status

Planning only as of 2026-09-23. This slice is released by the approved
DurableSubmissionV2 contract at Crawler commit `fb183b8`; implementation still
requires the shared contract to be available on the Data Storage branch.

## Goal

Build a provider-neutral Data Storage conformance harness and in-memory fake
provider that executes the shared DurableSubmissionV2 runner and vectors. It
will prove that a future Storage provider can satisfy the contract without
starting PostgreSQL, PostGIS, object storage, migrations, or crawler runtime
behavior.

## Why

The shared package defines what every provider must do. A Data Storage-owned
fake proves that the provider side can consume that contract independently of
the Crawler implementation. It becomes the executable foundation for later
durable-provider CI.

## Scope

1. Add a Data Storage-owned provider-neutral test package or module, outside
   `@rent-yield/listing-storage-contracts`.
2. Implement an in-memory `DurableSubmissionV2Provider` fake that follows the
   shared runner’s source-scoped replay, capture conflict, reinterpretation,
   outcome conflict, acceptance receipt, and terminal-progress behavior.
3. Run `runDurableSubmissionV2Conformance` against that fake.
4. Add focused negative tests for provider behavior not exercised by the runner
   alone, especially an invalid/stale receipt reference and terminal-progress
   immutability.
5. Document how a later PostgreSQL/object-storage provider adopts the same
   runner in CI.

## Explicit exclusions

- PostgreSQL, PostGIS, Aiven, MinIO, S3, object placement, and reconciliation;
- database schema, migrations, retention jobs, or persistence adapters;
- crawler runtime acquisition, parsing, redaction, canary, or source access;
- HTTP endpoints, queues, schedules, and production deployment; and
- changes to the shared V2 contract, its vectors, or the Crawler-owned package
  unless a new joint review identifies a defect.

## Dependencies and coordination decision

The approved shared contract currently exists at Crawler commit `fb183b8` in a
separate worktree. Before implementation, it must be made available to this
branch through the agreed merge or cherry-pick path. The harness must import the
exact shared-package revision rather than copy its types or vectors.

Proposed code location is a new Data Storage-owned workspace package:
`packages/data-storage-conformance`. It keeps provider-side tests separate from
the shared contract and from future durable-provider code. Confirm this package
location when the shared-contract integration path is chosen.

## Behavior to prove

| Behavior                                                           | Expected fake-provider result                         |
| ------------------------------------------------------------------ | ----------------------------------------------------- |
| Exact replay under one `(source_key, submission_id)`               | Original immutable accepted receipt                   |
| Same submission ID under another source                            | Independent acceptance                                |
| Changed payload under same submission pair                         | `submission_conflict`                                 |
| Changed capture fingerprint under same capture identity            | `capture_event_conflict`                              |
| Changed parser/normalizer/methodology/extraction identity          | New accepted reinterpretation                         |
| Same five-field interpretation with changed canonical outcome hash | `interpretation_conflict`                             |
| First accepted progress                                            | Zero or one terminal event with sanitized code/reason |
| Any later progress mutation                                        | Rejected; terminal event remains immutable            |

## Test-first execution order

1. Write the fake-provider conformance test and confirm it fails because the
   provider module does not exist.
2. Add the smallest in-memory provider that passes the shared runner.
3. Add targeted Storage-owned tests for immutable terminal progress and receipt
   identity.
4. Refactor only after all shared and local tests pass.
5. Run workspace typecheck, lint, format check, and relevant tests.

## Files likely to change

| Path                                                               | Responsibility                                                |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `packages/data-storage-conformance/package.json`                   | New Data Storage-owned workspace package                      |
| `packages/data-storage-conformance/src/in-memory-provider.ts`      | In-memory provider fake                                       |
| `packages/data-storage-conformance/src/in-memory-provider.test.ts` | RED/GREEN provider conformance and negative tests             |
| `packages/data-storage-conformance/README.md`                      | CI adoption instructions for future durable providers         |
| `pnpm-workspace.yaml`                                              | No expected change; `packages/*` already includes the package |
| `docs/architecture/durable-submission-v2-provider-requirements.md` | Link the executable harness after it exists                   |

## Validation

- The first focused test fails for the missing provider module.
- The in-memory provider passes `runDurableSubmissionV2Conformance` from the
  exact approved shared-contract revision.
- Focused tests prove terminal progress cannot be appended or changed.
- Package lint, typecheck, test, Prettier check, and `git diff --check` pass.
- No touched file connects to a database, object store, network source, or
  crawler runtime.

## Risks and assumptions

- The fake is conformance evidence, not durable-storage evidence. Passing it
  cannot be described as PostgreSQL or object-storage conformance.
- The import path and package name remain a coordination decision until the
  shared contract is integrated into the Data Storage branch.
- Durable-provider work requires a separate approved plan after this harness
  has demonstrated the provider-facing contract.
