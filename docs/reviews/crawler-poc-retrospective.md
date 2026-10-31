# Crawler PoC Retrospective

## Outcome

The implementation met the approved crawler PoC plan and
[specification](../specs/crawler-poc-spec.md). A saved candidate now passes
through the workspace builder, one bounded request per configured operation,
the generated adapter parser, and a schema-versioned local artifact. Failed
operations retain safe error details while later operations continue; successful
operation rows survive in partial artifacts.

The runner and CLI use an injected fetch function in automated tests. Those
tests cover ordered operation requests and parse handoff, valid empty results,
partial fetch and parse failures, timeout, redirect rejection, response limits,
candidate rejection, malformed input, CLI argument errors, output collision,
and candidate immutability.

## Live smoke evidence

The manual smoke runs used the checked-in candidates without editing them for
execution:

| Candidate     | Format      | Rent | Sale | Result    |
| ------------- | ----------- | ---: | ---: | --------- |
| D.C. Colombia | JSON        |    2 |   31 | succeeded |
| Ciencuadras   | Static HTML |   28 |   28 | succeeded |

The schema-v1 artifacts are written under the ignored `data/crawler-runs/`
directory. A local audit confirmed each operation was parsed, each operation's
recorded count matched its normalized rows, and both artifacts had at least one
row for rent and sale.

Live responses exposed two candidate recipe mismatches that builder-only tests
could not catch. D.C. Colombia includes rental rows with `bedrooms: 0`, which
the builder rejects when mapped as a positive optional number. The candidate
now omits that optional field. The current Ciencuadras cards did not expose a
listing URL at the configured selector, so that optional mapping was removed.
Both adjustments preserve the required listing ID and price fields and are
verified by successful end-to-end runs.

## Validation

- Crawler tests: 12 passed.
- Source-adapter builder tests: 24 passed.
- Repository tests: 97 passed across five test projects.
- Workspace typecheck and lint passed.
- Prettier check passed after formatting the updated lockfile.
- Frozen offline lockfile validation passed.
- D.C. Colombia and Ciencuadras live smoke runs succeeded for rent and sale.

The root `pnpm check` script could not invoke because the shell did not have a
standalone `pnpm` executable on `PATH`. Its constituent workspace typecheck,
lint, format, and test commands were run directly through Corepack and passed.

## Divergences and ergonomics

The source-adapter package needed a public workspace entry point before the
crawler could consume it. That small integration boundary is now exported and
covered by a package-root test. The checked-in candidate recipes were also
adjusted only after live evidence identified optional fields that invalidate
the builder's response-atomic parser.

The crawler README gives a single repository-root command, a concise JSON
summary, clear per-operation status, and a non-overwriting artifact path. It
keeps raw source bodies out of files and console output. The implementation
remains intentionally simple: operations run sequentially and the caller
chooses when to run each source.

## Follow-up

No further crawler iteration is needed for the PoC acceptance criteria. Before
connecting these artifacts to the Rent Model, a separate contract must map
`ListingInput` to the fuller `ResidentialListing` domain shape, including city,
property type, bathrooms, and social stratum. That integration remains out of
scope here.
