# Rent Model Specification

## Status And Authority

This is the canonical specification for the `rent-yield` Rent Model.

It defines the version-one deterministic model for Colombia, initially
Barranquilla. It supersedes the Rent Model methodology portions of
[`plan/rent-model-v1.md`](../plan/rent-model-v1.md) after implementation
decisions are made. The plan remains the execution record. The shared domain
spec owns common product metrics; the crawler research specification owns
source-research and crawler authorization rules.

## Purpose

The Rent Model estimates the base monthly long-term residential **asking rent**
a subject property could reasonably achieve, in COP, from independent rental
market evidence and residential property characteristics.

It does not estimate:

- collected or achieved rent;
- guaranteed income;
- utilities, administration fees, or other variable fees;
- net cash flow, ROI, underwriting, or yield;
- rent inferred from sale price.

Parking may remain part of an observed asking-rent amount only when the source
lists it as bundled with the property. The model does not separately value
parking in version one.

The Rent Model is consumer-agnostic. It has no HTTP, database, frontend, map,
or server responsibility.

## Product Boundary

```text
for-sale listing  -> subject property characteristics
for-rent listings -> observed rental evidence
Rent Model        -> Rent Assessment
downstream only   -> annual rent, gross yield, consumer presentation
```

For-sale and for-rent observations remain distinct. A sale listing can supply a
subject property, but cannot become rental evidence. Rental observations and
qualified benchmarks are the only evidence sources for a modeled estimate.

## Vocabulary

- **Subject property**: the residential property being assessed.
- **Rental observation**: a dated, provenance-qualified observed long-term
  monthly asking-rent record.
- **Comparable**: a unique eligible rental observation selected for a subject.
- **Benchmark**: a dated, provenance-qualified market rent reference used only
  when there are insufficient qualifying comparables.
- **Observed rent**: a rent directly stated by a source for the subject.
- **Modeled rent**: a deterministic estimate from comparables or a benchmark.
- **As-of date**: the UTC market-date cutoff for evidence eligibility.
- **Snapshot**: an immutable collection of normalized rental observations and
  benchmarks identified by a stable ID.
- **Evidence level**: `high`, `medium`, or `low`; a categorical description of
  evidence quality, not a probability or confidence interval.
- **Insufficient data**: no valid modeled estimate can be supported by the
  available snapshot.

## Canonical Inputs

### Subject Property

The subject input must contain:

```ts
type RentModelSubject = {
  subject_id: string;
  country_code: "CO";
  city_id: string;
  area_id: string | null;
  property_type: "apartment" | "house" | "studio" | "other_residential";
  built_area_sqm: Decimal; // greater than zero
  social_stratum: 1 | 2 | 3 | 4 | 5 | 6 | null;
  observed_monthly_asking_rent_cop: bigint | null;
  observed_rent_provenance: SourceProvenance | null;
};
```

`built_area_sqm` is the only area measure used for matching and normalization.
`interior_area_sqm`, private area, gross area, and other measurements must not
be substituted for built area. A future conversion requires a separately
versioned rule.

`sale_price_amount`, sale-price-per-square-meter, gross yield, sale-to-rent
ratio, ranking, and all derived sale values are prohibited from this input.

### Rental Observation

Each potential comparable must contain:

```ts
type RentalObservation = {
  observation_id: string;
  source_name: string;
  source_listing_id: string;
  canonical_url: string | null;
  resolved_property_id: string | null;
  normalized_address_key: string | null;
  country_code: "CO";
  city_id: string;
  area_id: string | null;
  property_type: RentModelSubject["property_type"];
  built_area_sqm: Decimal;
  social_stratum: 1 | 2 | 3 | 4 | 5 | 6 | null;
  monthly_asking_rent_cop: bigint;
  rent_composition: "base_excluding_variable_fees" | "bundled_parking";
  observed_at: string; // ISO-8601 UTC
  provenance: SourceProvenance;
  value_basis: "observed";
};
```

An observation is invalid when rent or built area is non-positive, the currency
is not COP, required provenance or date is absent, the geography or property
type is unsupported, or variable fees are known to be inseparable from the
listed rent. `value_basis: "modeled"` is never eligible rental evidence.

### Provenance And Snapshot

```ts
type SourceProvenance = {
  source_name: string;
  source_url: string | null;
  collected_at: string;
  extraction_version: string;
};

type RentalEvidenceSnapshot = {
  snapshot_id: string;
  snapshot_version: string;
  as_of_date: string;
  normalized_observations: RentalObservation[];
  benchmarks: RentBenchmark[];
};
```

Snapshots are immutable. A model run uses an explicit snapshot, never a mutable
“latest” query. Raw crawler captures belong in data storage and are referenced
through provenance; they are not required in the model process.

## Rent Assessment Output

`RentAssessment` is a discriminated union. A consumer must not infer semantics
from missing fields.

```ts
type RentAssessment =
  | ObservedRentAssessment
  | ModeledComparableAssessment
  | ModeledBenchmarkAssessment
  | ObservedWithModelContextAssessment
  | InsufficientDataAssessment;
```

Every modeled assessment includes:

- positive `monthly_rent_amount_cop`;
- `monthly_rent_range_cop` with `lower_amount <= point <= upper_amount`;
- `evidence_level` and ordered machine-readable reason codes;
- snapshot ID, model ID/version, and matching/freshness/range/rounding
  configuration versions;
- `as_of_date` and an injected UTC `generated_at` timestamp.

### Assessment Variants

```ts
type ObservedRentAssessment = {
  kind: "observed";
  monthly_rent_amount_cop: bigint;
  observed_at: string;
  provenance: SourceProvenance;
};

type ModeledComparableAssessment = ModelMetadata & {
  kind: "modeled_comparable";
  monthly_rent_amount_cop: bigint;
  monthly_rent_range_cop: MoneyRange;
  evidence_level: EvidenceLevel;
  reason_codes: ReasonCode[];
  matching_tier: MatchingTier;
  comparable_ids: string[];
  exclusion_summary: ExclusionSummary;
};

type ModeledBenchmarkAssessment = ModelMetadata & {
  kind: "modeled_benchmark";
  monthly_rent_amount_cop: bigint;
  monthly_rent_range_cop: MoneyRange;
  evidence_level: "low";
  reason_codes: ReasonCode[];
  fallback_tier: BenchmarkTier;
  benchmark: BenchmarkReference;
  exclusion_summary: ExclusionSummary;
};

type ObservedWithModelContextAssessment = {
  kind: "observed_with_model_context";
  observed: ObservedRentAssessment;
  modeled_context: ModeledComparableAssessment | ModeledBenchmarkAssessment;
};

type InsufficientDataAssessment = {
  kind: "insufficient_data";
  snapshot_id: string;
  as_of_date: string;
  reason_codes: ReasonCode[];
  exclusion_summary: ExclusionSummary;
};
```

For an observed subject rent, the observed amount remains primary. A caller may
request model context, but the modeled result must not overwrite the source
fact. An insufficient-data assessment contains no numeric modeled rent or
range.

## Sale-Price Independence

The model must not read, accept, or derive a value from:

- sale price or sale-price-per-square-meter;
- gross rent yield or sale-to-rent ratio;
- investor ranking, financing, or underwriting;
- any model feature calculated from the items above.

This rule applies to validation, deduplication, comparable selection, matching,
estimation, range calculation, evidence classification, and benchmark fallback.
Changing, adding, removing, or corrupting sale-price data must not change any
Rent Assessment field.

## Evidence Eligibility, Identity, And Freshness

An observation is eligible only when it is a valid rental observation; shares
the subject’s `country_code`, `city_id`, and exact property type; has
`observed_at <= as_of_date`; and is no more than **180 calendar days** old.
The 180-day boundary is inclusive.

The model excludes the subject itself and duplicates before matching. Identity
is resolved in this precedence order:

1. matching non-null `resolved_property_id`;
2. matching `(source_name, source_listing_id)`;
3. matching non-null `canonical_url`;
4. matching non-null `normalized_address_key` only when city, area, property
   type, and built area are also equal.

V1 does not use fuzzy address, coordinate, or title matching. If identity is
ambiguous, records remain separate and receive `identity_ambiguous`; they do
not become a forced deduplication match.

For a resolved duplicate identity, retain the newest eligible observation. If
dates tie, retain the lexicographically smallest `observation_id`. The same
rules identify and exclude a subject’s separate rental listing.

Evidence at most 90 days old is `recent`; 91–180 days is
`historical_eligible`. Freshness changes reason codes and evidence level,
never comparable rent values in V1.

## Comparable Matching

Property type compatibility is exact in V1:

```text
apartment -> apartment
house -> house
studio -> studio
other_residential -> other_residential
```

The model evaluates tiers in this order and selects the first with at least
three unique eligible observations. Tiers are never pooled.

| Tier | Geography | Stratum | Inclusive built-area window |
| --- | --- | --- | --- |
| `area_stratum_15` | same non-null `area_id` | both known and equal | ±15% |
| `area_relaxed_15` | same non-null `area_id` | ignored | ±15% |
| `city_stratum_15` | same city | both known and equal | ±15% |
| `city_relaxed_15` | same city | ignored | ±15% |
| `area_stratum_25` | same non-null `area_id` | both known and equal | ±25% |
| `area_relaxed_25` | same non-null `area_id` | ignored | ±25% |
| `city_stratum_25` | same city | both known and equal | ±25% |
| `city_relaxed_25` | same city | ignored | ±25% |

For a subject area `A_s` and comparable area `A_i`, a window `w` qualifies
when:

```text
abs(A_i - A_s) <= w * A_s
```

Missing stratum never matches a stratum tier and is permitted only in a relaxed
tier. Bedrooms, bathrooms, furnishing, parking, floor, building age, and
amenities have no numerical coefficient and do not alter eligibility in V1.

## Estimation Mathematics

For each selected comparable:

```text
rent_per_sqm_i = monthly_asking_rent_cop_i / built_area_sqm_i
adjusted_rent_i = rent_per_sqm_i * subject_built_area_sqm
```

Use decimal arithmetic for all intermediate values. Sort adjusted values by
numeric amount ascending, then `observation_id` ascending.

The point estimate is the ordinary unweighted median:

- odd `n`: the middle sorted value;
- even `n`: the arithmetic mean of the two middle values.

V1 performs no statistical outlier removal. It only excludes records under the
documented eligibility and identity rules.

The comparable range is calculated after all exclusions:

| Comparable count | Lower bound | Upper bound |
| ---: | --- | --- |
| 3–4 | minimum | maximum |
| 5–7 | P20 | P80 |
| 8+ | P25 | P75 |

Percentiles use the nearest-rank rule. For percentile `p` and `n` sorted
values, select one-based index `ceil(p * n)`.

Publish COP values in units of COP 1,000:

- point: round half-up to the nearest COP 1,000;
- lower bound: floor to COP 1,000;
- upper bound: ceiling to COP 1,000.

The published range must contain the published point. If rounding would violate
that invariant, widen the relevant bound to the point.

## Evidence Levels And Reason Codes

Evidence levels are descriptive, never probabilistic:

- `high`: at least eight comparables from `area_stratum_15`, all recent.
- `medium`: at least five comparables from any ±15% comparable tier and not
  qualifying for `high`.
- `low`: all other comparable estimates, any ±25% tier, or a benchmark result.

Every modeled result includes applicable reason codes in this canonical order:

```text
selected_matching_tier
comparable_count
stratum_relaxed
size_window_expanded
historical_evidence
wide_comparable_range
benchmark_fallback
```

Additional exclusion codes include:

```text
missing_required_field
invalid_rent_amount
invalid_built_area
unsupported_currency
variable_fees_unseparated
unsupported_property_type
unresolved_geography
future_observation
stale_observation
modeled_rent_not_evidence
subject_match
duplicate_observation
identity_ambiguous
```

## Benchmark Fallback

When no comparable tier reaches three observations, resolve one eligible
benchmark in this order:

1. area + property-type benchmark, minimum sample size 8;
2. citywide + property-type benchmark, minimum sample size 5;
3. citywide generic apartment benchmark, minimum sample size 3 and only for an
   `apartment` subject;
4. insufficient data.

An eligible benchmark requires COP denomination, dated vintage, source
provenance, documented sample count, either `rent_per_sqm` or a direct monthly
rent basis, and a configured lower and upper uncertainty band. It must expose a
benchmark ID and configuration version. The model applies the benchmark to the
subject built area when the basis is rent-per-square-meter. Benchmark results
always have `low` evidence.

## Reproducibility And Auditability

The model receives `snapshot_id`, `as_of_date`, model/configuration versions,
and `generated_at` as explicit inputs. `generated_at` is injected by the
caller or snapshot process; the model never reads the system clock.

With identical inputs, including injected generation time, output must be
semantically byte-equivalent. Result order must not depend on database,
filesystem, provider, or asynchronous ordering.

## Required Workflow Tools

The final implementation consists of separately testable modules:

1. listing normalizer;
2. immutable rental-evidence snapshot repository;
3. identity and deduplication resolver;
4. comparable selector;
5. deterministic rent estimator;
6. range and evidence classifier;
7. benchmark resolver;
8. snapshot/configuration registry;
9. validation and regression harness.

The current `apps/rent-model` workbench is the initial development surface for
these modules. Crawlers and the data lake later satisfy its contracts; they do
not run inside the Rent Model.

## Verification And Success Criteria

Implementation follows RED → GREEN → REFACTOR. The final product is complete
when it is a standalone, pure, fixture-backed TypeScript library and CLI that
accepts a frozen normalized subject and rental-evidence snapshot, then returns
a deterministic, auditable Rent Assessment or `insufficient_data`.

The following are mandatory success criteria:

- Same subject, snapshot, configuration, as-of date, and injected timestamp
  produce an equivalent output across repeated runs and input permutations.
- Changing any sale-price data does not change a Rent Assessment.
- A comparable result uses at least three unique eligible rental observations
  from exactly one tier.
- Subject, duplicate, stale, invalid, and modeled rental records cannot affect
  a result.
- Every modeled result includes point estimate, range, evidence level, reason
  codes, snapshot/model/configuration metadata, and evidence traceability.
- Every published modeled value is positive COP and satisfies
  `lower_amount <= point_amount <= upper_amount`.
- Every benchmark result names a dated benchmark, its provenance, sample
  threshold, and uncertainty-band configuration.
- Missing or invalid evidence yields a typed exclusion or `insufficient_data`,
  never a silent estimate.
- Frozen, provenance-labeled fixtures cover exact three-comparable eligibility,
  every tier boundary, duplicate and subject exclusion, stale/future dates,
  modeled-rent rejection, percentile counts, benchmarks, insufficient data,
  equal-value ties, input permutations, and sale-price independence.

## Non-Goals

Version one excludes:

- live crawling, production data-lake adapters, or database deployment;
- fuzzy cross-source entity resolution;
- rent adjustments for bedrooms, bathrooms, amenities, condition, age, or
  furnishing;
- ML training, online fitting, calibration to lease outcomes, or probability
  claims;
- APIs, frontend rendering, map/chart ranking, yield calculation, and
  underwriting.
