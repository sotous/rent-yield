# Crawler foundation ticket 2 retrospective

## Scope and outcome

Ticket 2 establishes the offline TypeScript/Vitest workbench and versioned
research schemas. Three agents owned primitive/canonical schemas, research
schemas, and methodology schemas; the coordinating agent owned package setup,
consumer validation, schema catalog, integration checks, and documentation.
The approved parent plan remains `crawler-research-and-methodology-foundation`;
this note is its implementation retrospective, not a separate feature plan.

The delivered surface includes strict runtime schemas and structural JSON
Schema projections for candidates, access assessments, probes, fixtures,
extraction contracts, manifests, validation reports, review decisions, proposals,
lookup requests, and source-health events. The crawler consumes the shared
package and returns typed, sanitized input failures. Examples are synthetic.

## TDD and validation

Each owner first ran focused tests that failed for missing implementation.
Subsequent RED cycles covered portable examples, duplicate set members, and
proposal reference mismatches. Primitive vectors cover canonical decimals,
calendar dates, integer-like key ordering, Unicode, safe integers, semantic
arrays, and declared sets.

Repository type checking, linting and all 111 tests pass (44 shared-contract,
6 crawler, 23 backend, 35 frontend, 3 Rent Model). Targeted formatting passes.
The aggregate `pnpm check` stops at pre-existing formatting in five untouched
files: two Rent Model source files, the data-lake and storage architecture
notes, and the business-model research document. It does not reach tests, so
`pnpm test` was run separately. No live source or database was used.

## Review and ergonomics

Peer review caught duplicate set members and credential-bearing URLs accepted
by research schemas; both were corrected. Storage review then found missing
residential extraction targets and policy effective/version metadata; focused
RED tests reproduced both gaps before the schemas were extended. Consumers can use one schema catalog
and one validation function without knowing storage infrastructure. Strict
schema failure does not echo raw payloads. JSON Schema is explicitly structural;
Zod's runtime date, interval, uniqueness and reference refinements remain
necessary.

## Boundaries and next iteration

Schema validity is not source authorization, redaction verification, correct
hash computation, or effective-methodology resolution. Those behaviors remain
in later tickets. The existing unversioned storage DTOs remain drafts, avoiding
an unsupported claim that old ingestion payloads satisfy the new agreement.
The next ticket implements candidate registration and access-assessment rules.

Documentation now explains the workbench commands, public research surface,
synthetic examples, structural/runtime distinction, and legacy boundary.
