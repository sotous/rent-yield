# Source-Adapter Rent Model Fields Plan

## Status

Completed. The user requested adding `property_type` and `social_stratum`
support to the source-adapter builder.

## Objective

Extend adapter candidates and normalized `ListingInput` rows so an operation
can provide a canonical property type and social stratum when the source
evidence supports them. The crawler should preserve these parsed values in its
run artifact.

## Contract decisions

- `propertyType` is an optional extraction-recipe declaration. It supports an
  explicit constant for a verified category-scoped operation, or a source field
  plus an explicit mapping to the Rent Model enum.
- Canonical property types are `apartment`, `house`, `studio`, and
  `other_residential`. Unknown source values fail parsing; the builder never
  guesses from arbitrary listing text or URLs.
- `socialStratum` is an optional field recipe that parses an integer from 1
  through 6. Missing/unmapped fields stay absent; a declared but invalid value
  fails the operation consistently with other mapped fields.
- Both output properties remain optional so existing candidates continue to
  build and run without fabricated values.
- The crawler remains a transport layer; it serializes the additional
  `ListingInput` properties without adding source-specific logic.
- Existing rent/sale semantics and the Rent Model estimator are unchanged.

## Approach

1. Add focused failing tests for constant and mapped property types, social
   stratum parsing/range validation, candidate contract validation, and
   crawler-artifact pass-through.
2. Implement the typed candidate recipes and parser behavior.
3. Update the candidate-discovery skill and builder documentation to explain
   evidence-backed constants, explicit source-value maps, and stratum bounds.
4. Add constants to existing apartment-only candidates where their operation
   URL/category explicitly establishes apartment scope. Do not add guessed
   mappings to broader sources.
5. Run relevant builder and crawler tests, types, lint, formatting, and diff
   checks.

## Risks and assumptions

- Some sources expose category rather than a per-listing type. A constant is
  valid only when the candidate operation is explicitly scoped to that type.
- Source labels vary by language and capitalization. The candidate must provide
  the observed-to-canonical mapping; runtime matching may normalize whitespace
  and case but must not use fuzzy or substring matching.
- Social stratum may be absent for some listings. It remains optional unless a
  candidate explicitly maps it; out-of-range values are invalid evidence.
- The current crawler normalizer work must treat these new properties as
  optional inputs and continue surfacing other missing Rent Model fields.

## Likely files

- `apps/crawlers/source-adapter-builder/src/adapter-candidate.ts`
- `apps/crawlers/source-adapter-builder/src/source-adapter-builder.ts`
- `apps/crawlers/source-adapter-builder/src/adapter-candidate.test.ts`
- `apps/crawlers/source-adapter-builder/src/source-adapter-builder.test.ts`
- `apps/crawlers/crawler/src/crawler.test.ts`
- `apps/crawlers/source-adapter-builder/candidates/*.json`
- `.codex/skills/find-candidates/SKILL.md`
- builder and crawler documentation

## Success criteria

- Candidates can declare a verified constant or evidence-backed mapping for
  property type and an optional stratum field recipe.
- Parsed listing rows include only canonical property types and valid integer
  strata from 1 through 6.
- Invalid mapped values return typed parse failures; absent optional recipes do
  not break existing candidate behavior.
- The crawler artifact preserves both normalized fields without extra
  source-specific handling.
- Documentation and candidate examples match the tested contract.
