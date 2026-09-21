# Documentation

This directory records the current implementation, contracts, and completed
reviews. Product requirements and version-one scope live in
[`../specs/`](../specs/); delivery intent and status live in
[`../plan/`](../plan/).

## Current documentation

- [Architecture](architecture/): system boundaries and implementation design.
- [API](api/): consumer contracts and API reference material.
- [Decisions](decisions/): durable technical and product choices.
- [Research](research/): exploratory findings and market research.
- [Reviews](reviews/): implementation assessments and ergonomics reviews.

## Data Storage architecture

The [Data Storage System Specification](../specs/data-storage-spec.md) is the
authoritative storage-requirements document. Read these architecture artifacts
in order when more detail is useful:

1. [Conceptual storage model](architecture/data-storage-conceptual-model.md)
2. [Logical storage ERD](architecture/data-storage-erd.md)
3. [Shared storage port contracts](architecture/data-storage-port-contracts.md)
4. [Storage-modeling review](architecture/data-storage-modeling-review.md)

The older [crawler ingestion architecture note](architecture/crawler-ingestion-data-lake.md)
and [listing storage contract](architecture/listing-storage-contract.md) remain
supporting, detailed handoff notes; neither supersedes the Data Storage System
Specification.

## Organization conventions

Use `architecture/` for the current system design, `api/` for interfaces,
`decisions/` for durable technical or product choices, `research/` for
exploratory findings, and `reviews/` for completed assessments and
retrospectives.

Use repository-relative links so this documentation works in any clone or
worktree.
