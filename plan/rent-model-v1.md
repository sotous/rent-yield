# Rent Model V1

## Status

Approved on 2026-08-11. The four approval questions at the end of this plan
were confirmed. Execution must be tracked through the Notion task breakdown.

The repository currently implements only the initial input-contract workbench:
it inspects listing-shaped records, identifies crawler and storage requirements,
and proves that sale price is excluded from the model request. Comparable
selection, estimation, evidence classification, benchmark fallback, and the
complete regression matrix remain planned work.

## Goal

Define and implement a standalone, interpretable Rent Model that estimates the
monthly long-term residential asking rent a property could reasonably achieve
in COP, based on rental-market evidence and residential property
characteristics.

The model is not guaranteed income, collected rent, ROI, net cash flow, or a
sale-price-derived rent assumption.

## Product decisions

- Scope: long-term residential asking rent.
- Currency: COP.
- Included amount: base monthly asking rent; exclude utilities,
  administration fees, and variable fees. Parking is a property feature unless
  its charge is bundled into the listed rent.
- Primary output: monthly point estimate and monthly plausible range.
- Additional output: confidence level, data coverage, estimate as-of date,
  generation timestamp, evidence references, and observed/modeled basis.
- Rent and sale price are independent. Sale price is used only after rent
  resolution to calculate annual rent, gross rent yield, and sale-to-rent ratio.
- The model is consumer-agnostic. Explorer behavior, ranking, underwriting,
  frontend presentation, and HTTP/API design are out of scope.

## Data foundation

The planned data lake and Colombian real-estate web crawlers are the source of
real subject properties and their characteristics. A sales-listing crawler is
well suited to collecting sale asking price, location, area, property type,
bedrooms, bathrooms, and listing metadata for the property being assessed.

However, sales observations alone cannot identify market rent without making a
sale-price-derived assumption. A defensible rent estimate requires an
independent rental-evidence dataset containing observed long-term asking rents.
The V1 evidence hierarchy is therefore:

1. Crawled long-term rental listings, normalized into rental observations.
2. A licensed or partner rental-market feed, if available.
3. Curated, dated rent-per-square-meter benchmarks with documented sample size
   and provenance.
4. `insufficient_data` when no qualifying rental evidence or benchmark exists.

The sales crawler may supply the subject property, but its sale-price fields
must be excluded from the Rent Model input interface. It cannot substitute for
rental comparables, and sale listings must not be used to construct the rent
range, evidence level, or fallback tier.

In practical terms, sale asking price is generally easier to collect from a
sales-focused crawl, while rent is the harder value to establish because it
needs direct rental observations. That difficulty is a data-acquisition issue,
not a reason to infer rent from price.

## Required deterministic workflow tools

The Rent Model requires these discrete, testable tools or modules:

1. **Listing normalizer** — converts raw Colombian property listings into a
   canonical model input, including source-qualified ID, canonical geography,
   property type, built area, observed rent when present, observation date, and
   provenance.
2. **Rental-evidence store** — provides an immutable, dated snapshot of
   observed rental listings and curated benchmarks. This can initially be
   fixture-backed; the future data lake is an implementation of the same
   boundary.
3. **Identity and deduplication resolver** — excludes the subject and retains
   at most one eligible observation per resolved listing/property identity.
4. **Comparable selector** — applies the documented eligibility rules, matching
   tiers, canonical ordering, and size windows.
5. **Rent estimator** — area-normalizes selected comparables and calculates the
   deterministic point estimate.
6. **Spread and evidence classifier** — calculates the empirical market range,
   applies benchmark bands when needed, and returns evidence level plus reason
   codes. It does not produce a probability claim.
7. **Benchmark resolver** — selects only dated, provenance-labeled benchmarks
   that meet their configured sample thresholds.
8. **Snapshot and configuration registry** — supplies model ID/version,
   as-of date, parameter versions, and reproducible input-snapshot identity.
9. **Validation and regression harness** — runs golden fixtures, input-order
   permutations, sale-price independence tests, threshold-boundary tests, and
   data-quality checks.

These are model workflow tools, not APIs or UI components. They can begin as
pure TypeScript modules and fixture-backed repositories; crawler and data-lake
adapters are separate infrastructure concerns.

## V1 methodology

Use a deterministic comparable-based estimator with a benchmark fallback.

The algorithm is deterministic even where it uses statistical summaries. Given
the same immutable input snapshot, model version, configuration, and as-of
date, it must produce the same point estimate, range, evidence level, selected
comparables, fallback tier, and metadata. Statistics describe evidence
uncertainty; they do not make execution random. V1 uses descriptive empirical
spreads and rule-based evidence labels, not calibrated probabilities,
confidence intervals, or prediction intervals.

### Evidence eligibility

A comparable must be a residential listing with:

- positive observed monthly asking rent;
- usable built area in square meters;
- matching city and compatible property type;
- source identity/provenance;
- no duplicate source listing;
- not the subject property itself.

Modeled rents must not be counted as comparable evidence. Historical listings
may be used with a freshness penalty and explicit date metadata.

The estimator must not consume sale price, sale price per square meter, gross
rent yield, sale-to-rent ratio, investor ranking, or any field derived from
those values. This applies to eligibility, matching, deduplication, outlier
handling, range calculation, evidence labeling, and fallback selection.

The subject property and its rental listing must be excluded from its own
comparables, even when sale and rental records use different IDs. Duplicate
URLs, source IDs, normalized addresses, and resolved property identities must
contribute at most one observation per estimator run.

### Matching hierarchy

Use the first tier with sufficient evidence:

1. Same area, property type, stratum preference, and size within ±15%.
2. Same area and property type, size within ±15%, stratum relaxed.
3. Same city, property type, stratum preference, and size within ±15%.
4. Same city and property type, size within ±15%, stratum relaxed.
5. Repeat the relevant area/city tiers with a size window up to ±25%.
6. Curated area benchmark.
7. Curated citywide property-type benchmark.
8. Generic city apartment benchmark.
9. Explicit insufficient-data result.

Use built area consistently. Do not mix built, private, and interior area
without a documented conversion.

Comparable tiers require at least three unique eligible observations. The
estimator selects the first qualifying tier and never silently pools records
from different tiers. Same area means equal canonical `area_id`, not equal
display text. Size-window boundaries are inclusive.

### Estimate

Normalize each comparable to the subject area:

```text
comparable_rent_per_sqm = comparable_monthly_rent / comparable_built_area_sqm
adjusted_rent = comparable_rent_per_sqm * subject_built_area_sqm
```

Use the ordinary unweighted median adjusted rent as the point estimate, with
deterministic tie-breaking. For V1, do not automatically remove statistical
outliers; reject only invalid data, duplicates, impossible measurements, and
known fee or currency inconsistencies. Any future outlier rule must be
versioned, defined before execution, and record excluded IDs and reasons.

Freshness affects eligibility and evidence labeling, not the rent value, until
a weighting rule is calibrated. Do not introduce unsupported fixed percentage
adjustments for bedrooms, bathrooms, furnishing, parking, floor, building age,
or amenities. Those fields are either explicit matching keys or evidence
signals; missing values never become guessed adjustments.

All intermediate calculations use decimal precision. COP values are rounded
only at publication using one documented half-up rule and configured rounding
unit.

### Minimum evidence and confidence

- Three comparable listings are the minimum for a comparable-based estimate.
- Five or more comparable listings support medium confidence when reasonably
  homogeneous.
- Eight or more strong same-area comparables may support high confidence.
- Three or four heterogeneous comparables produce low confidence and a wide
  range.
- Existing benchmark thresholds remain: area 8, city/property type 5, generic
  city apartment 3.
- Confidence is categorical (`high`, `medium`, `low`) with reason codes; do not
  expose a numeric score until calibrated.

### Range

- 8+ comparables: P25–P75 of adjusted rents.
- 5–7 comparables: P20–P80.
- 3–4 comparables: minimum–maximum, labeled wide.
- Benchmark fallback: configured uncertainty band labeled benchmark-derived.

The range describes asking-rent market uncertainty, not achieved-rent income
or a yield interval.

The range is calculated from the selected comparable tier after validation and
documented exclusions. Its percentile algorithm must be fixed in the
implementation contract. Range invariants are:

```text
0 < lower_amount <= monthly_rent_amount <= upper_amount
```

Benchmark ranges must be stored or configured explicitly with their own
uncertainty band, vintage, and provenance. They cannot be inferred from sale
price or described as comparable spreads.

## Real-listing input boundary

The primary test input is a real residential property listing from a Colombian
real-estate website, initially scoped to Barranquilla and its relevant areas.
The input should be shaped like a real listing record and normally contain:

- source name, source listing ID, URL, and collection timestamp;
- city, canonical area, neighborhood or sector, and coordinates when available;
- residential property type;
- built area in square meters;
- bedrooms, bathrooms, stratum, and available amenities;
- observed monthly asking rent when the listing is for rent;
- sale asking price when the listing is also for sale;
- listing publication/observation date and source provenance.

Sale price may be present in the real listing fixture because it is part of the
actual property record, but it must be removed at the Rent Model input boundary
and supplied only to the downstream yield calculation.

Real listings exercise normalization and missing-data paths realistically.
Tests must nevertheless use frozen, provenance-labeled snapshots rather than
live web requests. Each fixture should preserve the raw source reference,
normalized record, extraction date, and expected model output. Include both
complete listings and realistic partial listings; the model must not assume
every website provides every field.

## Deterministic execution contract

Every modeled result must record:

- immutable input snapshot or feed version;
- `model_id` and `model_version`;
- matching, freshness, range, and rounding configuration versions;
- `as_of_date` and UTC `generated_at`;
- selected comparable IDs in canonical order;
- selected fallback tier and reason code;
- benchmark ID and vintage when applicable;
- exclusion counts and reasons where useful for audit.

Input collections must be canonicalized before processing. No result may depend
on filesystem order, database order, provider response order, async completion
order, or the current clock. Stable IDs provide final tie-breaking.

Required tests include permutation invariance, repeated execution with
different clocks, sale-price independence for subjects and comparables,
modeled-rent exclusion, duplicate/subject exclusion, deterministic fallback,
and explicit insufficient-data behavior.

## Domain contract

Introduce a coherent rent assessment rather than treating rent metadata as
unrelated scalar fields:

```ts
type RentAssessment = {
  monthly_rent_amount: number;
  monthly_rent_range: {
    lower_amount: number;
    upper_amount: number;
    currency: "COP";
    basis: "comparables" | "benchmark";
  } | null;
  rent_basis: "observed" | "modeled" | "observed_with_model_context";
  evidence_level: "high" | "medium" | "low" | null;
  confidence_reasons: string[];
  as_of_date: string;
  generated_at: string | null;
  comparable_ids: string[];
  fallback_tier: string | null;
  benchmark_id: string | null;
  benchmark_vintage: string | null;
  model_id: string | null;
  model_version: string | null;
};
```

The implementation should use a discriminated union so modeled results cannot
omit required evidence metadata. At minimum, distinguish observed,
modeled-comparable, modeled-benchmark, observed-primary-with-modeled-context,
and insufficient-data assessments. `model_id`, `model_version`, range,
evidence level, as-of date, and generation timestamp are mandatory for modeled
assessments. Benchmark assessments also require benchmark ID, vintage, source,
and uncertainty-band configuration. `source_range` is deferred unless an
upstream source-range contract is defined separately.

Observed rent remains a source fact. A modeled estimate must include range,
confidence, as-of date, generation time, model version, and evidence. Manual
import describes transport/provenance and does not by itself mean modeled.

When both observed and modeled values exist, preserve both and resolve the
observed value as primary while exposing the model as context.

Existing `monthly_rent_amount`, `rent_source_type`, and `metric_status` remain
compatibility projections during the migration, not independent sources of
truth.

## Model boundary and data sources

The Rent Model owns:

- input validation and canonical property representation;
- comparable eligibility, deduplication, and matching;
- point estimate, empirical range, evidence level, and fallback behavior;
- model versioning, reproducibility, and evidence traceability.

Real State Compass is an available source of real Colombian residential
listing-shaped inputs, rental observations, and curated market benchmarks. Its
listing adapters may be reused or extended only when needed to create valid
model inputs. No consumer application needs to be wired for this feature.

The model must expose a pure, testable input/output boundary. It must not
depend on Fastify, HTTP, map state, frontend types, sale-price calculations,
underwriting, or a live website at execution time.

Real listing fixtures must be frozen snapshots with source provenance. Live
scraping and deployment/runtime integration are deferred.

## Expected implementation slices

1. Create `apps/rent-model` as a standalone developer workbench. It is a
   fixture-backed CLI/library for inspecting model inputs and outputs; it has no
   HTTP, database, or frontend responsibility.
2. Define the standalone Rent Model input/output contract and mathematical
   specification.
3. Create frozen Barranquilla listing-shaped fixtures, including complete,
   partial, duplicated, historical, and invalid records.
4. Implement and test normalization, eligibility, deduplication, matching
   tiers, area normalization, median estimation, empirical range, evidence
   labeling, and benchmark fallback.
5. Add reproducibility and metamorphic tests for order, clock, sale-price, and
   duplicate invariance.
6. Validate the model against real-listing-shaped fixtures and document known
   limitations, without claiming statistical calibration.
7. Perform the required retrospective and update the model documentation.

## Rent Model Workbench

`apps/rent-model` is the first development surface for the model. It should
make the model's needs visible before a data lake or consumer server is wired.

Its initial responsibilities are:

- analyze frozen Colombian sale and rental listing-shaped records;
- report which database fields are required, optional, missing, or invalid;
- report the crawler extraction requirements implied by those fields;
- emit a server-ready, transport-neutral Rent Assessment object or a typed
  insufficient-data result;
- provide repeatable fixtures and a CLI for inspecting those outputs locally.

It must remain a pure TypeScript package with no live crawling, HTTP server,
database connection, or frontend. The data lake and crawlers will later satisfy
the workbench's explicit input contract.

## Files likely to change

### rent-yield

- `specs/domain-spec.md`
- new `docs/architecture/rent-model-v1.md`
- new `apps/rent-model/` workbench package, CLI, tests, and fixtures
- explicit rent-model fixtures and benchmark fixtures

### Real State Compass

- `tools/listing_source_adapter/`
- existing `tools/city_market_study/`
- real-listing fixture snapshots and model-input normalization only where
  required by the standalone model

## Explicitly out of scope

- explorer API or frontend changes;
- map/chart ranking and area summaries;
- rent-yield integration and gross-yield calculation;
- investor underwriting, financing, expenses, or ROI;
- live scraping and provider deployment;
- machine-learning training or online model fitting;
- achieved-rent or lease-outcome calibration;
- fuzzy cross-source entity resolution beyond deterministic fixture rules.

## Risks and assumptions

- Current source data may not contain enough bedrooms, bathrooms, amenities,
  coordinates, or observation dates for high-confidence estimates.
- Asking rent is not achieved rent; all UI and API language must preserve that
  distinction.
- Free-text areas require stable normalization before cross-repository use.
- Benchmark data must retain vintage and provenance; it must not be presented as
  live observed evidence.
- The model's evidence level is not a calibrated probability of achieved rent.
- Missing source fields must reduce evidence quality or produce an explicit
  unavailable result; they must never be silently guessed.

## Validation strategy

Tests must follow RED → GREEN → REFACTOR:

- pure domain tests for eligibility, matching tiers, normalization, median,
  ranges, outliers, confidence, fallbacks, determinism, and sale-price
  independence;
- model input normalization and fixture tests for IDs, areas, provenance,
  dates, and missing fields;
- regression fixtures clearly marked synthetic or provenance-labeled.

The real-listing fixture matrix must include:

- one complete Barranquilla rental listing;
- one sale-and-rental listing where sale price is excluded from estimation;
- incomplete listings with missing area, date, coordinates, or rent;
- duplicate URLs and cross-source records for the same property;
- the subject's own sale and rental records;
- exact three-comparable minimum;
- every matching-tier boundary;
- benchmark area, city/property-type, generic, and insufficient-data fallbacks;
- repeated input permutations and equal-value tie cases;
- historical observations at the freshness cutoff;
- modeled-rent records that must be rejected as comparables.

Success means a modeled rent cannot appear without its required uncertainty and
evidence metadata, insufficient evidence does not produce a misleading precise
estimate, and changing or removing sale-price data does not change any Rent
Model output.

## Approval questions

1. Approve the V1 scope as long-term residential asking rent, excluding
   utilities, administration, and variable fees?
2. Approve the comparable thresholds and benchmark fallback hierarchy?
3. Approve the deterministic mathematics and reproducibility contract,
   including unweighted median, frozen snapshots, explicit as-of dates, and
   descriptive rather than probabilistic ranges?
4. Approve keeping consumers, APIs, and frontend integration explicitly out of
   scope for this Rent Model slice?
