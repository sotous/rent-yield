# Data storage modeling artifacts plan

## Status

Completed on 2026-09-21. The execution breakdown is tracked in the
`Prototype v1 Tasks` Notion database under plan slug
`data-storage-modeling-artifacts`.

## Goal

Create a small set of visual design artifacts that make the Data Storage System
Specification easier to understand and provide a disciplined path to a future
ERD. The artifacts must describe needs and relationships before selecting
physical tables or implementation details.

## Scope

1. Add a compact UML use-case diagram to the data storage specification.
2. Create a separate conceptual data model showing durable concepts,
   relationships, owners, and reasons for persistence.
3. Derive a logical ERD from the approved conceptual model.
4. Define only the port/interface diagrams that remain useful after the ERD;
   do not create a broad application class diagram by default.
5. Review traceability from use cases to concepts and ERD relationships, then
   update supporting documentation.

## Decisions already made

- The use-case diagram is the main-spec visual: it must remain small and
  readable on one screen.
- The conceptual data model bridges user needs and the logical ERD.
- The ERD is gated by approved use cases and conceptual relationships.
- Runtime class diagrams complement the ERD for shared ports; they do not gate
  the ERD or force object-oriented storage design.
- This work creates no migrations, persistence adapters, or runtime behavior.

## Likely artifacts

- `specs/data-storage-spec.md`
- `docs/architecture/data-storage-conceptual-model.md`
- `docs/architecture/data-storage-erd.md`
- `docs/architecture/data-storage-port-contracts.md`, only if the ERD review
  identifies port relationships that a diagram clarifies
- `docs/architecture/data-storage-modeling-review.md`

## Success criteria

- A reader can understand the storage system’s actors and responsibilities from
  the main specification without reading a detailed ERD.
- Every logical ERD entity and relationship traces to a stated use case and
  conceptual need.
- No physical-table, ORM, or migration decision is introduced merely to make a
  diagram complete.
- The model preserves the sale-price firewall, immutable evidence history,
  object-storage boundary, and publication boundary.

## Validation

- Review the use-case diagram with crawler, Rent Model, backend, and reviewer
  perspectives.
- Check that each conceptual relation has a clear owner, cardinality, and
  persistence purpose before adding it to the ERD.
- Verify Markdown rendering, diagram syntax, links, and terminology alignment
  with the storage, Rent Model, crawler, and backend specifications.

## Out of scope

- SQL schema, migrations, database provisioning, object-storage setup,
  application class diagrams unrelated to shared ports, and implementation.
