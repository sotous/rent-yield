# Source-Adapter Property-Type and Social-Stratum Plan

## Status

Completed. The candidate contract separates source identity from each
operation's collection requests, and the builder and crawler digest multiple
verified property-type requests.

## Objective

Represent a listing source's supported residential property types without
labeling the source candidate itself as one fixed type. Let the builder and
crawler consume multiple verified collection requests per operation, or a
single mixed feed whose rows expose a mapped type.

## Contract decisions

- A candidate identifies a source and geography. It does not have one
  `propertyType` value assigned to the source as a whole.
- Each rent or sale operation may contain one or more named collection requests.
  A request owns its URL and extraction recipe.
- A request may use a property-type constant only when its verified URL or
  request parameters restrict results to that one type. A mixed request must
  map a verified per-listing type field.
- The candidate-finding skill records the residential types it verified and
  how each type is retrieved. A UI filter's existence alone is not a request
  recipe; the request URL and representative response/page must be verified.
- Keep the legacy one-request operation shape readable during migration so
  existing checked-in candidates and downstream callers continue to work.
- The builder exposes every configured request to the crawler. The crawler
  executes requests sequentially, parses each with its own recipe, and records
  request-level outcomes alongside the operation summary.
- Missing social stratum remains optional; an invalid configured value remains
  a parse failure. Existing property-type mapping behavior remains strict.

## Approach

1. Define the new candidate request-list shape and validation rules while
   retaining legacy single-request candidates. Completed.
2. Add focused tests for multiple category requests, mixed-feed field mappings,
   duplicate request identifiers, invalid URLs/recipes, and legacy compatibility.
   Completed.
3. Update the built adapter API to expose requests by operation and validate
   response URLs against the exact request recipe. Completed.
4. Update crawler execution and run artifacts to fetch all requests in order,
   aggregate listings per operation, and preserve request-level failures.
   Completed.
5. Update the candidate-finding skill and source-adapter documentation so
   source-level discovery is distinct from per-request property-type evidence.
   Completed.
6. Revisit existing candidate artifacts. Retain constants only on verified
   category-scoped requests; use mapped type fields for mixed results; do not
   claim unsupported categories without evidence. Completed.
7. Update the crawler specification and retrospective, then run focused tests,
   typechecks, lint, formatting, and diff checks. Completed.

## Risks and assumptions

- Search pages may expose category controls while still rendering only one
  category. The skill verifies the actual request/result scope rather than
  treating visible controls as proof that a recipe collects every type.
- The supported canonical type enum remains residential. Commercial categories
  must not be coerced into `other_residential`.
- Source-specific request URLs and field mappings must be observed; do not infer
  route patterns from labels in a dropdown.

## Likely files

- `apps/crawlers/source-adapter-builder/src/adapter-candidate.ts`
- `apps/crawlers/source-adapter-builder/src/source-adapter-builder.ts`
- `apps/crawlers/source-adapter-builder/src/*.test.ts`
- `apps/crawlers/crawler/src/crawler.ts` and tests
- `apps/crawlers/source-adapter-builder/candidates/*.json`
- `.codex/skills/find-candidates/SKILL.md`
- `apps/crawlers/source-adapter-builder/README.md`
- `docs/specs/crawler-poc-spec.md`

## Success criteria

- A candidate can describe multiple verified requests for rent and sale without
  assigning one property type to the source as a whole.
- Category-scoped requests assign a constant only to their own output; mixed
  requests map the listing's actual type.
- The builder and crawler execute every configured request and retain clear
  request-level results and failures.
- Existing one-request candidates remain accepted during migration.
- Ciencuadras has separately verified apartment, house, and apartaestudio
  requests for rent and sale; each request carries its own category scope.
- Araújo & Segovia and Metrocuadrado retain apartment-scoped request entries;
  those entries do not declare the whole source apartment-only.
