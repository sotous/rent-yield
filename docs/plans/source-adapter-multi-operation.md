# Source Adapter Multi-Operation Support

## Status

`completed` — 2026-10-29.

## Goal

Extend `@rent-yield/source-adapter-builder` so one source candidate can define
and build an adapter for rent, sale, or both operations. A built adapter parses
each supplied operation response into the existing normalized `ListingInput[]`
shape, tagging each listing with its verified operation.

## Why

The rent-yield data pipeline needs rental listings as comparable-rent evidence
and sale listings as the properties whose asking prices are used downstream to
calculate gross rent yield. The current builder only accepts one operation and
one extraction recipe per candidate. It cannot represent a source such as D.C.
Colombia whose API request and price field differ by operation.

## Contract decision

- Keep one source identity and one candidate artifact per organization/source.
- Replace the candidate's single-operation recipe with an `operations` map keyed
  by `rent` and/or `sale`.
- Each operation entry declares the request URL and its JSON extraction recipe,
  including that operation's `id` and `priceCop` paths.
- Require the caller to label each supplied `SourceResponse` with its operation.
  The adapter validates that operation is configured and that the response URL
  matches the operation entry; it does not infer operation from response data.
- Keep `ListingInput` unchanged. The adapter sets its `operation` from the
  validated response operation.
- Allow candidates to support one operation when only one is evidenced, and
  both when both are evidenced. Do not fabricate support for a missing operation.
- The builder remains a parser/build step: no fetching, crawler runtime,
  scheduling, source access, or persistence is added.

## Scope

- Update candidate and source-response types, validation, adapter construction,
  and parsing for per-operation URLs and recipes.
- Preserve the current typed failure behavior for malformed input, URL/content
  type drift, invalid JSON, missing collections, and invalid listings.
- Add focused tests for rent-only and sale-only candidates, a two-operation
  candidate with different endpoint/price paths, wrong-operation/URL failures,
  and existing parser failure cases.
- Migrate the synthetic candidate fixture and the discovered D.C. Colombia
  candidate to the new contract.
- Update `find-candidates` instructions so it emits operation-specific recipes
  and saves only operations supported by verifiable evidence.
- Update package and root documentation to explain how a future crawler supplies
  separate operation responses to the same adapter.
- Record a retrospective after implementation.

## Out of Scope

- Implementing a crawler, HTTP transport, request retries, pagination,
  scheduling, persistence, adapter registry, or Rent Model integration.
- Calling D.C. Colombia or any other live source during implementation.
- Claiming source permission from public API documentation.
- Changing Rent Model calculations or the `ListingInput` output shape.

## Risks and assumptions

- The future crawler must retain the operation context when it fetches each
  operation URL and pass it with the corresponding response.
- Per-operation URLs and recipes keep the parser deterministic and avoid
  guessing operation from source-specific response fields.
- Candidate compatibility is local to this prototype: there is no persisted
  runtime registry, but all checked-in candidate artifacts and docs must migrate
  together to avoid stale examples.
- A candidate may list only one operation if public evidence supports only one.

## Files likely to change

- `apps/crawlers/source-adapter-builder/src/adapter-candidate.ts`
- `apps/crawlers/source-adapter-builder/src/source-adapter-builder.ts`
- `apps/crawlers/source-adapter-builder/src/*.test.ts`
- `apps/crawlers/source-adapter-builder/fixtures/candidates/*.json`
- `apps/crawlers/source-adapter-builder/candidates/dc-colombia.json`
- `apps/crawlers/source-adapter-builder/README.md`
- `.codex/skills/find-candidates/SKILL.md`
- `README.md` and a builder retrospective

## Validation

- Use test-first changes for the candidate contract and parser behavior.
- Run focused builder tests, typecheck, lint, and format checks.
- Parse and validate both checked-in candidate artifacts against the new
  contract without making source requests.
- Run `git diff --check` and review documentation against implementation.

## Success criteria

- One candidate can define independently verified rent and sale response
  recipes.
- The built adapter parses both operation responses and emits correctly tagged
  `ListingInput` rows with the operation-specific price path.
- A response cannot be parsed under an operation or URL that the candidate did
  not configure.
- Existing single-operation use remains representable.
- No crawler or network behavior is introduced into the builder package.

## Completion evidence

- Focused source-adapter-builder tests passed: 23 tests.
- Source-adapter-builder typecheck, lint, and changed-file format checks passed.
- `adapter:build` built the D.C. Colombia candidate and reported both rent and
  sale URLs without making a source request.
- The review is recorded in
  [`docs/reviews/source-adapter-multi-operation-retrospective.md`](../reviews/source-adapter-multi-operation-retrospective.md).
- The plan's four execution tasks are marked Done in the Prototype v1 Tasks
  Notion database.
