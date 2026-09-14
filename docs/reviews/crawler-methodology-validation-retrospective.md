# Crawler methodology validation retrospective

## Outcome

Foundation ticket 7 is complete. The fixture-only workbench can now turn a
strict declarative methodology manifest into a canonical, content-addressed
proposal and validate its exact pinned fixture evidence offline.

## What met the plan

- Manifest and validation-report identity is deterministic: declared set fields
  are canonicalized before SHA-256 while mutable review state stays outside the
  manifest digest.
- Proposal intake validates an injected adapter registry against key, artifact,
  parser, normalizer, supported contract version, and extraction strategy.
- Validation checks manifest integrity, adapter registration, fixture and
  extraction-contract pins, redaction/retention references, and replay outcome
  classification. Its reports contain only typed, sanitized issues.
- A passing report can assemble a reviewable methodology proposal. A failed
  report remains evidence but cannot create an approval-eligible proposal.
- The implementation has no network transport, durable storage, clock-based
  activation, publication, or review-decision capability.

## Divergence and ergonomics

The earlier shared schemas described manifests and reports but did not provide
canonical digest helpers. This slice added them to the shared contract package
so later lookup and provider work share the exact same identity rules. The
application keeps the generic extraction-contract digest local because its
content is already an immutable parser artifact and no shared cross-provider
consumer exists yet.

Adapter registration remains an injected in-memory allowlist. A durable registry
and approved-effective methodology resolution are deliberately reserved for
ticket 8 and provider-conformance work.

## Validation and next iteration

Focused RED/GREEN tests cover semantic-set ordering, immutable-content changes,
registry mismatches, changed extraction pins, absent fixtures, replay integrity,
parser incompatibility, and sanitized failures. The full workspace passes
typecheck, lint, tests, and fixture scanning.

Ticket 8 should implement trusted append-only review decisions and
approved-effective lookup. It must require this exact successful validation
report and continue to fail closed; it should not introduce live crawling.
