# Data Storage V2 conformance harness plan

## Status

Completed on 2026-09-24. This slice uses the approved DurableSubmissionV2
contract at `ef02bdc`, merged into `main` by PR #18. The harness imports that
shared workspace package directly; it does not copy contracts or vectors.

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

The approved shared contract is available from merged `main` at `ef02bdc`.
The harness imports the exact shared-package revision rather than copying its
types or vectors.

The confirmed code location is the new Data Storage-owned workspace package:
`packages/data-storage-conformance`. It keeps provider-side tests separate from
the shared contract and from future durable-provider code.

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
- The shared package import and the harness package location are now fixed by
  this slice; changing either needs a coordinated contract update.
- Durable-provider work requires a separate approved plan after this harness
  has demonstrated the provider-facing contract.

## Delivery and retrospective

The Data Storage-owned package now contains an in-memory provider plus the
shared runner invocation. It stores only process-local maps for submission,
capture, interpretation, reference-fixture, receipt, and terminal-progress
state. The focused tests additionally prove that an unknown receipt cannot
produce progress and that a receipt accepts only one terminal event.

The implementation stayed within the intended boundary: it adds no database,
object store, migration, network access, crawler runtime, or live-canary
behavior. The fake is useful as executable contract evidence and as a template
for future provider CI, but it is not durability evidence. A later PostgreSQL
or object-storage provider must use the same shared runner with its own
provider-owned reference fixture adapter and its own durable failure tests.
