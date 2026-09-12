# Crawler fixture remediation

## Status

Proposed on 2026-09-12 after review of PR #6. This plan repairs ticket 5
before merge. It does not begin ticket 6, enable live transport, or expand the
canary scope.

## Goal

Make committed crawler fixtures safe to retain, faithfully attributable to the
received bytes, and verifiable as one immutable fixture set.

## Relevant references

- `specs/crawler-research-spec.md`
- `plan/crawler-research-and-methodology-foundation.md`
- `docs/architecture/crawler-foundation-contract-agreement.md`
- PR #6 review findings

## Remediation slices

### 1. Restore exact provenance and contract validity

- Hash the original `Uint8Array` before text decoding; hash UTF-8 encoded bytes
  only when callers supplied a string.
- Require `original_entity_sha256` for permitted-source fixtures. If legacy
  import support is needed later, represent it as an explicit legacy origin
  variant rather than a nullable current-capture field.
- Canonicalize the declared set fields (`permitted_use` and
  `parser_compatibility`) when constructing and verifying envelopes, and reject
  duplicates through typed validation rather than uncaught errors.
- Version the actual redaction rule artifact: its hash preimage must include
  stable rule identifiers and definitions, not only category labels.

### 2. Replace unsafe content handling

- Separate origin URL canonicalization from payload URL treatment. Origin URLs
  retain the strict HTTPS/no-credential/no-query/no-fragment rule; payload URLs
  retain semantic query parameters while removing only prohibited tracking or
  credential data.
- Use structural HTML parsing and sanitization. Remove scripts, event handlers,
  media/image references, `data:` binaries, nested sensitive elements, and
  sensitive attribute values without altering unrelated parser selectors.
- Extend deterministic text and HTML redaction/scanning for Colombian address,
  identity, mobile and landline contact forms. Add false-positive cases for
  ordinary fields such as `community` and `unit-price`.
- Enforce synthetic payload provenance: URL-shaped data must use a reserved
  non-source domain or marker.

### 3. Validate the complete committed fixture set

- Require `fixtures/<fixture-id>/` bundles to contain exactly one envelope and
  one supported payload. Reject every orphan, nested, unknown, symlinked, or
  binary file under the fixture root.
- Build a fixture index after individual validation. Reject duplicate IDs,
  directory/ID mismatch, missing predecessors, forks, cycles, mismatched
  session/origin chains, and invalid correction timestamps.
- Keep diagnostics sanitized: paths and reason codes only, never fixture body
  text.

### 4. Reconcile delivery records and automation

- Mark ticket 5 back in progress while remediation runs, then complete its
  acceptance checks only after the full fixture suite passes.
- Correct stale status wording in the crawler specification and architecture
  agreement. Narrow CR-005 to the implemented fixture-only gate until trusted
  reviewer authority exists.
- Make fixture scanning an actual automated required check through the existing
  root verification entrypoint or repository CI configuration.
- Rewrite the retrospective and project-status review to reflect the final,
  verified result.

## TDD sequence

1. Add failing vectors for BOM-preserving hashes, null provenance, duplicate
   set members, reordered set hashes, and policy-rule digest drift.
2. Add failing JSON, HTML, and text fixtures for nested contacts, exact
   addresses, landlines, unquoted image/media URLs, active attributes, safe
   selectors, payload query identity, and synthetic real-source URLs.
3. Add failing directory vectors for orphan files, nested files, duplicate IDs,
   missing predecessors, forks, cycles, and invalid successor metadata.
4. Implement each smallest behavior change until its focused vector passes.
5. Run the full crawler, shared-contract, root typecheck, lint, formatting, and
   fixture-scanner suites.

## Success criteria

- Every permitted fixture binds to the exact received bytes and a valid,
  canonical envelope.
- Every retained payload is redacted without breaking allowed parser semantics.
- No unrecognized file or invalid lineage can enter the committed fixture set.
- The repository automation runs the fixture scanner for pull requests.
- Plan, specification, architecture record, Notion task, retrospective, and PR
  all state the same completion status.

## Risks and assumptions

- Structural HTML parsing needs a deliberately small, pinned dependency or a
  reviewed built-in parser approach. Its selection must preserve deterministic
  serialized output for hashing.
- Address and identity matching must be tested against false positives; a value
  that cannot be safely retained should be redacted or the fixture rejected.
- This remediation must merge before ticket 6 consumes fixture envelopes.
