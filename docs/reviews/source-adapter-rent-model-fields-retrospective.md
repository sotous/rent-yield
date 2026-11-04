# Source-Adapter Rent Model Fields Retrospective

## Outcome

The builder now supports the two requested data points without making them
mandatory for existing candidates. A candidate can declare a verified
category-scoped `propertyType` constant or map exact source values to the
canonical property-type enum. `socialStratum` uses an ordinary format-specific
field recipe and only emits integer values from 1 through 6. Unknown mapped
property types and invalid nonempty strata fail parsing with
`invalid_listing`.

The crawler already serializes `ListingInput` rows, so adding the two optional
properties to that type and adapter output was enough for run artifacts to
preserve them. No source-specific logic was added to the crawler.

The apartment-only Ciencuadras, Araújo & Segovia, and Metrocuadrado candidates
now declare `apartment` for both operations, based on their apartment-scoped
request URLs. The broader D.C. Colombia candidate remains unmapped because its
operation URLs do not establish property type by themselves. No current
candidate maps social stratum; the capability is ready, but a source field
must be evidenced before it is added to a candidate.

## Validation

- Source-adapter builder tests: 35 passed.
- Crawler tests: 13 passed, including artifact pass-through for both fields.
- Builder and crawler typechecks passed.
- Builder and crawler lint passed.
- Prettier and `git diff --check` passed.
- Ciencuadras, Araújo & Segovia, and Metrocuadrado rent/sale candidates built
  successfully with the new contract.

## Assessment

The change met the plan. Keeping both fields optional preserved compatibility
with existing candidates; explicit category constants and source-value maps
provide a clear way to produce canonical types without fuzzy inference. Stratum
validation rejects values outside the Colombian 1–6 range. The remaining data
quality work is source evidence for strata and property types on broad,
uncategorized feeds, followed by normalization into the Rent Model snapshot.
