# PoC Crawler Reset

## Status

Approved for cleanup on 2026-10-19. At the user's direction, this plan is
intentionally not broken down into Notion tasks. It is executed as small,
owned repository changes with one final integration and verification pass.

## Why

The crawler foundation has grown into a generic collection, governance, and
audit system before the product has demonstrated a useful user-facing result.
The immediate product question is simpler: can a Barranquilla user inspect a
small, transparent set of sale listings ranked by estimated gross rent yield,
grounded in rental comparables?

The existing discovery and canary work is valuable reference material, but it
must not be the critical path for answering that question.

## Product decision

For the PoC, acquisition is deliberately small and developer-operated:

```text
curated CSV/JSON or one manual source import
  -> small source-specific parser
  -> normalized local dataset
  -> comparable median rent per m²
  -> explorer yield ranking
```

This is not a policy-review or source-governance workflow. We will not bypass
authentication, access challenges, or other technical access controls; beyond
that, the PoC does not model an approval lifecycle.

The existing governance platform is removed from the repository, rather than
kept next to the PoC implementation. A smaller codebase is part of the PoC:
it makes the real product needs visible instead of hiding them behind generic
abstractions.

## Listing import contract

Define one intentionally small listing shape, independent from the existing
generic storage contracts:

```ts
type ListingInput = {
  operation: "rent" | "sale";
  priceCop: number;
  builtAreaSqm?: number;
  bedrooms?: number;
  neighborhood?: string;
  url?: string;
  observedAt: string;
};
```

Only add a field when the comparable calculation or explorer actually needs
it. Rent and sale rows remain distinct inputs.

## Delivery slices

1. **Remove the general crawler/governance path**
   Inventory and delete the methodology approval, source candidate/access
   lifecycle, source health, collection receipts, durable ingestion,
   generic transport, profile repositories, canary runtime, and their
   isolated tests/docs. Update package dependencies and imports so no
   reachable PoC code refers to them. Preserve only narrow extraction or
   normalization logic that the new PoC importer demonstrably reuses.
2. **Define the PoC dataset boundary**
   Add the small canonical contract plus a checked-in, manually curated sample
   for one Barranquilla area (target: 30–100 rentals and 30–100 sales).
3. **Build a narrow import path**
   Implement a developer-invoked CSV/JSON importer or one source-specific
   parser in a plainly named import module. It must not depend on the current
   generic runtime, methodology lookup, ingestion delivery, or bounded probe.
4. **Connect the vertical product slice**
   Feed imported rentals into deterministic comparable median rent/m² and
   feed imported sale listings into the explorer’s yield ranking.
5. **Validate the decision, then reassess**
   Demonstrate the end-to-end ranking to users. Only after that result decide
   whether refresh automation, more listings, or another source is valuable.

## Test-first acceptance criteria

- A valid rental and a valid sale row import into the PoC data shape.
- A malformed row is reported without preventing valid rows from importing.
- Rental rows cannot become sale candidates, and sale rows cannot become rent
  comparables.
- The comparable estimator uses only imported rentals and is deterministic.
- The explorer displays a transparent yield ranking from the imported data.
- The new PoC path has no dependency on generic crawler governance/runtime
  modules.

## Explicitly out of scope

- Scheduling, crawling portfolios, and pagination systems.
- Generic HTTP transport, retries, source profiles, source health, approval
  state, and durable collection receipts.
- Multi-source abstraction and production storage admission.
- Retaining the removed governance platform as in-repository reference
  material. Git history is the recovery path if it is ever needed again.

## Removal safety

- Inventory exact files, packages, commands, tests, documents, and imports
  before deleting them.
- Delete only the general governance/runtime path, not the Rent Model,
  explorer, shared essentials, or a narrow parser that the PoC adopts.
- Remove stale documentation and package scripts in the same change, so the
  repository communicates one clear path.
- Prove the replacement vertical slice with its focused tests before declaring
  the cleanup complete.

## Cleanup execution breakdown

1. **Crawler application removal** — Remove the existing generic crawler app,
   its CLI commands, transports, tests, fixtures, and app documentation.
2. **Governance package removal** — Remove discovery-profile storage,
   listing-storage contracts, and storage-conformance packages with their
   isolated source and tests.
3. **Governance documentation removal** — Remove superseded crawler/storage
   governance plans, architecture documents, retrospectives, and specs.
4. **Workspace integration** — Remove workspace/package references, prune the
   lockfile through the package manager, update root documentation, and prove
   no live import or script still points at deleted code.
5. **Replacement boundary check** — Confirm the repository is ready for the
   small listing-import vertical slice, without adding that new behavior as
   part of this deletion-only cleanup.

## Likely areas to change

- a small import module or import CLI
- a checked-in sample data fixture/dataset
- the Rent Model input adapter
- explorer/API data wiring
- crawler and product documentation

## Validation and retrospective

Use TDD for each import and product behavior. Verify the complete local user
flow from sample input to explorer ranking. At completion, document whether
the ranking changed a user decision and whether any automation is justified.
