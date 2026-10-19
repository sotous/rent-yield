# Basic Crawler Specification

## Status and purpose

This specification defines the first listing collector for `rent-yield`.

Its job is narrow: collect real Barranquilla rental and sale listings from one
source, turn them into a small local dataset, and provide the facts needed to
estimate rent and rank sale opportunities by gross rent yield.

The collector is a source-specific product component. It is not a crawler
framework.

## Product flow

```text
one source's rental and sale pages
  -> source-specific collector
  -> validated local listing snapshot
  -> comparable-rent estimate
  -> existing backend ranking and explorer
```

Rental listings are evidence for the rent estimate. Sale listings are the
properties shown and ranked in the explorer. They are always separate records.

## First implementation scope

- One selected source.
- Barranquilla only.
- One selected area at a time.
- A developer runs collection manually.
- One checked-in JSON snapshot is the first local dataset format.
- Source-specific URLs and parsing rules live directly in the selected
  collector.

The collector may read result and detail pages when a required fact is missing
from a result page. It must not try to emulate an authenticated or interactive
session when the source denies ordinary access; it stops with a clear failure
and leaves the previous snapshot unchanged.

## Explicit non-goals

- A source registry, profiles, plugins, or multi-source abstraction.
- Generic transport, retry, queue, workflow, scheduler, or pagination
  framework.
- Approval, methodology, health, receipt, or lifecycle state.
- Browser automation, authentication, or challenge handling.
- A database abstraction, durable ingestion layer, or raw-page archive.
- Geocoding, fuzzy matching, amenities, social stratum, or investment
  underwriting.

## Local listing shape

The local dataset uses one price field. Its meaning comes only from
`operation`.

```ts
type ListingOperation = "rent" | "sale";

type ListingInput = {
  id: string;
  operation: ListingOperation;
  priceCop: number;
  builtAreaSqm: number;
  propertyType: "apartment" | "house" | "studio" | "other_residential";
  city: "Barranquilla";
  neighborhood: string | null;
  bedrooms: number | null;
  latitude: number | null;
  longitude: number | null;
  url: string;
  observedAt: string;
};

type RejectedListing = {
  reference: string;
  operation: ListingOperation | "unknown";
  reason:
    | "missing_price"
    | "invalid_price"
    | "missing_built_area"
    | "invalid_built_area"
    | "unknown_operation"
    | "unsupported_property_type"
    | "duplicate"
    | "parse_error";
};

type ListingSnapshot = {
  source: string;
  collectedAt: string;
  city: "Barranquilla";
  area: string;
  listings: ListingInput[];
  rejected: RejectedListing[];
};
```

`id` is the source's stable listing identifier, prefixed by the source name. If
the source has no stable identifier, use its canonical listing URL. A rejected
record retains only an identifier or URL reference and a controlled reason; it
does not retain response bodies or arbitrary source fields.

## Data requirements

Every accepted listing must have a stable identity, a valid URL, a positive
integral COP price, a positive built area, supported residential property type,
Barranquilla city, and an ISO-8601 UTC observation time. `builtAreaSqm` means
built area only: private, interior, total, or inferred measurements must not
be silently substituted.

For the first ranking:

| Listing role | Required use                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `rent`       | Positive monthly asking rent and built area create rent-per-square-metre comparable evidence.       |
| `sale`       | Positive asking price and built area create a sale subject that receives an estimated monthly rent. |

`neighborhood`, `bedrooms`, and coordinates improve matching and presentation
but are not required to collect a valid listing. A sale listing needs an
existing area mapping and finite coordinates before it can appear on the
current map; otherwise it remains in the snapshot and is reported as not yet
displayable.

## Collection behavior

The first collector is an ordinary source-named module and one manual command,
for example:

```text
pnpm collect:listings -- --area <barranquilla-area>
```

Implementation chooses the package that owns the local dataset and backend
adapter; it must not create a new application solely for collection.

Each run:

1. Reads the selected source's rental and sale listings for the requested
   Barranquilla area.
2. Uses source-specific parsing to create `ListingInput` candidates.
3. Validates each candidate locally. Invalid candidates become a controlled
   `RejectedListing` and do not stop valid collection.
4. Deduplicates by `id`; when duplicates share an ID, retain the record with
   more required fields, then the newest `observedAt`. Do not use fuzzy address
   or price matching.
5. Writes a new snapshot atomically only when it contains at least one valid
   rental and one valid sale listing. Otherwise the command fails with counts
   by rejection reason and preserves the prior snapshot.

The first useful dataset targets enough rentals for the three-comparable path
and enough sales to make an explorer ranking meaningful. A run reports its
actual counts; it does not fail because it missed an arbitrary portfolio-size
quota.

## Rent Model and explorer handoff

The collector does not calculate yield. It provides the two record sets for a
small deterministic bridge:

1. For each sale listing, select rental rows with the same city and property
   type. Prefer the same neighborhood when it supplies at least three valid
   rows; otherwise use the city set.
2. Calculate each rental's monthly COP per square metre:
   `priceCop / builtAreaSqm`.
3. Take the median and multiply it by the sale listing's built area to produce
   estimated monthly rent.
4. Map the sale listing, estimated monthly rent, area mapping, and coordinates
   into the existing backend `PropertyRepository` result. Existing backend
   metric and ranking code then calculates gross rent yield.

If fewer than three valid comparable rentals exist, the sale listing is not
ranked. A sale listing never becomes its own rental evidence, and rent is never
derived from sale price.

## Minimum tests

- A source fixture yields one valid rent row and one valid sale row.
- Missing, zero, non-COP, or malformed price; missing or non-built area;
  unknown operation; and unsupported property type produce a controlled
  rejection.
- Deduplication by stable ID is deterministic.
- Snapshot output keeps rent and sale rows separate.
- Three valid rentals produce the expected median rent-per-square-metre and
  estimated monthly rent for a qualifying sale listing.
- Invalid, duplicate, and sale rows cannot affect the comparable estimate.
- A local snapshot-backed adapter produces the existing explorer ranking for
  the selected area without a frontend or HTTP-contract change.

## Acceptance criteria

- One engineer can implement the first collector without inventing a generic
  crawler abstraction.
- A manually collected snapshot contains real, traceable rental and sale
  listings that satisfy the required fields above.
- The snapshot produces a visible, deterministic explorer ranking when enough
  comparables and displayable sales are present.
- The implementation adds no platform concepts listed in the non-goals.
