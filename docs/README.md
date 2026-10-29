# Documentation

This directory contains the repository's specifications, plans, current
implementation records, contracts, and completed reviews.

## Current documentation

- [Architecture](architecture/): current system boundaries and implementation
  design.
- [API](api/): consumer contracts and API reference material.
- [Decisions](decisions/): durable technical and product choices.
- [Plans](plans/): scoped delivery intent, status, and archives.
- [Research](research/): exploratory findings and market research.
- [Reviews](reviews/): implementation assessments and ergonomics reviews.
- [Specifications](specs/): authoritative product, domain, and technical
  behavior.

## Organization conventions

Use `specs/` for authoritative behavior, `plans/` for delivery intent,
`architecture/` for the current system design, `api/` for interfaces,
`decisions/` for durable technical or product choices, `research/` for
exploratory findings, and `reviews/` for completed assessments and
retrospectives.

## Pending documentation

- TODO: Document the crawler source pipeline: `candidate-finder` →
  `source-adapter-builder` → crawler runtime. Cover each stage's inputs,
  outputs, fixture ownership, and approval boundaries.

Use repository-relative links so this documentation works in any clone or
worktree.
