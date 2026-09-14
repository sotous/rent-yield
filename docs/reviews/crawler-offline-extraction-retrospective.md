# Crawler offline extraction retrospective

## Outcome

Foundation ticket 6 is complete. The fixture-only workbench now proposes a
restricted JSON extraction contract and deterministically replays pinned,
integrity-checked fixtures into typed extraction outcomes. It preserves field
provenance and separates source observations from the narrower rental-evidence
projection.

## What met the plan

- Replay never performs network I/O, reads live policy, activates methodology,
  or persists to storage.
- The parser supports the representative JSON corpus: a single listing, bounded
  listing arrays, and separate sale/rent offers. Explicitly ended empty discovery
  pages are capture-only; unexpected shapes fail explicitly.
- Every source claim keeps its raw scalar value, absolute JSON path, transforms,
  parser/normalizer versions, source dates, collection time when observed, and
  immutable fixture origin and hashes.
- `listing-quality-v1` keeps blocking issues visible. Missing a stable detail URL
  always costs ten points; absence of both URL and stable source ID quarantines.
- Rental evidence requires observed origin, active long-term residential rent,
  positive base monthly COP, explicit built area, and stable identity. Sale data
  never appears in the evidence DTO.

## Divergence and ergonomics

The original redacted synthetic fixture remains a useful ambiguity vector: it
has a separate administration fee but does not declare base-fee scope, active
status, property type, or rental basis, so it now replays as quarantined. A new
explicit-base-rent fixture demonstrates a normalizable fact while still never
creating observed rental evidence because it is synthetic.

The initial slice only recognizes the agreed JSON vocabulary and explicit
detail-style URLs. HTML, text labels, source-specific URL patterns, durable
identity resolution, and provider ingestion remain deliberately outside this
ticket. A future parser needs representative redacted fixtures and a new
contract revision before extending those rules.

## Validation and next iteration

Focused RED/GREEN tests cover deterministic replay, provenance, identities,
URL penalties, malformed mappings, quarantines, quality-score integrity,
dual-offer isolation, and numeric/shape drift. The complete workspace passes
type checking, linting, tests, and fixture-directory scanning.

Ticket 7 should build immutable methodology proposals and fixture validation on
these replay results. It must not turn this offline parser into a live adapter.
