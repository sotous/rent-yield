# Source Adapter Specification

## Status and authority

This is the canonical specification for source adapters in `rent-yield`.
It defines the shared `ListingInput` contract and the fixture-first boundary
between one selected listing source and downstream consumers.

The delivery record is
[`plan/source-adapter-builder.md`](../plan/source-adapter-builder.md). This
specification does not define how a fixture is collected, stored, or published.

## Purpose

A source adapter translates the response shape of one selected listing source
into a source-neutral `ListingInput`. It lets new sources be added without
teaching shared storage or the Rent Model each source's field names and nesting.

The first adapter is `ciencuadras` rental discovery for Barranquilla, Colombia.
It is intentionally the only supported source-adapter scope in version one.

## Boundary

```text
frozen source fixture -> source-specific adapter -> ListingInput[]
                                           -> shared storage / Rent Model inputs
```

An adapter parses only a local frozen fixture. It does not make HTTP requests,
choose a source, request a page, manage a queue, retain source bodies, or
calculate rent, yield, or ranking.

## Source-local layout

Every source adapter lives in one place:

```text
apps/crawlers/src/sources/<source-key>/
```

The source directory contains the adapter, its focused tests, and source-only
fixture metadata. Shared contracts, schema validation, and generic test helpers
live outside the directory.

`apps/crawlers/src/adapters/sources/` is not a valid location and must not be
introduced. This resolves the earlier proposed-location conflict.

## Shared `ListingInput` contract

`ListingInput` describes one observed listing, not a merged property and not a
model result. A field is populated only from an explicit source claim. Unknown
or unavailable values are `null`; adapters do not infer them.

```ts
type ListingRole = "for_rent" | "for_sale";
type CanonicalDecimal = string;

type ListingInput = {
  source_key: string;
  source_listing_id: string | null;
  listing_url: string | null;
  collected_at: string;
  source_published_at: string | null;
  source_updated_at: string | null;

  country_code: "CO";
  city_name: string;
  neighborhood_name: string | null;
  latitude: CanonicalDecimal | null;
  longitude: CanonicalDecimal | null;

  listing_role: ListingRole;
  listing_status: "active" | "inactive" | "unknown";
  property_type: "apartment" | "house" | "studio" | "other_residential" | null;
  built_area_sqm: CanonicalDecimal | null;
  bedrooms: number | null;
  bathrooms: number | null;
  social_stratum: 1 | 2 | 3 | 4 | 5 | 6 | null;

  sale_asking_price_cop: CanonicalDecimal | null;
  monthly_asking_rent_cop: CanonicalDecimal | null;
  administration_fee_cop: CanonicalDecimal | null;
  fees_included_in_asking_price: boolean | null;

  field_provenance: ListingFieldProvenance[];
  adapter_version: string;
};

type ListingFieldProvenance = {
  field: string;
  source_path: string;
  raw_value: string | number | boolean | null;
};
```

The current shared contract uses canonical decimal strings for decimal-valued
claims, preserving the exact source value until a downstream consumer has an
explicit numeric boundary. It must retain these field names and semantics.

### Required values

Every `ListingInput` requires:

- `source_key` matching the adapter's declared source;
- at least one stable identity: a non-empty, source-local `source_listing_id`
  or a stable `listing_url`;
- `country_code: "CO"`;
- non-empty `city_name`;
- exactly one `listing_role`;
- a valid `collected_at` timestamp;
- `adapter_version`; and
- one provenance entry for each non-null source-derived data value other than
  adapter-owned metadata.

`listing_url` is optional because a source may provide a stable source ID but no
stable public URL.

### Price and rent semantics

`sale_asking_price_cop` and `monthly_asking_rent_cop` are separate facts.

- A `for_sale` listing may populate only `sale_asking_price_cop`.
- A `for_rent` listing may populate only `monthly_asking_rent_cop`.
- An adapter must set the other amount to `null`.
- Amounts are positive COP asking amounts when present; unknown currency,
  frequency, or amount means the corresponding value is `null`.
- `administration_fee_cop` is separate from asking price. When fee treatment is
  not explicit, `fees_included_in_asking_price` is `null`.

The Rent Model decides whether a rental listing is usable as rental evidence.
In particular, the adapter does not claim that a rental amount is base rent or
that it is eligible for modeling.

### Property and location semantics

`built_area_sqm` means explicitly stated built area only. Private, interior,
or total area must not be substituted. Numeric property values are populated
only when the source gives an unambiguous value. An unrecognized property type,
status, or location stays `null` or `"unknown"` as appropriate.

Coordinates are optional source claims; they are not geocoded or derived by an
adapter. `city_name` remains the source-provided city label. Canonical area IDs
and property resolution belong downstream.

### Provenance

Each provenance entry points to the source path from which its value was read,
such as a JSON pointer or an HTML selector. Transformations must be documented
by the source adapter and tested against its fixture. The adapter may normalize
formatting (for example, whitespace or a numeric string) but must not invent a
fact, silently replace a missing value, or conceal ambiguity.

## Adapter interface

The implementation follows this conceptual interface:

```ts
type SourceFixture = {
  source_key: string;
  collected_at: string;
  content_type: "application/json" | "text/html";
  body: string;
};

type SourceAdapter = {
  source_key: string;
  supported_content_types: Array<"application/json" | "text/html">;
  parseFixture(input: SourceFixture): SourceAdapterResult;
};

type SourceAdapterResult =
  | { kind: "listed"; listings: ListingInput[] }
  | {
      kind: "parse_failed";
      code:
        | "invalid_fixture"
        | "source_mismatch"
        | "unsupported_content_type"
        | "unsupported_shape"
        | "invalid_listing_input";
    };
```

Call the shared `parseSourceFixture(adapter, input)` boundary rather than a
source-local parser directly. It validates the fixture shape, source key, and
supported content type before parsing, then validates every listed result as
`ListingInput` with a matching source key. It preserves source order. A
recognized empty discovery fixture returns `{ kind: "listed", listings: [] }`;
a malformed, unsupported, mismatched, or invalid result returns `parse_failed`
rather than partial guessed records.

## Ciencuadras v1

| Item            | Decision                                                 |
| --------------- | -------------------------------------------------------- |
| Source          | `ciencuadras`                                            |
| City            | Barranquilla                                             |
| Country         | Colombia (`CO`)                                          |
| Listing role    | `for_rent` only                                          |
| Supported input | one documented frozen discovery-fixture shape            |
| Output          | ordered `ListingInput[]`                                 |
| Deferred        | detail pages, sale listings, other cities, other sources |

Implementation starts only after a representative sanitized fixture exists.
The fixture is the evidence for the declared response shape; the adapter must
not be built from assumptions about a source page.

When retaining a full source response is unnecessary or unsafe, a source-local
**structural fixture** may instead preserve only confirmed element/script IDs,
object nesting, and field names. Listing-specific scalars must be deterministic
non-source test values; a required page-level metadata claim, such as city, may
be retained when it is the exact claim the adapter must prove. Its adjacent
documentation must identify the source structures confirmed during in-memory
inspection and state that the fixture is test evidence, not crawler output or a
source-data archive.

## Versioning and validation

Each source adapter declares a human-readable version. A change in supported
fixture shape or any `ListingInput` mapping is a new version and requires a new
fixture and regression coverage. A behavior-preserving refactor is not a new
version.

Tests must prove:

- deterministic output for a fixture;
- required values and provenance are present;
- source order is preserved;
- empty recognized input returns no records;
- malformed, mismatched, and unknown shapes fail explicitly;
- price and rent cannot populate one another; and
- no network request occurs during adapter tests.

## Non-goals

- fetching, request options, scheduling, retries, pagination, or browser work;
- source selection, permission decisions, or fixture capture workflows;
- durable storage, listing deduplication, canonical area assignment, or data
  publication;
- Rent Model execution, yield calculation, or explorer presentation.
