# Source-Adapter Property-Type and Social-Stratum Retrospective

## Outcome

The first property-type implementation put a constant inside each operation's
recipe. Although the URLs were apartment searches, the shape made it too easy to
read `apartment` as a property of the entire source candidate. The user correctly
pointed out that Ciencuadras exposes apartment, house, and apartaestudio searches.

Candidates now represent the source and contain named requests per operation.
A request owns its URL and extraction recipe, so a constant type applies only to
that verified category-specific query. A mixed-feed request can instead map the
actual per-listing type field. The builder compiles all requests into a
`SourceAdapter.sourceRequests` map, and the crawler fetches them sequentially,
combines successful listings, and records request-level outcomes under each
operation. Legacy one-request candidates remain accepted as a `default` request.

The Ciencuadras candidate now describes apartment, house, and apartaestudio
requests for both rent and sale. Public category pages showed category-specific
headings, matching category labels in representative listings, and the same card
structure for ID and price extraction. The rent and sale house/apartaestudio
routes were checked individually. Araújo & Segovia and Metrocuadrado remain
configured for their verified apartment category routes; their candidates no
longer imply that those organizations offer only apartments. Social stratum
remains optional and no source mapping is added without source-field evidence.

## Validation

- Source-adapter builder tests: 35 passed, including multiple request parsing
  and validation.
- Crawler tests: 15 passed, including multi-request aggregation and partial
  results when one category request fails.
- Builder and crawler typechecks passed.
- Builder and crawler lint passed.
- Prettier and `git diff --check` passed.
- Ciencuadras candidate builds with three requests each for rent and sale.

## Assessment

The change now makes the candidate-to-builder handoff explicit: discovery
identifies source operations, residential types, and evidenced retrieval
recipes; the builder consumes those requests and parses each response; the
crawler executes them. The fixed-type value is attached to a request whose
scope is verified, not to the source identity. The remaining follow-up is to
validate the other source candidates for broader residential type coverage and
to map social stratum only where an actual source field is verified.

## Public evidence reviewed

- [Ciencuadras apartment rentals](https://www.ciencuadras.com/arriendo/barranquilla/apartamento)
- [Ciencuadras house rentals](https://www.ciencuadras.com/arriendo/barranquilla/casa)
- [Ciencuadras apartaestudio rentals](https://www.ciencuadras.com/arriendo/barranquilla/apartaestudio)
- [Ciencuadras apartment sales](https://www.ciencuadras.com/venta/barranquilla/apartamento)
- [Ciencuadras house sales](https://www.ciencuadras.com/venta/barranquilla/casa)
- [Ciencuadras apartaestudio sales](https://www.ciencuadras.com/venta/barranquilla/apartaestudio)
